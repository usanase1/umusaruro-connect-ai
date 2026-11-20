import { timingSafeEqual } from "node:crypto";
import express, { type Request, type Response, type NextFunction, type Router } from "express";
import { FeatureNotReadyError, NotAFarmerError, type Assistant } from "../ai/assistant.js";
import type { BackendClient } from "../backend/client.js";
import { getDigits, hangup, play, record, response, say, type Action } from "./actions.js";
import type { AudioStore } from "./audio-store.js";
import { normalizeLanguage, t, type Lang } from "./prompts.js";
import type { SessionStore, VoiceSession } from "./sessions.js";
import type { SpeechToText, TextToSpeech } from "./speech.js";

export interface VoiceDeps {
  publicBaseUrl: string;
  webhookToken: string | undefined;
  backend: Pick<BackendClient, "lookupUserByPhone">;
  assistant: Pick<Assistant, "answer">;
  stt: SpeechToText;
  tts: TextToSpeech;
  sessions: SessionStore;
  audio: AudioStore;
  /** Downloads an Africa's Talking recording. Injectable for tests. */
  fetchRecording?: (url: string) => Promise<{ data: Buffer; mimeType: string }>;
}

/** Fields Africa's Talking posts (application/x-www-form-urlencoded). */
interface AtCallback {
  isActive?: string;
  sessionId?: string;
  direction?: string;
  callerNumber?: string;
  dtmfDigits?: string;
  recordingUrl?: string;
  durationInSeconds?: string;
}

const MAX_QUESTIONS = 5;
const MAX_SILENT_ATTEMPTS = 2;

/** +250788123456 → +250*****3456 (logs never get full phone numbers). */
const maskPhone = (phone: string) => phone.replace(/^(\+\d{3})\d+(\d{4})$/, "$1*****$2");

