import type { Request, Response, NextFunction } from "express";
import { type AxiosError } from "axios";
import { logger } from "../lib/logger.js";

export const errorHandler = (
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  logger.error(error, "Error details:");

  const axiosError = error as AxiosError;
  const status = axiosError.response?.status || 500;

  res.status(status).send({
    message: status === 500 ? "Internal Server Error" : error.message,
    details: axiosError.response?.data || error.message,
  });
};
