import { readFileSync } from "node:fs";
import { CatalogueSchema, type Catalogue } from "../../supabase/functions/_shared/sync-agent/types.ts";

/** Paths are relative to the app root (run the npm scripts from there). */
export const SAMPLE_CATALOGUE_PATH = "supabase/functions/_shared/sync-agent/catalogue.sample.json";
export const BRIEFS_PATH = "sync-agent/data/briefs.json";

export function loadCatalogue(path: string): Catalogue {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(`Could not read catalogue at ${path}: ${(err as Error).message}`);
  }
  const parsed = CatalogueSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 10)
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Catalogue JSON is invalid:\n${issues}`);
  }
  const ids = new Set<string>();
  for (const t of parsed.data.tracks) {
    if (ids.has(t.id)) throw new Error(`Duplicate track id in catalogue: ${t.id}`);
    ids.add(t.id);
  }
  return parsed.data;
}
