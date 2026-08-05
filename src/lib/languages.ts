export type LangCode = string;

/** All 22 scheduled languages of India + English (and a few widely spoken ones). */
export const INDIAN_LANGUAGES: { code: LangCode; native: string; english: string }[] = [
  { code: "en", native: "English", english: "English" },
  { code: "hi", native: "हिन्दी", english: "Hindi" },
  { code: "bn", native: "বাংলা", english: "Bengali" },
  { code: "te", native: "తెలుగు", english: "Telugu" },
  { code: "mr", native: "मराठी", english: "Marathi" },
  { code: "ta", native: "தமிழ்", english: "Tamil" },
  { code: "ur", native: "اردو", english: "Urdu" },
  { code: "gu", native: "ગુજરાતી", english: "Gujarati" },
  { code: "kn", native: "ಕನ್ನಡ", english: "Kannada" },
  { code: "ml", native: "മലയാളം", english: "Malayalam" },
  { code: "or", native: "ଓଡ଼ିଆ", english: "Odia" },
  { code: "pa", native: "ਪੰਜਾਬੀ", english: "Punjabi" },
  { code: "as", native: "অসমীয়া", english: "Assamese" },
  { code: "mai", native: "मैथिली", english: "Maithili" },
  { code: "sat", native: "ᱥᱟᱱᱛᱟᱲᱤ", english: "Santali" },
  { code: "ks", native: "کٲشُر", english: "Kashmiri" },
  { code: "ne", native: "नेपाली", english: "Nepali" },
  { code: "sd", native: "سنڌي", english: "Sindhi" },
  { code: "kok", native: "कोंकणी", english: "Konkani" },
  { code: "doi", native: "डोगरी", english: "Dogri" },
  { code: "mni", native: "ꯃꯤꯇꯩꯂꯣꯟ", english: "Manipuri" },
  { code: "brx", native: "बड़ो", english: "Bodo" },
  { code: "sa", native: "संस्कृतम्", english: "Sanskrit" },
  { code: "bho", native: "भोजपुरी", english: "Bhojpuri" },
];

export const RTL_LANGS = new Set(["ur", "ks", "sd"]);

export function languageName(code: string) {
  const l = INDIAN_LANGUAGES.find((x) => x.code === code);
  return l ? l.english : "English";
}
