import express from "express";
import path from "node:path";

const app = express();
const port = 3000;

app.get("/api/hello", (req, res) => {
  res.send("Hello there!");
})


app.listen(port, () => {
  console.log(`Reviewer listening on ${port}`)
})

app.use(express.static(path.join(process.cwd(), "../frontend/dist")));

