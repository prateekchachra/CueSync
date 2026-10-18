import { z } from "zod";

// One rights holder on a master or publishing side.
export const OwnerSchema = z.object({
  name: z.string().min(1),
  share_pct: z.number().min(0).max(100),
  contact_email: z.string().email().optional(),
});

export const TrackSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  artist: z.string().min(1),
  isrc: z.string().optional(),
  bpm: z.number().positive().optional(),
  key: z.string().optional(),
  duration_sec: z.number().positive().optional(),
  moods: z.array(z.string()).default([]),
  genres: z.array(z.string()).default([]),
  instrumentation: z.array(z.string()).default([]),
  has_lyrics: z.boolean().default(false),
  lyric_themes: z.array(z.string()).default([]),
  explicit: z.boolean().default(false),
  stems_available: z.boolean().default(false),
  // Rights. "One-stop" means master AND publishing can be cleared with a single party.
  master_owners: z.array(OwnerSchema).default([]),
  publishing_owners: z.array(OwnerSchema).default([]),
  one_stop: z.boolean().default(false),
  territories: z.array(z.string()).default(["worldwide"]),
  exclusivity: z.enum(["non_exclusive", "exclusive", "unknown"]).default("unknown"),
  price_range_eur: z.object({ min: z.number().nonnegative(), max: z.number().nonnegative() }).optional(),
  // Supervisors increasingly ask for provenance.
  provenance: z.enum(["human", "ai_assisted", "unknown"]).default("unknown"),
  notes: z.string().optional(),
});

export const CatalogueSchema = z.object({
  catalogue_name: z.string().optional(),
  tracks: z.array(TrackSchema).min(1),
});

export type Owner = z.infer<typeof OwnerSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Catalogue = z.infer<typeof CatalogueSchema>;
