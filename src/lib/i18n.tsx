import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RTL_LANGS, languageName } from "./languages";
import { translateStrings } from "./translate.functions";

export type TKey =
  | "home" | "fields" | "advisor" | "alerts" | "profile"
  | "quickActions" | "myFields" | "weather" | "aiAdvice" | "leafScan" | "market" | "schemes"
  | "identify" | "identifyDesc" | "weed" | "plant" | "seed"
  | "upload" | "camera" | "analyze" | "analyzing" | "results"
  | "harmful" | "beneficial" | "uses" | "control" | "confidence"
  | "language" | "save" | "saved" | "loading";

type Dict = Partial<Record<TKey, string>>;

const en: Record<TKey, string> = {
  home: "Home", fields: "Fields", advisor: "AI Advisor", alerts: "Alerts", profile: "Profile",
  quickActions: "Quick actions", myFields: "My Fields", weather: "Weather", aiAdvice: "AI Advice",
  leafScan: "Leaf Scan", market: "Market", schemes: "Schemes",
  identify: "Identify", identifyDesc: "Identify weeds, plants and seeds from a photo",
  weed: "Weed", plant: "Plant", seed: "Seed",
  upload: "Upload", camera: "Camera", analyze: "Analyze", analyzing: "Analyzing…", results: "Results",
  harmful: "Harmful", beneficial: "Beneficial", uses: "Uses", control: "Control / management",
  confidence: "Confidence", language: "Language", save: "Save changes", saved: "Saved", loading: "Loading…",
};

