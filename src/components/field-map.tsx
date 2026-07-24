// Client-only draw/edit/delete polygon map using Leaflet + Turf for accurate area.
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
  const [past, setPast] = useState<[number, number][][]>([]);
  const [future, setFuture] = useState<[number, number][][]>([]);
  const ptsRef = useRef(pts);
  useEffect(() => { ptsRef.current = pts; }, [pts]);
  const pastRef = useRef(past);
  useEffect(() => { pastRef.current = past; }, [past]);
  const futureRef = useRef(future);
  useEffect(() => { futureRef.current = future; }, [future]);
  const [mode, setMode] = useState<"add" | "edit">("add");
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  const [search, setSearch] = useState("");

  // Commit a new pts state as a user action: push previous onto history, clear redo.
  function commit(next: [number, number][]) {
    setPast((p) => [...p, ptsRef.current]);
    setFuture([]);
    setPts(next);
  }
  function undo() {
    const p = pastRef.current;
    if (p.length === 0) return;
    const prev = p[p.length - 1];
    setPast((s) => s.slice(0, -1));
    setFuture((f) => [ptsRef.current, ...f]);
    setPts(prev);
  }
  function redo() {
    const f = futureRef.current;
    if (f.length === 0) return;
    const nextState = f[0];
    setFuture((s) => s.slice(1));
    setPast((s) => [...s, ptsRef.current]);
    setPts(nextState);
  }

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const m = L.map(ref.current, { zoomControl: true }).setView([20.5937, 78.9629], 5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(m);
    // Satellite fallback overlay toggle via layers control (kept optional)
    mapRef.current = m;

    if (!readOnly) {
      m.on("click", (e: L.LeafletMouseEvent) => {
        if (modeRef.current !== "add") return;
        commit([...ptsRef.current, [e.latlng.lat, e.latlng.lng]]);
      });
    }

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

  // Compute area/centroid and emit onChange for a given point set.
  function emitChange(next: [number, number][]) {
    if (next.length < 3) { onChange?.(null); return; }
    const ring: [number, number][] = next.map((p) => [p[1], p[0]]);
    ring.push(ring[0]);
    const gj = { type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [ring] }, properties: {} };
    const area_m2 = turfArea(gj);
    const area_acres = area_m2 / 4046.8564224;
    const latSum = next.reduce((s, p) => s + p[0], 0) / next.length;
    const lngSum = next.reduce((s, p) => s + p[1], 0) / next.length;
    onChange?.({ coords: next.map((p) => [p[1], p[0]]), area_m2, area_acres, centroid: { lat: latSum, lng: lngSum } });
  }

  // redraw polygon and markers on pts/mode change
  useEffect(() => {
    const m = mapRef.current;
    if (!m) return;
    if (layerRef.current) { layerRef.current.remove(); layerRef.current = null; }
    markersRef.current.forEach((mk) => mk.remove());
    markersRef.current = [];

    pts.forEach((p, i) => {
      const icon = L.divIcon({
        className: "",
        iconSize: [22, 22],
        iconAnchor: [11, 11],
        html: `<div style="width:22px;height:22px;border-radius:9999px;background:#4CAF50;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">${i + 1}</div>`,
      });
      const mk = L.marker([p[0], p[1]], { icon, draggable: !readOnly });
      mk.addTo(m);
      if (!readOnly) {
        mk.on("drag", (ev: L.LeafletEvent) => {
          const ll = (ev.target as L.Marker).getLatLng();
          // Live update without rebuilding markers (which would break the drag gesture).
          const next: [number, number][] = pts.map((q, idx) => (idx === i ? [ll.lat, ll.lng] : q));
          if (layerRef.current && next.length >= 3) {
            layerRef.current.setLatLngs(next.map((p) => L.latLng(p[0], p[1])));
            emitChange(next);
          }
        });
        mk.on("dragend", (ev: L.LeafletEvent) => {
          const ll = (ev.target as L.Marker).getLatLng();
          commit(ptsRef.current.map((q, idx) => (idx === i ? [ll.lat, ll.lng] : q)));
        });
        mk.on("click", (ev: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(ev);
          if (modeRef.current === "edit") {
            commit(ptsRef.current.filter((_, idx) => idx !== i));
          }
        });
        mk.bindTooltip(modeRef.current === "edit" ? "Tap to delete • drag to move" : "Drag to move", { direction: "top", offset: [0, -8] });
      }
      markersRef.current.push(mk);
    });

    if (pts.length >= 3) {
      const poly = L.polygon(pts.map((p) => L.latLng(p[0], p[1])), {
        color: "#2E7D32", weight: 3, fillColor: "#4CAF50", fillOpacity: 0.3,
      }).addTo(m);
      layerRef.current = poly;
    }
    emitChange(pts);
  }, [pts, mode, onChange, readOnly]);

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
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setMode("add")}
              className={`px-3 py-1.5 ${mode === "add" ? "bg-primary text-primary-foreground" : "bg-background"}`}
            >➕ Add</button>
            <button
              type="button"
              onClick={() => setMode("edit")}
              className={`px-3 py-1.5 border-l border-border ${mode === "edit" ? "bg-primary text-primary-foreground" : "bg-background"}`}
            >✎ Edit / Delete</button>
          </div>
          <button
            type="button"
            onClick={undoLast}
            disabled={pts.length === 0}
            className="rounded-xl border border-border px-3 py-1.5 text-xs disabled:opacity-40"
          >↶ Undo</button>
          {pts.length > 0 && (
            <button type="button" className="ml-auto text-xs text-destructive underline" onClick={() => setPts([])}>Clear all</button>
          )}
        </div>
      )}
      <div ref={ref} className="w-full overflow-hidden rounded-2xl border border-border shadow-soft" style={{ height }} />
      {!readOnly && (
        <div className="text-xs text-muted-foreground">
          {mode === "add"
            ? "Tap map to add corners. Drag any marker to fine-tune. Switch to Edit to delete."
            : "Tap a numbered marker to delete it, or drag it to reshape. Area updates live."}
        </div>
      )}
    </div>
  );
}
