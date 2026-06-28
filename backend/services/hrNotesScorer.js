/**
 * HR Notes — persists free-text interviewer observations to the candidate record.
 * Notes are stored for reference and inform the interviewer's own scoring judgment;
 * they do not produce a separate AI-scored criterion entry.
 */

/**
 * @param {Object} candidate - mutated in place
 * @param {string} notesText
 * @returns {{ saved: true, date: string }}
 */
export async function applyHrNotes(candidate, notesText) {
  if (!candidate.hr_notes_list) candidate.hr_notes_list = [];
  const date = new Date().toISOString().slice(0, 10);
  candidate.hr_notes_list.push({ text: notesText, date });
  return { saved: true, date };
}
