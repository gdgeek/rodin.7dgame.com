import type { Request, Response } from "express";

// 环境变量配置类型
export interface Config {
  apiUrl: string;
  rodin: {
    apiKey: string;
  };
  cos: {
    secret: {
      id: string;
      key: string;
    };
    bucket: string;
    region: string;
  };
}

// Rodin API 响应类型
export interface RodinGenerationResponse {
  uuid: string;
  prompt: string;
  jobs?: {
    subscription_key: string;
  };
}

export interface RodinDownloadItem {
  name: string;
  url: string;
}

export interface RodinDownloadResponse {
  list: RodinDownloadItem[];
}

export interface RodinCheckResponse {
  status: string;
  progress?: number;
}

// 内部 API 响应类型
export interface AiRodinRecord {
  id: number;
  name?: string;
  query?: {
    resource_id?: string | string[];
    prompt?: string;
  };
  generation?: RodinGenerationResponse;
  download?: RodinDownloadResponse;
  check?: RodinCheckResponse;
}

export interface ResourceFile {
  filename: string;
  url: string;
  type: string;
}

export interface ResourceResponse {
  file: ResourceFile;
}

// 图片数据类型
export interface ImageData {
  data: Buffer;
  meta: {
    filename: string;
    contentType: string;
  };
}

// COS 上传参数类型
export interface COSUploadParams {
  Bucket: string;
  Region: string;
  Key: string;
  Body: Buffer;
  ContentLength: number;
}

export interface COSUploadResult {
  Location: string;
  ETag: string;
}

// Express 扩展类型
export type AsyncRequestHandler = (
  req: Request,
  res: Response,
) => Promise<void>;
