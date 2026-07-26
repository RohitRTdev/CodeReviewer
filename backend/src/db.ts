import { Pool } from "pg";
import { getUserDetails } from './utils.js';

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

export async function getRepoDetails(token?: string) : Promise<string[]> {
    const result = getUserDetails(token);
    if (!result.isValid) {
        console.log("getRepoDetails authentication failed!");
        throw new Error("Auth failed!");
    }

    const resDb = await pool.query<{name: string}>(
        `SELECT name FROM repo
        where user_id = $1`,
        [result.id!]
    );

    if (resDb.rowCount === null || resDb.rowCount === 0) {
        return [];
    }

    console.log(`Found ${resDb.rows.length} saved repos`);
    
    return resDb.rows.map(row => row.name);
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

