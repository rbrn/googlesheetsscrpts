import express from "express";
import routes from "./routes/index.js";
import { connectMongo } from "./db.js";

const app = express();
app.use(express.json());
app.use("/api", routes);
app.get("/health", (_: express.Request, res: express.Response) =>
  res.json({ ok: true, version: process.env.npm_package_version })
);

connectMongo().then(() => {
  const port = process.env.PORT || 8080;
  app.listen(port, () => console.log(`API up on port ${port}`));
});
