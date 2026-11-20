import { createHmac } from "node:crypto";

export interface SignedHeaders {
  "X-Service-Id": string;
  "X-Timestamp": string;
  "X-Signature": string;
}

/**
 * Signs a request the way umusarurop2p-be's internal-service.middleware.ts verifies it:
 *   hex(HMAC-SHA256(secret, `${timestamp}.${METHOD}.${originalUrl}.${rawBody}`))
 *
 * `pathWithQuery` must be exactly what the backend sees as `req.originalUrl`,
 * i.e. including the `/api` prefix and the already-encoded query string
 * (e.g. `/api/internal/users/lookup?phone=%2B250788000000`).
 * `body` must be the exact string sent on the wire ("" when there is no body).
 */
export function signRequest(params: {
  serviceId: string;
  secret: string;
  method: string;
  pathWithQuery: string;
  body: string;
  nowMs?: number;
}): SignedHeaders {
  const timestamp = Math.floor((params.nowMs ?? Date.now()) / 1000).toString();
  const canonical = `${timestamp}.${params.method.toUpperCase()}.${params.pathWithQuery}.${params.body}`;
  const signature = createHmac("sha256", params.secret).update(canonical).digest("hex");
  return {
    "X-Service-Id": params.serviceId,
    "X-Timestamp": timestamp,
    "X-Signature": signature,
  };
}
