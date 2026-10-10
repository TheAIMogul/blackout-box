// All UI strings for en / es / ht.
// Sources: specs/blackout-box-brief.html (safety footer) and specs/four-hour-rule-brief.html (status + control strings).
// Lines marked "// MT" are machine-translated by the build agent and need a native speaker check before the demo.
// Kreyòl strings from the briefs are themselves marked "draft, have a Kreyòl speaker check".

export type Lang = 'en' | 'es' | 'ht'
export const LANGS: Lang[] = ['en', 'es', 'ht']

type Dict = Record<string, string>

const en: Dict = {
  snap_fridge: 'Snap your fridge',
  snap_meds: 'Snap your medicine',
  snap_hint: 'Opens your camera',
  snap_reading: 'Reading your photo…',
  items_saved: '{n} items saved',
  item_saved: '1 item saved',
  power_went_out: 'The power just went out',
  pack_box: 'Pack my box',
  open_clocks: 'Open Clocks',
  drill_title: 'SIMULATED STORM',
  drill_sub: 'Hurricane drill — practice mode',
  lang_name: 'English',
  tagline: 'The app that works when nothing else does.',
  tab_fourhour: 'Clocks',
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
  fh_photo: 'Scan fridge',
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
  indoor_temp: 'Room temperature °F',
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
  demo_items: 'Sample items',
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
  ans_insulin: 'FDA: insulin can be kept at 59–86 °F for up to 28 days. In an emergency, if there is no replacement, it may still need to be used. Never use frozen insulin. Get a replacement as soon as you can.',
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
  tab_now: 'Now',
  title_now: 'Now',
  title_prep: 'Prep',
  title_map: 'Map',
  title_ask: 'Ask',
  now_sub: 'Conditions and warnings, at a glance.',
  map_sub: 'Evacuation zones, flood reports and tides.',
  now_watch_one: '1 thing to watch in Zone {z}',
  now_watch_other: '{n} things to watch in Zone {z}',
  now_watch_nozone: '{n} things to watch',
  now_clear: 'Nothing to watch right now',
  now_live: 'Live',
  saved_at: 'Saved at {t}',
  now_loading: 'Loading current conditions…',
  now_none: 'No conditions saved yet. Connect once to load them.',
  feels_like: 'Feels like {t}',
  hi_lo: 'H {h}°  L {l}°',
  until: 'until {t}',
  lvl_red: 'Warning',
  lvl_orange: 'Watch',
  lvl_yellow: 'Advisory',
  lvl_blue: 'Info',
  lvl_green: 'All clear',
  tile_heat: 'Feels like',
  humidity: 'Humidity {n}%',
  uv_low: 'Low',
  uv_moderate: 'Moderate',
  uv_high: 'High',
  uv_very_high: 'Very high',
  uv_extreme: 'Extreme',
  uv_max: 'Max today {n}',
  tile_wind: 'Wind',
  gusts: 'Gusts {v}',
  tile_rain: 'Rain, next 6 h',
  tile_air: 'Air quality',
  aqi_good: 'Good',
  aqi_moderate: 'Moderate',
  aqi_usg: 'Unhealthy for sensitive groups',
  aqi_unhealthy: 'Unhealthy',
  aqi_very: 'Very unhealthy',
  aqi_hazardous: 'Hazardous',
  tile_tide: 'Tide now',
  tide_next: 'Next high {m} at {t}',
  king_tide: 'King tide line {m}',
  tile_daylight: 'Daylight',
  daylight_left_short: 'of daylight left',
  dark_now: 'After sunset. Use a flashlight, not candles.',
  dark_now_short: 'Dark',
  sunset_at: 'Sunset {t}',
  sunrise_at: 'Sunrise {t}',
  zone_check_short: 'Check miamidade.gov or 311',
  tile_clocks: 'Your clocks',
  clocks_need: '{n} need action',
  clocks_none: 'No items yet',
  clocks_ok: 'All clear for now',
  clocks_open: 'Open Clocks',
  wx_clear: 'Clear',
  wx_mainly_clear: 'Mostly clear',
  wx_partly: 'Partly cloudy',
  wx_overcast: 'Cloudy',
  wx_fog: 'Fog',
  wx_drizzle: 'Drizzle',
  wx_rain: 'Rain',
  wx_snow: 'Snow',
  wx_showers: 'Showers',
  wx_storm: 'Thunderstorm',
  blackout_pill: 'Blackout mode · everything here works offline',
  blackout_on: 'Turn on Blackout mode',
  blackout_off: 'Turn off Blackout mode',
  st_on_device: 'On this device',
  zone_short: 'Zone',
  zone_none_short: 'No zone',
  install_title: 'Add to Home Screen',
  install_why: 'Opens full screen and works with no signal.',
  install_ios_1: 'Tap Share',
  install_ios_2: 'Choose Add to Home Screen',
  install_ios_3: 'Tap Add. Blackout Box is now an app.',
  install_btn: 'Install Blackout Box',
  cat_all: 'All',
  cat_fridge: 'Fridge',
  cat_freezer: 'Freezer',
  cat_meds: 'Medicine',
  cat_pantry: 'Pantry',
  need_action_one: '{n} item needs action',
  need_action_other: '{n} items need action',
  all_clear: 'Everything is OK for now',
  hero_none: 'Scan your fridge to start the clocks',
  hero_sub: '{n} items · power out {h} h',
  adjust: 'Adjust',
  outage_title: 'Power outage',
  power_out_for: '{h} h ago',
  door_n: 'Fridge opened {n}×',
  room: 'Room {t}',
  est_nws: 'estimated from NWS',
  why: 'Why',
  what_to_do: 'What to do',
  source_quote: 'Source, word for word',
  open_source: 'Open source',
  done: 'Done',
  time_left: 'left',
  read_from_photo: 'Read from your photo',
  unreadable: 'unreadable',

  // v5: freezer scan, sample photos, Pantry empty state, Why tab
  fh_photo_freezer: 'Scan freezer',
  snap_freezer: 'Snap your freezer',
  cat_empty_h: 'Nothing in {cat} yet',
  cat_empty: 'Scan it with the camera, try a sample photo, or add an item by hand below.',
  samples_title: 'Sample photos',
  samples_lead: 'Pick a photo. We read it for real, the same way we read yours.',
  samples_none: 'Sample photos are not available right now.',
  samples_back: 'All sample photos',
  scan_this: 'Scan this photo',
  scan_again: 'Try again',
  tab_why: 'Why',
  title_why: 'Why it matters',
  why_sub: 'Who this is for, and why Miami needs it.',
  why_k1: 'The problem',
  why_h1: 'When the power goes out, a clock starts.',
  why_p1a: 'After a hurricane, Miami can lose power for days, in 90 °F heat.',
  why_p1b: 'Nobody knows if the food or the insulin is still safe.',
  why_p1c: 'And most apps die when the internet does.',
  why_k2: 'Who it helps',
  why_h2: 'The people who can least afford a guess.',
  why_w1: 'Seniors living alone',
  why_w2: 'People on insulin and refrigerated medicine',
  why_w3: 'Parents with baby formula',
  why_w4: 'Spanish and Haitian Creole speakers',
  why_w5: 'Families in evacuation zones A–E',
  why_k3: 'What it does',
  why_h3: 'Snap it. Every item gets a clock.',
  why_f1: 'Snap your fridge, freezer or medicine',
  why_f1s: 'Every item gets a countdown from FDA labels and USDA food rules.',
  why_f2: 'Works offline',
  why_f2s: 'Blackout mode keeps your clocks and plan with no signal.',
  why_f3: 'Live alerts',
  why_f3s: 'National Weather Service and National Hurricane Center.',
  why_f4: 'Your evacuation zone',
  why_f4s: 'From the Miami-Dade zone map.',
  why_f5: 'Places with power',
  why_f5s: 'Charging, libraries and fire stations near you.',
  why_f6: 'Flood map',
  why_f6s: 'Real ground elevation, block by block.',
  why_f7: 'English, Español, Kreyòl',
  why_f7s: 'Ask anything, in your language.',
  why_k4: 'Why Miami',
  why_h4: 'The numbers.',
  why_k5: 'Blackout Box',
  why_h5: 'Built for the hours after the storm.',
  why_p5: 'It works when nothing else does.',
  why_src: 'Source',
  shelter_title: 'Closest shelter',
  shelter_open: 'OPEN',
  shelter_not_open: 'Not open yet',
  shelter_pets: 'Pets OK',
  shelter_special: 'Special needs',
  shelter_saved: 'saved',
  shelter_none: 'No shelter data yet. Check miamidade.gov/hurricane.',
  directions: 'Directions',
  why_s_irma_fl: 'Florida electricity customers lost power in Hurricane Irma (2017), 64% of all accounts',
  why_s_irma_md: 'Miami-Dade FPL customers were affected by Irma',
  why_s_lang: 'of Miami-Dade residents speak a language other than English at home',
  why_s_diabetes: 'of Florida adults have been told they have diabetes',
  why_s_pop: 'people live in Miami-Dade County',
  why_s_evac: 'Miami-Dade residents were under evacuation orders for Irma',
  why_s_heat_days: 'days a year above 90 °F in Miami-Dade, up from 84 since 1970',
  why_s_heat_streak: 'days in a row the heat index hit 100 °F or more in Miami (2023)',
  why_s_heat_deaths: 'estimated excess deaths a year during extreme heat in Miami-Dade',
}

