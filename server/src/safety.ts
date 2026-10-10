// Server-side banned-phrase filter (regexes from specs/four-hour-rule-brief.html "Code-side banned-phrase filter",
// a superset of the cold-chain brief's /no (la )?uses|don't use|do not use|stop taking|throw (it )?away|discard|pa sèvi/i).
// Applied to model text from /api/chat, /api/vision/describe and /api/translate before it leaves the server.

export type Lang = 'en' | 'es' | 'ht';

/** Medication, status != DO_NOT_USE. */
export const MED_BANNED =
  /no (la |lo )?uses?|don'?t use|do not use|stop taking|throw (it )?away|discard|deseche|desechar|deja de|pa sèvi|jete/i;
/** Food, status DISCARD: never reassure. */
export const FOOD_BANNED =
  /probably (fine|ok)|should be (fine|ok)|smell|taste|sniff|still (good|safe)|huele|prueba|probablemente|pran sant|goute|toujou bon/i;
/** Any status: dosing instructions (a dosing verb near a number + unit). Label strengths like "Amoxicillin 500 mg"
 *  or "100 units/mL" are printed text, not dosing, and are allowed. */
export const DOSING =
  /\b(take|inject|give|increase|decrease|reduce|double|lower|raise|tome|inyecte|inyectar|aumente|reduzca|duplique|pran|bay|enjekte|ogmante|diminye)\b[^.]{0,40}?\d+(\.\d+)?\s?(units?|unidades|inite|mg|ml)\b(?!\s*\/\s*m?l)/i;
/** Scene photos: never call a space safe (P4 rule). */
export const SAFE_CLAIM = /\b(is|looks|seems|appears) (to be )?safe\b|\bes seguro\b|\bparece seguro\b|\ban sekirite\b/i;

const MED_WORDS =
  /insulin|insulina|ensilin|medic|medik|pill|pastilla|grenn|tablet|pen\b|pluma|plum|vial|lantus|humalog|trulicity|ozempic|basaglar|metformin|amoxicillin|pharmac|farmac|famasi|prescri|receta|dose|dosis|doz/i;
const FOOD_WORDS =
  /food|fridge|freezer|milk|egg|meat|chicken|comida|refrigerador|nevera|leche|huevo|carne|pollo|manje|frijidè|lèt|ze\b|vyann|poul/i;

/** "Never taste food" is the USDA line itself; strip negated forms before testing FOOD_BANNED. */
const NEGATED_FOOD =
  /(never|nunca|jamè|pa janm|do not|don'?t|no)\s+(\S+\s+){0,3}?(taste|smell|sniff|prueb\w*|huel\w*|goute|pran sant)/gi;

export const FIXED: Record<'med' | 'food' | 'translate_rejected' | 'scene', Record<Lang, string>> = {
  med: {
    en: 'Keep your medicine as cool as possible and out of the sun. If it is needed to sustain life, like insulin, and you have no replacement, FDA says it may be used until you get a new supply. Check your blood sugar more often and ask your pharmacist.',
    es: 'Mantenga su medicamento lo más fresco posible y fuera del sol. Si es necesario para vivir, como la insulina, y no tiene reemplazo, la FDA dice que puede usarse hasta conseguir uno nuevo. Mídase el azúcar más seguido y consulte a su farmacéutico.',
    ht: 'Kenbe medikaman ou a fre otank posib, lwen solèy. Si ou bezwen l pou viv, tankou ensilin, epi ou pa gen lòt, FDA di ou ka sèvi avè l jiskaske ou jwenn yon nouvo. Tcheke sik ou pi souvan epi mande famasyen ou.',
  },
  food: {
    en: 'USDA: a closed refrigerator keeps food safe for about 4 hours without power. After that, discard refrigerated perishable food. Never taste food to decide. When in doubt, throw it out.',
    es: 'USDA: un refrigerador cerrado mantiene la comida segura unas 4 horas sin electricidad. Después, deseche la comida perecedera refrigerada. Nunca la pruebe para decidir. Ante la duda, deséchela.',
    ht: 'USDA: yon frijidè ki fèmen kenbe manje an sekirite anviwon 4 èdtan san kouran. Apre sa, jete manje ki ka gate yo. Pa janm goute manje pou deside. Si ou pa sèten, jete l.',
  },
  translate_rejected: {
    en: 'Translation withheld by the safety filter; showing the original text.',
    es: 'Traducción retenida por el filtro de seguridad; se muestra el texto original.',
    ht: 'Filt sekirite a bloke tradiksyon an; men tèks orijinal la.',
  },
  scene: {
    en: 'Photo read. Stay out of any area with water, wires, or damage. Call 911 when you have service if anyone is in danger.',
    es: 'Foto leída. No entre en zonas con agua, cables o daños. Llame al 911 cuando tenga servicio si alguien está en peligro.',
    ht: 'Nou li foto a. Pa antre kote ki gen dlo, fil kouran, oswa domaj. Rele 911 lè ou gen siyal si yon moun an danje.',
  },
};

export type FilterResult = { text: string; filtered: boolean; rule?: string };

const lang3 = (l: string | undefined): Lang => (l === 'es' || l === 'ht' ? l : 'en');

/** Chat answers (P2). Medication context: MED_BANNED or DOSING -> fixed med copy. Food context: FOOD_BANNED -> fixed food copy. */
export function filterAnswer(answer: string, question: string, lang: string | undefined): FilterResult {
  const L = lang3(lang);
  const both = `${question}\n${answer}`;
  if (MED_WORDS.test(both)) {
    if (MED_BANNED.test(answer) && !isFoodDiscardOnly(answer)) return { text: FIXED.med[L], filtered: true, rule: 'med_banned' };
    if (DOSING.test(answer)) return { text: FIXED.med[L], filtered: true, rule: 'dosing' };
  }
  if (FOOD_WORDS.test(both) && FOOD_BANNED.test(answer.replace(NEGATED_FOOD, ''))) {
    return { text: FIXED.food[L], filtered: true, rule: 'food_banned' };
  }
  return { text: answer, filtered: false };
}

/** A food-only answer may say "discard" (USDA). Only treat MED_BANNED as a hit when medication words are in the answer. */
function isFoodDiscardOnly(answer: string): boolean {
  return !MED_WORDS.test(answer);
}

/** Scene/document descriptions (P4): drop sentences that trip a rule; if nothing is left, fixed copy. */
export function filterDescription(text: string, lang: string | undefined): FilterResult {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter(
    (s) => !(SAFE_CLAIM.test(s) || DOSING.test(s) || (MED_WORDS.test(s) && MED_BANNED.test(s)) || FOOD_BANNED.test(s.replace(NEGATED_FOOD, ''))),
  );
  if (kept.length === sentences.length) return { text, filtered: false };
  if (!kept.length) return { text: FIXED.scene[lang3(lang)], filtered: true, rule: 'scene_all_filtered' };
  return { text: kept.join(' '), filtered: true, rule: 'scene_sentence_removed' };
}

/** Translations (P3): a banned phrase may appear only if the source already carried that meaning. */
export function filterTranslation(source: string, translated: string): FilterResult {
  const srcMed = MED_BANNED.test(source);
  const srcFood = FOOD_BANNED.test(source);
  const srcDose = DOSING.test(source);
  if ((!srcMed && MED_BANNED.test(translated)) || (!srcFood && FOOD_BANNED.test(translated.replace(NEGATED_FOOD, ''))) || (!srcDose && DOSING.test(translated))) {
    return { text: source, filtered: true, rule: 'translation_added_banned_phrase' };
  }
  return { text: translated, filtered: false };
}
