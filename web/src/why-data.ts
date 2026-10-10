// Numbers on the Why tab. Every value below was read on the source page itself on 2026-10-10 (no estimates, no rounding
// beyond what the source shows). `label` is an i18n key in i18n.ts. If a source changes, update the value and the date.
export type WhyStat = {
  id: string
  value: number
  decimals?: number
  prefix?: string
  suffix?: string
  label: string // i18n key
  source: string // shown under the number
  url: string
}

export const STATS: Record<string, WhyStat> = {
  irmaFlorida: {
    id: 'irmaFlorida', value: 6.7, decimals: 1, suffix: 'M', label: 'why_s_irma_fl',
    source: 'U.S. Energy Information Administration, Today in Energy, Sept 20, 2017',
    url: 'https://www.eia.gov/todayinenergy/detail.php?id=32992',
  },
  irmaMiamiDade: {
    id: 'irmaMiamiDade', value: 1020255, label: 'why_s_irma_md',
    source: 'Patch Miami, reporting FPL figures, Sept 22, 2017',
    url: 'https://patch.com/florida/miami/power-restored-4-4-million-florida-fpl',
  },
  language: {
    id: 'language', value: 75.7, decimals: 1, suffix: '%', label: 'why_s_lang',
    source: 'U.S. Census Bureau ACS 2024 1-year, via Census Reporter',
    url: 'https://censusreporter.org/profiles/05000US12086-miami-dade-county-fl/',
  },
  diabetes: {
    id: 'diabetes', value: 11.9, decimals: 1, suffix: '%', label: 'why_s_diabetes',
    source: "America's Health Rankings, CDC BRFSS 2024",
    url: 'https://www.americashealthrankings.org/explore/measures/Diabetes/FL',
  },
  population: {
    id: 'population', value: 2838461, label: 'why_s_pop',
    source: 'U.S. Census Bureau ACS 2024 1-year, via Census Reporter',
    url: 'https://censusreporter.org/profiles/05000US12086-miami-dade-county-fl/',
  },
  evacIrma: {
    id: 'evacIrma', value: 700000, label: 'why_s_evac',
    source: 'CBS Miami, Sept 7, 2017',
    url: 'https://www.cbsnews.com/amp/miami/news/miami-dade-hurricane-irma-preps-carlos-gimenez',
  },
  heatDays: {
    id: 'heatDays', value: 133, label: 'why_s_heat_days',
    source: 'Miami-Dade County, Extreme Heat',
    url: 'https://www.miamidade.gov/initiative/weather-ready/extreme-heat/home.page',
  },
  heatStreak: {
    id: 'heatStreak', value: 46, label: 'why_s_heat_streak',
    source: 'City of Miami, Extreme Heat Plan (draft), Apr 12, 2024',
    url: 'https://www.miami.gov/files/413366bc-5f88-4440-b5e2-0814c1872bba/Extreme-Heat-DRAFT-Plan-04-12-24-web.pdf',
  },
  heatDeaths: {
    id: 'heatDeaths', value: 600, label: 'why_s_heat_deaths',
    source: 'Miami-Dade County, Extreme Heat',
    url: 'https://www.miamidade.gov/initiative/weather-ready/extreme-heat/home.page',
  },
}

// "Built on public data" chips. Every source below is actually used by the app (or cited for a number above).
// `group` is an i18n key for the agency heading; `name` is the source's proper name (not translated).
export type DataSource = { name: string; url: string }
export type SourceGroup = { group: string; icon: string; items: DataSource[] }

