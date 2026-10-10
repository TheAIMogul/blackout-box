// All UI strings for en / es / ht.
// Sources: specs/blackout-box-brief.html (safety footer) and specs/four-hour-rule-brief.html (status + control strings).
// Lines marked "// MT" are machine-translated by the build agent and need a native speaker check before the demo.
// Kreyòl strings from the briefs are themselves marked "draft, have a Kreyòl speaker check".

export type Lang = 'en' | 'es' | 'ht'
export const LANGS: Lang[] = ['en', 'es', 'ht']

type Dict = Record<string, string>

const en: Dict = {
  lang_name: 'English',
  tagline: 'The app that works when nothing else does.',
  tab_fourhour: '4-Hour Rule',
  tab_prep: 'Prep',
  tab_ask: 'Ask',
  tab_map: 'Map',
  st_online: 'Online',
  st_offline: 'Offline',
  st_noserver: 'No server',
  st_demo_data: 'demo data',
  st_checking: 'Checking',
  // safety footer (blackout-box brief, verbatim)
  footer: 'This information comes from FDA, USDA, NWS, FEMA and Miami-Dade sources. It is not medical advice. Call your pharmacist or doctor. In an emergency, call 911.',
  // 4-Hour Rule
  fh_title: 'The 4-Hour Rule',
  fh_sub: 'Everything in your fridge and medicine cabinet has a clock.',
  fh_photo: 'Take a photo',
  fh_demo: 'Try demo photo',
  demo_local: 'Load sample items (no server)',
  fh_none_found: 'No items found in that photo. Try one shelf at a time, or add items by hand.',
  fh_reading: 'Reading photo…',
  fh_read_fail: 'Could not read the photo. Showing what is saved.',
  power_out: 'Power went out',
  hours_ago: 'hours ago',
  opened_fridge: 'I opened the fridge',
  fridge_door: 'Fridge door',
  door_opens: 'door opens',
  reset: 'Reset',
  freezer: 'Freezer',
  full: 'Full',
  half: 'Half',
  indoor_temp: 'Indoor temperature °F',
  estimated: 'estimated',
  thermometer: 'thermometer',
  temp_placeholder: 'e.g. 88',
  no_reading: 'no reading',
  items: 'Items',
  add_item: 'Add',
  item_name: 'Item name',
  food: 'Food',
  med: 'Medicine',
  delete: 'Delete',
  clear_all: 'Clear all',
  fh_empty: 'No items yet. Take a photo of the open fridge or the medicine shelf, or add an item by hand.',
  read_by: 'Read by',
  via: 'via',
  demo_items: 'Demo items (no model call)',
  demo_items_fallback: 'Server unreachable: showing demo items',
  no_clock: 'No clock',
  over_limit: 'Over limit',
  left: 'left',
  door_penalty_note: 'Each door opening takes 30 min off the clock (our assumption, not USDA).',
  'status.SAFE': 'Safe',
  'status.USE_NOW': 'Use now',
  'status.DISCARD': 'Discard',
  'status.PAST_LIMIT': 'Past label limit',
  'status.DO_NOT_USE': 'Do not use: label says do not freeze',
  'status.UNKNOWN': 'Unknown',
  'act.food.SAFE': 'Keep the fridge and freezer closed.',
  'act.food.USE_NOW': 'Cook it now or move it to a cooler with ice.',
  'act.food.DISCARD': 'USDA: discard it. When in doubt, throw it out.',
  'act.food.UNKNOWN': 'When in doubt, throw it out.',
  'act.food.PAST_LIMIT': 'USDA: discard it. When in doubt, throw it out.',
  'act.food.DO_NOT_USE': 'USDA: discard it.',
  'act.med.SAFE': 'Inside the FDA label window. Keep it as cool as you can.',
  'act.med.USE_NOW': 'Label window ends soon. Keep it cool and get a replacement.',
  'act.insulin.PAST_LIMIT': 'Past label limit. Keep it cool, get a replacement. Keep using it only if you have no replacement. Check blood sugar more often.',
  'act.med.PAST_LIMIT': 'Past label limit. Keep it as cool as you can, get a replacement, and ask your pharmacist.',
  'act.med.DO_NOT_USE': 'It froze and the label says do not freeze. Get a replacement.',
  'act.med.UNKNOWN': 'Unknown. Ask your pharmacist.',
  'act.med.DISCARD': 'Ask your pharmacist.',
  doubt: 'When in doubt, throw it out.',
  // Prep
  prep_title: 'Pack my box',
  prep_sub: 'Before the storm: save your zone, places with power, FEMA, and the rules onto this device.',
  prep_btn: 'Pack my box',
  prep_locating: 'Finding your location…',
  prep_fallback_loc: 'Location not available. Using downtown Miami (25.77, -80.19).',
  prep_loading: 'Downloading…',
  prep_done: 'Prep complete. This works offline.',
  prep_cached: 'Saved on this device',
  prep_none: 'Nothing saved yet. Tap Pack my box while you have service.',
  prep_fail: 'Could not reach the server. Showing what is saved.',
  prep_demo: 'Sample data (server unreachable). Not live.',
  zone: 'Evacuation zone',
  zone_none: 'Not in an evacuation zone',
  zone_unknown: 'No Miami-Dade zone found for this location',
  zone_check: 'Check whether your zone has been ordered to evacuate (miamidade.gov or 311).',
  places: 'Places likely to have power',
  places_note: 'A hint, not a promise. Shelters show only when the county opens them.',
  place_power: 'EV charger (24 h power)',
  place_library: 'Library',
  place_fire: 'Fire station',
  mi: 'mi',
  fema: 'FEMA declarations, Miami-Dade',
  fema_register: 'Register at DisasterAssistance.gov or call 1-800-621-3362 once you have service.',
  statute: 'Florida early refill law',
  insulin: 'FDA: insulin in an emergency',
  food_rules: 'USDA: food after a power outage',
  tide: 'Tide (NOAA)',
  tide_next_high: 'Next high tide',
  tide_none: 'No tide data saved.',
  weather: 'Weather (NWS)',
  heat_index: 'heat index',
  source: 'Source',
  checked: 'checked',
  // Ask
  ask_title: 'Ask',
  ask_sub: 'Answers come only from what is saved in your box.',
  ask_placeholder: 'Ask in English, Español, or Kreyòl…',
  ask_send: 'Ask',
  ask_thinking: 'Thinking…',
  ask_offline: 'AI needs a connection. Your prep data and clocks still work.',
  ask_not_saved: "I don't have that saved. Check when service returns.",
  ask_filtered: 'This answer was replaced with fixed safety copy.',
  ask_911: 'This sounds like an emergency. Stay away from the hazard. Call 911 when you have service.',
  ask_q1: 'Am I in an evacuation zone?',
  ask_q2: 'Where can I find power?',
  ask_q3: 'Is my insulin still good?',
  ask_need_prep: 'Pack your box first (Prep tab) so answers have data.',
  ans_zone: 'You are in Miami-Dade evacuation Zone {z}. Check whether Zone {z} has been ordered to evacuate (miamidade.gov or 311).',
  ans_zone_none: 'Your saved location is not in a Miami-Dade evacuation zone.',
  ans_places: 'Places likely to have power, saved {t}:',
  ans_food: 'USDA: a closed fridge keeps food safe for about 4 hours without power. After that, discard perishable food. A full freezer holds about 48 hours (24 hours if half full).',
  ans_insulin: 'FDA: insulin can be kept at 59–86°F (15–30°C) for up to 28 days. In an emergency, if there is no replacement, it may still need to be used. Never use frozen insulin. Get a replacement as soon as you can.',
  // Map
  map_loading: 'Map loading…',
  map_missing: 'Map loading… (map module not built yet)',
  model_demo: 'demo',
  nav_menu: 'Main menu',
  lang_label: 'Language',
  picker_none: 'No box packed',
  drawer_note: 'Works offline after one visit. Data from FDA, USDA, NWS, FEMA, NOAA and Miami-Dade.',
  cite: 'Source',
  place_name: 'Name',
  place_type: 'Type',
  distance: 'Distance',
  fema_title: 'Title',
  fema_date: 'Declared',
  call_911: 'Call 911.',
}

