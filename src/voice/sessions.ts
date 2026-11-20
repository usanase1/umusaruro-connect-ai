import type { Lang } from "./prompts.js";

export interface VoiceSession {
  sessionId: string;
  userId: string;
  role: "FARMER" | "INVESTOR" | "ADMIN";
  language: Lang;
  consent: boolean;
  questions: number;
  silentAttempts: number;
  updatedAt: number;
}

/** Swappable so it can move to Redis or a small DB of this service's own later. */
export interface SessionStore {
  get(sessionId: string): VoiceSession | undefined;
  set(session: VoiceSession): void;
  delete(sessionId: string): void;
}

const TTL_MS = 60 * 60 * 1000;

/** In-memory store. Fine for one instance; sessions are lost on restart. */
export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, VoiceSession>();

  get(sessionId: string): VoiceSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session && Date.now() - session.updatedAt > TTL_MS) {
      this.sessions.delete(sessionId);
      return undefined;
    }
    return session;
  }

  set(session: VoiceSession): void {
    session.updatedAt = Date.now();
    this.sessions.set(session.sessionId, session);
    for (const [id, s] of this.sessions) {
      if (Date.now() - s.updatedAt > TTL_MS) this.sessions.delete(id);
    }
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
