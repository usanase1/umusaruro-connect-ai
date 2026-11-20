import type { Config, ProviderName } from "../config.js";
import type { SpeechToText, TextToSpeech } from "../voice/speech.js";
import { MockSpeechToText, MockTextToSpeech } from "./mock.js";
import { PindoSpeech } from "./pindo.js";
import { SunbirdSpeech } from "./sunbird.js";

function requireKey(provider: ProviderName, key: string | undefined): string {
  if (!key) throw new Error(`${provider.toUpperCase()}_API_KEY is required when using the ${provider} provider`);
  return key;
}

export function createSpeechToText(config: Config): SpeechToText {
  switch (config.sttProvider) {
    case "mock":
      return new MockSpeechToText(config.mockSttText);
    case "pindo":
      return new PindoSpeech(requireKey("pindo", config.pindoApiKey));
    case "sunbird":
      return new SunbirdSpeech(requireKey("sunbird", config.sunbirdApiKey));
  }
}

export function createTextToSpeech(config: Config): TextToSpeech {
  switch (config.ttsProvider) {
    case "mock":
      return new MockTextToSpeech();
    case "pindo":
      return new PindoSpeech(requireKey("pindo", config.pindoApiKey));
    case "sunbird":
      return new SunbirdSpeech(requireKey("sunbird", config.sunbirdApiKey));
  }
}