const es: Dict = {
  lang_name: 'Español',
  tagline: 'La app que funciona cuando nada más funciona.', // MT
  tab_fourhour: 'Regla de 4 horas', // MT
  tab_prep: 'Preparar', // MT
  tab_ask: 'Preguntar', // MT
  tab_map: 'Mapa',
  st_online: 'En línea', // MT
  st_offline: 'Sin conexión', // MT
  st_noserver: 'Sin servidor', // MT
  st_demo_data: 'datos de demostración', // MT
  st_checking: 'Verificando', // MT
  footer: 'Esta información proviene de fuentes de la FDA, USDA, NWS, FEMA y Miami-Dade. No es consejo médico. Llame a su farmacéutico o médico. En una emergencia, llame al 911.',
  fh_title: 'La regla de 4 horas', // MT
  fh_sub: 'Todo en su refrigerador y botiquín tiene un reloj.', // MT
  fh_photo: 'Tomar una foto', // MT
  fh_demo: 'Probar foto de ejemplo', // MT
  demo_local: 'Cargar ejemplos (sin servidor)', // MT
  fh_none_found: 'No se encontraron artículos en la foto. Pruebe un estante a la vez o agréguelos a mano.', // MT
  fh_reading: 'Leyendo la foto…', // MT
  fh_read_fail: 'No se pudo leer la foto. Mostrando lo guardado.', // MT
  power_out: 'Se fue la luz',
  hours_ago: 'horas atrás', // MT
  opened_fridge: 'Abrí el refrigerador',
  fridge_door: 'Puerta del refrigerador', // MT
  door_opens: 'aperturas', // MT
  reset: 'Reiniciar', // MT
  freezer: 'Congelador', // MT
  full: 'Lleno', // MT
  half: 'Medio', // MT
  indoor_temp: 'Temperatura interior °F', // MT
  estimated: 'estimada', // MT
  thermometer: 'termómetro', // MT
  temp_placeholder: 'ej. 88', // MT
  no_reading: 'sin lectura', // MT
  items: 'Artículos', // MT
  add_item: 'Agregar', // MT
  item_name: 'Nombre del artículo', // MT
  food: 'Comida', // MT
  med: 'Medicina', // MT
  delete: 'Borrar', // MT
  clear_all: 'Borrar todo', // MT
  fh_empty: 'Aún no hay artículos. Tome una foto del refrigerador abierto o del estante de medicinas, o agregue uno a mano.', // MT
  read_by: 'Leído por', // MT
  via: 'vía', // MT
  demo_items: 'Artículos de ejemplo (sin modelo)', // MT
  demo_items_fallback: 'Servidor no disponible: artículos de ejemplo', // MT
  no_clock: 'Sin reloj', // MT
  over_limit: 'Fuera de límite', // MT
  left: 'restante', // MT
  door_penalty_note: 'Cada apertura quita 30 min del reloj (nuestra suposición, no del USDA).', // MT
  'status.SAFE': 'Seguro',
  'status.USE_NOW': 'Úselo ahora',
  'status.DISCARD': 'Deséchelo',
  'status.PAST_LIMIT': 'Fuera del límite de la etiqueta',
  'status.DO_NOT_USE': 'No lo use: la etiqueta dice que no se congele', // MT
  'status.UNKNOWN': 'Desconocido',
  'act.food.SAFE': 'Mantenga cerrados el refrigerador y el congelador.', // MT
  'act.food.USE_NOW': 'Cocínelo ahora o páselo a una nevera con hielo.', // MT
  'act.food.DISCARD': 'USDA: deséchelo. Ante la duda, deséchelo.', // MT (second sentence from brief)
  'act.food.UNKNOWN': 'Ante la duda, deséchelo.',
  'act.food.PAST_LIMIT': 'USDA: deséchelo. Ante la duda, deséchelo.', // MT
  'act.food.DO_NOT_USE': 'USDA: deséchelo.', // MT
  'act.med.SAFE': 'Dentro del plazo de la etiqueta de la FDA. Manténgalo lo más fresco posible.', // MT
  'act.med.USE_NOW': 'El plazo de la etiqueta termina pronto. Manténgalo fresco y consiga un reemplazo.', // MT
  'act.insulin.PAST_LIMIT': 'Fuera del límite de la etiqueta. Manténgalo fresco y consiga un reemplazo. Siga usándolo solo si no tiene reemplazo. Revise su azúcar más seguido.', // MT (first two sentences from brief)
  'act.med.PAST_LIMIT': 'Fuera del límite de la etiqueta. Manténgalo lo más fresco posible, consiga un reemplazo y consulte a su farmacéutico.', // MT
  'act.med.DO_NOT_USE': 'Se congeló y la etiqueta dice que no se congele. Consiga un reemplazo.', // MT
  'act.med.UNKNOWN': 'Desconocido. Consulte a su farmacéutico.',
  'act.med.DISCARD': 'Consulte a su farmacéutico.', // MT
  doubt: 'Ante la duda, deséchelo.',
  prep_title: 'Preparar mi caja', // MT
  prep_sub: 'Antes de la tormenta: guarde su zona, lugares con electricidad, FEMA y las reglas en este dispositivo.', // MT
  prep_btn: 'Preparar mi caja', // MT
  prep_locating: 'Buscando su ubicación…', // MT
  prep_fallback_loc: 'Ubicación no disponible. Usando el centro de Miami (25.77, -80.19).', // MT
  prep_loading: 'Descargando…', // MT
  prep_done: 'Listo. Esto funciona sin conexión.', // MT
  prep_cached: 'Guardado en este dispositivo', // MT
  prep_none: 'Nada guardado aún. Toque Preparar mi caja mientras tenga servicio.', // MT
  prep_fail: 'No se pudo conectar al servidor. Mostrando lo guardado.', // MT
  prep_demo: 'Datos de ejemplo (servidor no disponible). No es en vivo.', // MT
  zone: 'Zona de evacuación', // MT
  zone_none: 'No está en una zona de evacuación', // MT
  zone_unknown: 'No se encontró zona de Miami-Dade para este lugar', // MT
  zone_check: 'Verifique si su zona tiene orden de evacuación (miamidade.gov o 311).', // MT
  places: 'Lugares que probablemente tienen electricidad', // MT
  places_note: 'Una pista, no una promesa. Los refugios aparecen solo cuando el condado los abre.', // MT
  place_power: 'Cargador eléctrico (24 h)', // MT
  place_library: 'Biblioteca', // MT
  place_fire: 'Estación de bomberos', // MT
  mi: 'mi',
  fema: 'Declaraciones de FEMA, Miami-Dade', // MT
  fema_register: 'Regístrese en DisasterAssistance.gov o llame al 1-800-621-3362 cuando tenga servicio.', // MT
  statute: 'Ley de Florida de resurtido anticipado', // MT
  insulin: 'FDA: insulina en una emergencia', // MT
  food_rules: 'USDA: comida después de un apagón', // MT
  tide: 'Marea (NOAA)', // MT
  tide_next_high: 'Próxima marea alta', // MT
  tide_none: 'No hay datos de marea guardados.', // MT
  weather: 'Clima (NWS)', // MT
  heat_index: 'índice de calor', // MT
  source: 'Fuente', // MT
  checked: 'revisado', // MT
  ask_title: 'Preguntar', // MT
  ask_sub: 'Las respuestas vienen solo de lo guardado en su caja.', // MT
  ask_placeholder: 'Pregunte en English, Español o Kreyòl…', // MT
  ask_send: 'Preguntar', // MT
  ask_thinking: 'Pensando…', // MT
  ask_offline: 'La IA necesita conexión. Sus datos de preparación y los relojes siguen funcionando.', // MT
  ask_not_saved: 'No tengo eso guardado. Revise cuando vuelva el servicio.', // MT
  ask_filtered: 'Esta respuesta se reemplazó con texto fijo de seguridad.', // MT
  ask_911: 'Esto parece una emergencia. Aléjese del peligro. Llame al 911 cuando tenga servicio.', // MT
  ask_q1: '¿Estoy en zona de evacuación?',
  ask_q2: '¿Dónde hay electricidad?', // MT
  ask_q3: '¿Mi insulina sigue buena?', // MT
  ask_need_prep: 'Primero prepare su caja (pestaña Preparar) para que las respuestas tengan datos.', // MT
  ans_zone: 'Usted está en la Zona de evacuación {z} de Miami-Dade. Verifique si la Zona {z} tiene orden de evacuación (miamidade.gov o 311).', // MT
  ans_zone_none: 'Su ubicación guardada no está en una zona de evacuación de Miami-Dade.', // MT
  ans_places: 'Lugares que probablemente tienen electricidad, guardado {t}:', // MT
  ans_food: 'USDA: un refrigerador cerrado mantiene la comida segura unas 4 horas sin electricidad. Después, deseche la comida perecedera. Un congelador lleno aguanta unas 48 horas (24 si está a la mitad).', // MT
  ans_insulin: 'FDA: la insulina se puede guardar a 59–86°F (15–30°C) hasta 28 días. En una emergencia, si no hay reemplazo, puede que todavía necesite usarla. Nunca use insulina congelada. Consiga un reemplazo lo antes posible.', // MT
  map_loading: 'Cargando mapa…', // MT
  map_missing: 'Cargando mapa… (módulo aún no listo)', // MT
  model_demo: 'demostración', // MT
  nav_menu: 'Menú principal', // MT
  lang_label: 'Idioma',
  picker_none: 'Caja sin preparar', // MT
  drawer_note: 'Funciona sin conexión después de una visita. Datos de FDA, USDA, NWS, FEMA, NOAA y Miami-Dade.', // MT
  cite: 'Fuente',
  place_name: 'Nombre',
  place_type: 'Tipo',
  distance: 'Distancia',
  fema_title: 'Título',
  fema_date: 'Declarada', // MT
  call_911: 'Llame al 911.',
}

