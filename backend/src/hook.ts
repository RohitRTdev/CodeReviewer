import { getAccessTokenFromRepoId } from "./db.js";

type Job = {
    repoId: number,
    pullNum: number,
    owner: string,
    repoName: string,
    headCommitSha: string
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

async function executeWorker(repoId: number, owner: string, repo: string, pull: number, headCommitSha: string) {
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
        const files = new Map<string, string>();
        
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
            const fileContentsUtf = Buffer.from(fileContents.content, "base64").toString("utf-8");
            files.set(fileDesc.filename, fileContentsUtf);

            if (fileDesc.patch) {
                console.log(`==== Diff for file: ${fileDesc.filename}\n${fileDesc.patch}`)
            }
            else {
                console.log(`===== No diff for file ${fileDesc.filename}`);
            }
            console.log(`==== Contents for file ====\n${fileContentsUtf}`);
        }
    }
    catch (err) {
        console.log(`Error during worker execution: ${err}`);
    }
}

async function workerLoop() {
    console.log("Started worker thread");
    while(true) {
        const job = await jobQueue.pop();
        console.log(`Executing job with owner: ${job.owner}, repo: ${job.repoName} and pull: ${job.pullNum}`);
        await executeWorker(job.repoId, job.owner, job.repoName, job.pullNum, job.headCommitSha);
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
                repoId: reqObj.repository.id,
                headCommitSha: reqObj.pull_request.head.sha
            });    
    }
}