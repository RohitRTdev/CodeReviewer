import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import authRouter from './auth.js';
import userRouter from './user.js';

const app = express();
const port = 8000;

app.use(express.json());
app.use(cookieParser());

app.use("/api", authRouter);
app.use("/api", userRouter);

app.listen(port, () => {
  console.log(`Reviewer listening on ${port}`)
});
