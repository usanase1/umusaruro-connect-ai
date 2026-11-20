/**
 * Builders for Africa's Talking Voice XML responses.
 * https://developers.africastalking.com/docs/voice/actions/overview
 */

export type Action = string & { readonly __action: unique symbol };

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function attrs(values: Record<string, string | number | boolean | undefined>): string {
  return Object.entries(values)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${k}="${escapeXml(String(v))}"`)
    .join("");
}

export function say(text: string): Action {
  return `<Say>${escapeXml(text)}</Say>` as Action;
}

export function play(url: string): Action {
  return `<Play${attrs({ url })}/>` as Action;
}

export function hangup(): Action {
  return "<Hangup/>" as Action;
}

export function getDigits(
  opts: { callbackUrl: string; numDigits?: number; timeout?: number; finishOnKey?: string },
  prompt: Action[],
): Action {
  return `<GetDigits${attrs(opts)}>${prompt.join("")}</GetDigits>` as Action;
}

/** Partial recording: AT posts `recordingUrl` to callbackUrl when the caller finishes. */
export function record(
  opts: { callbackUrl: string; maxLength?: number; timeout?: number; finishOnKey?: string; trimSilence?: boolean; playBeep?: boolean },
  prompt: Action[],
): Action {
  return `<Record${attrs(opts)}>${prompt.join("")}</Record>` as Action;
}

export function response(...actions: Action[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${actions.join("")}</Response>`;
}
