// Banned-phrase filter for model text (cold-chain + four-hour-rule briefs).
// Model output is never shown raw: medication answers that tell someone to stop/discard
// are replaced by fixed i18n copy unless the item status is DO_NOT_USE (frozen).

// Medication, status != DO_NOT_USE
export const MED_BANNED = /no (la |lo )?uses?|don'?t use|do not use|stop taking|throw (it )?away|discard|deseche|desechar|deja de|pa sèvi|jete/i
// Food, status DISCARD: never soften a discard
export const FOOD_SOFTEN = /probably (fine|ok)|should be (fine|ok)|smell|taste|sniff|still (good|safe)|huele|prueba|probablemente|pran sant|goute|toujou bon/i
// Dosing instructions (any status)
export const DOSING = /\b(take|inject|use|tome|inyecte|use|pran|bay)\b[^.\n]{0,24}\d+\s?(units?|unidades|inite|mg)\b/i

const MED_WORDS = /insulin|insulina|ensilin|lantus|humalog|novolog|trulicity|ozempic|metformin|amoxicillin|medic|medicine|medicina|medicamento|medikaman|pill|pastilla|grenn|pen\b|pluma|plim/i

export type FilterResult = { text: string; filtered: boolean; reason?: 'med' | 'dosing' }

/**
 * @param text model answer
 * @param question the user's question (used to decide whether the answer is about medication)
 * @param medNames names of medication items currently in the box
 * @param anyDoNotUse true when a medication item is DO_NOT_USE (frozen), where "do not use" is correct
 * @param fallback fixed i18n copy to show instead
 */
export function filterAnswer(text: string, question: string, medNames: string[], anyDoNotUse: boolean, fallback: string): FilterResult {
  const aboutMeds = MED_WORDS.test(text) || MED_WORDS.test(question) ||
    medNames.some((n) => n && (text.toLowerCase().includes(n.toLowerCase().split(' ')[0]) || question.toLowerCase().includes(n.toLowerCase().split(' ')[0])))
  if (DOSING.test(text)) return { text: fallback, filtered: true, reason: 'dosing' }
  if (aboutMeds && !anyDoNotUse && MED_BANNED.test(text)) return { text: fallback, filtered: true, reason: 'med' }
  return { text, filtered: false }
}
