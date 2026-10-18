import { z } from "zod";
import type { Catalogue, Owner, Track } from "./types.ts";

/* ------------------------------------------------------------------ */
/* Input schemas (validated before every tool call)                    */
/* ------------------------------------------------------------------ */

export const SearchInput = z.object({
  moods: z.array(z.string()).optional(),
  genres: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  bpm_min: z.number().positive().optional(),
  bpm_max: z.number().positive().optional(),
  instrumental_only: z.boolean().optional(),
  one_stop_only: z.boolean().optional(),
  human_made_only: z.boolean().optional(),
  stems_required: z.boolean().optional(),
  max_price_eur: z.number().nonnegative().optional(),
  territory: z.string().optional(),
  limit: z.number().int().min(1).max(10).optional(),
});

export const TrackIdInput = z.object({ track_id: z.string().min(1) });

export const ClearanceInput = z.object({
  track_id: z.string().min(1),
  territory: z.string().optional(),
});

export const DraftInput = z.object({
  track_id: z.string().min(1),
  supervisor_name: z.string().min(1),
  project_title: z.string().min(1),
  media_type: z.string().min(1), // e.g. "feature film", "online ad", "trailer"
  territory: z.string().min(1),
  term: z.string().min(1), // e.g. "1 year", "in perpetuity"
  budget_eur: z.number().nonnegative().optional(),
  usage_notes: z.string().optional(),
});

export type SearchArgs = z.infer<typeof SearchInput>;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const norm = (s: string) => s.trim().toLowerCase();
const sum = (owners: Owner[]) => owners.reduce((n, o) => n + o.share_pct, 0);
const eur = (n: number) => `EUR ${n.toLocaleString("en-GB")}`;

function haystack(t: Track): string {
  return [t.title, t.artist, ...t.moods, ...t.genres, ...t.instrumentation, ...t.lyric_themes, t.notes ?? ""]
    .join(" | ")
    .toLowerCase();
}

function territoryOk(t: Track, territory?: string): boolean {
  if (!territory) return true;
  const want = norm(territory);
  return t.territories.some((x) => {
    const have = norm(x);
    return have === "worldwide" || have === want;
  });
}

/* ------------------------------------------------------------------ */
/* search_catalog                                                      */
/* ------------------------------------------------------------------ */

export interface SearchHit {
  id: string;
  title: string;
  artist: string;
  bpm?: number;
  moods: string[];
  genres: string[];
  has_lyrics: boolean;
  stems_available: boolean;
  one_stop: boolean;
  provenance: Track["provenance"];
  price_range_eur?: { min: number; max: number };
  score: number;
  matched: string[];
}

