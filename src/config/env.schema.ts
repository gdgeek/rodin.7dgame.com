import { z } from "zod";

export const envSchema = z.object({
  PORT: z.string().default("3000"),
  API_URL: z.string().min(1, "API_URL is required"),
  RODIN_API_KEY: z.string().min(1, "RODIN_API_KEY is required"),
  A1_API_URL: z.string().optional(), // Make optional if not sure, or verify usage
  COS_SECRET_ID: z.string().min(1, "COS_SECRET_ID is required"),
  COS_SECRET_KEY: z.string().min(1, "COS_SECRET_KEY is required"),
  COS_BUCKET: z.string().min(1, "COS_BUCKET is required"),
  COS_REGION: z.string().min(1, "COS_REGION is required"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

export type Env = z.infer<typeof envSchema>;
