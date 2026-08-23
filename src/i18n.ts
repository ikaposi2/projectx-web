import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en/common.json";
import nl from "./locales/nl/common.json";

const saved = localStorage.getItem("projectx.locale");

void i18n.use(initReactI18next).init({
  resources: {
    nl: { translation: nl },
    en: { translation: en },
  },
  lng: saved || "nl",
  fallbackLng: "nl",
  interpolation: { escapeValue: false },
});

export default i18n;
