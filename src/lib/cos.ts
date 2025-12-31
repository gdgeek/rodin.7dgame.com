import COS from "cos-nodejs-sdk-v5";
import config from "../config.js";
import type { COSUploadParams, COSUploadResult } from "../types.js";

const cos = new COS({
  SecretId: config.cos.secret.id,
  SecretKey: config.cos.secret.key,
});

/**
 * Uploads data to Tencent Cloud COS
 */
export const uploadToCOS = (
  params: COSUploadParams,
): Promise<COSUploadResult> => {
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
