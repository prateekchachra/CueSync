import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIEFS_PATH, loadCatalogue, SAMPLE_CATALOGUE_PATH } from "../src/catalogue.ts";
import { searchCatalogue, checkClearance, getTrack, draftLicenseRequest, runTool } from "../src/tools.ts";

const cat = loadCatalogue(SAMPLE_CATALOGUE_PATH);
const track = (id: string) => {
  const t = getTrack(cat, id);
  assert.ok(t, `missing ${id}`);
  return t;
};

test("catalogue loads and validates", () => {
  assert.equal(cat.tracks.length, 12);
});

test("loader rejects bad data", () => {
  assert.throws(() => loadCatalogue(BRIEFS_PATH), /invalid/i);
});

test("tense night chase brief puts Midnight Pursuit first", () => {
  const hits = searchCatalogue(cat, {
    moods: ["tense", "dark", "driving"],
    bpm_min: 85,
    bpm_max: 95,
    instrumental_only: true,
    one_stop_only: true,
    max_price_eur: 2000,
  });
  assert.equal(hits[0]?.id, "trk_001");
  assert.ok(hits.every((h) => !h.has_lyrics && h.one_stop));
});

test("human_made_only excludes AI-assisted tracks", () => {
  const hits = searchCatalogue(cat, { moods: ["dreamy", "calm", "ethereal"], human_made_only: true });
  assert.ok(!hits.some((h) => h.id === "trk_006"));
});

test("territory filter respects regional deals", () => {
  const asia = searchCatalogue(cat, { moods: ["tender", "intimate"], territory: "Asia" });
  assert.ok(!asia.some((h) => h.id === "trk_004"));
  const europe = searchCatalogue(cat, { moods: ["tender", "intimate"], territory: "Europe" });
  assert.ok(europe.some((h) => h.id === "trk_004"));
});

test("price filter drops tracks whose minimum exceeds the budget", () => {
  const hits = searchCatalogue(cat, { moods: ["aggressive", "energetic"], max_price_eur: 1000 });
  assert.ok(!hits.some((h) => h.id === "trk_005"));
});

test("clearance: clean one-stop track is ready", () => {
  assert.equal(checkClearance(track("trk_001"), "worldwide").verdict, "ready");
});

test("clearance: publishing splits that do not add to 100 are flagged", () => {
  const r = checkClearance(track("trk_008"));
  assert.equal(r.verdict, "needs_work");
  assert.ok(r.issues.some((i) => i.includes("90%")));
});

test("clearance: multi-party track is not one-stop", () => {
  const r = checkClearance(track("trk_002"));
  assert.ok(r.notes.some((n) => n.includes("Not one-stop")));
  assert.ok(r.parties_to_contact.includes("Delta Songs"));
});

test("clearance: missing contact is reported", () => {
  const r = checkClearance(track("trk_007"));
  assert.ok(r.missing_info.some((m) => m.includes("Verde Publishing")));
});

test("clearance: out-of-territory track is blocked", () => {
  assert.equal(checkClearance(track("trk_004"), "Asia").verdict, "blocked");
});

test("clearance: AI-assisted track gets a provenance note", () => {
  assert.ok(checkClearance(track("trk_006")).notes.some((n) => n.includes("AI-assisted")));
});

test("draft email addresses every rights holder and mentions terms", () => {
  const d = draftLicenseRequest(track("trk_002"), {
    track_id: "trk_002",
    supervisor_name: "Alex Kim",
    project_title: "Night Shift",
    media_type: "feature film",
    territory: "worldwide",
    term: "in perpetuity",
    budget_eur: 3000,
  });
  assert.equal(d.to.length, 3);
  assert.ok(d.body.includes("Night Shift") && d.body.includes("in perpetuity") && d.body.includes("3,000"));
});

test("runTool reports bad input as an error, not a crash", () => {
  assert.equal(runTool(cat, "get_track", {}).is_error, true);
  assert.equal(runTool(cat, "nope", {}).is_error, true);
  assert.equal(runTool(cat, "get_track", { track_id: "trk_999" }).is_error, true);
});

test("app songs map to agent tracks; bad rows are skipped, not fatal", async () => {
  const { tracksFromRows } = await import("../../supabase/functions/_shared/sync-agent/fromDb.ts");
  const base = {
    isrc: null, bpm: 118, musical_key: "F# minor", duration_seconds: 214, genre: "Electronic, Cinematic",
    description: "Night drive.", notes: null, has_lyrics: false, stems_available: true, one_stop: true,
    territories: [], exclusivity: "non_exclusive", provenance: "human", price_min_eur: 800, price_max_eur: 2500,
    master_owners: [{ name: "Darzini", share_pct: 100, contact_email: "d@x.com" }],
    publishing_owners: [{ name: "Darzini Music", share_pct: 100, contact_email: "d@x.com" }],
    profiles: { artist_name: "Darzini" },
    song_moods: [{ moods: { name: "Tense" } }, { moods: [{ name: "Dark" }] }],
  };
  const { tracks, skipped } = tracksFromRows([
    { ...base, id: "s1", title: "Midnight Circuit" },
    { ...base, id: "s2", title: "Broken", master_owners: [{ name: "X", share_pct: 100, contact_email: "not-an-email" }] },
  ]);
  assert.equal(tracks.length, 1);
  assert.equal(skipped[0]?.id, "s2");
  const t = tracks[0]!;
  assert.deepEqual(t.moods, ["tense", "dark"]);
  assert.deepEqual(t.genres, ["electronic", "cinematic"]);
  assert.deepEqual(t.territories, ["worldwide"]);
  assert.deepEqual(t.price_range_eur, { min: 800, max: 2500 });
  assert.equal(checkClearance(t).verdict, "needs_work"); // no ISRC
  assert.equal(searchCatalogue({ tracks }, { moods: ["tense"], instrumental_only: true })[0]?.id, "s1");
});

test("shortlist: recommended tracks first (in answer order), then search hits, capped at topN", async () => {
  const { buildShortlist, searchRecorder } = await import("../../supabase/functions/_shared/sync-agent/shortlist.ts");
  const rec = searchRecorder();
  rec.listener("search_catalog", { moods: ["tense", "dark"] }, false);
  rec.listener("search_catalog", { instrumental_only: true }, false);
  rec.listener("search_catalog", { bpm_min: "fast" }, false); // invalid input is ignored
  rec.listener("check_clearance", { track_id: "trk_001" }, false);
  assert.equal(rec.calls.length, 2);

  const answer = "Best: **Midnight Pursuit** (trk_001). Also trk_011 if you need cello.";
  const list = buildShortlist(cat, answer, rec.calls, 4);
  assert.equal(list.length, 4);
  assert.deepEqual(list.slice(0, 2).map((t) => t.id), ["trk_001", "trk_011"]);
  assert.ok(list[0]!.recommended && list[1]!.recommended);
  assert.ok(list.slice(2).every((t) => !t.recommended));
  assert.deepEqual(list.map((t) => t.rank), [1, 2, 3, 4]);
  assert.equal(new Set(list.map((t) => t.id)).size, 4);
  assert.equal(buildShortlist(cat, answer, rec.calls, 50).length <= 10, true);
});
