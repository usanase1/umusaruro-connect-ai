/**
 * Smoke test: calls the core backend's signed GET /internal/users/lookup.
 *   npm run check:backend -- +250788123456
 */
import { BackendClient } from "../src/backend/client.js";
import { loadConfig } from "../src/config.js";

const phone = process.argv[2];
if (!phone) {
  console.error("Usage: npm run check:backend -- +250788123456");
  process.exit(1);
}

const config = loadConfig();
console.log(`Backend: ${config.backendUrl}`);

try {
  const user = await new BackendClient(config).lookupUserByPhone(phone);
  if (user) {
    console.log("Signature accepted. User found:", user);
  } else {
    console.log("Signature accepted. No user has this phone (404 USER_NOT_FOUND).");
  }
} catch (err) {
  const e = err as Error & { status?: number; code?: string };
  console.error(`Failed: ${e.message}${e.status ? ` (HTTP ${e.status}${e.code ? ` ${e.code}` : ""})` : ""}`);
  if (e.code === "INVALID_SIGNATURE") console.error("Check INTERNAL_SERVICE_ID / INTERNAL_SERVICE_SECRET match the backend, and the clocks are in sync.");
  if (e.code === "INTERNAL_AUTH_NOT_CONFIGURED") console.error("Set INTERNAL_SERVICE_ID and INTERNAL_SERVICE_SECRET in the backend's .env and restart it.");
  process.exit(1);
}
