import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { Router } from "express";
import { getUserDetails } from './utils.js';
import { setupUser } from './db.js';

const router = Router();

function isSessionActive(token: string | undefined) : boolean {
    return getUserDetails(token).isValid; 
}

router.get("/isSessionValid", (req, res) => {
  console.log("Checking session validity");
  let token = req.cookies?.jwt;
  if (isSessionActive(token)) {
    res.sendStatus(200);
  }
  else {
    res.sendStatus(401);
  }
});

router.get("/login", async (req, res) => {
  const jwtToken = req.cookies?.jwt;
  if (isSessionActive(jwtToken)) {
    return res.redirect("/");
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_REDIRECT_URI;
  console.log(`redirect_uri=${redirectUri}`);

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET/GITHUB_REDIRECT_URI is not set!");
  }

  const oauthState = req.cookies?.oauth;
  if (oauthState) {
    const code = req.query.code;
    const state = req.query.state;
    res.clearCookie("oauth");

    if (!code || !state) {
      console.log("User cancelled request!");
      return res.redirect("/");
    }

    // Check if github really sent us this request
    console.log(`Received code:${code} and state:${state}`);
    if (state !== oauthState) {
      console.log(`Github state doesn't match stored state -> ${oauthState}`);
      return res.redirect("/");
    }

    try {
      // Fetch the access token next
      const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
        }),
      });

      if (!response.ok) {
        console.log("Github post request unauthorized failure");
        return res.redirect("/");
      }

      const result = await response.json() as { access_token: string };
      console.log(`Fetch access token: ${result.access_token}`);
      
      // Get user details from github
      const userResp = await fetch("https://api.github.com/user", {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${result.access_token}`,
            "Accept": "application/vnd.github+json",
        },
      }); 

      if (!userResp.ok) {
        console.log("Github fetch user details request failed!");
        return res.redirect("/");
      }

      const user = await userResp.json() as { login: string, id: number };
      console.log(`Found user name: ${user.login}`);

      const userId = await setupUser(user.login, result.access_token, user.id);
      
      const secret = process.env.JWT_SECRET!;
      const token = jwt.sign({
        userId: userId,
        name: user.login
      },
      secret
      );

      res.cookie("jwt", token, {
        sameSite: "strict",
        httpOnly: true
      });

      return res.redirect("/");
    }
    catch(err) {
      console.log("Github auth flow failed!");
      return res.redirect("/");
    }
  }
  else {
    // Redirect user to github authentication page
    console.log("Starting OAuth flow");
    const state = crypto.randomBytes(32).toString("hex");
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "repo",
      state
    }); 

    const url = "https://github.com/login/oauth/authorize?" +
    params.toString();

    res.cookie("oauth", state, {
      sameSite: "lax",
      httpOnly: true
    });

    return res.redirect(url);
  }
});

router.get("/logout", (req, res) => {
  res.clearCookie("jwt");
  res.clearCookie("oauth");
  res.redirect("/");
});


export default router;