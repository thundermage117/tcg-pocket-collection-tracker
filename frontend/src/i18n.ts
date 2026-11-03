import i18n from 'i18next'
import Backend from 'i18next-http-backend'
import { initReactI18next } from 'react-i18next'

// English only: other languages were dropped to keep the deployed site small
export const allLocales = ['en-US']

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
    },
    supportedLngs: allLocales,
  })

export default i18n
