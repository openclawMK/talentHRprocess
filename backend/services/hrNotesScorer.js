/**
 * HR Notes — persists free-text interviewer observations to the candidate record.
 * Notes are stored for reference and inform the interviewer's own scoring judgment;
 * they do not produce a separate AI-scored criterion entry.
 */

/**
 * @param {Object} candidate - mutated in place
 * @param {string} notesText
 * @param {{by?:string, by_id?:string, recommendation?:string}} [meta] - who wrote it,
 *   and optionally their recommendation ("approve"|"reject"|"hold") — distinct from
 *   the actual final decision, which a Level 2 user may not have permission to make.
 * @returns {{ saved: true, date: string }}
 */
export async function applyHrNotes(candidate, notesText, meta = {}) {
  if (!candidate.hr_notes_list) candidate.hr_notes_list = [];
  const date = new Date().toISOString().slice(0, 10);
  candidate.hr_notes_list.push({ text: notesText, date, by: meta.by || null, by_id: meta.by_id || null, recommendation: meta.recommendation || null });
  return { saved: true, date };
}
