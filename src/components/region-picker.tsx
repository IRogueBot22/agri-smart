import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, LocateFixed, Check, X, MapPinOff } from "lucide-react";
import { toast } from "sonner";
import { COUNTRIES } from "@/lib/countries";
import { INDIAN_STATES, districtsFor } from "@/lib/regions";
import { listSubRegions } from "@/lib/places.functions";
import { reverseGeocodeRegion, type ReverseGeocodeResult } from "@/lib/geocode.functions";
import { getAccuratePosition } from "@/lib/geolocate";
import { getCachedGeocode, setCachedGeocode } from "@/lib/geocode-cache";


import { useI18n } from "@/lib/i18n";
import type { RegionErrors } from "@/lib/region-schema";

const LocationPinMap = lazy(() =>
  import("@/components/location-pin-map").then((m) => ({ default: m.LocationPinMap })),
);

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
  label, value, options, loading, onChange, placeholder, disabled, error,
}: {
  label: string;
  value: string;
  options: string[];
  loading: boolean;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  error?: string;
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
          <Input
            value={value}
            placeholder={placeholder}
            maxLength={80}
            aria-invalid={!!error}
            className={error ? "border-destructive" : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
          {options.length > 0 && (
            <button type="button" onClick={() => { setManual(false); onChange(""); }} className="rounded-md border px-2 text-xs">↺</button>
          )}
        </div>
      ) : (
        <select
          value={known ? value : ""}
          disabled={disabled}
          aria-invalid={!!error}
          onChange={(e) => {
            if (e.target.value === OTHER) { setManual(true); onChange(""); return; }
            onChange(e.target.value);
          }}
          className={`h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50 ${error ? "border-destructive" : ""}`}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
          <option value={OTHER}>Other / type manually…</option>
        </select>
      )}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function RegionPicker({ value, onChange, errors }: { value: RegionValue; onChange: (v: RegionValue) => void; errors?: RegionErrors }) {
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
  const [locateStatus, setLocateStatus] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  // Location permission handling: explain before asking, guide after a denial.
  const [permission, setPermission] = useState<"unknown" | "unsupported" | "prompt" | "granted" | "denied">("unknown");
  const [showConsent, setShowConsent] = useState(false);
  const [geoFailed, setGeoFailed] = useState<string | null>(null);


  // Pending GPS pick shown on a small map so the farmer can confirm/adjust it.
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [pinResult, setPinResult] = useState<ReverseGeocodeResult | null>(null);
  const [pinBusy, setPinBusy] = useState(false);

  const staticDistricts = useMemo(() => (isIndia ? districtsFor(value.state) : []), [isIndia, value.state]);

  async function lookupPin(lat: number, lng: number) {
    // Reuse a nearby cached lookup instead of hitting the geocoding API again.
    const cached = getCachedGeocode(lat, lng);
    if (cached) {
      setPinResult(cached);
      setPinBusy(false);
      return;
    }
    setPinBusy(true);
    try {
      const r = await reverseGeocode({ data: { lat, lon: lng } });
      setPinResult(r);
      if (r) setCachedGeocode(lat, lng, r);
    } catch (e) {
      setPinResult(null);
      toast.error(t("Could not read that location"), {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setPinBusy(false);
    }
  }


  function applyPin() {
    const r = pinResult;
    if (!r) return;
    const detectedCountry =
      (r.country && COUNTRIES.find((c) => c.toLowerCase() === r.country!.toLowerCase())) || r.country || country;
    onChange({
      country: detectedCountry,
      state: r.state ?? "",
      district: r.district ?? "",
      mandal: r.mandal ?? "",
      village: r.village ?? "",
    });
    setPin(null);
    setPinResult(null);
    toast.success(t("Location confirmed"), { description: r.label ?? undefined });
  }

  // Read the current permission state (where supported) so we can tailor copy.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermission("unsupported");
      return;
    }
    const perms = navigator.permissions;
    if (!perms?.query) { setPermission("unknown"); return; }
    let status: PermissionStatus | null = null;
    const onChange = () => status && setPermission(status.state as "prompt" | "granted" | "denied");
    perms
      .query({ name: "geolocation" as PermissionName })
      .then((s) => {
        status = s;
        setPermission(s.state as "prompt" | "granted" | "denied");
        s.addEventListener("change", onChange);
      })
      .catch(() => setPermission("unknown"));
    return () => status?.removeEventListener("change", onChange);
  }, []);

  /** Entry point from the button: explain first if we haven't asked yet. */
  function requestLocation() {
    if (permission === "unsupported") {
      setGeoFailed("unsupported");
      return;
    }
    if (permission === "denied") {
      setGeoFailed("denied");
      return;
    }
    if (permission === "granted") { detectFromGps(); return; }
    setShowConsent(true);
  }

  async function detectFromGps() {
    setShowConsent(false);
    setGeoFailed(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermission("unsupported");
      setGeoFailed("unsupported");
      return;
    }
    setLocating(true);
    setLocateStatus(t("Searching for GPS signal…"));
    try {
      const fix = await getAccuratePosition({
        desiredAccuracy: 50,
        attemptTimeout: 12000,
        retries: 3,
        maximumAge: 30000,
        onProgress: ({ attempt, attempts, accuracy }) => {
          setLocateStatus(
            accuracy == null
              ? `${t("Searching for GPS signal…")} (${attempt}/${attempts})`
              : `${t("Improving accuracy")} · ±${Math.round(accuracy)} m (${attempt}/${attempts})`,
          );
        },
      });
      setAccuracy(fix.accuracy);
      setPin({ lat: fix.lat, lng: fix.lng });
      if (fix.accuracy > 200) {
        toast.warning(t("Weak GPS signal"), {
          description: `${t("Accuracy")} ±${Math.round(fix.accuracy)} m — ${t("adjust the pin if needed")}`,
        });
      }
      await lookupPin(fix.lat, fix.lng);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/denied/i.test(msg)) {
        setPermission("denied");
        setGeoFailed("denied");
      } else if (!/cancelled/i.test(msg)) {
        setGeoFailed("unavailable");
      }
    } finally {
      setLocating(false);
      setLocateStatus(null);
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
      <button
        type="button"
        onClick={requestLocation}
        disabled={locating || permission === "unsupported"}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm font-medium text-primary disabled:opacity-60"
      >
        {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
        {locating ? t("Detecting location…") : t("Use my current location")}
      </button>

      {showConsent && (
        <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium">{t("Allow location access?")}</p>
          <p className="text-xs text-muted-foreground">
            {t(
              "We use your location only to fill in your country, state, district and village. It is never shared, and you can always type your region by hand.",
            )}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={detectFromGps}
              className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              {t("Allow")}
            </button>
            <button
              type="button"
              onClick={() => { setShowConsent(false); setGeoFailed("manual"); }}
              className="flex-1 rounded-md border px-3 py-2 text-sm font-medium"
            >
              {t("Enter manually")}
            </button>
          </div>
        </div>
      )}

      {geoFailed && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <MapPinOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="space-y-1 text-xs">
            <p className="font-medium text-foreground">
              {geoFailed === "denied"
                ? t("Location access is blocked")
                : geoFailed === "unsupported"
                  ? t("Location is not supported on this device")
                  : geoFailed === "manual"
                    ? t("No problem — choose your region below")
                    : t("Could not detect your location")}
            </p>
            <p className="text-muted-foreground">
              {geoFailed === "denied"
                ? t(
                    "Enable location for this site in your browser or phone settings, then tap Use my current location again. You can also select your region manually below.",
                  )
                : t("Select your country, state, district, mandal and village from the lists below.")}
            </p>
            <button
              type="button"
              onClick={() => setGeoFailed(null)}
              className="font-medium text-primary underline"
            >
              {t("Dismiss")}
            </button>
          </div>
        </div>
      )}


      {(locateStatus || (accuracy != null && pin)) && (
        <p className="text-center text-xs text-muted-foreground">
          {locateStatus ?? `${t("Accuracy")} ±${Math.round(accuracy!)} m`}
        </p>
      )}


      {pin && (
        <div className="space-y-2 rounded-md border bg-muted/30 p-2">
          <p className="text-xs text-muted-foreground">
            {t("Drag the pin or tap the map to adjust, then confirm.")}
          </p>
          <Suspense fallback={<div className="h-[180px] w-full animate-pulse rounded-md bg-muted" />}>
            <LocationPinMap
              lat={pin.lat}
              lng={pin.lng}
              onMove={(lat, lng) => { setPin({ lat, lng }); lookupPin(lat, lng); }}
            />
          </Suspense>
          <div className="text-xs">
            {pinBusy ? (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> {t("Reading location…")}
              </span>
            ) : (
              <span className="text-muted-foreground">{pinResult?.label ?? t("Unknown location")}</span>
            )}
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyPin}
              disabled={pinBusy || !pinResult}
              className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              <Check className="h-4 w-4" /> {t("Confirm location")}
            </button>
            <button
              type="button"
              onClick={() => { setPin(null); setPinResult(null); }}
              className="flex items-center justify-center gap-1 rounded-md border px-3 py-2 text-sm"
            >
              <X className="h-4 w-4" /> {t("Cancel")}
            </button>
          </div>
        </div>
      )}

      <div>
        <Label className="text-xs">{t("Country")}</Label>
        <select
          value={country}
          aria-invalid={!!errors?.country}
          onChange={(e) => onChange({ country: e.target.value, state: "", district: "", mandal: "", village: "" })}
          className={`h-10 w-full rounded-md border bg-background px-3 text-sm ${errors?.country ? "border-destructive" : ""}`}
        >
          {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {errors?.country && <p className="mt-1 text-xs text-destructive">{t(errors.country)}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field
          label={t("State")}
          placeholder={t("Select state")}
          value={value.state ?? ""}
          options={states}
          loading={busy === "state"}
          error={errors?.state ? t(errors.state) : undefined}
          onChange={(v) => onChange({ ...value, country, state: v, district: "", mandal: "", village: "" })}
        />
        <Field
          label={t("District")}
          placeholder={t("Select district")}
          value={value.district ?? ""}
          options={districts}
          loading={busy === "district"}
          disabled={!value.state}
          error={errors?.district ? t(errors.district) : undefined}
          onChange={(v) => onChange({ ...value, country, district: v, mandal: "", village: "" })}
        />
        <Field
          label={t("Mandal / Block")}
          placeholder={t("Select mandal")}
          value={value.mandal ?? ""}
          options={mandals}
          loading={busy === "mandal"}
          disabled={!value.district}
          error={errors?.mandal ? t(errors.mandal) : undefined}
          onChange={(v) => onChange({ ...value, country, mandal: v, village: "" })}
        />

        <Field
          label={t("Village")}
          placeholder={t("Select village")}
          value={value.village ?? ""}
          options={villages}
          loading={busy === "village"}
          disabled={!value.district}
          error={errors?.village ? t(errors.village) : undefined}
          onChange={(v) => onChange({ ...value, country, village: v })}
        />
      </div>
    </div>
  );
}
