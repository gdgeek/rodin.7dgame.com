import type { Request, Response } from "express";
import axios from "axios";
import crypto from "crypto";
import config from "../config.js";
import api from "../api.js";
import { uploadToCOS } from "../lib/cos.js";
import { cache } from "../lib/cache.js";
import type { AiRodinRecord, ImageData, ResourceResponse } from "../types.js";

// Helper for API URL
const getApiUrl = (path: string): string => {
  return `http://${config.apiUrl}${path}`;
};

// Helper to get resource
const getResource = async (
  resourceId: string,
  req: Request,
): Promise<ImageData> => {
  const response = await axios.get<ResourceResponse>(
    getApiUrl(`/v1/resources/${resourceId}`),
    { headers: req.headers as Record<string, string> },
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

/**
 * @openapi
 * /file:
 *   get:
 *     summary: Retrieve and upload a generated file to COS
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the Rodin generation task
 *     responses:
 *       200:
 *         description: File successfully processed and uploaded
 *       400:
 *         description: Missing ID parameter
 *       404:
 *         description: File not found
 *       500:
 *         description: Internal server error
 */
export const handleFile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    res.status(400).send("id is required");
    return;
  }

  const response = await axios.get<AiRodinRecord>(
    getApiUrl(`/v1/ai-rodin/${id}`),
    { headers: req.headers as Record<string, string> },
  );

  const downloadData = response.data.download;
  if (!downloadData?.list) {
    throw new Error("No download data found");
  }

  const glbFile = downloadData.list.find((item) => item.name.endsWith(".glb"));

  if (!glbFile) {
    await axios.put(
      getApiUrl(`/v1/ai-rodin/${id}`),
      { download: null },
      { headers: req.headers as Record<string, string> },
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
    { headers: req.headers as Record<string, string> },
  );

  res.status(response3.status).send(response3.data);
};

/**
 * @openapi
 * /download:
 *   get:
 *     summary: Trigger download of generation result
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the Rodin generation task
 *     responses:
 *       200:
 *         description: Download triggered successfully
 *       400:
 *         description: Missing ID parameter
 *       404:
 *         description: Generation UUID not found
 */
export const handleDownload = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    res.status(400).send("id is required");
    return;
  }

  const response = await axios.get<AiRodinRecord>(
    getApiUrl(`/v1/ai-rodin/${id}`),
    { headers: req.headers as Record<string, string> },
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
    { headers: req.headers as Record<string, string> },
  );

  res.status(response3.status).send(response3.data);
};

/**
 * @openapi
 * /check:
 *   get:
 *     summary: Check status of generation task
 *     parameters:
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the Rodin generation task
 *     responses:
 *       200:
 *         description: Status checked successfully
 *       400:
 *         description: Missing ID parameter
 *       404:
 *         description: Subscription key not found
 */
export const handleCheck = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    res.status(400).send("id is required");
    return;
  }

  const cacheKey = `check:${id}`;
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    res.status(200).send(cachedData);
    return;
  }

  const response = await axios.get<AiRodinRecord>(
    getApiUrl(`/v1/ai-rodin/${id}`),
    { headers: req.headers as Record<string, string> },
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
    { headers: req.headers as Record<string, string> },
  );

  // Cache the successful response
  cache.set(cacheKey, response3.data);

  res.status(response.status).send(response3.data);
};

/**
 * @openapi
 * /rodin:
 *   get:
 *     summary: Create or continue a Rodin generation task
 *     parameters:
 *       - in: query
 *         name: prompt
 *         schema:
 *           type: string
 *         description: Text prompt for generation
 *       - in: query
 *         name: resource_id
 *         schema:
 *           type: string
 *         description: Resource ID for image-to-3d
 *       - in: query
 *         name: id
 *         schema:
 *           type: string
 *         description: Existing task ID to resume
 *       - in: query
 *         name: quality
 *         schema:
 *           type: string
 *         description: Generation quality
 *     responses:
 *       200:
 *         description: Task created or updated successfully
 *       400:
 *         description: Missing prompt or resource_id
 */
export const handleRodin = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const { quality } = req.query as { quality?: string };
  let { resource_id, prompt, id } = req.query as {
    resource_id?: string | string[];
    prompt?: string;
    id?: string;
  };

  if (id) {
    const response = await axios.get<AiRodinRecord>(
      getApiUrl(`/v1/ai-rodin/${id}`),
      { headers: req.headers as Record<string, string> },
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
      { headers: req.headers as Record<string, string> },
    );

    id = String(response.data.id);
  }

  let images: ImageData[] = [];

  if (resource_id) {
    if (Array.isArray(resource_id)) {
      images = await Promise.all(
        resource_id.map((rid) => getResource(rid, req)),
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
    { headers: req.headers as Record<string, string> },
  );

  res.status(response3.status).send(response3.data);
};
