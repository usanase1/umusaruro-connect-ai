import {
  ProviderNotImplementedError,
  type AudioClip,
  type SpeechToText,
  type TextToSpeech,
  type Transcript,
} from "../voice/speech.js";

/**
 * Sunbird AI (Kinyarwanda STT/TTS candidate).
 *
 * TODO: implement against Sunbird's API docs once there is an account and key.
 * Keep the key in SUNBIRD_API_KEY. Sunbird uses 3-letter codes ("kin" for
 * Kinyarwanda); map from our "rw".
 */
export class SunbirdSpeech implements SpeechToText, TextToSpeech {
  readonly name = "sunbird";

  constructor(private readonly apiKey: string) {}

  async transcribe(_audio: AudioClip, _language: string): Promise<Transcript> {
    void this.apiKey;
    throw new ProviderNotImplementedError(this.name, "speech-to-text");
  }

  async synthesize(_text: string, _language: string): Promise<AudioClip | null> {
    throw new ProviderNotImplementedError(this.name, "text-to-speech");
  }
}
