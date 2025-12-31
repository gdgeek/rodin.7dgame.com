import "dotenv/config";
import { envSchema } from "./config/env.schema.js";
import type { Config } from "./types.js";

const env = envSchema.parse(process.env);

const config: Config = {
  apiUrl: env.API_URL,
  rodin: {
    apiKey: env.RODIN_API_KEY,
  },
  cos: {
    secret: {
      id: env.COS_SECRET_ID,
      key: env.COS_SECRET_KEY,
    },
    bucket: env.COS_BUCKET,
    region: env.COS_REGION,
  },
};

export default config;
