import getenv from "getenv";
import type { Config } from "./types.js";

const config: Config = {
  apiUrl: getenv.string("API_URL"),
  rodin: {
    apiKey: getenv.string("RODIN_API_KEY"),
  },
  cos: {
    secret: {
      id: getenv.string("COS_SECRET_ID"),
      key: getenv.string("COS_SECRET_KEY"),
    },
    bucket: getenv.string("COS_BUCKET"),
    region: getenv.string("COS_REGION"),
  },
};

export default config;
