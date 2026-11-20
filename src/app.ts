import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { Assistant } from "./ai/assistant.js";
import { GeminiModel } from "./ai/gemini.js";
import { BackendClient } from "./backend/client.js";
import type { Config } from "./config.js";
import { createSpeechToText, createTextToSpeech } from "./providers/index.js";
import { AudioStore } from "./voice/audio-store.js";
import { MemorySessionStore } from "./voice/sessions.js";
import { createVoiceRouter, type VoiceDeps } from "./voice/voice.controller.js";

export function createApp(voiceDeps: VoiceDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // Render / ngrok sit in front

  app.get("/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok", stt: voiceDeps.stt.name, tts: voiceDeps.tts.name } });
  });

  app.use("/voice", createVoiceRouter(voiceDeps));

  app.use((_req, res) => {
    res.status(404).json({ success: false, message: "Not found" });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[app] unhandled error:", err.message);
    res.status(500).json({ success: false, message: "Internal server error" });
  });

  return app;
}

export function buildVoiceDeps(config: Config): VoiceDeps {
  const backend = new BackendClient(config);
  const model = config.geminiApiKey ? new GeminiModel(config.geminiApiKey, config.geminiModel) : null;
  return {
    publicBaseUrl: config.publicBaseUrl,
    webhookToken: config.voiceWebhookToken,
    backend,
    assistant: new Assistant(backend, model),
    stt: createSpeechToText(config),
    tts: createTextToSpeech(config),
    sessions: new MemorySessionStore(),
    audio: new AudioStore(),
  };
}
