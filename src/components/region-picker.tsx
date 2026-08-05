import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, LocateFixed } from "lucide-react";
import { toast } from "sonner";
import { COUNTRIES } from "@/lib/countries";
import { INDIAN_STATES, districtsFor } from "@/lib/regions";
import { listSubRegions } from "@/lib/places.functions";
import { reverseGeocodeRegion } from "@/lib/geocode.functions";
import { useI18n } from "@/lib/i18n";

export type RegionValue = {
  country?: string | null;
  state?: string | null;
  district?: string | null;
  mandal?: string | null;
  village?: string | null;
};

const OTHER = "__other__";
const cacheKey = (p: string) => `agri-places:${p}`;

function readCache(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(key));
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch { return null; }
}
function writeCache(key: string, items: string[]) {
  try { localStorage.setItem(cacheKey(key), JSON.stringify(items)); } catch { /* ignore */ }
}

function Field({
  label, value, options, loading, onChange, placeholder, disabled,
}: {
  label: string;
  value: string;
  options: string[];
  loading: boolean;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const known = !value || options.includes(value);
  const [manual, setManual] = useState(!known && !!value);

  useEffect(() => { if (!value) setManual(false); }, [value]);

  return (
    <div>
      <div className="flex items-center gap-1">
        <Label className="text-xs">{label}</Label>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      {manual ? (
        <div className="flex gap-1">
          <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
          {options.length > 0 && (
            <button type="button" onClick={() => { setManual(false); onChange(""); }} className="rounded-md border px-2 text-xs">↺</button>
          )}
        </div>
      ) : (
        <select
          value={known ? value : ""}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.value === OTHER) { setManual(true); onChange(""); return; }
            onChange(e.target.value);
          }}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
          <option value={OTHER}>Other / type manually…</option>
        </select>
      )}
    </div>
  );
}

export function RegionPicker({ value, onChange }: { value: RegionValue; onChange: (v: RegionValue) => void }) {
  const { t } = useI18n();
  const fetchSub = useServerFn(listSubRegions);
  const reverseGeocode = useServerFn(reverseGeocodeRegion);

  const country = value.country || "India";
  const isIndia = country === "India";

  const [states, setStates] = useState<string[]>(isIndia ? INDIAN_STATES : []);
  const [districts, setDistricts] = useState<string[]>([]);
  const [mandals, setMandals] = useState<string[]>([]);
  const [villages, setVillages] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const staticDistricts = useMemo(() => (isIndia ? districtsFor(value.state) : []), [isIndia, value.state]);

  async function detectFromGps() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error(t("Location is not supported on this device"));
      return;
    }
    setLocating(true);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 60000,
        }),
      );
      const r = await reverseGeocode({
        data: { lat: pos.coords.latitude, lon: pos.coords.longitude },
      });
      const detectedCountry =
        (r.country && COUNTRIES.find((c) => c.toLowerCase() === r.country!.toLowerCase())) || r.country || country;
      onChange({
        country: detectedCountry,
        state: r.state ?? "",
        district: r.district ?? "",
        mandal: r.mandal ?? "",
        village: r.village ?? "",
      });
      toast.success(t("Location detected"), { description: r.label ?? undefined });
    } catch (e) {
      toast.error(t("Could not detect your location"), {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLocating(false);
    }
  }


  async function load(
    level: "state" | "district" | "mandal" | "village",
    key: string,
    args: { state?: string | null; district?: string | null; mandal?: string | null },
    set: (v: string[]) => void,
  ) {
    const cached = readCache(key);
    if (cached) { set(cached); return; }
    setBusy(level);
    try {
      const items = (await fetchSub({ data: { level, country, ...args } })) as string[];
      set(items);
      if (items.length) writeCache(key, items);
    } catch {
      set([]);
    } finally {
      setBusy(null);
    }
  }

  // States
  useEffect(() => {
    if (isIndia) { setStates(INDIAN_STATES); return; }
    load("state", `${country}`, {}, setStates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country]);

  // Districts
  useEffect(() => {
    setDistricts([]);
    if (!value.state) return;
    if (staticDistricts.length) { setDistricts(staticDistricts); return; }
    load("district", `${country}/${value.state}`, { state: value.state }, setDistricts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, value.state, staticDistricts.length]);

  // Mandals / blocks
  useEffect(() => {
    setMandals([]);
    if (!value.state || !value.district) return;
    load("mandal", `${country}/${value.state}/${value.district}`, { state: value.state, district: value.district }, setMandals);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, value.state, value.district]);

  // Villages
  useEffect(() => {
    setVillages([]);
    if (!value.district) return;
    load(
      "village",
      `${country}/${value.state}/${value.district}/${value.mandal ?? ""}`,
      { state: value.state, district: value.district, mandal: value.mandal },
      setVillages,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, value.state, value.district, value.mandal]);

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs">{t("Country")}</Label>
        <select
          value={country}
          onChange={(e) => onChange({ country: e.target.value, state: "", district: "", mandal: "", village: "" })}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field
          label={t("State")}
          placeholder={t("Select state")}
          value={value.state ?? ""}
          options={states}
          loading={busy === "state"}
          onChange={(v) => onChange({ ...value, country, state: v, district: "", mandal: "", village: "" })}
        />
        <Field
          label={t("District")}
          placeholder={t("Select district")}
          value={value.district ?? ""}
          options={districts}
          loading={busy === "district"}
          disabled={!value.state}
          onChange={(v) => onChange({ ...value, country, district: v, mandal: "", village: "" })}
        />
        <Field
          label={t("Mandal / Block")}
          placeholder={t("Select mandal")}
          value={value.mandal ?? ""}
          options={mandals}
          loading={busy === "mandal"}
          disabled={!value.district}
          onChange={(v) => onChange({ ...value, country, mandal: v, village: "" })}
        />
        <Field
          label={t("Village")}
          placeholder={t("Select village")}
          value={value.village ?? ""}
          options={villages}
          loading={busy === "village"}
          disabled={!value.district}
          onChange={(v) => onChange({ ...value, country, village: v })}
        />
      </div>
    </div>
  );
}
