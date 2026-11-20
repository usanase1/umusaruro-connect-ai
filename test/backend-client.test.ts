import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import express from "express";
import { BackendClient, BackendError } from "../src/backend/client.js";
import { authenticateInternalService } from "./fixtures/backend-internal-middleware.js";

const SERVICE_ID = "umusaruro-connect-ai";
const SECRET = "test-secret-that-is-at-least-32-characters-long";

describe("BackendClient against the backend's real signature middleware", () => {
  let server: ReturnType<express.Express["listen"]>;
  let baseUrl = "";
  let seenPhone: unknown;

  before(async () => {
    process.env.INTERNAL_SERVICE_ID = SERVICE_ID;
    process.env.INTERNAL_SERVICE_SECRET = SECRET;

    const app = express();
    // Same raw-body capture as umusarurop2p-be/src/app.ts
    app.use(express.json({ verify: (req, _res, buf) => ((req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buf)) }));
    const api = express.Router();
    api.get("/internal/users/lookup", authenticateInternalService, (req, res) => {
      seenPhone = req.query.phone;
      if (req.query.phone === "+250700000000") {
        res.status(404).json({ success: false, code: "USER_NOT_FOUND", message: "No account" });
        return;
      }
      res.json({
        success: true,
        data: { userId: "u1", role: "FARMER", status: "ACTIVE", hasPassword: false, preferredLanguage: "rw", phoneVerifiedAt: null },
      });
    });
    api.post("/internal/auth/user-token", authenticateInternalService, (req, res) => {
      res.json({ success: true, data: { token: `tok-for-${(req.body as { userId: string }).userId}` } });
    });
    app.use("/api", api);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  });

  after(() => server.close());

  const client = (secret = SECRET) => new BackendClient({ backendUrl: baseUrl, internalServiceId: SERVICE_ID, internalServiceSecret: secret });

  it("signed GET with an encoded +phone query is accepted", async () => {
    const user = await client().lookupUserByPhone("+250788123456");
    assert.equal(user?.userId, "u1");
    assert.equal(seenPhone, "+250788123456", "the + must survive URL encoding");
  });

  it("returns null for USER_NOT_FOUND", async () => {
    assert.equal(await client().lookupUserByPhone("+250700000000"), null);
  });

  it("signed POST with a JSON body is accepted", async () => {
    assert.equal(await client().getUserToken("u1"), "tok-for-u1");
  });

  it("a wrong secret is rejected with INVALID_SIGNATURE", async () => {
    await assert.rejects(
      client("a-different-secret-that-is-also-32-chars-long").lookupUserByPhone("+250788123456"),
      (err: unknown) => err instanceof BackendError && err.status === 401 && err.code === "INVALID_SIGNATURE",
    );
  });
});
