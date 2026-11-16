import i18n from 'i18next'
import Backend from 'i18next-http-backend'
import { initReactI18next } from 'react-i18next'

// English only: other languages were dropped to keep the deployed site small
export const allLocales = ['en-US']

// Wording overrides on top of upstream's locale JSON, which stays untouched so syncs don't conflict.
// The UI says "expansion" (upstream's term) for a set and "pack" for a booster inside one.
const overrides: Record<string, Record<string, string>> = {
  'common/sets': { all: 'All expansions' },
}

i18n
  .use(Backend)
  .use(initReactI18next)
  .init({
    // debug: true,
    interpolation: { escapeValue: false },
    lng: 'en-US',
    fallbackLng: 'en-US',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
      parse: (data: string, _lng?: string | string[], ns?: string | string[]) => ({ ...JSON.parse(data), ...overrides[String(ns)] }),
    },
    supportedLngs: allLocales,
  })

export default i18n
