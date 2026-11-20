export type Lang = "rw" | "en" | "fr";

/**
 * Maps User.preferredLanguage (a code, a language name, or "auto") to a
 * language we have prompts for. Defaults to Kinyarwanda.
 */
export function normalizeLanguage(preferred: string | null | undefined): Lang {
  const value = (preferred ?? "").trim().toLowerCase();
  if (["en", "eng", "english", "icyongereza"].includes(value) || value.startsWith("en-")) return "en";
  if (["fr", "fra", "fre", "french", "français", "francais", "igifaransa"].includes(value) || value.startsWith("fr-")) return "fr";
  return "rw";
}

export type PromptKey =
  | "consent"
  | "notRegistered"
  | "declined"
  | "askQuestion"
  | "notHeard"
  | "another"
  | "goodbye"
  | "error"
  | "notReady"
  | "farmersOnly";

/**
 * NOTE: the Kinyarwanda strings are drafts and must be reviewed by a native
 * speaker (and tested on real calls) before going live.
 */
export const PROMPTS: Record<Lang, Record<PromptKey, string>> = {
  rw: {
    consent:
      "Murakaza neza kuri Umusaruro. Kugira ngo tubafashe, tuzafata amajwi y'ibibazo byanyu. Mukande 1 niba mubyemeye, cyangwa 2 niba mutabyemeye.",
    notRegistered: "Murakaza neza kuri Umusaruro. Iyi nimero ntabwo yanditse kuri Umusaruro. Murakoze.",
    declined: "Nta kibazo. Ntabwo tuzafata amajwi yanyu. Murakoze, mugire umunsi mwiza.",
    askQuestion: "Nyuma y'akajwi, muvuge ikibazo cyanyu. Nimurangiza, mukande diyezi.",
    notHeard: "Ntabwo twabumvise neza. Mwongere muvuge ikibazo cyanyu.",
    another: "Mukande 1 kugira ngo mubaze ikindi kibazo, cyangwa mukupe telefoni.",
    goodbye: "Murakoze guhamagara Umusaruro. Mugire umunsi mwiza.",
    error: "Mutwihanganire, habaye ikibazo. Mwongere mugerageze nyuma.",
    notReady: "Mutwihanganire, iyi serivisi ntiraboneka. Mwongere mugerageze vuba.",
    farmersOnly: "Mutwihanganire, ubu iyi serivisi ikorera abahinzi gusa.",
  },
  en: {
    consent:
      "Welcome to Umusaruro. To help you, we will record your questions. Press 1 if you agree, or 2 if you do not.",
    notRegistered: "Welcome to Umusaruro. This number is not registered on Umusaruro. Thank you.",
    declined: "No problem. We will not record you. Thank you, and have a good day.",
    askQuestion: "After the beep, say your question. When you finish, press the hash key.",
    notHeard: "Sorry, we did not hear you clearly. Please say your question again.",
    another: "Press 1 to ask another question, or hang up.",
    goodbye: "Thank you for calling Umusaruro. Have a good day.",
    error: "Sorry, something went wrong. Please try again later.",
    notReady: "Sorry, this service is not available yet. Please try again soon.",
    farmersOnly: "Sorry, this service is only for farmers for now.",
  },
  fr: {
    consent:
      "Bienvenue sur Umusaruro. Pour vous aider, nous allons enregistrer vos questions. Appuyez sur 1 si vous acceptez, ou sur 2 si vous refusez.",
    notRegistered: "Bienvenue sur Umusaruro. Ce numéro n'est pas enregistré sur Umusaruro. Merci.",
    declined: "Pas de problème. Nous ne vous enregistrerons pas. Merci et bonne journée.",
    askQuestion: "Après le bip, posez votre question. Quand vous avez terminé, appuyez sur la touche dièse.",
    notHeard: "Désolé, nous ne vous avons pas bien entendu. Veuillez répéter votre question.",
    another: "Appuyez sur 1 pour poser une autre question, ou raccrochez.",
    goodbye: "Merci d'avoir appelé Umusaruro. Bonne journée.",
    error: "Désolé, une erreur s'est produite. Veuillez réessayer plus tard.",
    notReady: "Désolé, ce service n'est pas encore disponible. Veuillez réessayer bientôt.",
    farmersOnly: "Désolé, ce service est réservé aux agriculteurs pour le moment.",
  },
};

export function t(lang: Lang, key: PromptKey): string {
  return PROMPTS[lang][key];
}
