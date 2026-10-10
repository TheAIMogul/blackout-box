// Emergency contacts (not 911) for Miami-Dade. Static and bundled, so they work offline.
// Every number below was checked on 2026-10-10 against the agency's own page (src = that page).
// Numbers that could not be confirmed on an official page were left out on purpose.
import { getLang, type Lang } from './i18n'

export type Contact = {
  name: string
  number: string // as shown to people
  tel: string // dial string for tel:
  for: Record<Lang, string>
  src: string
  srcLabel: string
  icon: string
}

export const CONTACTS: Contact[] = [
  {
    name: 'Miami-Dade 311',
    number: '311 · 305-468-5900',
    tel: '311',
    for: {
      en: 'County info: shelters, storm updates, services (305 number from outside the county)',
      es: 'Información del condado: refugios, avisos de tormenta, servicios',
      ht: 'Enfòmasyon konte a: abri, nouvèl tanpèt, sèvis',
    },
    src: 'https://www.miamidade.gov/global/311/home.page',
    srcLabel: 'miamidade.gov',
    icon: 'support_agent',
  },
  {
    name: 'FPL power outage',
    number: '1-800-468-8243',
    tel: '18004688243',
    for: { en: 'Report a power outage or downed line', es: 'Reportar un apagón o cable caído', ht: 'Rapòte yon pàn kouran oswa yon fil ki tonbe' },
    src: 'https://www.fpl.com/support/contact.html',
    srcLabel: 'fpl.com',
    icon: 'power_off',
  },
  {
    name: 'Miami-Dade Sheriff (non-emergency)',
    number: '305-743-7433',
    tel: '3057437433',
    for: { en: 'Police help that is not life-threatening', es: 'Ayuda policial que no es de vida o muerte', ht: 'Èd polis ki pa danje lavi' },
    src: 'https://www.mdso.com/',
    srcLabel: 'mdso.com',
    icon: 'local_police',
  },
  {
    name: 'Water & Sewer emergency',
    number: '305-274-9272',
    tel: '3052749272',
    for: { en: '24-hour line: broken pipes, low pressure, sewer backups', es: 'Línea 24 horas: tuberías rotas, baja presión, aguas negras', ht: 'Liy 24 è: tiyo kase, presyon ba, egou ki debòde' },
    src: 'https://www.miamidade.gov/global/water/contact-water-sewer.page',
    srcLabel: 'miamidade.gov',
    icon: 'water_drop',
  },
  {
    name: 'Florida Poison Control',
    number: '1-800-222-1222',
    tel: '18002221222',
    for: { en: 'Poisoning, carbon monoxide, medicine questions', es: 'Envenenamiento, monóxido de carbono, medicinas', ht: 'Anpwazònman, monoksid kabòn, kesyon sou medikaman' },
    src: 'https://www.floridapoisoncontrol.org/',
    srcLabel: 'floridapoisoncontrol.org',
    icon: 'science',
  },
  {
    name: 'Evacuation help (EEAP)',
    number: '305-513-7700',
    tel: '3055137700',
    for: { en: 'County Emergency & Evacuation Assistance Program for people who need help to evacuate', es: 'Programa del condado para personas que necesitan ayuda para evacuar', ht: 'Pwogram konte a pou moun ki bezwen èd pou evakye' },
    src: 'https://www.miamidade.gov/fire/eeap.asp',
    srcLabel: 'miamidade.gov',
    icon: 'accessible',
  },
  {
    name: '211 Miami',
    number: '211 · 305-631-4211',
    tel: '211',
    for: { en: 'Food, housing, crisis and community help', es: 'Comida, vivienda, crisis y ayuda comunitaria', ht: 'Manje, lojman, kriz ak èd kominote' },
    src: 'https://www.211miami.org/',
    srcLabel: '211miami.org',
    icon: 'diversity_3',
  },
  {
    name: 'Florida SAIL',
    number: '1-800-342-3557',
    tel: '18003423557',
    for: { en: 'State disaster info line (staffed during emergencies)', es: 'Línea estatal de información de desastres (activa en emergencias)', ht: 'Liy enfòmasyon eta a pou dezas (aktif pandan ijans)' },
    src: 'https://floridadisaster.org/planprepare/information-line/',
    srcLabel: 'floridadisaster.org',
    icon: 'info',
  },
  {
    name: 'FEMA Helpline',
    number: '1-800-621-3362',
    tel: '18006213362',
    for: { en: 'Apply for federal disaster assistance (7 a.m.–10 p.m.)', es: 'Solicitar ayuda federal por desastre (7 a.m.–10 p.m.)', ht: 'Aplike pou èd federal pou dezas (7 a.m.–10 p.m.)' },
    src: 'https://www.disasterassistance.gov/',
    srcLabel: 'disasterassistance.gov',
    icon: 'assignment',
  },
]

const L: Record<string, Record<Lang, string>> = {
  title: { en: 'Emergency contacts', es: 'Contactos de emergencia', ht: 'Kontak ijans' },
  e911: { en: 'Life-threatening emergency? Call 911.', es: '¿Emergencia de vida o muerte? Llame al 911.', ht: 'Ijans ki an danje lavi? Rele 911.' },
  note: { en: 'Saved in the app, works offline. Numbers checked on official sites Oct 10, 2026.', es: 'Guardado en la app, funciona sin conexión. Números verificados en sitios oficiales el 10 oct 2026.', ht: 'Sere nan app la, mache san entènèt. Nimewo verifye sou sit ofisyèl 10 okt 2026.' },
  power: { en: 'Help nearby: hospitals, pharmacies, cooling', es: 'Ayuda cercana: hospitales, farmacias, lugares frescos', ht: 'Èd tou pre: lopital, famasi, kote ki fre' },
  shelters: { en: 'Shelters', es: 'Refugios', ht: 'Abri' },
  source: { en: 'source', es: 'fuente', ht: 'sous' },
}
export const cl = (k: string): string => L[k]?.[getLang()] ?? L[k]?.en ?? k