export const SOURCES: SourceGroup[] = [
  { group: 'why_g_fda', icon: 'medication', items: [
    { name: 'openFDA drug labels', url: 'https://open.fda.gov/apis/drug/label/' },
    { name: 'openFDA drug recalls', url: 'https://open.fda.gov/apis/drug/enforcement/' },
    { name: 'FDA emergency insulin guidance', url: 'https://www.fda.gov/drugs/emergency-preparedness-drugs/information-regarding-insulin-storage-and-switching-between-products-emergency' },
  ] },
  { group: 'why_g_usda', icon: 'kitchen', items: [
    { name: 'USDA FoodKeeper data', url: 'https://catalog.data.gov/dataset/fsis-foodkeeper-data' },
    { name: 'FoodSafety.gov power-outage chart', url: 'https://www.foodsafety.gov/food-safety-charts/food-safety-during-power-outage' },
  ] },
  { group: 'why_g_noaa', icon: 'cyclone', items: [
    { name: 'NWS observations & hourly forecast', url: 'https://www.weather.gov/documentation/services-web-api' },
    { name: 'NWS active alerts', url: 'https://www.weather.gov/documentation/services-web-api' },
    { name: 'National Hurricane Center active storms', url: 'https://www.nhc.noaa.gov/CurrentStorms.json' },
    { name: 'NOAA Tides & Currents, Virginia Key 8723214', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8723214' },
    { name: 'NOAA flood thresholds', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8723214' },
  ] },
  { group: 'why_g_fema', icon: 'emergency_home', items: [
    { name: 'FEMA National Shelter System', url: 'https://gis.fema.gov/arcgis/rest/services/NSS/FEMA_NSS/MapServer' },
    { name: 'OpenFEMA disaster declarations', url: 'https://www.fema.gov/about/openfema/data-sets' },
  ] },
  { group: 'why_g_mdc', icon: 'location_city', items: [
    { name: 'Hurricane evacuation zones', url: 'https://gis-mdc.opendata.arcgis.com' },
    { name: 'Hospitals', url: 'https://gis-mdc.opendata.arcgis.com' },
    { name: 'Open pharmacies & grocery stores', url: 'https://gis-mdc.opendata.arcgis.com' },
    { name: 'Libraries', url: 'https://gis-mdc.opendata.arcgis.com' },
    { name: 'Fire stations', url: 'https://gis-mdc.opendata.arcgis.com' },
    { name: '311 flooding & drainage requests (2023)', url: 'https://gis-mdc.opendata.arcgis.com' },
    { name: 'Miami-Dade Extreme Heat', url: 'https://www.miamidade.gov/initiative/weather-ready/extreme-heat/home.page' },
    { name: 'City of Miami Extreme Heat Plan', url: 'https://www.miami.gov/files/413366bc-5f88-4440-b5e2-0814c1872bba/Extreme-Heat-DRAFT-Plan-04-12-24-web.pdf' },
  ] },
  { group: 'why_g_energy', icon: 'bolt', items: [
    { name: 'NREL / NLR alternative fuel & EV stations', url: 'https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/' },
    { name: 'U.S. Energy Information Administration', url: 'https://www.eia.gov/todayinenergy/detail.php?id=32992' },
  ] },
  { group: 'why_g_people', icon: 'groups', items: [
    { name: 'U.S. Census Bureau ACS 2024', url: 'https://censusreporter.org/profiles/05000US12086-miami-dade-county-fl/' },
    { name: "CDC BRFSS via America's Health Rankings", url: 'https://www.americashealthrankings.org/explore/measures/Diabetes/FL' },
  ] },
  { group: 'why_g_wx', icon: 'air', items: [
    { name: 'Open-Meteo forecast, UV, sunrise & sunset', url: 'https://open-meteo.com' },
    { name: 'Open-Meteo air quality', url: 'https://open-meteo.com/en/docs/air-quality-api' },
  ] },
  { group: 'why_g_maps', icon: 'terrain', items: [
    { name: 'AWS Terrain Tiles / USGS 3DEP elevation', url: 'https://registry.opendata.aws/terrain-tiles/' },
    { name: 'OpenFreeMap', url: 'https://openfreemap.org' },
    { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' },
  ] },
  { group: 'why_g_law', icon: 'gavel', items: [
    { name: 'Florida Statute 252.358 emergency refills', url: 'https://www.flsenate.gov/Laws/Statutes/2025/252.358' },
  ] },
]

export const SOURCE_COUNT = SOURCES.reduce((n, g) => n + g.items.length, 0)