const ht: Dict = {
  lang_name: 'Kreyòl',
  tagline: 'Aplikasyon ki mache lè anyen pa mache.', // MT
  tab_fourhour: 'Règ 4 èdtan', // MT
  tab_prep: 'Prepare', // MT
  tab_ask: 'Mande', // MT
  tab_map: 'Kat', // MT
  st_online: 'Konekte', // MT
  st_offline: 'Pa konekte', // MT
  st_noserver: 'Pa gen sèvè', // MT
  st_demo_data: 'done egzanp', // MT
  st_checking: 'N ap tcheke', // MT
  footer: 'Enfòmasyon sa a soti nan sous FDA, USDA, NWS, FEMA ak Miami-Dade. Se pa konsèy medikal. Rele famasyen oswa doktè ou. Si se yon ijans, rele 911.',
  fh_title: 'Règ 4 èdtan an', // MT
  fh_sub: 'Tout bagay nan frijidè ou ak nan armwa medikaman ou gen yon revèy.', // MT
  fh_photo: 'Pran yon foto', // MT
  fh_demo: 'Eseye foto egzanp', // MT
  demo_local: 'Mete egzanp (san sèvè)', // MT
  fh_none_found: 'Nou pa jwenn anyen nan foto a. Eseye yon etajè alafwa, oswa ajoute yo ak men.', // MT
  fh_reading: 'N ap li foto a…', // MT
  fh_read_fail: 'Nou pa t ka li foto a. Men sa ki sove.', // MT
  power_out: 'Kouran an ale',
  hours_ago: 'èdtan pase', // MT
  opened_fridge: 'Mwen te louvri frijidè a',
  fridge_door: 'Pòt frijidè a', // MT
  door_opens: 'fwa louvri', // MT
  reset: 'Rekòmanse', // MT
  freezer: 'Frizè', // MT
  full: 'Plen', // MT
  half: 'Mwatye', // MT
  indoor_temp: 'Tanperati andedan °F', // MT
  estimated: 'estimasyon', // MT
  thermometer: 'tèmomèt', // MT
  temp_placeholder: 'egz. 88', // MT
  no_reading: 'pa gen mezi', // MT
  items: 'Bagay yo', // MT
  add_item: 'Ajoute', // MT
  item_name: 'Non bagay la', // MT
  food: 'Manje', // MT
  med: 'Medikaman', // MT
  delete: 'Efase', // MT
  clear_all: 'Efase tout', // MT
  fh_empty: 'Pa gen anyen ankò. Pran yon foto frijidè a ouvè oswa etajè medikaman an, oswa ajoute youn ak men.', // MT
  read_by: 'Li pa', // MT
  via: 'atravè', // MT
  demo_items: 'Egzanp (san modèl)', // MT
  demo_items_fallback: 'Sèvè a pa reponn: men egzanp', // MT
  no_clock: 'Pa gen revèy', // MT
  over_limit: 'Depase limit', // MT
  left: 'ki rete', // MT
  door_penalty_note: 'Chak fwa ou louvri pòt la, revèy la pèdi 30 minit (se pa chif USDA, se pa nou).', // MT
  'status.SAFE': 'San danje',
  'status.USE_NOW': 'Sèvi avè l kounye a',
  'status.DISCARD': 'Jete l',
  'status.PAST_LIMIT': 'Li depase limit etikèt la',
  'status.DO_NOT_USE': 'Pa sèvi avè l: etikèt la di pa kite l jele', // MT
  'status.UNKNOWN': 'Nou pa konnen',
  'act.food.SAFE': 'Kenbe frijidè a ak frizè a fèmen.', // MT
  'act.food.USE_NOW': 'Kwit li kounye a oswa mete l nan yon glasyè ak glas.', // MT
  'act.food.DISCARD': 'USDA: jete l. Si ou pa sèten, jete l.', // MT (second sentence from brief)
  'act.food.UNKNOWN': 'Si ou pa sèten, jete l.',
  'act.food.PAST_LIMIT': 'USDA: jete l. Si ou pa sèten, jete l.', // MT
  'act.food.DO_NOT_USE': 'USDA: jete l.', // MT
  'act.med.SAFE': 'Li toujou nan limit etikèt FDA a. Kenbe l pi fre ke ou kapab.', // MT
  'act.med.USE_NOW': 'Limit etikèt la prèt pou fini. Kenbe l fre epi jwenn yon lòt.', // MT
  'act.insulin.PAST_LIMIT': 'Li depase limit etikèt la. Kenbe l fre epi jwenn yon lòt. Kontinye sèvi avè l sèlman si ou pa gen yon lòt. Tcheke sik nan san ou pi souvan.', // MT (first two sentences from brief)
  'act.med.PAST_LIMIT': 'Li depase limit etikèt la. Kenbe l pi fre ke ou kapab, jwenn yon lòt, epi mande famasyen ou.', // MT
  'act.med.DO_NOT_USE': 'Li te jele e etikèt la di pa kite l jele. Jwenn yon lòt.', // MT
  'act.med.UNKNOWN': 'Nou pa konnen. Mande famasyen ou.',
  'act.med.DISCARD': 'Mande famasyen ou.', // MT
  doubt: 'Si ou pa sèten, jete l.',
  prep_title: 'Ranje bwat mwen', // MT
  prep_sub: 'Anvan tanpèt la: sove zòn ou, kote ki gen kouran, FEMA, ak règ yo sou aparèy sa a.', // MT
  prep_btn: 'Ranje bwat mwen', // MT
  prep_locating: 'N ap chèche kote ou ye…', // MT
  prep_fallback_loc: 'Nou pa jwenn kote ou ye. N ap sèvi ak anba lavil Miami (25.77, -80.19).', // MT
  prep_loading: 'N ap telechaje…', // MT
  prep_done: 'Fini. Sa a mache san entènèt.', // MT
  prep_cached: 'Sove sou aparèy sa a', // MT
  prep_none: 'Pa gen anyen ki sove. Peze Ranje bwat mwen pandan ou gen sèvis.', // MT
  prep_fail: 'Nou pa ka jwenn sèvè a. Men sa ki sove.', // MT
  prep_demo: 'Done egzanp (sèvè a pa reponn). Se pa an dirèk.', // MT
  zone: 'Zòn evakyasyon', // MT
  zone_none: 'Ou pa nan yon zòn evakyasyon', // MT
  zone_unknown: 'Nou pa jwenn zòn Miami-Dade pou kote sa a', // MT
  zone_check: 'Tcheke si yo bay lòd pou evakye zòn ou (miamidade.gov oswa 311).', // MT
  places: 'Kote ki ka gen kouran', // MT
  places_note: 'Se yon endikasyon, se pa yon garanti. Abri yo parèt sèlman lè konte a louvri yo.', // MT
  place_power: 'Chajè machin elektrik (24 è)', // MT
  place_library: 'Bibliyotèk', // MT
  place_fire: 'Estasyon ponpye', // MT
  mi: 'mi',
  fema: 'Deklarasyon FEMA, Miami-Dade', // MT
  fema_register: 'Enskri sou DisasterAssistance.gov oswa rele 1-800-621-3362 lè ou gen sèvis.', // MT
  statute: 'Lwa Florid pou ranpli preskripsyon bonè', // MT
  insulin: 'FDA: ensilin nan yon ijans', // MT
  food_rules: 'USDA: manje apre kouran koupe', // MT
  tide: 'Mare (NOAA)', // MT
  tide_next_high: 'Pwochen mare wo', // MT
  tide_none: 'Pa gen done mare ki sove.', // MT
  weather: 'Tan (NWS)', // MT
  heat_index: 'endèks chalè', // MT
  source: 'Sous', // MT
  checked: 'tcheke', // MT
  ask_title: 'Mande', // MT
  ask_sub: 'Repons yo soti sèlman nan sa ki sove nan bwat ou.', // MT
  ask_placeholder: 'Mande an English, Español, oswa Kreyòl…', // MT
  ask_send: 'Mande', // MT
  ask_thinking: 'N ap reflechi…', // MT
  ask_offline: 'IA a bezwen koneksyon. Done preparasyon ou ak revèy yo toujou mache.', // MT
  ask_not_saved: 'Mwen pa gen sa sove. Tcheke lè sèvis la tounen.', // MT
  ask_filtered: 'Nou ranplase repons sa a ak yon tèks sekirite fiks.', // MT
  ask_911: 'Sa sanble yon ijans. Rete lwen danje a. Rele 911 lè ou gen sèvis.', // MT
  ask_q1: 'Èske mwen nan yon zòn evakyasyon?', // MT
  ask_q2: 'Ki kote mwen ka jwenn kouran?',
  ask_q3: 'Èske ensilin mwen an toujou bon?',
  ask_need_prep: 'Ranje bwat ou anvan (onglè Prepare) pou repons yo gen done.', // MT
  ans_zone: 'Ou nan Zòn evakyasyon {z} Miami-Dade. Tcheke si yo bay lòd pou evakye Zòn {z} (miamidade.gov oswa 311).', // MT
  ans_zone_none: 'Kote ou sove a pa nan yon zòn evakyasyon Miami-Dade.', // MT
  ans_places: 'Kote ki ka gen kouran, sove {t}:', // MT
  ans_food: 'USDA: yon frijidè ki fèmen kenbe manje an sekirite anviwon 4 èdtan san kouran. Apre sa, jete manje ki ka gate. Yon frizè plen kenbe anviwon 48 èdtan (24 si li mwatye plen).', // MT
  ans_insulin: 'FDA: ou ka kenbe ensilin nan 59–86°F (15–30°C) jiska 28 jou. Nan yon ijans, si ou pa gen yon lòt, ou ka toujou bezwen sèvi avè l. Pa janm sèvi ak ensilin ki te jele. Jwenn yon lòt pi vit ke ou kapab.', // MT
  map_loading: 'Kat la ap chaje…', // MT
  map_missing: 'Kat la ap chaje… (modil la poko pare)', // MT
  model_demo: 'egzanp', // MT
  nav_menu: 'Meni prensipal', // MT
  lang_label: 'Lang', // MT
  picker_none: 'Bwat la poko ranje', // MT
  drawer_note: 'Li mache san entènèt apre premye vizit la. Done FDA, USDA, NWS, FEMA, NOAA ak Miami-Dade.', // MT
  cite: 'Sous', // MT
  place_name: 'Non', // MT
  place_type: 'Kalite', // MT
  distance: 'Distans', // MT
  fema_title: 'Tit', // MT
  fema_date: 'Dat deklarasyon', // MT
  call_911: 'Rele 911.', // MT
}

const DICTS: Record<Lang, Dict> = { en, es, ht }

const LS_KEY = 'bb.lang'
let current: Lang = (() => {
  try {
    const v = localStorage.getItem(LS_KEY)
    if (v === 'en' || v === 'es' || v === 'ht') return v
  } catch { /* storage blocked */ }
  return 'en'
})()

const listeners = new Set<(l: Lang) => void>()

export function getLang(): Lang { return current }

export function setLang(l: Lang): void {
  current = l
  try { localStorage.setItem(LS_KEY, l) } catch { /* ignore */ }
  document.documentElement.lang = l === 'ht' ? 'ht' : l
  listeners.forEach((fn) => fn(l))
}

export function onLang(fn: (l: Lang) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = DICTS[current][key] ?? DICTS.en[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v))
  return s
}