const es: Dict = {
  snap_fridge: 'Foto del refrigerador', // MT
  snap_meds: 'Foto de sus medicinas', // MT
  snap_hint: 'Abre la cámara', // MT
  snap_reading: 'Leyendo su foto…', // MT
  items_saved: '{n} artículos guardados', // MT
  item_saved: '1 artículo guardado', // MT
  power_went_out: 'Se acaba de ir la luz', // MT
  pack_box: 'Preparar mi caja', // MT
  open_clocks: 'Abrir Relojes', // MT
  drill_title: 'TORMENTA SIMULADA', // MT
  drill_sub: 'Simulacro de huracán — modo práctica', // MT
  lang_name: 'Español',
  tagline: 'La app que funciona cuando nada más funciona.', // MT
  tab_fourhour: 'Relojes', // MT
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
  fh_photo: 'Escanear refrigerador', // MT
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
  demo_items: 'Artículos de ejemplo', // MT
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
  ans_insulin: 'FDA: la insulina se puede guardar a 59–86 °F hasta 28 días. En una emergencia, si no hay reemplazo, puede que todavía necesite usarla. Nunca use insulina congelada. Consiga un reemplazo lo antes posible.', // MT
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
  tab_now: 'Ahora',
  title_now: 'Ahora',
  title_prep: 'Preparar',
  title_map: 'Mapa',
  title_ask: 'Preguntar',
  now_sub: 'Condiciones y alertas de un vistazo.',
  map_sub: 'Zonas de evacuación, reportes de inundación y mareas.',
  now_watch_one: '1 cosa a vigilar en la Zona {z}',
  now_watch_other: '{n} cosas a vigilar en la Zona {z}',
  now_watch_nozone: '{n} cosas a vigilar',
  now_clear: 'Nada que vigilar por ahora',
  now_live: 'En vivo',
  saved_at: 'Guardado a las {t}',
  now_loading: 'Cargando condiciones…',
  now_none: 'Aún no hay condiciones guardadas. Conéctese una vez para cargarlas.',
  feels_like: 'Sensación de {t}',
  hi_lo: 'Máx {h}°  Mín {l}°',
  until: 'hasta {t}',
  lvl_red: 'Advertencia',
  lvl_orange: 'Vigilancia',
  lvl_yellow: 'Aviso',
  lvl_blue: 'Información',
  lvl_green: 'Todo bien',
  tile_heat: 'Sensación',
  humidity: 'Humedad {n}%',
  uv_low: 'Bajo',
  uv_moderate: 'Moderado',
  uv_high: 'Alto',
  uv_very_high: 'Muy alto',
  uv_extreme: 'Extremo',
  uv_max: 'Máx. hoy {n}',
  tile_wind: 'Viento',
  gusts: 'Ráfagas {v}',
  tile_rain: 'Lluvia, próximas 6 h',
  tile_air: 'Calidad del aire',
  aqi_good: 'Buena',
  aqi_moderate: 'Moderada',
  aqi_usg: 'Dañina para grupos sensibles',
  aqi_unhealthy: 'Dañina',
  aqi_very: 'Muy dañina',
  aqi_hazardous: 'Peligrosa',
  tile_tide: 'Marea ahora',
  tide_next: 'Próxima alta {m} a las {t}',
  king_tide: 'Línea de marea real {m}',
  tile_daylight: 'Luz del día',
  daylight_left_short: 'de luz restante',
  dark_now: 'Ya anocheció. Use una linterna, no velas.',
  dark_now_short: 'Noche',
  sunset_at: 'Atardecer {t}',
  sunrise_at: 'Amanecer {t}',
  zone_check_short: 'Verifique en miamidade.gov o 311',
  tile_clocks: 'Sus relojes',
  clocks_need: '{n} requieren acción',
  clocks_none: 'Aún no hay artículos',
  clocks_ok: 'Todo bien por ahora',
  clocks_open: 'Abrir Relojes',
  wx_clear: 'Despejado',
  wx_mainly_clear: 'Mayormente despejado',
  wx_partly: 'Parcialmente nublado',
  wx_overcast: 'Nublado',
  wx_fog: 'Niebla',
  wx_drizzle: 'Llovizna',
  wx_rain: 'Lluvia',
  wx_snow: 'Nieve',
  wx_showers: 'Chubascos',
  wx_storm: 'Tormenta eléctrica',
  blackout_pill: 'Modo apagón · todo aquí funciona sin conexión',
  blackout_on: 'Activar modo apagón',
  blackout_off: 'Desactivar modo apagón',
  st_on_device: 'En este dispositivo',
  zone_short: 'Zona',
  zone_none_short: 'Sin zona',
  install_title: 'Agregar a la pantalla de inicio',
  install_why: 'Se abre en pantalla completa y funciona sin señal.',
  install_ios_1: 'Toque Compartir',
  install_ios_2: 'Elija Agregar a inicio',
  install_ios_3: 'Toque Agregar. Blackout Box ya es una app.',
  install_btn: 'Instalar Blackout Box',
  cat_all: 'Todo',
  cat_fridge: 'Refrigerador',
  cat_freezer: 'Congelador',
  cat_meds: 'Medicina',
  cat_pantry: 'Despensa',
  need_action_one: '{n} artículo requiere acción',
  need_action_other: '{n} artículos requieren acción',
  all_clear: 'Todo está bien por ahora',
  hero_none: 'Escanee su refrigerador para iniciar los relojes',
  hero_sub: '{n} artículos · sin luz hace {h} h',
  adjust: 'Ajustar',
  outage_title: 'Apagón',
  power_out_for: 'hace {h} h',
  door_n: 'Refrigerador abierto {n}×',
  room: 'Interior {t}',
  est_nws: 'estimada con NWS',
  why: 'Por qué',
  what_to_do: 'Qué hacer',
  source_quote: 'Fuente, textual',
  open_source: 'Abrir fuente',
  done: 'Listo',
  time_left: 'restante',
  read_from_photo: 'Leído de su foto',
  unreadable: 'ilegibles',

  // v5 // MT (all lines in this block are machine-translated)
  fh_photo_freezer: 'Escanear congelador', // MT
  snap_freezer: 'Foto del congelador', // MT
  cat_empty_h: 'Nada en {cat} todavía', // MT
  cat_empty: 'Escanéelo con la cámara, pruebe una foto de ejemplo o agregue un artículo a mano abajo.', // MT
  samples_title: 'Fotos de ejemplo', // MT
  samples_lead: 'Elija una foto. La leemos de verdad, igual que la suya.', // MT
  samples_none: 'Las fotos de ejemplo no están disponibles ahora.', // MT
  samples_back: 'Todas las fotos de ejemplo', // MT
  scan_this: 'Escanear esta foto', // MT
  scan_again: 'Intentar de nuevo', // MT
  tab_why: 'Por qué', // MT
  title_why: 'Por qué importa', // MT
  why_sub: 'Para quién es, y por qué Miami lo necesita.', // MT
  why_k1: 'El problema', // MT
  why_h1: 'Cuando se va la luz, empieza un reloj.', // MT
  why_p1a: 'Después de un huracán, Miami puede quedarse sin luz por días, con 90 °F de calor.', // MT
  why_p1b: 'Nadie sabe si la comida o la insulina siguen seguras.', // MT
  why_p1c: 'Y la mayoría de las apps mueren cuando se cae el internet.', // MT
  why_k2: 'A quién ayuda', // MT
  why_h2: 'A quienes menos pueden darse el lujo de adivinar.', // MT
  why_w1: 'Personas mayores que viven solas', // MT
  why_w2: 'Personas con insulina y medicinas refrigeradas', // MT
  why_w3: 'Padres con fórmula para bebé', // MT
  why_w4: 'Hablantes de español y criollo haitiano', // MT
  why_w5: 'Familias en zonas de evacuación A–E', // MT
  why_k3: 'Qué hace', // MT
  why_h3: 'Tome una foto. Cada artículo recibe un reloj.', // MT
  why_f1: 'Fotografíe su refrigerador, congelador o medicinas', // MT
  why_f1s: 'Cada artículo recibe una cuenta regresiva de etiquetas de la FDA y reglas del USDA.', // MT
  why_f2: 'Funciona sin conexión', // MT
  why_f2s: 'El modo Apagón guarda sus relojes y su plan sin señal.', // MT
  why_f3: 'Alertas en vivo', // MT
  why_f3s: 'Servicio Meteorológico Nacional y Centro Nacional de Huracanes.', // MT
  why_f4: 'Su zona de evacuación', // MT
  why_f4s: 'Del mapa de zonas de Miami-Dade.', // MT
  why_f5: 'Lugares con electricidad', // MT
  why_f5s: 'Carga, bibliotecas y estaciones de bomberos cerca de usted.', // MT
  why_f6: 'Mapa de inundaciones', // MT
  why_f6s: 'Elevación real del terreno, cuadra por cuadra.', // MT
  why_f7: 'English, Español, Kreyòl', // MT
  why_f7s: 'Pregunte lo que sea, en su idioma.', // MT
  why_k4: 'Por qué Miami', // MT
  why_h4: 'Los números.', // MT
  why_k5: 'Blackout Box', // MT
  why_h5: 'Hecho para las horas después de la tormenta.', // MT
  why_p5: 'Funciona cuando nada más funciona.', // MT
  why_src: 'Fuente', // MT
  shelter_title: 'Refugio más cercano', // MT
  shelter_open: 'ABIERTO', // MT
  shelter_not_open: 'Aún no abre', // MT
  shelter_pets: 'Acepta mascotas', // MT
  shelter_special: 'Necesidades especiales', // MT
  shelter_saved: 'guardado', // MT
  shelter_none: 'Aún no hay datos de refugios. Consulte miamidade.gov/hurricane.', // MT
  directions: 'Cómo llegar', // MT
  why_s_irma_fl: 'clientes eléctricos de Florida se quedaron sin luz con el huracán Irma (2017), 64% de todas las cuentas', // MT
  why_s_irma_md: 'clientes de FPL en Miami-Dade afectados por Irma', // MT
  why_s_lang: 'de los residentes de Miami-Dade hablan en casa un idioma distinto del inglés', // MT
  why_s_diabetes: 'de los adultos de Florida han sido diagnosticados con diabetes', // MT
  why_s_pop: 'personas viven en el condado de Miami-Dade', // MT
  why_s_evac: 'residentes de Miami-Dade estuvieron bajo orden de evacuación por Irma', // MT
  why_s_heat_days: 'días al año por encima de 90 °F en Miami-Dade, antes eran 84 (desde 1970)', // MT
  why_s_heat_streak: 'días seguidos con índice de calor de 100 °F o más en Miami (2023)', // MT
  why_s_heat_deaths: 'muertes en exceso estimadas al año durante calor extremo en Miami-Dade', // MT
}

