import "dotenv/config";
import "express-async-errors";
import express, { type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import swaggerUi from "swagger-ui-express";
import { logger } from "./lib/logger.js";
import { swaggerSpec } from "./config/swagger.js";
import {
  handleCheck,
  handleDownload,
  handleFile,
  handleRodin,
} from "./controllers/rodin.controller.js";
import userRouter from "./controllers/user.controller.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Logger
app.use(pinoHttp({ logger }));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

import { validate } from "./middlewares/validate.middleware.js";
import { IdSchema, RodinSchema } from "./schemas/rodin.schema.js";

// Rodin Routes
app.get("/file", validate(IdSchema), handleFile);
app.get("/download", validate(IdSchema), handleDownload);
app.get("/check", validate(IdSchema), handleCheck);
app.get("/rodin", validate(RodinSchema), handleRodin);

// User Routes (RESTful CRUD)
app.use("/api/users", userRouter);

// Swagger Documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Error Handling Middleware
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});
