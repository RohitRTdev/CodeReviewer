import { Router } from "express";
import { getUserDetails } from './utils.js';
import { getRepoDetails, getAccessToken } from './db.js';

type RepoDetails = {
    id: number,
    name: string
};

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
        return res.json(result);
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
            id: repo.id,
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

export default router;
