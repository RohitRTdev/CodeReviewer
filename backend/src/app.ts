import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import authRouter from './auth.js';
import userRouter from './user.js';
import { submitWebhook, type WebHook } from './hook.js';
import { getRepoSecret } from "./db.js";

const app = express();
const port = 8000;

app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const hookIdStr = req.header("X-Github-Hook-ID");
  const actual = req.header("X-Hub-Signature-256");
  const eventType = req.header("X-Github-Event");
  if (!hookIdStr || !actual || !eventType) {
    return res.sendStatus(400);
  }

  const hookId = Number(hookIdStr);
  if (Number.isNaN(hookId)) {
    return res.sendStatus(400);
  }

  try {
    const secret = await getRepoSecret(hookId);
    // Verify that this request is from github
    const expected = "sha256=" + crypto.createHmac("sha256", secret)
      .update(req.body)
      .digest("hex");

    if (expected !== actual) {
      console.log("Signature mismatch on github webhook request");
      return res.sendStatus(401);
    }

    switch (eventType) {
      case "ping": 
        console.log("Received ping event");
        break;
      case "pull_request": 
        const body = JSON.parse(req.body.toString("utf-8")) as WebHook;
        submitWebhook(body);
        break;
      default:
        console.log(`Request type ${eventType} not handled`);
        return res.sendStatus(400);
    }

    return res.sendStatus(200);
  }
  catch (err) {
    console.log(err);
    return res.sendStatus(401);
  }
});

app.use(express.json());
app.use(cookieParser());

app.use("/api", authRouter);
app.use("/api", userRouter);

app.listen(port, () => {
  console.log(`Reviewer listening on ${port}`)
});
