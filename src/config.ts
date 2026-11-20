import "dotenv/config";

export type ProviderName = "mock" | "pindo" | "sunbird";

const PROVIDERS: readonly ProviderName[] = ["mock", "pindo", "sunbird"];

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function provider(name: string): ProviderName {
  const value = (optional(name) ?? "mock") as ProviderName;
  if (!PROVIDERS.includes(value)) {
    throw new Error(`${name} must be one of: ${PROVIDERS.join(", ")} (got "${value}")`);
  }
  return value;
}

export interface Config {
  port: number;
  publicBaseUrl: string;
  voiceWebhookToken: string | undefined;
  backendUrl: string;
  internalServiceId: string | undefined;
  internalServiceSecret: string | undefined;
  sttProvider: ProviderName;
  ttsProvider: ProviderName;
  mockSttText: string;
  pindoApiKey: string | undefined;
  sunbirdApiKey: string | undefined;
  geminiApiKey: string | undefined;
  geminiModel: string;
}

export function loadConfig(): Config {
  const port = Number(optional("PORT") ?? 4000);
  const secret = optional("INTERNAL_SERVICE_SECRET");
  if (secret && Buffer.byteLength(secret) < 32) {
    throw new Error("INTERNAL_SERVICE_SECRET must be at least 32 characters (the backend rejects shorter ones)");
  }

  return {
    port,
    publicBaseUrl: (optional("PUBLIC_BASE_URL") ?? `http://localhost:${port}`).replace(/\/+$/, ""),
    voiceWebhookToken: optional("VOICE_WEBHOOK_TOKEN"),
    backendUrl: (optional("BACKEND_URL") ?? "http://localhost:5000/api").replace(/\/+$/, ""),
    internalServiceId: optional("INTERNAL_SERVICE_ID"),
    internalServiceSecret: secret,
    sttProvider: provider("STT_PROVIDER"),
    ttsProvider: provider("TTS_PROVIDER"),
    mockSttText: optional("MOCK_STT_TEXT") ?? "Umushinga wanjye ugeze he?",
    pindoApiKey: optional("PINDO_API_KEY"),
    sunbirdApiKey: optional("SUNBIRD_API_KEY"),
    geminiApiKey: optional("GEMINI_API_KEY"),
    geminiModel: optional("GEMINI_MODEL") ?? "gemini-2.5-flash",
  };
}
