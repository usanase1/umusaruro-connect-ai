import {
  ProviderNotImplementedError,
  type AudioClip,
  type SpeechToText,
  type TextToSpeech,
  type Transcript,
} from "../voice/speech.js";

/**
 * Pindo AI (Kinyarwanda STT/TTS candidate).
 *
 * TODO: implement against Pindo's API docs once there is an account and key.
 * Keep the key in PINDO_API_KEY. Map "rw" to whatever code Pindo expects.
 * Test with real Rwandan speakers on real phone audio (8 kHz, noisy) before
 * choosing a provider.
 */
export class PindoSpeech implements SpeechToText, TextToSpeech {
  readonly name = "pindo";

  constructor(private readonly apiKey: string) {}

  async transcribe(_audio: AudioClip, _language: string): Promise<Transcript> {
    void this.apiKey;
    throw new ProviderNotImplementedError(this.name, "speech-to-text");
  }

  async synthesize(_text: string, _language: string): Promise<AudioClip | null> {
    throw new ProviderNotImplementedError(this.name, "text-to-speech");
  }
}
