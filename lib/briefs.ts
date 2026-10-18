import { supabase } from './supabase';
import type { Brief, BriefStats, Submission, SupervisorSubmission } from './types';

export type BriefInput = Omit<Brief, 'id' | 'supervisor_id' | 'created_at' | 'status'> & {
  status?: Brief['status'];
};

/* Supervisor ---------------------------------------------------------- */

export async function fetchMyBriefs(userId: string): Promise<(Brief & { stats: BriefStats })[]> {
  const [{ data: briefs, error }, { data: stats, error: statsError }] = await Promise.all([
    supabase.from('briefs').select('*').eq('supervisor_id', userId).order('created_at', { ascending: false }),
    supabase.rpc('my_brief_stats'),
  ]);
  if (error) throw error;
  if (statsError) throw statsError;
  const byId = new Map(((stats ?? []) as BriefStats[]).map((s) => [s.brief_id, s]));
  return ((briefs ?? []) as Brief[]).map((b) => ({
    ...b,
    stats: byId.get(b.id) ?? { brief_id: b.id, total: 0, pending: 0, accepted: 0, declined: 0 },
  }));
}

export async function fetchBrief(id: string): Promise<Brief> {
  const { data, error } = await supabase.from('briefs').select('*').eq('id', id).single();
  if (error) throw error;
  return data as Brief;
}

export async function createBrief(input: BriefInput): Promise<Brief> {
  const { data, error } = await supabase.from('briefs').insert(input).select().single();
  if (error) throw error;
  return data as Brief;
}

export async function setBriefStatus(id: string, status: Brief['status']) {
  const { error } = await supabase.from('briefs').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteBrief(id: string) {
  const { error } = await supabase.from('briefs').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchBriefSubmissions(briefId: string): Promise<SupervisorSubmission[]> {
  const { data, error } = await supabase.rpc('brief_submissions', { p_brief_id: briefId });
  if (error) throw error;
  return (data ?? []) as SupervisorSubmission[];
}

export async function reviewSubmission(submissionId: string, decision: 'accepted' | 'declined' | 'block') {
  const { error } = await supabase.rpc('review_submission', {
    p_submission_id: submissionId,
    p_decision: decision,
  });
  if (error) throw error;
}

export async function fetchBlockedCount(): Promise<number> {
  const { data, error } = await supabase.rpc('my_blocked_count');
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function clearBlocks() {
  const { error } = await supabase.rpc('clear_my_blocks');
  if (error) throw error;
}

/* Musician ------------------------------------------------------------ */

/** Open briefs this musician may see (RLS hides closed ones and supervisors who blocked them). */
export async function fetchOpenBriefs(userId: string): Promise<Brief[]> {
  const { data, error } = await supabase
    .from('briefs')
    .select('*')
    .eq('status', 'open')
    .neq('supervisor_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Brief[];
}

export type MySubmission = Submission & {
  briefs: Pick<Brief, 'id' | 'title' | 'project_type' | 'status'> | null;
  songs: { id: string; title: string; song_type: string; poster_url: string | null } | null;
};

export async function fetchMySubmissions(): Promise<MySubmission[]> {
  const { data, error } = await supabase
    .from('submissions')
    .select('id, brief_id, song_id, note, status, created_at, reviewed_at, briefs ( id, title, project_type, status ), songs ( id, title, song_type, poster_url )')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown[]).map((row) => {
    const r = row as MySubmission & { briefs: unknown; songs: unknown };
    return {
      ...r,
      briefs: (Array.isArray(r.briefs) ? r.briefs[0] : r.briefs) ?? null,
      songs: (Array.isArray(r.songs) ? r.songs[0] : r.songs) ?? null,
    } as MySubmission;
  });
}

export async function submitToBrief(briefId: string, songId: string, note: string | null) {
  const { error } = await supabase
    .from('submissions')
    .insert({ brief_id: briefId, song_id: songId, note: note?.trim() || null });
  if (error) {
    if (error.code === '23505') throw new Error('That song is already submitted to this brief.');
    if (error.code === '42501') throw new Error('This brief is no longer accepting submissions.');
    throw error;
  }
}

export async function withdrawSubmission(id: string) {
  const { error } = await supabase.from('submissions').delete().eq('id', id);
  if (error) throw error;
}

export function briefSummary(b: Pick<Brief, 'vocals' | 'bpm_min' | 'bpm_max' | 'budget_eur' | 'territory'>) {
  const bits: string[] = [];
  if (b.vocals === 'instrumental') bits.push('Instrumental');
  if (b.vocals === 'vocals') bits.push('Vocals');
  if (b.bpm_min || b.bpm_max) bits.push(`${b.bpm_min ?? '?'}–${b.bpm_max ?? '?'} BPM`);
  if (b.budget_eur) bits.push(`≤ €${b.budget_eur.toLocaleString('en-GB')}`);
  if (b.territory) bits.push(b.territory);
  return bits;
}
