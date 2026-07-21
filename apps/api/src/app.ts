import "dotenv/config";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import path from "node:path";
import { uploadDir } from "./lib/upload.js";
import { corsOptions } from "./lib/cors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import apiRouter from "./routes/index.js";

const app = express();

// Behind a reverse proxy (Fly.io) the client IP arrives in X-Forwarded-For.
// Trust exactly one proxy hop so req.ip is correct and express-rate-limit can
// identify clients. Fly runs a single proxy, hence 1 (not `true`, which is
// permissive and lets clients spoof the header). Override via TRUST_PROXY.
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));

app.use(cors(corsOptions));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.resolve(uploadDir)));

app.use("/api", apiLimiter, apiRouter);

app.use(errorHandler);

export default app;
