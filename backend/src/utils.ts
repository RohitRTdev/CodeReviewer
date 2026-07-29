import jwt from "jsonwebtoken";

const host = process.env.DOMAIN;
if (!host) {
  throw new Error("DOMAIN is not set!");
}

export type UserDetails = {
  isValid: boolean,
  name?: string,
  id?: string
};

export type RepoDetails = {
    id: string,
    name: string
};

export function getUserDetails(token: string | undefined) : UserDetails {
  if (!token) {
      return { isValid: false };
  }
  
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set!");
  }

  try {
    const payload = jwt.verify(token, secret) as { userId: string, name: string };
    console.log(`Session for ${payload.name} is active!`);

    return { name: payload.name, id: payload.userId, isValid: true };
  }
  catch {
    console.log("Not a valid session");
    return { isValid: false };
  }
}

export async function removeWebhook(access_token: string, owner: string, repoName: string, hookId: string) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repoName}/hooks/${hookId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to delete webhook: ${await res.text()}`);
  }
}

export async function registerWebhook(access_token: string, owner: string, repoName: string, secret: string) : Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/hooks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access_token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "web",
      active: true,
      events: [
        "pull_request"
      ],
      config: {
        url: `${host}/api/webhook`,
        content_type: "json",
        secret: `${secret}`,
        insecure_ssl: "0"
      }
    })
  });

  if (!res.ok) {
    console.log(await res.status);
    console.log(await res.text());
    throw new Error("Webhook registration failed!");
  }

  const webhook = await res.json() as { id: number };
  return webhook.id.toString();
}