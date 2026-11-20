import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { FeatureNotReadyError } from "../src/ai/assistant.js";
import { createApp } from "../src/app.js";
import type { UserLookup } from "../src/backend/client.js";
import { MockSpeechToText, MockTextToSpeech } from "../src/providers/mock.js";
import { AudioStore } from "../src/voice/audio-store.js";
import { MemorySessionStore } from "../src/voice/sessions.js";

const FARMER: UserLookup = {
  userId: "u1",
  role: "FARMER",
  status: "ACTIVE",
  hasPassword: false,
  preferredLanguage: "en",
  phoneVerifiedAt: null,
};

describe("voice webhook flow", () => {
  let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
  let base = "";
  let answerImpl: () => Promise<string> = async () => "Project Maize: status ACTIVE.";

  before(async () => {
    const app = createApp({
      publicBaseUrl: "https://example.ngrok.app",
      webhookToken: "hook-token",
      backend: { lookupUserByPhone: async (phone) => (phone === "+250788123456" ? FARMER : null) },
      assistant: { answer: () => answerImpl() },
      stt: new MockSpeechToText("What is the status of my project?"),
      tts: new MockTextToSpeech(),
      sessions: new MemorySessionStore(),
      audio: new AudioStore(),
      fetchRecording: async () => ({ data: Buffer.from("fake"), mimeType: "audio/mpeg" }),
    });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(() => server.close());

  const post = async (step: string, fields: Record<string, string>, token = "hook-token") => {
    const res = await fetch(`${base}/voice/${step}?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields),
    });
    return { status: res.status, xml: await res.text() };
  };

  it("rejects callbacks without the webhook token", async () => {
    assert.equal((await post("callback", { isActive: "1", sessionId: "s0" }, "wrong")).status, 403);
  });

  it("unregistered caller is told so and the call ends", async () => {
    const { xml } = await post("callback", { isActive: "1", sessionId: "s1", callerNumber: "+250700000000" });
    assert.match(xml, /not registered|ntabwo yanditse/);
    assert.match(xml, /<Hangup\/>/);
  });

  it("full turn: consent → question → answer → offer another", async () => {
    const start = await post("callback", { isActive: "1", sessionId: "s2", callerNumber: "+250788123456" });
    assert.match(start.xml, /<GetDigits[^>]*callbackUrl="https:\/\/example\.ngrok\.app\/voice\/consent\?token=hook-token"/);
    assert.match(start.xml, /Press 1 if you agree/);
    assert.doesNotMatch(start.xml, /<Record/, "must not record before consent");

    const consent = await post("consent", { isActive: "1", sessionId: "s2", dtmfDigits: "1" });
    assert.match(consent.xml, /<Record[^>]*callbackUrl="[^"]*\/voice\/question/);

    const answer = await post("question", { isActive: "1", sessionId: "s2", recordingUrl: "https://at.example/rec.mp3" });
    assert.match(answer.xml, /<Say>Project Maize: status ACTIVE\.<\/Say>/);
    assert.match(answer.xml, /\/voice\/next/);

    const end = await post("next", { isActive: "1", sessionId: "s2", dtmfDigits: "2" });
    assert.match(end.xml, /Thank you for calling/);
    assert.match(end.xml, /<Hangup\/>/);
  });

  it("declining consent ends the call without recording", async () => {
    await post("callback", { isActive: "1", sessionId: "s3", callerNumber: "+250788123456" });
    const { xml } = await post("consent", { isActive: "1", sessionId: "s3", dtmfDigits: "2" });
    assert.match(xml, /We will not record you/);
    assert.doesNotMatch(xml, /<Record/);
  });

  it("missing backend C1 endpoint gives a polite 'not ready' message", async () => {
    answerImpl = async () => {
      throw new FeatureNotReadyError("no C1");
    };
    await post("callback", { isActive: "1", sessionId: "s4", callerNumber: "+250788123456" });
    await post("consent", { isActive: "1", sessionId: "s4", dtmfDigits: "1" });
    const { xml } = await post("question", { isActive: "1", sessionId: "s4", recordingUrl: "https://at.example/rec.mp3" });
    assert.match(xml, /not available yet/);
  });

  it("call-ended notification returns 200 with no XML", async () => {
    const res = await post("callback", { isActive: "0", sessionId: "s2", durationInSeconds: "42" });
    assert.equal(res.status, 200);
  });
});
