import "dotenv/config";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import path from "node:path";
import { uploadDir } from "./lib/upload.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import apiRouter from "./routes/index.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.resolve(uploadDir)));

app.use("/api", apiLimiter, apiRouter);

app.use(errorHandler);

export default app;
