import express from "express";
import path from "node:path";

const app = express();
const port = 8000;

app.get("/api/hello", (req, res) => {
  console.log("Called api endpoint");
  res.send("Hello there!");
})


app.listen(port, () => {
  console.log(`Reviewer listening on ${port}`)
})
