import crypto from "crypto";
import { Pool } from "pg";
import { getUserDetails, registerWebhook, removeWebhook, type RepoDetails } from './utils.js';

const dbUser = process.env.DB_USER;
const dbName = process.env.DB_NAME;
const dbPass = process.env.DB_PASSWORD;

if (!dbUser || !dbName || !dbPass) {
    throw new Error("DB_USER/DB_NAME/DB_PASSWORD is not set!");
}

const pool = new Pool({
    host: "postgres",
    port: 5432,
    user: dbUser,
    password: dbPass,
    database: dbName 
});

export async function setupUser(name: string, access_token: string, github_id: number) : Promise<number> {
    const res = await pool.query(
        `INSERT INTO users (name, token, github_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (github_id)
        DO UPDATE
        SET token = EXCLUDED.token
        RETURNING id`,
        [name, access_token, github_id]
    );

    if (res.rowCount === null || res.rowCount !== 1) {
        throw new Error("SQL insert failed!");
    } 
    
    const user = res.rows[0] as { id: number };
    console.log(`User: ${name} with id: ${user.id} registered`);

    return user.id;
}

export async function getRepoDetails(token?: string) : Promise<RepoDetails[]> {
    const result = getUserDetails(token);
    if (!result.isValid) {
        console.log("getRepoDetails authentication failed!");
        throw new Error("Auth failed!");
    }

    const resDb = await pool.query<{github_repo_id: number, name: string}>(
        `SELECT github_repo_id, name FROM repo
        where user_id = $1`,
        [result.id!]
    );

    if (resDb.rowCount === null || resDb.rowCount === 0) {
        return [];
    }

    console.log(`Found ${resDb.rows.length} saved repos`);
    
    return resDb.rows.map(row => ({ id: row.github_repo_id, name: row.name }));
}

export async function getAccessToken(token?: string) : Promise<string> {
    const result = getUserDetails(token);
    if (!result.isValid) {
        console.log("getAccessToken authentication failed!");
        throw new Error("Auth failed!");
    }

    const resDb = await pool.query<{token: string}>(
        `SELECT token FROM users
        where id = $1`,
        [result.id!]
    );

    const access_token = resDb.rows[0]?.token;
    if (!access_token) {
        return "";
    }

    return access_token;
}

export async function registerAllRepos(userId: number, userName: string, access_token: string, repos: RepoDetails[]) {
    const client = await pool.connect();
    const createdHooks: { name: string; hookId: number }[] = [];
    try {
        await client.query("BEGIN");
        await client.query(
            `SELECT pg_advisory_xact_lock($1)`,
            [userId]
        ); 

        // First, get all the repos associated with this user
        const userDbRepos = await client.query<{github_repo_id: number, webhook_id: number, name: string, secret: string}>(
            `SELECT github_repo_id, name, webhook_id, secret FROM repo
            WHERE user_id=$1`,
            [userId]
        );

        const userInfo = new Map<number, {name: string, hookId: number}>();
        for (const row of userDbRepos.rows) {
            userInfo.set(row.github_repo_id, {name: row.name, hookId: row.webhook_id});
        }

        const callerRepoInfo = new Map<number, string>();
        for (const row of repos) {
            callerRepoInfo.set(row.id, row.name);
        }

        // Find which repos need to be registered and which needs to be unregistered
        const userRepos = new Set<number>(userDbRepos.rows.map(row => row.github_repo_id));
        const newRepos = new Set(repos.map(row => row.id));

        const toAdd = newRepos.difference(userRepos);
        const toRemove = userRepos.difference(newRepos);

        console.log(`Unregistering ${toRemove.size} repos`);
        
        // Notify github to remove webhooks from these repos
        for (const repo of toRemove) {
            const info = userInfo.get(repo)!;
            await removeWebhook(access_token, userName, info.name, info.hookId);
        }
        
        await client.query(
            `DELETE FROM repo
            WHERE github_repo_id = ANY($1::bigint[])`,
            [Array.from(toRemove)]
        );

        for (const repo of toAdd) {
            const secret = crypto.randomBytes(32).toString("hex");
            const repoName = callerRepoInfo.get(repo)!;
            const hookId = await registerWebhook(access_token, userName, repoName, secret);
            createdHooks.push({name: repoName, hookId});
            await client.query(
                `INSERT INTO repo 
                (name, secret, github_repo_id, user_id, webhook_id)
                VALUES($1, $2, $3, $4, $5)`,
                [repoName, secret, repo, userId, hookId]
            );
        }
        
        console.log(`Registering ${toAdd.size} repos`);

        await client.query("COMMIT");
    }
    catch (err) {
        await client.query("ROLLBACK");
        for (const repo of createdHooks) {
            await removeWebhook(access_token, userName, repo.name, repo.hookId);
        }
        throw err;
    }
    finally {
        client.release();
    }
}