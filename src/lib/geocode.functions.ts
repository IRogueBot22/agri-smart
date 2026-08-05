import { createServerFn } from "@tanstack/react-start";

export type ReverseGeocodeResult = {
  country?: string | null;
  state?: string | null;
  district?: string | null;
  mandal?: string | null;
  village?: string | null;
  label?: string | null;
};

const clean = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim().replace(/\s+(District|Taluk|Tehsil|Mandal)$/i, "") : null;

/** Reverse geocode GPS coordinates into an administrative region (country → village). */
export const reverseGeocodeRegion = createServerFn({ method: "POST" })
  .inputValidator((data: { lat: number; lon: number }) => {
    const lat = Number(data?.lat);
    const lon = Number(data?.lon);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw new Error("Invalid latitude");
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) throw new Error("Invalid longitude");
    return { lat, lon };
  })
  .handler(async ({ data }): Promise<ReverseGeocodeResult> => {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=en` +
      `&lat=${data.lat}&lon=${data.lon}`;

    const res = await fetch(url, {
      headers: { "User-Agent": "AgriSmartAI/1.0 (farmer advisory app)", Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Reverse geocoding failed [${res.status}]: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as { display_name?: string; address?: Record<string, string> };
    const a = json.address ?? {};

    return {
      country: clean(a["country"]),
      state: clean(a["state"] ?? a["region"] ?? a["province"]),
      district: clean(a["state_district"] ?? a["county"] ?? a["district"]),
      mandal: clean(a["county"] !== a["state_district"] ? a["subdistrict"] ?? a["municipality"] ?? a["city_district"] : a["subdistrict"]),
      village: clean(a["village"] ?? a["hamlet"] ?? a["town"] ?? a["suburb"] ?? a["city"]),
      label: clean(json.display_name),
    };
  });
