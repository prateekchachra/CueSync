import { loadCatalogue, SAMPLE_CATALOGUE_PATH } from "./catalogue.ts";
import { resolveProvider, runSyncAgent } from "../../supabase/functions/_shared/sync-agent/provider.ts";

async function main() {
  const brief = process.argv.slice(2).join(" ").trim();
  if (!brief) {
    console.error('Usage: npm run agent:brief -- "Tense night chase, 90 BPM, no vocals, under 2000 EUR, one-stop"');
    process.exit(1);
  }
  const model = resolveProvider((name) => process.env[name]); // throws a clear message if no key is set
  const catalogue = loadCatalogue(process.env.CATALOGUE_PATH ?? SAMPLE_CATALOGUE_PATH);
  console.error(`Catalogue: ${catalogue.catalogue_name ?? "(unnamed)"} | ${catalogue.tracks.length} tracks | model ${model.provider}:${model.model}\n`);

  const answer = await runSyncAgent(catalogue, brief, model, (name, input, isError) =>
    console.error(`[tool] ${name}${isError ? " (error)" : ""} ${JSON.stringify(input)}`),
  );
  console.log(`\n${answer}\n`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
