import { GoogleGenAI } from "@google/genai";
import { getAccessTokenFromRepoId } from "./db.js";

const MAX_RETRIES = 5;
const geminiKey = process.env.GEMINI_API_KEY;
if (!geminiKey) {
    throw new Error("GEMINI_API_KEY is not set!");
}

const AI = new GoogleGenAI({
    apiKey: geminiKey 
});

type Job = {
    repoId: string,
    pullNum: number,
    owner: string,
    repoName: string,
    headCommitSha: string,
    retries: number
}

type FilePatch = {
    sha: string,
    filename: string,
    patch?: string | null
}

class JobQueue {
    private queue: Job[] = [];
    private waiting: (() => void)[] = [];

    async pop(): Promise<Job> {
        while (this.queue.length === 0) {
            await new Promise<void>(resolve => {
                this.waiting.push(resolve);
            });
        }

        return this.queue.shift()!;
    }

    push(job: Job) {
        this.queue.push(job);

        if (this.waiting.length > 0) {
            this.waiting.shift()!();
        }
    }
}

export type WebHook = {
    action: string,
    number: number,
    pull_request: {
        id: number,
        html_url: string,
        head: {
            sha: string
        }
    },
    repository: {
        id: number,
        name: string,
        owner: {
            login: string,
            id: number
        }
    }
};

const jobQueue = new JobQueue();

async function executeWorker(repoId: string, owner: string, repo: string, pull: number, headCommitSha: string, retries: number) {
    try {
        const accessToken = await getAccessTokenFromRepoId(repoId);
        const res = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/pulls/${pull}/files`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28"
                }
            }
        );

        if (!res.ok) {
            throw new Error("Github pull request diff fetch failed!");
        }

        const changedFiles = await res.json() as FilePatch[];
        const systemPrompt = `You are a senior software engineer reviewing a PR. Check for bugs, clean code practices 
        and optimization improvements. You will be given the diff on a file followed by the actual contents of the file 
        at the new commit. This will be done for every file. Some files may not have a diff. 
        Always submit your response comments in following format....
        {
            "event": "COMMENT",
            "body": "AI review or whatever you want to put here",
            "comments": [
                {
                "path": "src/main.ts",
                "line": 42,
                "side": "RIGHT",
                "body": "Consider checking for null before accessing this value."
                },
                {
                "path": "src/utils.ts",
                "line": 15,
                "side": "RIGHT",
                "body": "This function can be simplified using Array.map()."
                },
                ...
            ]
        }
        
        The tool will be taking this response and directly sending as body to github pr review endpoint, so always stick to this format
        `;

        let userContent = "==== Start of contents ====\n";
        
        for (const fileDesc of changedFiles) {
            const path = fileDesc.filename
                .split("/")
                .map(encodeURIComponent)
                .join("/");

            const fileResp = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${headCommitSha}`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        Accept: "application/vnd.github+json"
                    }
                }
            ); 

            if (!fileResp.ok) {
                throw new Error(`Failed to fetch file contents for ${fileDesc.filename} from github`);
            }

            const fileContents = await fileResp.json() as { content: string };
            const fileContentsBin = Buffer.from(fileContents.content, "base64"); 

            if (fileDesc.patch) {
                userContent += `==== Diff for file: ${fileDesc.filename}\n${fileDesc.patch}\n`;
            }
            else {
                userContent += `===== No diff for file ${fileDesc.filename}\n`;
            }

            if (fileContentsBin.includes(0)) {
                // Possibly a binary file
                userContent += "==== Contents for file skipped since its suspected to be non-utf8 ====\n";
            }
            else {
                const fileContentsUtf8 = fileContentsBin.toString("utf-8");
                userContent += `==== Contents for file ====\n${fileContentsUtf8}\n`;
            }
        }

        if (retries > 0) {
            userContent += `The request for this same diff has been now sent ${retries+1} times. Last time, 
            JSON.parse failed since you didn't return correct json format as I mentioned above...\n`;
        }

        const response = await AI.models.generateContent({
            model: "gemini-3.6-flash",
            config: {
                systemInstruction: systemPrompt,
            },
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            text: userContent,
                        },
                    ],
                },
            ],
        });

        if (response.text) {
            // Just to verify that this is indeed proper json
            // However this is not necessarily enough to verify if its in correct format for github
            try {
                JSON.parse(response.text);
                const reviewResponse = await fetch(
                    `https://api.github.com/repos/${owner}/${repo}/pulls/${pull}/reviews`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: `Bearer ${accessToken}`,
                            Accept: "application/vnd.github+json",
                            "X-GitHub-Api-Version": "2022-11-28",
                            "Content-Type": "application/json",
                        },
                        body: response.text
                    }
                ); 
                
                if (!reviewResponse.ok) {
                    const error = await reviewResponse.text();
                    throw new Error(`Failed to post review comments for PR: ${error}`);
                }
                console.log("Completed job");
            }
            catch (err) {
                if (err instanceof SyntaxError) {
                    if (retries < MAX_RETRIES) {
                        console.log("Retrying job => Pushing back to job queue");
                        jobQueue.push({
                            owner,
                            repoId,
                            headCommitSha,
                            repoName: repo,
                            pullNum: pull,
                            retries: retries + 1
                        });
                    }
                    else {
                        console.log("Job failed max retries. Discarding...");
                    }
                }
            }
        }
        else {
            console.log("No response send back for this PR");
        }
    }
    catch (err) {
        console.log(`Error during worker execution: ${err}`);
    }
}

async function workerLoop() {
    console.log("Started worker thread");
    while(true) {
        console.log("Waiting for new jobs");
        const job = await jobQueue.pop();
        console.log(`Executing job with owner: ${job.owner}, repo: ${job.repoName} and pull: ${job.pullNum}`);
        executeWorker(job.repoId, job.owner, job.repoName, job.pullNum, job.headCommitSha, job.retries);
    }
}

workerLoop();

export function submitWebhook(reqObj: WebHook) {
    switch (reqObj.action) {
        case "opened":
        case "synchronize":
        case "reopened": 
            jobQueue.push({
                owner: reqObj.repository.owner.login,
                pullNum: reqObj.number,
                repoName: reqObj.repository.name,
                repoId: reqObj.repository.id.toString(),
                headCommitSha: reqObj.pull_request.head.sha,
                retries: 0
            });    
    }
}