import type { Config } from "../config.js";
import { signRequest } from "./signing.js";

/** Envelope used by every umusarurop2p-be endpoint. */
interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  code?: string;
  data?: T;
}

export class BackendError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | undefined,
  ) {
    super(message);
    this.name = "BackendError";
  }
}

export interface UserLookup {
  userId: string;
  role: "FARMER" | "INVESTOR" | "ADMIN";
  status: string;
  hasPassword: boolean;
  preferredLanguage: string;
  phoneVerifiedAt: string | null;
}

export interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  location?: string;
  district?: string | null;
  capitalNeeded?: number | null;
  projectType?: string;
  submittedAt?: string | null;
}

export interface ProgressUpdate {
  stage: string;
  description: string;
  createdAt: string;
}

const TIMEOUT_MS = 10_000;

/**
 * HTTP client for the core backend. This service never touches the core
 * database: everything goes through these calls.
 *
 * Read-only by design. Do not add methods that approve projects, move money,
 * sign contracts or verify identity. Those are user/ADMIN actions.
 */
export class BackendClient {
  private readonly baseUrl: URL;

  constructor(private readonly config: Pick<Config, "backendUrl" | "internalServiceId" | "internalServiceSecret">) {
    this.baseUrl = new URL(config.backendUrl.endsWith("/") ? config.backendUrl : `${config.backendUrl}/`);
  }

  // ─── /internal/* (service-signed) ──────────────────────────────────────────

  /** GET /internal/users/lookup?phone=+250... Returns null when no account has this phone. */
  async lookupUserByPhone(phone: string): Promise<UserLookup | null> {
    try {
      return await this.internal<UserLookup>("GET", "internal/users/lookup", { query: { phone } });
    } catch (err) {
      if (err instanceof BackendError && err.status === 404 && err.code === "USER_NOT_FOUND") return null;
      throw err;
    }
  }

  /**
   * C1 (not built in the backend yet): POST /internal/auth/user-token.
   * Returns a short-lived JWT so this service can read data *as* the caller.
   * Until C13 exists the backend should refuse to issue one without a phoneProof.
   */
  async getUserToken(userId: string, phoneProof?: string): Promise<string> {
    const data = await this.internal<{ token: string }>("POST", "internal/auth/user-token", {
      body: phoneProof ? { userId, phoneProof } : { userId },
    });
    return data.token;
  }

  // ─── Normal APIs, called with a user token ─────────────────────────────────

  getMyProjects(userToken: string): Promise<ProjectSummary[]> {
    return this.asUser<ProjectSummary[]>(userToken, "GET", "projects/my");
  }

  async getLatestProgress(userToken: string, projectId: string): Promise<ProgressUpdate | null> {
    try {
      return await this.asUser<ProgressUpdate>(userToken, "GET", `progress/${encodeURIComponent(projectId)}/latest`);
    } catch (err) {
      if (err instanceof BackendError && err.status === 404) return null;
      throw err;
    }
  }

  // ─── Plumbing ──────────────────────────────────────────────────────────────

  private async internal<T>(
    method: "GET" | "POST",
    path: string,
    opts: { query?: Record<string, string>; body?: unknown } = {},
  ): Promise<T> {
    const { internalServiceId: serviceId, internalServiceSecret: secret } = this.config;
    if (!serviceId || !secret) {
      throw new Error("INTERNAL_SERVICE_ID and INTERNAL_SERVICE_SECRET must be set to call /internal/*");
    }

    const url = this.url(path, opts.query);
    const body = opts.body === undefined ? "" : JSON.stringify(opts.body);
    // Sign exactly what the backend will see as req.originalUrl: path + encoded query.
    const headers = signRequest({ serviceId, secret, method, pathWithQuery: url.pathname + url.search, body });

    return this.send<T>(url, method, body, { ...headers });
  }

  private asUser<T>(token: string, method: "GET", path: string): Promise<T> {
    return this.send<T>(this.url(path), method, "", { Authorization: `Bearer ${token}` });
  }

  private url(path: string, query?: Record<string, string>): URL {
    const url = new URL(path, this.baseUrl);
    // URLSearchParams encodes "+" as "%2B", so +250... is not turned into a space.
    for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
    return url;
  }

  private async send<T>(url: URL, method: string, body: string, headers: Record<string, string>): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      ...(body ? { body } : {}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    let payload: ApiEnvelope<T> | undefined;
    try {
      payload = (await res.json()) as ApiEnvelope<T>;
    } catch {
      payload = undefined;
    }

    if (!res.ok || !payload?.success) {
      throw new BackendError(
        payload?.message ?? `Backend ${method} ${url.pathname} failed with HTTP ${res.status}`,
        res.status,
        payload?.code,
      );
    }
    return payload.data as T;
  }
}
