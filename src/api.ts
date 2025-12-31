import axios, { type AxiosResponse } from "axios";
import FormData from "form-data";
import { PassThrough } from "stream";
import config from "./config.js";
import type {
  ImageData,
  RodinDownloadResponse,
  RodinCheckResponse,
  RodinGenerationResponse,
} from "./types.js";

const RODIN_API_BASE = "https://hyperhuman.deemos.com/api/v2";

const getAuthHeaders = () => ({
  Authorization: `Bearer ${config.rodin.apiKey}`,
});

/**
 * 下载已完成的 Rodin 任务结果
 */
export const download = async (
  uuid: string,
): Promise<AxiosResponse<RodinDownloadResponse>> => {
  const response = await axios.post<RodinDownloadResponse>(
    `${RODIN_API_BASE}/download`,
    { task_uuid: uuid },
    {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    },
  );
  return response;
};

/**
 * 检查 Rodin 任务状态
 */
export const check = async (
  key: string,
): Promise<AxiosResponse<RodinCheckResponse>> => {
  const response = await axios.post<RodinCheckResponse>(
    `${RODIN_API_BASE}/status`,
    { subscription_key: key },
    {
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders(),
      },
    },
  );
  return response;
};

/**
 * 调用 Rodin API 生成 3D 模型
 */
export const rodin = async (
  images: ImageData[],
  prompt?: string,
  quality?: string,
): Promise<AxiosResponse<RodinGenerationResponse>> => {
  if ((!images || images.length === 0) && !prompt) {
    throw new Error("Images or prompt is required");
  }

  const formData = new FormData();

  images.forEach((image) => {
    const stream = new PassThrough();
    stream.end(image.data);
    formData.append("images", stream, image.meta);
  });

  if (quality) {
    formData.append("quality", quality);
  }

  if (prompt) {
    formData.append("prompt", prompt);
  }

  const response = await axios.post<RodinGenerationResponse>(
    `${RODIN_API_BASE}/rodin`,
    formData,
    {
      headers: {
        ...formData.getHeaders(),
        ...getAuthHeaders(),
      },
    },
  );

  return response;
};

export default {
  download,
  check,
  rodin,
};
