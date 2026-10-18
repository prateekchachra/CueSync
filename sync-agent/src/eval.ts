import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { BRIEFS_PATH, loadCatalogue, SAMPLE_CATALOGUE_PATH } from "./catalogue.ts";
import { resolveProvider, runSyncAgent } from "../../supabase/functions/_shared/sync-agent/provider.ts";

interface Brief {
  id: string;
  brief: string;
  expect_any_of: string[];
}

async function main() {
  const model = resolveProvider((name) => process.env[name]); // throws a clear message if no key is set
  const catalogue = loadCatalogue(process.env.CATALOGUE_PATH ?? SAMPLE_CATALOGUE_PATH);
  const briefs: Brief[] = JSON.parse(readFileSync(process.env.BRIEFS_PATH ?? BRIEFS_PATH, "utf8"));

  const lines: string[] = [`# Eval run`, `Model: ${model.provider}:${model.model}`, `Tracks: ${catalogue.tracks.length}`, ``];
  let hits = 0;

  for (const b of briefs) {
    process.stderr.write(`Running ${b.id}...\n`);
    const tools: string[] = [];
    const answer = await runSyncAgent(catalogue, b.brief, model, (n) => tools.push(n));
    // Rough automatic check: did the answer mention an expected track id?
    const found = b.expect_any_of.some((id) => answer.includes(id));
    if (found) hits++;
    lines.push(
      `## ${b.id}: ${found ? "HIT" : "CHECK BY HAND"}`,
      `**Brief:** ${b.brief}`,
      `**Expected any of:** ${b.expect_any_of.join(", ")}`,
      `**Tools called:** ${tools.join(", ")}`,
      ``,
      answer,
      ``,
    );
  }
  lines.splice(3, 0, `Automatic hit rate: ${hits}/${briefs.length} (you still judge the top 5 yourself)`);

  mkdirSync("sync-agent/results", { recursive: true });
  const path = `sync-agent/results/eval-${Date.now()}.md`;
  writeFileSync(path, lines.join("\n"));
  console.log(`Wrote ${path}. Automatic hit rate ${hits}/${briefs.length}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
