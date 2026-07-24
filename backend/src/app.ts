import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRouter from './auth.js';
import userRouter from './user.js';

dotenv.config();

const app = express();
const port = 8000;

app.use(cookieParser());

app.use("/api", authRouter);
app.use("/api", userRouter);

app.listen(port, () => {
  console.log(`Reviewer listening on ${port}`)
});