async function defaultFetchRecording(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Recording download failed: HTTP ${res.status}`);
  return { data: Buffer.from(await res.arrayBuffer()), mimeType: res.headers.get("content-type") ?? "audio/mpeg" };
}

export function createVoiceRouter(deps: VoiceDeps): Router {
  const router = express.Router();
  const fetchRecording = deps.fetchRecording ?? defaultFetchRecording;

  // ─── helpers ───────────────────────────────────────────────────────────────

  const callbackUrl = (step: string) => {
    const url = new URL(`/voice/${step}`, deps.publicBaseUrl);
    if (deps.webhookToken) url.searchParams.set("token", deps.webhookToken);
    return url.toString();
  };

  /** Speaks text with the configured TTS, or falls back to AT <Say>. */
  const speak = async (text: string, lang: Lang): Promise<Action> => {
    try {
      const clip = await deps.tts.synthesize(text, lang);
      if (clip) return play(new URL(`/voice/audio/${deps.audio.put(clip)}`, deps.publicBaseUrl).toString());
    } catch (err) {
      console.error(`[voice] TTS (${deps.tts.name}) failed, falling back to <Say>:`, (err as Error).message);
    }
    return say(text);
  };

  const send = (res: Response, ...actions: Action[]) => {
    res.type("application/xml").send(response(...actions));
  };

  const endCall = async (res: Response, lang: Lang, key: Parameters<typeof t>[1]) => {
    send(res, await speak(t(lang, key), lang), hangup());
  };

  const askQuestion = async (lang: Lang, key: "askQuestion" | "notHeard" = "askQuestion") =>
    record(
      { callbackUrl: callbackUrl("question"), finishOnKey: "#", maxLength: 20, timeout: 5, trimSilence: true, playBeep: true },
      [await speak(t(lang, key), lang)],
    );

  const withSession = (res: Response, body: AtCallback): VoiceSession | undefined => {
    const session = body.sessionId ? deps.sessions.get(body.sessionId) : undefined;
    if (!session) {
      // Unknown or expired session: don't guess who this is.
      send(res, say(t("rw", "error")), hangup());
    }
    return session;
  };

  // ─── middleware ────────────────────────────────────────────────────────────

  router.use(express.urlencoded({ extended: false, limit: "20kb" }));

  // Africa's Talking does not sign webhooks, so require a shared token in the URL when configured.
  router.use((req: Request, res: Response, next: NextFunction) => {
    if (!deps.webhookToken || req.method === "GET") return next();
    const supplied = Buffer.from(typeof req.query.token === "string" ? req.query.token : "");
    const expected = Buffer.from(deps.webhookToken);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      res.sendStatus(403);
      return;
    }
    next();
  });

  // ─── routes ────────────────────────────────────────────────────────────────

  /** Main Voice callback URL configured in the Africa's Talking dashboard. */
  router.post("/callback", async (req: Request, res: Response) => {
    const body = req.body as AtCallback;
    const sessionId = body.sessionId ?? "";

    // Final notification when the call ends (cost/duration). No XML needed.
    if (body.isActive !== "1") {
      deps.sessions.delete(sessionId);
      console.log(`[voice] call ended session=${sessionId} duration=${body.durationInSeconds ?? "?"}s`);
      res.sendStatus(200);
      return;
    }

    const phone = (body.callerNumber ?? "").trim();
    console.log(`[voice] incoming call session=${sessionId} from=${maskPhone(phone)}`);

    try {
      const user = await deps.backend.lookupUserByPhone(phone);
      if (!user) {
        // Registration by phone needs backend gap C3.
        await endCall(res, "rw", "notRegistered");
        return;
      }

      const lang = normalizeLanguage(user.preferredLanguage);
      deps.sessions.set({
        sessionId,
        userId: user.userId,
        role: user.role,
        language: lang,
        consent: false,
        questions: 0,
        silentAttempts: 0,
        updatedAt: Date.now(),
      });

      // Ask for consent before recording anything. If no key is pressed, AT moves on to goodbye.
      send(
        res,
        getDigits({ callbackUrl: callbackUrl("consent"), numDigits: 1, timeout: 10 }, [await speak(t(lang, "consent"), lang)]),
        await speak(t(lang, "goodbye"), lang),
        hangup(),
      );
    } catch (err) {
      console.error(`[voice] lookup failed session=${sessionId}:`, (err as Error).message);
      await endCall(res, "rw", "error");
    }
  });

  router.post("/consent", async (req: Request, res: Response) => {
    const body = req.body as AtCallback;
    const session = withSession(res, body);
    if (!session) return;

    if (body.dtmfDigits !== "1") {
      await endCall(res, session.language, "declined");
      return;
    }

    session.consent = true;
    deps.sessions.set(session);
    send(res, await askQuestion(session.language));
  });

  router.post("/question", async (req: Request, res: Response) => {
    const body = req.body as AtCallback;
    const session = withSession(res, body);
    if (!session) return;
    const lang = session.language;

    if (!session.consent) {
      await endCall(res, lang, "error");
      return;
    }

    try {
      let question = "";
      if (body.recordingUrl) {
        const audio = await fetchRecording(body.recordingUrl);
        question = (await deps.stt.transcribe(audio, lang)).text.trim();
      }

      if (!question) {
        session.silentAttempts += 1;
        deps.sessions.set(session);
        if (session.silentAttempts > MAX_SILENT_ATTEMPTS) {
          await endCall(res, lang, "goodbye");
        } else {
          send(res, await askQuestion(lang, "notHeard"));
        }
        return;
      }

      session.silentAttempts = 0;
      session.questions += 1;
      deps.sessions.set(session);
      console.log(`[voice] question session=${session.sessionId} n=${session.questions} chars=${question.length}`);

      const answer = await deps.assistant.answer(session, question);

      if (session.questions >= MAX_QUESTIONS) {
        send(res, await speak(answer, lang), await speak(t(lang, "goodbye"), lang), hangup());
        return;
      }

      send(
        res,
        await speak(answer, lang),
        getDigits({ callbackUrl: callbackUrl("next"), numDigits: 1, timeout: 8 }, [await speak(t(lang, "another"), lang)]),
        await speak(t(lang, "goodbye"), lang),
        hangup(),
      );
    } catch (err) {
      if (err instanceof FeatureNotReadyError) {
        console.warn(`[voice] ${err.message}`);
        await endCall(res, lang, "notReady");
      } else if (err instanceof NotAFarmerError) {
        await endCall(res, lang, "farmersOnly");
      } else {
        console.error(`[voice] question failed session=${session.sessionId}:`, (err as Error).message);
        await endCall(res, lang, "error");
      }
    }
  });

  router.post("/next", async (req: Request, res: Response) => {
    const body = req.body as AtCallback;
    const session = withSession(res, body);
    if (!session) return;

    if (body.dtmfDigits === "1") {
      send(res, await askQuestion(session.language));
    } else {
      await endCall(res, session.language, "goodbye");
    }
  });

  /** Serves synthesized TTS audio to Africa's Talking's <Play>. */
  router.get("/audio/:id", (req: Request, res: Response) => {
    const clip = deps.audio.get(String(req.params.id));
    if (!clip) {
      res.sendStatus(404);
      return;
    }
    res.type(clip.mimeType).send(clip.data);
  });

  return router;
}
