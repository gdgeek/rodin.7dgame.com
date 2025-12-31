import { describe, it, expect, vi, beforeEach } from "vitest";
import { type Request, type Response } from "express";
import axios from "axios";
import { handleCheck, handleFile } from "./rodin.controller";
import { cache } from "../lib/cache";
import api from "../api";
import { uploadToCOS } from "../lib/cos";

// Do not mock cache fully, just use real node-cache instance but flush it.
// Mock other dependencies
vi.mock("axios");
vi.mock("../api", () => ({
  default: {
    download: vi.fn(),
    check: vi.fn(),
    rodin: vi.fn(),
  },
}));
vi.mock("../lib/cos", () => ({
  uploadToCOS: vi.fn(),
}));
vi.mock("../config", () => ({
  default: {
    apiUrl: "api.example.com",
    cos: {
      bucket: "test-bucket",
      region: "test-region",
    },
  },
}));

const mockRequest = (query = {}, body = {}, headers = {}) =>
  ({
    query,
    body,
    headers,
  }) as unknown as Request;

const mockResponse = () => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
};

describe("Rodin Controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.flushAll();
  });

  describe("handleCheck", () => {
    it("should return cached data if available", async () => {
      const req = mockRequest({ id: "123" });
      const res = mockResponse();
      cache.set("check:123", { status: "cached" });

      await handleCheck(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ status: "cached" });
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("should fetch data, update cache, and return result if not cached", async () => {
      const req = mockRequest({ id: "123" });
      const res = mockResponse();

      (axios.get as any).mockResolvedValue({
        status: 200,
        data: {
          generation: { jobs: { subscription_key: "sub_123" } },
        },
      });

      (api.check as any).mockResolvedValue({ data: { progress: 100 } });

      (axios.put as any).mockResolvedValue({
        status: 200,
        data: { id: "123", progress: 100 },
      });

      await handleCheck(req, res);

      expect(axios.get).toHaveBeenCalled();
      expect(api.check).toHaveBeenCalledWith("sub_123");
      // Should set cache
      expect(cache.get("check:123")).toEqual({ id: "123", progress: 100 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith({ id: "123", progress: 100 });
    });

    it("should return 400 if id is missing", async () => {
      const req = mockRequest({});
      const res = mockResponse();
      await handleCheck(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith("id is required");
    });
  });

  describe("handleFile", () => {
    it("should upload file to COS and update record", async () => {
      const req = mockRequest({ id: "123" });
      const res = mockResponse();

      // 1. Get Record
      (axios.get as any).mockImplementation((url: string) => {
        if (url.includes("resources")) {
          return Promise.resolve({
            data: {
              file: {
                url: "http://example.com/file.jpg",
                filename: "file.jpg",
                type: "image/jpeg",
              },
            },
          });
        }
        if (url.endsWith(".glb")) {
          return Promise.resolve({
            data: new ArrayBuffer(10),
          });
        }
        return Promise.resolve({
          data: {
            download: {
              list: [
                { name: "model.glb", url: "http://example.com/model.glb" },
              ],
            },
            generation: { prompt: "test prompt" },
          },
        });
      });

      // 2. Upload to COS
      (uploadToCOS as any).mockResolvedValue({
        Location: "cos.example.com/key",
      });

      // 3. Update Record
      (axios.put as any).mockResolvedValue({
        status: 200,
        data: { success: true },
      });

      await handleFile(req, res);

      expect(uploadToCOS).toHaveBeenCalled();
      expect(axios.put).toHaveBeenCalledWith(
        expect.stringContaining("/v1/ai-rodin/file?id=123"),
        expect.objectContaining({
          url: "https://cos.example.com/key",
        }),
        expect.any(Object),
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
