export type RepoDetails = {
  id: string,
  name: string
};

export default async function checkSession() : Promise<boolean> {
    const res = await fetch("/api/isSessionValid");
    return res.ok;
}

export async function getUser() : Promise<string> {
    const res = await fetch("/api/getUser");
    if (!res.ok) {
        console.error("getUser api endpoint response failed!");
        return "user";
    }

    return await res.text();
}

export async function getRepos() : Promise<RepoDetails[]> {
    const res = await fetch("/api/savedRepos");
    if (!res.ok) {
        console.error("savedRepos api endpoint response failed!");
        return [];
    }

    return res.json() as Promise<RepoDetails[]>;
}

export async function getUserRepos() : Promise<RepoDetails[]> {
    const res = await fetch("/api/getRepos");
    if (!res.ok) {
        console.error("getRepos api endpoint response failed!");
        return [];
    }

    return res.json() as Promise<RepoDetails[]>;
}

export async function setRepos(repos: RepoDetails[]) : Promise<boolean> {
    const res = await fetch("/api/setRepos", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(repos)
    });

    if (!res.ok) {
        console.error("Set repo post request failed!");
        return false;
    }

    return true;
}