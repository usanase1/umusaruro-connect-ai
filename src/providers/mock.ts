import type { AudioClip, SpeechToText, TextToSpeech, Transcript } from "../voice/speech.js";

/** Development STT: ignores the audio and "hears" a fixed sentence. */
export class MockSpeechToText implements SpeechToText {
  readonly name = "mock";
  constructor(private readonly text: string) {}

  async transcribe(_audio: AudioClip, _language: string): Promise<Transcript> {
    return { text: this.text, confidence: 1 };
  }
}

/** Development TTS: returns null so the flow uses Africa's Talking <Say>. */
export class MockTextToSpeech implements TextToSpeech {
  readonly name = "mock";

  async synthesize(_text: string, _language: string): Promise<AudioClip | null> {
    return null;
  }
}
