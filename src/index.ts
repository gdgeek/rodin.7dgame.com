import express, { type Request, type Response } from "express";
import axios, { type AxiosError } from "axios";
import crypto from "crypto";
import COS from "cos-nodejs-sdk-v5";
import cors from "cors";
import config from "./config.js";
import api from "./api.js";
import type {
  AiRodinRecord,
  COSUploadParams,
  COSUploadResult,
  ImageData,
  ResourceResponse,
} from "./types.js";

const app = express();
const PORT = process.env.PORT || 3000;

const cos = new COS({
  SecretId: config.cos.secret.id,
  SecretKey: config.cos.secret.key,
});

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// COS 上传 Promise 封装
const uploadToCOS = (params: COSUploadParams): Promise<COSUploadResult> => {
  return new Promise((resolve, reject) => {
    cos.putObject(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data as COSUploadResult);
      }
    });
  });
};

// 统一错误处理函数
const handleError = (
  res: Response,
  error: unknown,
  message = "Internal Server Error"
): void => {
  console.error("Error details:", error);
  const axiosError = error as AxiosError;
  const status = axiosError.response?.status || 500;
  res.status(status).send({
    message,
    details: axiosError.response?.data || (error as Error).message,
  });
};

// API 基础 URL
const getApiUrl = (path: string): string => {
  return `http://${config.apiUrl}${path}`;
};

// 健康检查端点
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// 文件处理端点
app.get("/file", async (req: Request, res: Response) => {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    res.status(400).send("id is required");
    return;
  }

  try {
    const response = await axios.get<AiRodinRecord>(
      getApiUrl(`/v1/ai-rodin/${id}`),
      { headers: req.headers as Record<string, string> }
    );

    const downloadData = response.data.download;
    if (!downloadData?.list) {
      throw new Error("No download data found");
    }

    const glbFile = downloadData.list.find((item) =>
      item.name.endsWith(".glb")
    );

    if (!glbFile) {
      await axios.put(
        getApiUrl(`/v1/ai-rodin/${id}`),
        { download: null },
        { headers: req.headers as Record<string, string> }
      );
      throw new Error("No file with .glb extension found");
    }

    const rs = await axios.get<ArrayBuffer>(glbFile.url, {
      responseType: "arraybuffer",
    });

    if (!rs.data) {
      throw new Error("Downloaded data is undefined");
    }

    const hash = crypto.createHash("md5");
    hash.update(Buffer.from(rs.data));
    const md5Hash = hash.digest("hex");

    const key = `/ai/polygen/${md5Hash}.glb`;
    const buffer = Buffer.from(rs.data);

    const cosData = await uploadToCOS({
      Bucket: config.cos.bucket,
      Region: config.cos.region,
      Key: key,
      Body: buffer,
      ContentLength: buffer.length,
    });

    const response3 = await axios.put(
      getApiUrl(`/v1/ai-rodin/file?id=${id}`),
      {
        filename: `${response.data.generation?.prompt || "model"}.glb`,
        url: `https://${cosData.Location}`,
        md5: md5Hash,
        key: key,
      },
      { headers: req.headers as Record<string, string> }
    );

    res.status(response3.status).send(response3.data);
  } catch (error) {
    handleError(res, error);
  }
});

// 下载端点
app.get("/download", async (req: Request, res: Response) => {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    res.status(400).send("id is required");
    return;
  }

  try {
    const response = await axios.get<AiRodinRecord>(
      getApiUrl(`/v1/ai-rodin/${id}`),
      { headers: req.headers as Record<string, string> }
    );

    const generation = response.data.generation;

    if (!generation?.uuid) {
      res.status(404).send("Not Found");
      return;
    }

    const response2 = await api.download(generation.uuid);
    const response3 = await axios.put(
      getApiUrl(`/v1/ai-rodin/${id}`),
      { download: response2.data },
      { headers: req.headers as Record<string, string> }
    );

    res.status(response3.status).send(response3.data);
  } catch (error) {
    handleError(res, error);
  }
});

// 检查状态端点
app.get("/check", async (req: Request, res: Response) => {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    res.status(400).send("id is required");
    return;
  }

  try {
    const response = await axios.get<AiRodinRecord>(
      getApiUrl(`/v1/ai-rodin/${id}`),
      { headers: req.headers as Record<string, string> }
    );

    const generation = response.data.generation;

    if (!generation?.jobs?.subscription_key) {
      res.status(404).send("Not Found");
      return;
    }

    const response2 = await api.check(generation.jobs.subscription_key);
    const response3 = await axios.put(
      getApiUrl(`/v1/ai-rodin/${id}`),
      { check: response2.data },
      { headers: req.headers as Record<string, string> }
    );

    res.status(response.status).send(response3.data);
  } catch (error) {
    handleError(res, error);
  }
});

// 获取资源辅助函数
const getResource = async (
  resourceId: string,
  req: Request
): Promise<ImageData> => {
  const response = await axios.get<ResourceResponse>(
    getApiUrl(`/v1/resources/${resourceId}`),
    { headers: req.headers as Record<string, string> }
  );

  const file = response.data.file;
  const url = file.url.replace(/^http:\/\//, "https://");

  const meta = {
    filename: file.filename,
    contentType: file.type,
  };

  const response2 = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
  });

  if (!response2.data) {
    throw new Error("Downloaded data is undefined");
  }

  return { data: Buffer.from(response2.data), meta };
};

// Rodin 生成端点
app.get("/rodin", async (req: Request, res: Response) => {
  let { resource_id, prompt, id, quality } = req.query as {
    resource_id?: string | string[];
    prompt?: string;
    id?: string;
    quality?: string;
  };

  try {
    if (id) {
      const response = await axios.get<AiRodinRecord>(
        getApiUrl(`/v1/ai-rodin/${id}`),
        { headers: req.headers as Record<string, string> }
      );

      resource_id = response.data.query?.resource_id;
      prompt = response.data.query?.prompt;

      if (!prompt && !resource_id) {
        res.status(400).send("prompt or resource_id is required");
        return;
      }
    } else {
      if (!prompt && !resource_id) {
        res.status(400).send("prompt or resource_id is required");
        return;
      }

      const response = await axios.post<{ id: number }>(
        getApiUrl("/v1/ai-rodin"),
        { query: req.query, name: prompt },
        { headers: req.headers as Record<string, string> }
      );

      id = String(response.data.id);
    }

    let images: ImageData[] = [];

    if (resource_id) {
      if (Array.isArray(resource_id)) {
        images = await Promise.all(
          resource_id.map((rid) => getResource(rid, req))
        );
      } else {
        const data = await getResource(resource_id, req);
        images.push(data);
      }
    }

    const response2 = await api.rodin(images, prompt, quality);
    const response3 = await axios.put(
      getApiUrl(`/v1/ai-rodin/${id}`),
      { generation: response2.data, name: response2.data.prompt },
      { headers: req.headers as Record<string, string> }
    );

    res.status(response3.status).send(response3.data);
  } catch (error) {
    handleError(res, error);
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
