import { buildVoiceDeps, createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
const app = createApp(buildVoiceDeps(config));

app.listen(config.port, () => {
  console.log(`Umusaruro Connect AI listening on http://localhost:${config.port}`);
  console.log(`  Voice callback URL: ${config.publicBaseUrl}/voice/callback${config.voiceWebhookToken ? "?token=***" : ""}`);
  console.log(`  Backend: ${config.backendUrl}`);
  console.log(`  STT=${config.sttProvider} TTS=${config.ttsProvider} LLM=${config.geminiApiKey ? config.geminiModel : "template (no GEMINI_API_KEY)"}`);
  if (!config.internalServiceId || !config.internalServiceSecret) {
    console.warn("  WARNING: INTERNAL_SERVICE_ID / INTERNAL_SERVICE_SECRET not set; backend /internal/* calls will fail");
  }
});