export function searchCatalogue(cat: Catalogue, args: SearchArgs): SearchHit[] {
  const limit = args.limit ?? 8;
  const wantMoods = (args.moods ?? []).map(norm);
  const wantGenres = (args.genres ?? []).map(norm);
  const wantKeywords = (args.keywords ?? []).map(norm);
  const hasSoft = wantMoods.length + wantGenres.length + wantKeywords.length > 0;

  const hits: SearchHit[] = [];
  for (const t of cat.tracks) {
    // Hard filters first: a track that fails one of these is never shown.
    if (args.instrumental_only && t.has_lyrics) continue;
    if (args.one_stop_only && !t.one_stop) continue;
    if (args.human_made_only && t.provenance !== "human") continue;
    if (args.stems_required && !t.stems_available) continue;
    if (args.bpm_min !== undefined && t.bpm !== undefined && t.bpm < args.bpm_min) continue;
    if (args.bpm_max !== undefined && t.bpm !== undefined && t.bpm > args.bpm_max) continue;
    if (!territoryOk(t, args.territory)) continue;
    if (args.max_price_eur !== undefined && t.price_range_eur && t.price_range_eur.min > args.max_price_eur) continue;

    // Soft scoring.
    let score = 0;
    const matched: string[] = [];
    for (const m of wantMoods) {
      if (t.moods.some((x) => norm(x).includes(m) || m.includes(norm(x)))) {
        score += 3;
        matched.push(`mood:${m}`);
      }
    }
    for (const g of wantGenres) {
      if (t.genres.some((x) => norm(x).includes(g) || g.includes(norm(x)))) {
        score += 2;
        matched.push(`genre:${g}`);
      }
    }
    const hay = haystack(t);
    for (const k of wantKeywords) {
      if (hay.includes(k)) {
        score += 1;
        matched.push(`keyword:${k}`);
      }
    }
    if (args.bpm_min !== undefined && args.bpm_max !== undefined && t.bpm !== undefined) {
      const mid = (args.bpm_min + args.bpm_max) / 2;
      const half = (args.bpm_max - args.bpm_min) / 2;
      const closeness = Math.max(0, 1 - Math.abs(t.bpm - mid) / (half + 20));
      score += closeness * 2;
      matched.push(`bpm:${t.bpm}`);
    }
    if (t.price_range_eur === undefined && args.max_price_eur !== undefined) matched.push("price:unknown");

    if (hasSoft && score <= 0) continue;
    hits.push({
      id: t.id,
      title: t.title,
      artist: t.artist,
      bpm: t.bpm,
      moods: t.moods,
      genres: t.genres,
      has_lyrics: t.has_lyrics,
      stems_available: t.stems_available,
      one_stop: t.one_stop,
      provenance: t.provenance,
      price_range_eur: t.price_range_eur,
      score: Math.round(score * 100) / 100,
      matched,
    });
  }
  hits.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return hits.slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* get_track                                                           */
/* ------------------------------------------------------------------ */

export function getTrack(cat: Catalogue, id: string): Track | undefined {
  return cat.tracks.find((t) => t.id === id);
}

/* ------------------------------------------------------------------ */
/* check_clearance                                                     */
/* ------------------------------------------------------------------ */

export interface ClearanceReport {
  track_id: string;
  title: string;
  territory_ok: boolean;
  one_stop_claimed: boolean;
  parties_to_contact: string[];
  issues: string[];
  missing_info: string[];
  notes: string[];
  verdict: "ready" | "needs_work" | "blocked";
}

export function checkClearance(t: Track, territory?: string): ClearanceReport {
  const issues: string[] = [];
  const missing: string[] = [];
  const notes: string[] = [];

  const masterTotal = sum(t.master_owners);
  const pubTotal = sum(t.publishing_owners);

  if (t.master_owners.length === 0) missing.push("master owners");
  else if (Math.abs(masterTotal - 100) > 0.01) issues.push(`Master splits add up to ${masterTotal}%, not 100%.`);

  if (t.publishing_owners.length === 0) missing.push("publishing owners");
  else if (Math.abs(pubTotal - 100) > 0.01) issues.push(`Publishing splits add up to ${pubTotal}%, not 100%.`);

  const allOwners = [...t.master_owners, ...t.publishing_owners];
  const parties = new Set<string>(allOwners.map((o) => o.name));
  for (const o of allOwners) {
    if (!o.contact_email) missing.push(`contact email for ${o.name}`);
  }
  // A label and its own publishing arm can share one contact and still be one-stop,
  // so count distinct contacts (email, falling back to name), not distinct names.
  const contacts = new Set<string>(allOwners.map((o) => (o.contact_email ?? o.name).toLowerCase()));
  if (t.one_stop && contacts.size > 1) {
    issues.push(`Marked one-stop but ${contacts.size} different contacts hold rights (${[...parties].join(", ")}).`);
  }
  if (!t.one_stop && parties.size > 0) {
    notes.push(`Not one-stop: expect to clear with ${contacts.size} contact(s) (${[...parties].join(", ")}). Slower turnaround.`);
  }

  const territory_ok = territoryOk(t, territory);
  if (!territory_ok) issues.push(`Not available for ${territory}. Available: ${t.territories.join(", ")}.`);

  if (t.exclusivity === "exclusive") notes.push("Exclusive deal: confirm the exclusivity window and fee before pitching.");
  if (t.exclusivity === "unknown") missing.push("exclusivity terms");
  if (t.provenance === "ai_assisted") notes.push(`AI-assisted production. ${t.notes ?? "Check what was AI-generated before pitching."}`);
  if (t.provenance === "unknown") missing.push("provenance (human-made or AI-assisted)");
  if (!t.price_range_eur) missing.push("price range");
  if (t.has_lyrics && t.explicit) notes.push("Explicit lyrics: check the project's content rating.");
  if (!t.isrc) missing.push("ISRC");

  let verdict: ClearanceReport["verdict"] = "ready";
  if (issues.length > 0 || missing.length > 0) verdict = "needs_work";
  if (!territory_ok) verdict = "blocked";

  return {
    track_id: t.id,
    title: t.title,
    territory_ok,
    one_stop_claimed: t.one_stop,
    parties_to_contact: [...parties],
    issues,
    missing_info: missing,
    notes,
    verdict,
  };
}

/* ------------------------------------------------------------------ */
/* draft_license_request                                               */
/* ------------------------------------------------------------------ */

export interface DraftEmail {
  to: { name: string; email?: string; role: "master" | "publishing" }[];
  subject: string;
  body: string;
}

export function draftLicenseRequest(t: Track, a: z.infer<typeof DraftInput>): DraftEmail {
  const to: DraftEmail["to"] = [
    ...t.master_owners.map((o) => ({ name: o.name, email: o.contact_email, role: "master" as const })),
    ...t.publishing_owners.map((o) => ({ name: o.name, email: o.contact_email, role: "publishing" as const })),
  ];
  const budget = a.budget_eur !== undefined ? `Our budget for this placement is ${eur(a.budget_eur)}. ` : "";
  const body = [
    `Hello,`,
    ``,
    `I'm ${a.supervisor_name}, music supervisor on "${a.project_title}". We'd like to license "${t.title}" by ${t.artist}` +
      (t.isrc ? ` (ISRC ${t.isrc})` : "") +
      ` for use in a ${a.media_type}.`,
    ``,
    `Proposed terms:`,
    `- Territory: ${a.territory}`,
    `- Term: ${a.term}`,
    `- Rights needed: synchronisation (publishing) and master use`,
    a.usage_notes ? `- Usage: ${a.usage_notes}` : undefined,
    ``,
    `${budget}Could you confirm that you control the rights, whether the track is available for these terms, and your quote and timeline?`,
    ``,
    `Thank you,`,
    a.supervisor_name,
  ]
    .filter((l): l is string => l !== undefined)
    .join("\n");
  return { to, subject: `Sync licence request: "${t.title}" for ${a.project_title}`, body };
}

/* ------------------------------------------------------------------ */
/* Tool definitions for the model + dispatcher                         */
/* ------------------------------------------------------------------ */

export const TOOL_DEFS = [
  {
    name: "search_catalog",
    description:
      "Search the catalogue. Hard filters (instrumental_only, one_stop_only, human_made_only, stems_required, bpm range, max_price_eur, territory) remove tracks entirely. Soft criteria (moods, genres, keywords) rank what is left. Use concrete catalogue-style words for moods and genres, e.g. 'tense', 'dark', 'uplifting'. If nothing comes back, relax one filter at a time and say which one you relaxed.",
    input_schema: {
      type: "object" as const,
      properties: {
        moods: { type: "array", items: { type: "string" } },
        genres: { type: "array", items: { type: "string" } },
        keywords: { type: "array", items: { type: "string" } },
        bpm_min: { type: "number" },
        bpm_max: { type: "number" },
        instrumental_only: { type: "boolean" },
        one_stop_only: { type: "boolean" },
        human_made_only: { type: "boolean" },
        stems_required: { type: "boolean" },
        max_price_eur: { type: "number", description: "Maximum budget in EUR for the sync fee." },
        territory: { type: "string", description: "e.g. 'worldwide', 'Europe', 'Spain'." },
        limit: { type: "integer", minimum: 1, maximum: 10 },
      },
    },
  },
  {
    name: "get_track",
    description: "Get the full record for one track by id (all metadata and rights).",
    input_schema: {
      type: "object" as const,
      properties: { track_id: { type: "string" } },
      required: ["track_id"],
    },
  },
  {
    name: "check_clearance",
    description:
      "Check the clearance status of one track: rights splits, one-stop claim, territory, exclusivity, provenance, missing information. Always call this for every track you plan to recommend.",
    input_schema: {
      type: "object" as const,
      properties: { track_id: { type: "string" }, territory: { type: "string" } },
      required: ["track_id"],
    },
  },
  {
    name: "draft_license_request",
    description:
      "Draft a licence-request email to the rights holders of one track. Only call this when the supervisor asks for a draft or has chosen a track. Needs supervisor name, project title, media type, territory and term; ask the supervisor if any are missing.",
    input_schema: {
      type: "object" as const,
      properties: {
        track_id: { type: "string" },
        supervisor_name: { type: "string" },
        project_title: { type: "string" },
        media_type: { type: "string" },
        territory: { type: "string" },
        term: { type: "string" },
        budget_eur: { type: "number" },
        usage_notes: { type: "string" },
      },
      required: ["track_id", "supervisor_name", "project_title", "media_type", "territory", "term"],
    },
  },
] as const;

export interface ToolResult {
  content: string;
  is_error: boolean;
}

export function runTool(cat: Catalogue, name: string, input: unknown): ToolResult {
  try {
    switch (name) {
      case "search_catalog": {
        const args = SearchInput.parse(input ?? {});
        const hits = searchCatalogue(cat, args);
        return ok({ count: hits.length, results: hits });
      }
      case "get_track": {
        const { track_id } = TrackIdInput.parse(input);
        const t = getTrack(cat, track_id);
        return t ? ok(t) : fail(`No track with id ${track_id}.`);
      }
      case "check_clearance": {
        const { track_id, territory } = ClearanceInput.parse(input);
        const t = getTrack(cat, track_id);
        return t ? ok(checkClearance(t, territory)) : fail(`No track with id ${track_id}.`);
      }
      case "draft_license_request": {
        const args = DraftInput.parse(input);
        const t = getTrack(cat, args.track_id);
        return t ? ok(draftLicenseRequest(t, args)) : fail(`No track with id ${args.track_id}.`);
      }
      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(`Invalid input: ${err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }
    return fail((err as Error).message);
  }
}

const ok = (data: unknown): ToolResult => ({ content: JSON.stringify(data, null, 2), is_error: false });
const fail = (message: string): ToolResult => ({ content: message, is_error: true });
