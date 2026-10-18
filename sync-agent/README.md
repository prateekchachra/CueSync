# Sync licensing agent (CLI, eval, tests)

The agent itself lives in `../supabase/functions/_shared/sync-agent/` so the app's Edge Function and this CLI share one copy. Run everything from the app root:

```bash
npm run agent:test        # offline tests (schema, search, clearance, drafting, agent loop, DB mapping)
npm run agent:typecheck
set -a; source sync-agent/.env; set +a   # after copying .env.example and adding a key
npm run agent:brief -- "Tense night chase, ~90 BPM, no vocals, under 2000 EUR, one-stop"
npm run agent:eval   # runs data/briefs.json, writes sync-agent/results/eval-*.md
```

Own catalogue: `CATALOGUE_PATH=./my-catalogue.json npm run agent:brief -- "..."`. Model: set GEMINI_API_KEY (free tier), LLM_API_KEY + LLM_BASE_URL + MODEL (Groq, OpenRouter…), or ANTHROPIC_API_KEY. See `.env.example`.
