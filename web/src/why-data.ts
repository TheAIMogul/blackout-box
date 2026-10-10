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
