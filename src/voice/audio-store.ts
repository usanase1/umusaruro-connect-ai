import { randomUUID } from "node:crypto";
import type { AudioClip } from "./speech.js";

const TTL_MS = 10 * 60 * 1000;

/**
 * Holds synthesized TTS audio briefly so Africa's Talking can fetch it via
 * <Play url=".../voice/audio/:id">. IDs are random UUIDs and expire quickly.
 */
export class AudioStore {
  private readonly clips = new Map<string, { clip: AudioClip; expiresAt: number }>();

  put(clip: AudioClip): string {
    const now = Date.now();
    for (const [id, entry] of this.clips) if (entry.expiresAt < now) this.clips.delete(id);
    const id = randomUUID();
    this.clips.set(id, { clip, expiresAt: now + TTL_MS });
    return id;
  }

  get(id: string): AudioClip | undefined {
    const entry = this.clips.get(id);
    if (!entry || entry.expiresAt < Date.now()) return undefined;
    return entry.clip;
  }
}
