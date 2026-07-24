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