const ht: Dict = {
  snap_fridge: 'Foto frijidè ou', // MT
  snap_meds: 'Foto medikaman ou', // MT
  snap_hint: 'Louvri kamera a', // MT
  snap_reading: 'N ap li foto ou…', // MT
  items_saved: '{n} bagay sove', // MT
  item_saved: '1 bagay sove', // MT
  power_went_out: 'Kouran an fèk koupe', // MT
  pack_box: 'Prepare bwat mwen', // MT
  open_clocks: 'Louvri Revèy', // MT
  drill_title: 'TANPÈT SIMILE', // MT
  drill_sub: 'Egzèsis siklòn — mòd pratik', // MT
  lang_name: 'Kreyòl',
  tagline: 'Aplikasyon ki mache lè anyen pa mache.', // MT
  tab_fourhour: 'Revèy', // MT
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
  fh_photo: 'Eskane frijidè', // MT
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
  demo_items: 'Egzanp', // MT
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
  ans_insulin: 'FDA: ou ka kenbe ensilin nan 59–86 °F jiska 28 jou. Nan yon ijans, si ou pa gen yon lòt, ou ka toujou bezwen sèvi avè l. Pa janm sèvi ak ensilin ki te jele. Jwenn yon lòt pi vit ke ou kapab.', // MT
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
  tab_now: 'Kounye a',
  title_now: 'Kounye a',
  title_prep: 'Prepare',
  title_map: 'Kat',
  title_ask: 'Mande',
  now_sub: 'Kondisyon ak avètisman, yon sèl kou.',
  map_sub: 'Zòn evakyasyon, rapò inondasyon ak mare.',
  now_watch_one: '1 bagay pou veye nan Zòn {z}',
  now_watch_other: '{n} bagay pou veye nan Zòn {z}',
  now_watch_nozone: '{n} bagay pou veye',
  now_clear: 'Pa gen anyen pou veye kounye a',
  now_live: 'An dirèk',
  saved_at: 'Sove a {t}',
  now_loading: 'N ap chaje kondisyon yo…',
  now_none: 'Pa gen kondisyon ki sove ankò. Konekte yon fwa pou chaje yo.',
  feels_like: 'Santi tankou {t}',
  hi_lo: 'Wo {h}°  Ba {l}°',
  until: 'jiska {t}',
  lvl_red: 'Avètisman',
  lvl_orange: 'Veye',
  lvl_yellow: 'Avi',
  lvl_blue: 'Enfòmasyon',
  lvl_green: 'Tout bon',
  tile_heat: 'Santi',
  humidity: 'Imidite {n}%',
  uv_low: 'Ba',
  uv_moderate: 'Mwayen',
  uv_high: 'Wo',
  uv_very_high: 'Trè wo',
  uv_extreme: 'Ekstrèm',
  uv_max: 'Pi wo jodi a {n}',
  tile_wind: 'Van',
  gusts: 'Rafal {v}',
  tile_rain: 'Lapli, 6 è k ap vini',
  tile_air: 'Kalite lè',
  aqi_good: 'Bon',
  aqi_moderate: 'Mwayen',
  aqi_usg: 'Malsen pou moun ki fragil',
  aqi_unhealthy: 'Malsen',
  aqi_very: 'Trè malsen',
  aqi_hazardous: 'Danjere',
  tile_tide: 'Mare kounye a',
  tide_next: 'Pwochen mare wo {m} a {t}',
  king_tide: 'Liy gwo mare {m}',
  tile_daylight: 'Limyè jou',
  daylight_left_short: 'limyè ki rete',
  dark_now: 'Solèy la kouche. Sèvi ak flach, pa ak bouji.',
  dark_now_short: 'Nwa',
  sunset_at: 'Solèy kouche {t}',
  sunrise_at: 'Solèy leve {t}',
  zone_check_short: 'Tcheke miamidade.gov oswa 311',
  tile_clocks: 'Revèy ou yo',
  clocks_need: '{n} bezwen aksyon',
  clocks_none: 'Pa gen anyen ankò',
  clocks_ok: 'Tout bon pou kounye a',
  clocks_open: 'Louvri Revèy',
  wx_clear: 'Klè',
  wx_mainly_clear: 'Prèske klè',
  wx_partly: 'Kèk nwaj',
  wx_overcast: 'Nwaj',
  wx_fog: 'Bwouya',
  wx_drizzle: 'Ti lapli',
  wx_rain: 'Lapli',
  wx_snow: 'Nèj',
  wx_showers: 'Avès',
  wx_storm: 'Tanpèt loraj',
  blackout_pill: 'Mòd blakawout · tout sa ki la a mache san entènèt',
  blackout_on: 'Limen mòd blakawout',
  blackout_off: 'Etenn mòd blakawout',
  st_on_device: 'Sou aparèy sa a',
  zone_short: 'Zòn',
  zone_none_short: 'Pa gen zòn',
  install_title: 'Ajoute sou ekran dakèy',
  install_why: 'Li louvri plen ekran e li mache san siyal.',
  install_ios_1: 'Peze Pataje',
  install_ios_2: 'Chwazi Ajoute sou ekran dakèy',
  install_ios_3: 'Peze Ajoute. Blackout Box se yon aplikasyon kounye a.',
  install_btn: 'Enstale Blackout Box',
  cat_all: 'Tout',
  cat_fridge: 'Frijidè',
  cat_freezer: 'Frizè',
  cat_meds: 'Medikaman',
  cat_pantry: 'Pantri',
  need_action_one: '{n} bagay bezwen aksyon',
  need_action_other: '{n} bagay bezwen aksyon',
  all_clear: 'Tout bagay anfòm pou kounye a',
  hero_none: 'Eskane frijidè ou pou revèy yo kòmanse',
  hero_sub: '{n} bagay · san kouran depi {h} è',
  adjust: 'Ajiste',
  outage_title: 'Pàn kouran',
  power_out_for: 'depi {h} è',
  door_n: 'Frijidè louvri {n}×',
  room: 'Andedan {t}',
  est_nws: 'estimasyon NWS',
  why: 'Poukisa',
  what_to_do: 'Kisa pou fè',
  source_quote: 'Sous, mo pou mo',
  open_source: 'Louvri sous',
  done: 'Fini',
  time_left: 'ki rete',
  read_from_photo: 'Li nan foto ou',
  unreadable: 'pa ka li',

  // v5 // MT (all lines in this block are machine-translated; have a Kreyòl speaker check)
  fh_photo_freezer: 'Eskane frizè', // MT
  snap_freezer: 'Foto frizè ou', // MT
  cat_empty_h: 'Poko gen anyen nan {cat}', // MT
  cat_empty: 'Eskane l ak kamera a, eseye yon foto egzanp, oswa ajoute youn ak men anba a.', // MT
  samples_title: 'Foto egzanp', // MT
  samples_lead: 'Chwazi yon foto. Nou li l tout bon, menm jan ak pa w la.', // MT
  samples_none: 'Foto egzanp yo pa disponib kounye a.', // MT
  samples_back: 'Tout foto egzanp yo', // MT
  scan_this: 'Eskane foto sa a', // MT
  scan_again: 'Eseye ankò', // MT
  tab_why: 'Poukisa', // MT
  title_why: 'Poukisa sa enpòtan', // MT
  why_sub: 'Pou ki moun li ye, ak poukisa Miami bezwen l.', // MT
  why_k1: 'Pwoblèm nan', // MT
  why_h1: 'Lè kouran an koupe, yon revèy kòmanse.', // MT
  why_p1a: 'Apre yon siklòn, Miami ka rete san kouran pandan plizyè jou, nan chalè 90 °F.', // MT
  why_p1b: 'Pèsonn pa konnen si manje a oswa ensilin nan toujou bon.', // MT
  why_p1c: 'Epi pifò aplikasyon mouri lè entènèt la tonbe.', // MT
  why_k2: 'Ki moun li ede', // MT
  why_h2: 'Moun ki pa ka pèmèt yo devine.', // MT
  why_w1: 'Granmoun ki viv pou kont yo', // MT
  why_w2: 'Moun ki pran ensilin ak medikaman nan frijidè', // MT
  why_w3: 'Paran ki gen lèt tibebe', // MT
  why_w4: 'Moun ki pale panyòl ak kreyòl ayisyen', // MT
  why_w5: 'Fanmi nan zòn evakyasyon A–E', // MT
  why_k3: 'Sa li fè', // MT
  why_h3: 'Pran yon foto. Chak bagay jwenn yon revèy.', // MT
  why_f1: 'Pran foto frijidè, frizè oswa medikaman ou', // MT
  why_f1s: 'Chak bagay jwenn yon kontwa ki soti nan etikèt FDA ak règ USDA.', // MT
  why_f2: 'Mache san entènèt', // MT
  why_f2s: 'Mòd Blakout kenbe revèy ou ak plan ou san siyal.', // MT
  why_f3: 'Alèt an dirèk', // MT
  why_f3s: 'Sèvis Meteyo Nasyonal ak Sant Nasyonal Siklòn.', // MT
  why_f4: 'Zòn evakyasyon ou', // MT
  why_f4s: 'Soti nan kat zòn Miami-Dade.', // MT
  why_f5: 'Kote ki gen kouran', // MT
  why_f5s: 'Chaj, bibliyotèk ak estasyon ponpye toupre ou.', // MT
  why_f6: 'Kat inondasyon', // MT
  why_f6s: 'Vrè wotè tè a, blòk pa blòk.', // MT
  why_f7: 'English, Español, Kreyòl', // MT
  why_f7s: 'Mande nenpòt bagay, nan lang ou.', // MT
  why_k4: 'Poukisa Miami', // MT
  why_h4: 'Chif yo.', // MT
  why_k5: 'Blackout Box', // MT
  why_h5: 'Fèt pou lè yo apre tanpèt la.', // MT
  why_p5: 'Li mache lè anyen pa mache.', // MT
  why_src: 'Sous', // MT
  shelter_title: 'Abri ki pi pre a', // MT
  shelter_open: 'OUVÈ', // MT
  shelter_not_open: 'Poko ouvè', // MT
  shelter_pets: 'Bèt aksepte', // MT
  shelter_special: 'Bezwen espesyal', // MT
  shelter_saved: 'anrejistre', // MT
  shelter_none: 'Poko gen done sou abri. Gade miamidade.gov/hurricane.', // MT
  directions: 'Direksyon', // MT
  why_s_irma_fl: 'kliyan elektrisite nan Florid te pèdi kouran nan siklòn Irma (2017), 64% tout kont yo', // MT
  why_s_irma_md: 'kliyan FPL nan Miami-Dade Irma te afekte', // MT
  why_s_lang: 'moun nan Miami-Dade pale yon lòt lang pase angle lakay yo', // MT
  why_s_diabetes: 'granmoun nan Florid yo te di yo gen dyabèt', // MT
  why_s_pop: 'moun ap viv nan konte Miami-Dade', // MT
  why_s_evac: 'moun Miami-Dade te anba lòd evakyasyon pou Irma', // MT
  why_s_heat_days: 'jou pa ane plis pase 90 °F nan Miami-Dade, te 84 depi 1970', // MT
  why_s_heat_streak: 'jou youn dèyè lòt endèks chalè a te rive 100 °F oswa plis nan Miami (2023)', // MT
  why_s_heat_deaths: 'lanmò anplis estime chak ane pandan gwo chalè nan Miami-Dade', // MT
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
