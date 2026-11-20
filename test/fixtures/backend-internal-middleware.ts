// Copy of umusarurop2p-be/src/middlewares/internal-service.middleware.ts (only imports adjusted),
// used to prove BackendClient signatures are accepted. Re-copy if the backend changes.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

type RequestWithRawBody = Request & { rawBody?: Buffer };

export const authenticateInternalService = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const serviceId = process.env.INTERNAL_SERVICE_ID;
  const secret = process.env.INTERNAL_SERVICE_SECRET;

  if (!serviceId || !secret || Buffer.byteLength(secret) < 32) {
    res.status(503).json({
      success: false,
      code: "INTERNAL_AUTH_NOT_CONFIGURED",
      message: "Internal service authentication is not configured",
    });
    return;
  }

  const suppliedServiceId = req.header("X-Service-Id") ?? "";
  const timestamp = req.header("X-Timestamp") ?? "";
  const suppliedSignature = req.header("X-Signature") ?? "";

  const timestampSeconds = Number(timestamp);
  const isFresh =
    /^\d{10}$/.test(timestamp) &&
    Number.isFinite(timestampSeconds) &&
    Math.abs(Date.now() - timestampSeconds * 1000) <= 5 * 60 * 1000;

  if (
    suppliedServiceId !== serviceId ||
    !isFresh ||
    !/^[a-f0-9]{64}$/i.test(suppliedSignature)
  ) {
    res.status(401).json({
      success: false,
      code: "INVALID_SIGNATURE",
      message: "Invalid service credentials",
    });
    return;
  }

  const body = (req as RequestWithRawBody).rawBody?.toString("utf8") ?? "";
  // Sign the exact path (including query string) and exact JSON body sent by the caller.
  const canonical = `${timestamp}.${req.method.toUpperCase()}.${req.originalUrl}.${body}`;
  const expected = createHmac("sha256", secret).update(canonical).digest();
  const supplied = Buffer.from(suppliedSignature, "hex");

  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    res.status(401).json({
      success: false,
      code: "INVALID_SIGNATURE",
      message: "Invalid service credentials",
    });
    return;
  }

  next();
};