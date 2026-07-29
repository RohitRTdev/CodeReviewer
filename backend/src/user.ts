import { Router } from "express";
import { getUserDetails, type RepoDetails } from './utils.js';
import { getRepoDetails, getAccessToken, registerAllRepos } from './db.js';

const router = Router();

router.get("/getUser", (req, res) => {
    const token = req.cookies?.jwt;
    
    const result = getUserDetails(token);
    if (result.isValid) {
        res.send(result.name);
    }    
    else {
        res.sendStatus(404);
    }
});


router.get("/savedRepos", async (req, res) => {
    const token = req.cookies?.jwt;

    try {
        const result = await getRepoDetails(token);
        return res.status(200).json(result);
    }
    catch (err) {
        return res.sendStatus(401);
    }
});

router.get("/getRepos", async (req, res) => {
    const token = req.cookies?.jwt;
    try {
        const access_token = await getAccessToken(token);

        const response = await fetch("https://api.github.com/user/repos?per_page=10&page=1", {
            headers: {
                Authorization: `Bearer ${access_token}`,
                Accept: "application/vnd.github+json",
                "X-Github-Api-Version": "2022-11-28" 
            }
        });

        if (!response.ok) {
            throw new Error("Github repo fetch request failed!");
        }

        const repos = (await response.json()).map((repo: any) => ({
            id: repo.id.toString(),
            name: repo.name
        })) as RepoDetails[];

        console.log(`Fetched ${repos.length} repos from user`);

        return res.json(repos);
    }
    catch (err) {
        console.log(err);
        return res.sendStatus(401);
    }
});

router.post("/setRepos", async (req, res) => {
    const token = req.cookies?.jwt;
    const user = getUserDetails(token);
    if (!user.isValid) {
        return res.sendStatus(401);
    }

    try {
        const access_token = await getAccessToken(token);
        const repos = req.body as RepoDetails[];
        await registerAllRepos(user.id!, user.name!, access_token, repos);

        res.sendStatus(200);
    }
    catch (err) {
        console.log(err);
        res.sendStatus(500);
    }
});


export default router;