const dicts: Record<string, Dict> = {
  hi: { home: "होम", fields: "खेत", advisor: "एआई सलाहकार", alerts: "सूचनाएँ", profile: "प्रोफ़ाइल", quickActions: "त्वरित क्रियाएँ", myFields: "मेरे खेत", weather: "मौसम", aiAdvice: "एआई सलाह", leafScan: "पत्ती स्कैन", market: "बाज़ार", schemes: "योजनाएँ", identify: "पहचान", identifyDesc: "फ़ोटो से खरपतवार, पौधे और बीज पहचानें", weed: "खरपतवार", plant: "पौधा", seed: "बीज", upload: "अपलोड", camera: "कैमरा", analyze: "विश्लेषण करें", analyzing: "विश्लेषण हो रहा है…", results: "परिणाम", harmful: "हानिकारक", beneficial: "लाभदायक", uses: "उपयोग", control: "नियंत्रण / प्रबंधन", confidence: "विश्वास", language: "भाषा", save: "सहेजें", saved: "सहेजा गया", loading: "लोड हो रहा है…" },
  bn: { home: "হোম", fields: "জমি", advisor: "এআই পরামর্শদাতা", alerts: "সতর্কতা", profile: "প্রোফাইল", quickActions: "দ্রুত কাজ", myFields: "আমার জমি", weather: "আবহাওয়া", aiAdvice: "এআই পরামর্শ", leafScan: "পাতা স্ক্যান", market: "বাজার", schemes: "প্রকল্প", identify: "শনাক্ত", identifyDesc: "ছবি থেকে আগাছা, গাছ ও বীজ শনাক্ত করুন", weed: "আগাছা", plant: "গাছ", seed: "বীজ", upload: "আপলোড", camera: "ক্যামেরা", analyze: "বিশ্লেষণ", analyzing: "বিশ্লেষণ চলছে…", results: "ফলাফল", harmful: "ক্ষতিকর", beneficial: "উপকারী", uses: "ব্যবহার", control: "নিয়ন্ত্রণ", confidence: "আত্মবিশ্বাস", language: "ভাষা", save: "সংরক্ষণ", saved: "সংরক্ষিত", loading: "লোড হচ্ছে…" },
  te: { home: "హోమ్", fields: "పొలాలు", advisor: "AI సలహాదారు", alerts: "హెచ్చరికలు", profile: "ప్రొఫైల్", quickActions: "త్వరిత చర్యలు", myFields: "నా పొలాలు", weather: "వాతావరణం", aiAdvice: "AI సలహా", leafScan: "ఆకు స్కాన్", market: "మార్కెట్", schemes: "పథకాలు", identify: "గుర్తింపు", identifyDesc: "ఫోటో నుండి కలుపు, మొక్క, విత్తనం గుర్తించండి", weed: "కలుపు", plant: "మొక్క", seed: "విత్తనం", upload: "అప్‌లోడ్", camera: "కెమెరా", analyze: "విశ్లేషించు", analyzing: "విశ్లేషిస్తోంది…", results: "ఫలితాలు", harmful: "హానికరం", beneficial: "ఉపయోగకరం", uses: "ఉపయోగాలు", control: "నియంత్రణ", confidence: "నమ్మకం", language: "భాష", save: "సేవ్ చేయి", saved: "సేవ్ అయింది", loading: "లోడ్ అవుతోంది…" },
  mr: { home: "होम", fields: "शेत", advisor: "एआय सल्लागार", alerts: "सूचना", profile: "प्रोफाइल", quickActions: "जलद क्रिया", myFields: "माझी शेते", weather: "हवामान", aiAdvice: "एआय सल्ला", leafScan: "पान स्कॅन", market: "बाजार", schemes: "योजना", identify: "ओळख", identifyDesc: "फोटोवरून तण, वनस्पती व बियाणे ओळखा", weed: "तण", plant: "वनस्पती", seed: "बियाणे", upload: "अपलोड", camera: "कॅमेरा", analyze: "विश्लेषण", analyzing: "विश्लेषण सुरू…", results: "निकाल", harmful: "हानिकारक", beneficial: "फायदेशीर", uses: "उपयोग", control: "नियंत्रण", confidence: "विश्वास", language: "भाषा", save: "जतन करा", saved: "जतन केले", loading: "लोड होत आहे…" },
  ta: { home: "முகப்பு", fields: "வயல்கள்", advisor: "AI ஆலோசகர்", alerts: "எச்சரிக்கைகள்", profile: "சுயவிவரம்", quickActions: "விரைவு செயல்கள்", myFields: "என் வயல்கள்", weather: "வானிலை", aiAdvice: "AI ஆலோசனை", leafScan: "இலை ஸ்கேன்", market: "சந்தை", schemes: "திட்டங்கள்", identify: "அடையாளம்", identifyDesc: "புகைப்படத்திலிருந்து களை, செடி, விதை அடையாளம் காணுங்கள்", weed: "களை", plant: "செடி", seed: "விதை", upload: "பதிவேற்று", camera: "கேமரா", analyze: "பகுப்பாய்வு", analyzing: "பகுப்பாய்வு…", results: "முடிவுகள்", harmful: "தீங்கானது", beneficial: "பயனுள்ளது", uses: "பயன்கள்", control: "கட்டுப்பாடு", confidence: "நம்பிக்கை", language: "மொழி", save: "சேமி", saved: "சேமிக்கப்பட்டது", loading: "ஏற்றுகிறது…" },
  ur: { home: "ہوم", fields: "کھیت", advisor: "اے آئی مشیر", alerts: "اطلاعات", profile: "پروفائل", quickActions: "فوری اقدامات", myFields: "میرے کھیت", weather: "موسم", aiAdvice: "اے آئی مشورہ", leafScan: "پتہ اسکین", market: "منڈی", schemes: "اسکیمیں", identify: "شناخت", identifyDesc: "تصویر سے جڑی بوٹی، پودا اور بیج پہچانیں", weed: "جڑی بوٹی", plant: "پودا", seed: "بیج", upload: "اپ لوڈ", camera: "کیمرا", analyze: "تجزیہ", analyzing: "تجزیہ جاری…", results: "نتائج", harmful: "نقصان دہ", beneficial: "فائدہ مند", uses: "استعمال", control: "کنٹرول", confidence: "اعتماد", language: "زبان", save: "محفوظ کریں", saved: "محفوظ ہوگیا", loading: "لوڈ ہو رہا ہے…" },
  gu: { home: "હોમ", fields: "ખેતરો", advisor: "AI સલાહકાર", alerts: "સૂચનાઓ", profile: "પ્રોફાઇલ", quickActions: "ઝડપી ક્રિયાઓ", myFields: "મારા ખેતરો", weather: "હવામાન", aiAdvice: "AI સલાહ", leafScan: "પાન સ્કેન", market: "બજાર", schemes: "યોજનાઓ", identify: "ઓળખ", identifyDesc: "ફોટોમાંથી નીંદણ, છોડ અને બીજ ઓળખો", weed: "નીંદણ", plant: "છોડ", seed: "બીજ", upload: "અપલોડ", camera: "કેમેરા", analyze: "વિશ્લેષણ", analyzing: "વિશ્લેષણ ચાલુ…", results: "પરિણામો", harmful: "હાનિકારક", beneficial: "લાભદાયી", uses: "ઉપયોગો", control: "નિયંત્રણ", confidence: "વિશ્વાસ", language: "ભાષા", save: "સાચવો", saved: "સાચવ્યું", loading: "લોડ થાય છે…" },
  kn: { home: "ಮುಖಪುಟ", fields: "ಹೊಲಗಳು", advisor: "AI ಸಲಹೆಗಾರ", alerts: "ಎಚ್ಚರಿಕೆಗಳು", profile: "ಪ್ರೊಫೈಲ್", quickActions: "ತ್ವರಿತ ಕ್ರಿಯೆಗಳು", myFields: "ನನ್ನ ಹೊಲಗಳು", weather: "ಹವಾಮಾನ", aiAdvice: "AI ಸಲಹೆ", leafScan: "ಎಲೆ ಸ್ಕ್ಯಾನ್", market: "ಮಾರುಕಟ್ಟೆ", schemes: "ಯೋಜನೆಗಳು", identify: "ಗುರುತಿಸಿ", identifyDesc: "ಫೋಟೋದಿಂದ ಕಳೆ, ಸಸ್ಯ ಮತ್ತು ಬೀಜ ಗುರುತಿಸಿ", weed: "ಕಳೆ", plant: "ಸಸ್ಯ", seed: "ಬೀಜ", upload: "ಅಪ್‌ಲೋಡ್", camera: "ಕ್ಯಾಮೆರಾ", analyze: "ವಿಶ್ಲೇಷಿಸಿ", analyzing: "ವಿಶ್ಲೇಷಿಸಲಾಗುತ್ತಿದೆ…", results: "ಫಲಿತಾಂಶಗಳು", harmful: "ಹಾನಿಕಾರಕ", beneficial: "ಉಪಯುಕ್ತ", uses: "ಉಪಯೋಗಗಳು", control: "ನಿಯಂತ್ರಣ", confidence: "ವಿಶ್ವಾಸ", language: "ಭಾಷೆ", save: "ಉಳಿಸಿ", saved: "ಉಳಿಸಲಾಗಿದೆ", loading: "ಲೋಡ್ ಆಗುತ್ತಿದೆ…" },
  ml: { home: "ഹോം", fields: "വയലുകൾ", advisor: "AI ഉപദേഷ്ടാവ്", alerts: "അറിയിപ്പുകൾ", profile: "പ്രൊഫൈൽ", quickActions: "ദ്രുത പ്രവർത്തനങ്ങൾ", myFields: "എന്റെ വയലുകൾ", weather: "കാലാവസ്ഥ", aiAdvice: "AI ഉപദേശം", leafScan: "ഇല സ്കാൻ", market: "വിപണി", schemes: "പദ്ധതികൾ", identify: "തിരിച്ചറിയുക", identifyDesc: "ഫോട്ടോയിൽ നിന്ന് കള, ചെടി, വിത്ത് തിരിച്ചറിയുക", weed: "കള", plant: "ചെടി", seed: "വിത്ത്", upload: "അപ്‌ലോഡ്", camera: "ക്യാമറ", analyze: "വിശകലനം", analyzing: "വിശകലനം ചെയ്യുന്നു…", results: "ഫലങ്ങൾ", harmful: "ഹാനികരം", beneficial: "പ്രയോജനകരം", uses: "ഉപയോഗങ്ങൾ", control: "നിയന്ത്രണം", confidence: "വിശ്വാസ്യത", language: "ഭാഷ", save: "സേവ് ചെയ്യുക", saved: "സേവ് ചെയ്തു", loading: "ലോഡുചെയ്യുന്നു…" },
  or: { home: "ହୋମ୍", fields: "କ୍ଷେତ", advisor: "AI ପରାମର୍ଶଦାତା", alerts: "ସୂଚନା", profile: "ପ୍ରୋଫାଇଲ୍", quickActions: "ଶୀଘ୍ର କାର୍ଯ୍ୟ", myFields: "ମୋର କ୍ଷେତ", weather: "ପାଗ", aiAdvice: "AI ପରାମର୍ଶ", leafScan: "ପତ୍ର ସ୍କାନ୍", market: "ବଜାର", schemes: "ଯୋଜନା", identify: "ଚିହ୍ନଟ", identifyDesc: "ଫଟୋରୁ ଅନାବନା ଘାସ, ଗଛ ଓ ମଞ୍ଜି ଚିହ୍ନଟ କରନ୍ତୁ", weed: "ଅନାବନା ଘାସ", plant: "ଗଛ", seed: "ମଞ୍ଜି", upload: "ଅପଲୋଡ୍", camera: "କ୍ୟାମେରା", analyze: "ବିଶ୍ଳେଷଣ", analyzing: "ବିଶ୍ଳେଷଣ ଚାଲିଛି…", results: "ଫଳାଫଳ", harmful: "କ୍ଷତିକାରକ", beneficial: "ଉପକାରୀ", uses: "ବ୍ୟବହାର", control: "ନିୟନ୍ତ୍ରଣ", confidence: "ଆତ୍ମବିଶ୍ୱାସ", language: "ଭାଷା", save: "ସେଭ୍", saved: "ସେଭ୍ ହେଲା", loading: "ଲୋଡ୍ ହେଉଛି…" },
  pa: { home: "ਹੋਮ", fields: "ਖੇਤ", advisor: "AI ਸਲਾਹਕਾਰ", alerts: "ਸੂਚਨਾਵਾਂ", profile: "ਪ੍ਰੋਫਾਈਲ", quickActions: "ਤੇਜ਼ ਕਾਰਵਾਈਆਂ", myFields: "ਮੇਰੇ ਖੇਤ", weather: "ਮੌਸਮ", aiAdvice: "AI ਸਲਾਹ", leafScan: "ਪੱਤਾ ਸਕੈਨ", market: "ਮੰਡੀ", schemes: "ਸਕੀਮਾਂ", identify: "ਪਛਾਣ", identifyDesc: "ਫੋਟੋ ਤੋਂ ਨਦੀਨ, ਪੌਦਾ ਤੇ ਬੀਜ ਪਛਾਣੋ", weed: "ਨਦੀਨ", plant: "ਪੌਦਾ", seed: "ਬੀਜ", upload: "ਅੱਪਲੋਡ", camera: "ਕੈਮਰਾ", analyze: "ਵਿਸ਼ਲੇਸ਼ਣ", analyzing: "ਵਿਸ਼ਲੇਸ਼ਣ ਹੋ ਰਿਹਾ…", results: "ਨਤੀਜੇ", harmful: "ਨੁਕਸਾਨਦੇਹ", beneficial: "ਲਾਭਦਾਇਕ", uses: "ਵਰਤੋਂ", control: "ਕੰਟਰੋਲ", confidence: "ਭਰੋਸਾ", language: "ਭਾਸ਼ਾ", save: "ਸੰਭਾਲੋ", saved: "ਸੰਭਾਲਿਆ", loading: "ਲੋਡ ਹੋ ਰਿਹਾ…" },
  as: { home: "হোম", fields: "পথাৰ", advisor: "AI পৰামৰ্শদাতা", alerts: "সতৰ্কবাণী", profile: "প্ৰ'ফাইল", quickActions: "দ্ৰুত কাৰ্য", myFields: "মোৰ পথাৰ", weather: "বতৰ", aiAdvice: "AI পৰামৰ্শ", leafScan: "পাত স্কেন", market: "বজাৰ", schemes: "আঁচনি", identify: "চিনাক্তকৰণ", identifyDesc: "ফটোৰ পৰা বননি, গছ আৰু বীজ চিনাক্ত কৰক", weed: "বননি", plant: "গছ", seed: "বীজ", upload: "আপল'ড", camera: "কেমেৰা", analyze: "বিশ্লেষণ", analyzing: "বিশ্লেষণ চলিছে…", results: "ফলাফল", harmful: "ক্ষতিকাৰক", beneficial: "উপকাৰী", uses: "ব্যৱহাৰ", control: "নিয়ন্ত্ৰণ", confidence: "আত্মবিশ্বাস", language: "ভাষা", save: "সংৰক্ষণ", saved: "সংৰক্ষিত", loading: "ল'ড হৈ আছে…" },
  ne: { home: "गृह", fields: "खेत", advisor: "एआई सल्लाहकार", alerts: "सूचना", profile: "प्रोफाइल", weed: "झारपात", plant: "बिरुवा", seed: "बीउ", identify: "पहिचान" },
  mai: { home: "होम", fields: "खेत", weed: "खर-पतवार", plant: "गाछ", seed: "बीज", identify: "पहचान" },
  bho: { home: "होम", fields: "खेत", weed: "खरपतवार", plant: "पौधा", seed: "बीज", identify: "पहचान" },
  kok: { home: "घर", fields: "शेतां", weed: "तण", plant: "रोप", seed: "बी", identify: "वळख" },
  doi: { home: "होम", fields: "खेत", weed: "खरपतवार", plant: "पौधा", seed: "बीज", identify: "पछयाण" },
  sa: { home: "गृहम्", fields: "क्षेत्राणि", weed: "अपतृणम्", plant: "वनस्पतिः", seed: "बीजम्", identify: "परिचयः" },
};

