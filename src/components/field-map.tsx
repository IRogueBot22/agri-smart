// Client-only draw-a-polygon map using Leaflet directly.
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import turfArea from "@turf/area";

export type PolygonResult = {
  coords: [number, number][]; // [lng,lat]
  area_m2: number;
  area_acres: number;
  centroid: { lat: number; lng: number };
};

export function FieldMap({
  initial,
  onChange,
  readOnly = false,
  height = 320,
}: {
  initial?: [number, number][];
  onChange?: (r: PolygonResult | null) => void;
  readOnly?: boolean;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.Polygon | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [pts, setPts] = useState<[number, number][]>(initial ?? []); // [lat,lng]
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const m = L.map(ref.current, { zoomControl: true }).setView([20.5937, 78.9629], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(m);
    mapRef.current = m;

    if (!readOnly) {
      m.on("click", (e: L.LeafletMouseEvent) => {
        setPts((prev) => [...prev, [e.latlng.lat, e.latlng.lng]]);
      });
    }

    // fit initial
    if (initial && initial.length >= 3) {
      const b = L.latLngBounds(initial.map((p) => L.latLng(p[0], p[1])));
      m.fitBounds(b, { padding: [20, 20] });
    } else if (typeof navigator !== "undefined" && navigator.geolocation && !readOnly) {
      navigator.geolocation.getCurrentPosition(
        (pos) => m.setView([pos.coords.latitude, pos.coords.longitude], 16),
        () => {},
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }

    return () => { m.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw polygon and markers on pts change
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }
    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = [];

    if (pts.length >= 1) {
      pts.forEach((p, i) => {
        const mk = L.circleMarker([p[0], p[1]], { radius: 6, color: "#2E7D32", fillColor: "#4CAF50", fillOpacity: 1, weight: 2 })
          .addTo(m) as unknown as L.Marker;
        if (!readOnly) {
          mk.on("click", () => setPts((prev) => prev.filter((_, idx) => idx !== i)));
        }
        markersRef.current.push(mk);
      });
    }
    if (pts.length >= 3) {
      const poly = L.polygon(pts.map((p) => L.latLng(p[0], p[1])), {
        color: "#2E7D32", weight: 3, fillColor: "#4CAF50", fillOpacity: 0.3,
      }).addTo(m);
      layerRef.current = poly;

      // area via Turf (GeoJSON needs [lng,lat] and closed ring)
      const ring: [number, number][] = pts.map((p) => [p[1], p[0]]);
      ring.push(ring[0]);
      const gj = { type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [ring] }, properties: {} };
      const area_m2 = turfArea(gj);
      const area_acres = area_m2 / 4046.8564224;
      const latSum = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const lngSum = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      onChange?.({
        coords: pts.map((p) => [p[1], p[0]]),
        area_m2,
        area_acres,
        centroid: { lat: latSum, lng: lngSum },
      });
    } else {
      onChange?.(null);
    }
  }, [pts, onChange, readOnly]);

  async function locateSearch() {
    if (!search.trim()) return;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}&limit=1`);
    const j = await res.json();
    if (j[0] && mapRef.current) mapRef.current.setView([parseFloat(j[0].lat), parseFloat(j[0].lon)], 16);
  }

  function useMyLocation() {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition((pos) => mapRef.current!.setView([pos.coords.latitude, pos.coords.longitude], 17));
  }

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex gap-2">
          <input
            className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
            placeholder="Search location…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); locateSearch(); } }}
          />
          <button type="button" onClick={locateSearch} className="rounded-xl bg-primary px-3 text-sm text-primary-foreground">Go</button>
          <button type="button" onClick={useMyLocation} className="rounded-xl bg-secondary px-3 text-sm">📍</button>
        </div>
      )}
      <div ref={ref} className="w-full overflow-hidden rounded-2xl border border-border shadow-soft" style={{ height }} />
      {!readOnly && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Tap map to add corners{pts.length >= 3 ? " · tap a marker to remove" : ""}</span>
          {pts.length > 0 && (
            <button type="button" className="text-destructive underline" onClick={() => setPts([])}>Clear polygon</button>
          )}
        </div>
      )}
    </div>
  );
}
