import { BackendError, type BackendClient } from "../backend/client.js";
import type { Lang } from "../voice/prompts.js";
import type { TextModel } from "./gemini.js";

/** Thrown when the backend lacks an endpoint this flow needs (e.g. C1 user-token). */
export class FeatureNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeatureNotReadyError";
  }
}

export class NotAFarmerError extends Error {}

export interface Caller {
  userId: string;
  role: "FARMER" | "INVESTOR" | "ADMIN";
  language: Lang;
}

export interface ProjectFacts {
  title: string;
  status: string;
  district: string | null;
  latestProgress: { stage: string; description: string; date: string } | null;
}

const LANGUAGE_NAMES: Record<Lang, string> = { rw: "Kinyarwanda", en: "English", fr: "French" };
const MAX_PROJECTS = 3;
const MAX_ANSWER_CHARS = 600;

const SYSTEM_PROMPT = `You are Umusaruro Connect, a phone assistant for farmers on Umusaruro P2P,
a Rwandan platform where farmers post agricultural projects and investors fund them.

Rules you must follow:
- You only READ and EXPLAIN. You cannot approve projects, move money, sign contracts,
  verify identity or change anything. If asked, explain that the farmer must do it in the
  Umusaruro app or that an administrator decides it.
- Never ask for or repeat national ID numbers, PINs, passwords or one-time codes.
- Use only the facts provided. If the facts do not answer the question, say so briefly
  and say you can tell them about their projects' status.
- Your answer will be read aloud on a basic phone call: at most 3 short sentences,
  plain words, no lists, no markdown, no emojis, no IDs or URLs.

Project statuses:
DRAFT = not yet submitted, or sent back by an administrator for changes;
PENDING_VERIFICATION = submitted, waiting for an administrator to review it;
ACTIVE = approved and open to investors; FUNDED = fully funded by investors;
IN_PROGRESS = farming under way; HARVESTED = harvest recorded;
COMPLETED = finished and profit shared; CANCELLED = cancelled.`;

/** Read-only question answering for a caller. */
export class Assistant {
  constructor(
    private readonly backend: BackendClient,
    private readonly model: TextModel | null,
  ) {}

  async answer(caller: Caller, question: string): Promise<string> {
    if (caller.role !== "FARMER") throw new NotAFarmerError();
    const facts = await this.loadProjectFacts(caller.userId);

    if (!this.model) return templateAnswer(facts, caller.language);

    const userPrompt = [
      `Answer in ${LANGUAGE_NAMES[caller.language]}.`,
      `Facts about the caller's projects (most recent first, JSON): ${JSON.stringify(facts)}`,
      `The caller asked: """${question.slice(0, 500)}"""`,
    ].join("\n\n");

    const text = await this.model.generate(SYSTEM_PROMPT, userPrompt);
    return cleanForSpeech(text);
  }

  async loadProjectFacts(userId: string): Promise<ProjectFacts[]> {
    let token: string;
    try {
      token = await this.backend.getUserToken(userId);
    } catch (err) {
      if (err instanceof BackendError && (err.status === 404 || err.status === 501)) {
        throw new FeatureNotReadyError("Backend has no POST /internal/auth/user-token yet (gap C1)");
      }
      throw err;
    }

    const projects = (await this.backend.getMyProjects(token)).slice(0, MAX_PROJECTS);
    return Promise.all(
      projects.map(async (p): Promise<ProjectFacts> => {
        const progress = await this.backend.getLatestProgress(token, p.id);
        // Whitelist fields: nothing sensitive goes to the LLM.
        return {
          title: p.title,
          status: p.status,
          district: p.district ?? null,
          latestProgress: progress
            ? { stage: progress.stage, description: progress.description.slice(0, 300), date: progress.createdAt.slice(0, 10) }
            : null,
        };
      }),
    );
  }
}

export function cleanForSpeech(text: string): string {
  const cleaned = text
    .replace(/[*_#`>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length <= MAX_ANSWER_CHARS) return cleaned;
  const cut = cleaned.slice(0, MAX_ANSWER_CHARS);
  const lastStop = cut.lastIndexOf(".");
  return lastStop > 100 ? cut.slice(0, lastStop + 1) : cut;
}

/** Used when no GEMINI_API_KEY is set. Status names stay as codes. */
export function templateAnswer(facts: ProjectFacts[], lang: Lang): string {
  if (facts.length === 0) {
    return { rw: "Nta mushinga mufite kuri Umusaruro.", en: "You have no projects on Umusaruro.", fr: "Vous n'avez aucun projet sur Umusaruro." }[lang];
  }
  const lines = facts.map((f) => {
    const stage = f.latestProgress?.stage;
    switch (lang) {
      case "rw":
        return `Umushinga ${f.title}: uri ku rwego rwa ${f.status}${stage ? `, igikorwa giheruka ni ${stage}` : ""}.`;
      case "fr":
        return `Projet ${f.title} : statut ${f.status}${stage ? `, dernière étape ${stage}` : ""}.`;
      default:
        return `Project ${f.title}: status ${f.status}${stage ? `, latest stage ${stage}` : ""}.`;
    }
  });
  return lines.join(" ");
}
