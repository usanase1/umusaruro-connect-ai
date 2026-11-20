/**
 * Swappable speech interfaces. Every STT/TTS vendor (Pindo, Sunbird, Abena,
 * Google, Azure...) lives in its own file under src/providers/ and implements
 * one or both of these. The voice flow only ever talks to these interfaces.
 *
 * Language codes are ISO 639-1 ("rw", "en", "fr", "sw"). Each provider maps
 * them to its own codes (e.g. "kin" for Kinyarwanda).
 */

export interface AudioClip {
  data: Buffer;
  /** e.g. "audio/mpeg", "audio/wav" */
  mimeType: string;
}

export interface Transcript {
  text: string;
  /** 0..1 when the provider reports it. */
  confidence?: number;
}

export interface SpeechToText {
  readonly name: string;
  transcribe(audio: AudioClip, language: string): Promise<Transcript>;
}

export interface TextToSpeech {
  readonly name: string;
  /**
   * Returns audio to play to the caller, or null to fall back to Africa's
   * Talking's built-in <Say>. <Say> has no Kinyarwanda voice, so it is only
   * acceptable for development.
   */
  synthesize(text: string, language: string): Promise<AudioClip | null>;
}

export class ProviderNotImplementedError extends Error {
  constructor(provider: string, what: string) {
    super(`${provider} ${what} is not implemented yet. See src/providers/${provider}.ts`);
    this.name = "ProviderNotImplementedError";
  }
}