/** t() accepts either a known TKey or any English UI string. */
type Ctx = {
  lang: string;
  setLang: (l: string) => void;
  t: (k: TKey | (string & {})) => string;
  langName: string;
  dir: "ltr" | "rtl";
  translating: boolean;
};

const I18nContext = createContext<Ctx>({
  lang: "en",
  setLang: () => {},
  t: (k) => (en as Record<string, string>)[k] ?? String(k),
  langName: "English",
  dir: "ltr",
  translating: false,
});

export const LANG_STORAGE_KEY = "agri-lang";
const CACHE_KEY = "agri-i18n-cache";

type Cache = Record<string, Record<string, string>>;

function loadCache(): Cache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") as Cache;
  } catch {
    return {};
  }
}

function saveCache(c: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* quota */
  }
}

/**
 * Translate strings outside React (toasts, push notifications, background jobs)
 * using the same language the farmer picked in their profile/settings.
 * Returns a map keyed by the original English string.
 */
export async function translateNow(texts: string[], target?: string): Promise<Record<string, string>> {
  const lang = target ?? (typeof localStorage !== "undefined" ? localStorage.getItem(LANG_STORAGE_KEY) : null) ?? "en";
  const out: Record<string, string> = {};
  const unique = [...new Set(texts.filter(Boolean))];
  if (lang === "en") {
    unique.forEach((s) => (out[s] = s));
    return out;
  }
  const cache = loadCache();
  const bucket = cache[lang] || {};
  const missing = unique.filter((s) => !bucket[s]);
  if (missing.length) {
    try {
      const res = await translateStrings({ data: { language: lang, texts: missing } });
      Object.assign(bucket, res.translations);
      cache[lang] = bucket;
      saveCache(cache);
    } catch {
      /* fall back to English below */
    }
  }
  unique.forEach((s) => (out[s] = bucket[s] || s));
  return out;
}



export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState("en");
  const [cache, setCache] = useState<Cache>({});
  const [translating, setTranslating] = useState(false);
  const pending = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Set<string>>(new Set());

  useEffect(() => {
    setCache(loadCache());
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored) setLangState(stored);
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase.from("profiles").select("language").eq("id", u.user.id).maybeSingle();
      if (data?.language) {
        setLangState(data.language);
        localStorage.setItem(LANG_STORAGE_KEY, data.language);
      }
    })();
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
  }, [lang]);

  const flush = useCallback(async (target: string) => {
    const texts = [...pending.current].filter((s) => !inflight.current.has(s)).slice(0, 100);
    pending.current.clear();
    if (!texts.length || target === "en") return;
    texts.forEach((s) => inflight.current.add(s));
    setTranslating(true);
    try {
      const res = await translateStrings({ data: { language: target, texts } });
      setCache((prev) => {
        const next: Cache = { ...prev, [target]: { ...(prev[target] || {}), ...res.translations } };
        saveCache(next);
        return next;
      });
    } catch {
      texts.forEach((s) => inflight.current.delete(s));
    } finally {
      setTranslating(false);
    }
  }, []);

  const queue = useCallback(
    (text: string, target: string) => {
      if (target === "en" || inflight.current.has(text)) return;
      pending.current.add(text);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(target), 250);
    },
    [flush],
  );

  const value = useMemo<Ctx>(() => {
    const t = (k: TKey | (string & {})) => {
      const base = (en as Record<string, string>)[k as string] ?? String(k);
      if (lang === "en") return base;
      const staticHit = dicts[lang]?.[k as TKey];
      if (staticHit) return staticHit;
      const cached = cache[lang]?.[base];
      if (cached) return cached;
      queue(base, lang);
      return base;
    };
    return {
      lang,
      setLang: (l: string) => {
        setLangState(l);
        localStorage.setItem(LANG_STORAGE_KEY, l);
      },
      t,
      langName: languageName(lang),
      dir: RTL_LANGS.has(lang) ? "rtl" : "ltr",
      translating,
    };
  }, [lang, cache, translating, queue]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

