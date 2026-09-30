// Client-only draw/edit/delete polygon map using Leaflet + Turf for accurate area.
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
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
  // Vertex currently selected for precise nudging / deletion.
  const [selected, setSelected] = useState<number | null>(null);
  const selectedRef = useRef(selected);
  useEffect(() => { selectedRef.current = selected; }, [selected]);
  const [step, setStep] = useState(1); // nudge step in metres
  const [search, setSearch] = useState("");
  const [sat, setSat] = useState(false);
  const satRef = useRef(sat);
  useEffect(() => { satRef.current = sat; }, [sat]);
  const baseRef = useRef<L.TileLayer | null>(null);
  const satLayerRef = useRef<L.TileLayer | null>(null);
  const liveMarkerRef = useRef<L.Marker | null>(null);
  const liveAccRef = useRef<L.Circle | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [liveOn, setLiveOn] = useState(false);
  const [liveInfo, setLiveInfo] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [follow, setFollow] = useState(false);
  const followRef = useRef(follow);
  useEffect(() => { followRef.current = follow; }, [follow]);

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
    baseRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(m);
    // Esri World Imagery — free satellite basemap, swapped in by the toggle.
    satLayerRef.current = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Imagery &copy; Esri", maxZoom: 19 }
    );
    mapRef.current = m;

    if (!readOnly) {
      m.on("click", (e: L.LeafletMouseEvent) => {
        if (modeRef.current !== "add") return;
        commit([...ptsRef.current, [e.latlng.lat, e.latlng.lng]]);
      });
    }
    // User panning the map cancels follow-mode.
    m.on("dragstart", () => { if (followRef.current) setFollow(false); });

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

    return () => {
      m.remove(); mapRef.current = null; baseRef.current = null; satLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Swaps between street and satellite basemaps, keeping view and layers intact. */
  function toggleBasemap() {
    const m = mapRef.current;
    if (!m) return;
    const next = !satRef.current;
    if (baseRef.current) baseRef.current.remove();
    if (satLayerRef.current) satLayerRef.current.remove();
    if (next) { satLayerRef.current?.addTo(m); } else { baseRef.current?.addTo(m); }
    setSat(next);
  }

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
      const isSel = selected === i;
      const size = isSel ? 28 : 22;
      const bg = isSel ? "#F9A825" : "#4CAF50";
      const icon = L.divIcon({
        className: "",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${bg};border:${isSel ? 3 : 2}px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">${i + 1}</div>`,
      });
      const mk = L.marker([p[0], p[1]], { icon, draggable: !readOnly });
      mk.addTo(m);
      if (!readOnly) {
        mk.on("dragstart", () => setSelected(i));
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
        // Tapping selects the corner — deletion is an explicit action in the
        // vertex panel so a stray tap can never destroy a boundary point.
        mk.on("click", (ev: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(ev);
          setSelected((cur) => (cur === i ? null : i));
        });
        mk.bindTooltip(`${t("Corner")} ${i + 1} — ${t("drag to adjust, tap to select")}`, { direction: "top", offset: [0, -8] });
      }
      markersRef.current.push(mk);
    });

    if (pts.length >= 3) {
      const poly = L.polygon(pts.map((p) => L.latLng(p[0], p[1])), {
        color: "#2E7D32", weight: 3, fillColor: "#4CAF50", fillOpacity: 0.3,
      }).addTo(m);
      if (!readOnly) {
        // Tap an edge to insert a new vertex at the nearest point on that edge.
        poly.on("click", (ev: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(ev);
          const cur = ptsRef.current;
          if (cur.length < 2) return;
          const clickPt = m.latLngToLayerPoint(ev.latlng);
          let bestIdx = 0;
          let bestDist = Infinity;
          for (let i = 0; i < cur.length; i++) {
            const a = m.latLngToLayerPoint(L.latLng(cur[i][0], cur[i][1]));
            const b = m.latLngToLayerPoint(L.latLng(cur[(i + 1) % cur.length][0], cur[(i + 1) % cur.length][1]));
            const dx = b.x - a.x, dy = b.y - a.y;
            const len2 = dx * dx + dy * dy || 1;
            let t = ((clickPt.x - a.x) * dx + (clickPt.y - a.y) * dy) / len2;
            t = Math.max(0, Math.min(1, t));
            const px = a.x + t * dx, py = a.y + t * dy;
            const d = Math.hypot(clickPt.x - px, clickPt.y - py);
            if (d < bestDist) { bestDist = d; bestIdx = i; }
          }
          const next = [...cur];
          next.splice(bestIdx + 1, 0, [ev.latlng.lat, ev.latlng.lng]);
          commit(next);
          setSelected(bestIdx + 1);
        });
      }
      layerRef.current = poly;
    }
    emitChange(pts);
  }, [pts, mode, selected, onChange, readOnly]);

  // Keep the selection valid when points are removed.
  useEffect(() => {
    if (selected !== null && selected >= pts.length) setSelected(null);
  }, [pts.length, selected]);

  /** Moves the selected corner by a precise metre offset (fine adjustment). */
  function nudge(dNorthM: number, dEastM: number) {
    const i = selectedRef.current;
    if (i === null) return;
    const cur = ptsRef.current;
    const [lat, lng] = cur[i];
    const nextLat = lat + dNorthM / 111320;
    const nextLng = lng + dEastM / (111320 * Math.cos((lat * Math.PI) / 180) || 1);
    commit(cur.map((q, idx) => (idx === i ? ([nextLat, nextLng] as [number, number]) : q)));
  }

  function deleteSelected() {
    const i = selectedRef.current;
    if (i === null) return;
    commit(ptsRef.current.filter((_, idx) => idx !== i));
    setSelected(null);
  }

  // Arrow-key nudging while a corner is selected.
  useEffect(() => {
    if (readOnly || selected === null) return;
    function onKey(e: KeyboardEvent) {
      const map: Record<string, [number, number]> = {
        ArrowUp: [step, 0], ArrowDown: [-step, 0], ArrowLeft: [0, -step], ArrowRight: [0, step],
      };
      if (map[e.key]) { e.preventDefault(); nudge(...map[e.key]); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(); }
      else if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, step, readOnly]);

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

  function stopLive() {
    if (watchIdRef.current !== null && typeof navigator !== "undefined") {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
    liveMarkerRef.current?.remove(); liveMarkerRef.current = null;
    liveAccRef.current?.remove(); liveAccRef.current = null;
    setLiveOn(false);
    setFollow(false);
    setLiveInfo(null);
  }
  function toggleLive() {
    if (liveOn) { stopLive(); return; }
    if (typeof navigator === "undefined" || !navigator.geolocation || !mapRef.current) return;
    setLiveOn(true);
    setFollow(true);
    let first = true;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const m = mapRef.current; if (!m) return;
        const { latitude, longitude, accuracy } = pos.coords;
        const ll = L.latLng(latitude, longitude);
        if (!liveMarkerRef.current) {
          const icon = L.divIcon({
            className: "",
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            html: `<div style="width:14px;height:14px;border-radius:9999px;background:#1E88E5;border:3px solid #fff;box-shadow:0 0 0 2px rgba(30,136,229,.35),0 1px 4px rgba(0,0,0,.4)"></div>`,
          });
          liveMarkerRef.current = L.marker(ll, { icon, interactive: false }).addTo(m);
          liveAccRef.current = L.circle(ll, { radius: accuracy, color: "#1E88E5", weight: 1, fillOpacity: 0.1 }).addTo(m);
        } else {
          liveMarkerRef.current.setLatLng(ll);
          liveAccRef.current?.setLatLng(ll).setRadius(accuracy);
        }
        setLiveInfo({ lat: latitude, lng: longitude, acc: accuracy });
        if (first) { m.setView(ll, Math.max(m.getZoom(), 17)); first = false; }
        else if (followRef.current) { m.panTo(ll, { animate: true }); }
      },
      () => { stopLive(); },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );
  }
  useEffect(() => () => { stopLive(); }, []);

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={toggleLive}
            className={`rounded-xl px-3 py-1.5 border ${liveOn ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
          >{liveOn ? `● ${t("Live location on")}` : `○ ${t("Live location")}`}</button>
          {liveOn && (
            <button
              type="button"
              onClick={() => {
                const nextFollow = !follow;
                setFollow(nextFollow);
                if (nextFollow && liveInfo && mapRef.current) {
                  mapRef.current.setView([liveInfo.lat, liveInfo.lng], Math.max(mapRef.current.getZoom(), 17));
                }
              }}
              className={`rounded-xl px-3 py-1.5 border ${follow ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"}`}
            >{follow ? `🎯 ${t("Following")}` : `🎯 ${t("Follow")}`}</button>
          )}
          {liveInfo && (
            <span className="text-muted-foreground">±{Math.round(liveInfo.acc)} m</span>
          )}
          {liveInfo && !follow && (
            <button
              type="button"
              onClick={() => mapRef.current?.setView([liveInfo.lat, liveInfo.lng], Math.max(mapRef.current.getZoom(), 17))}
              className="ml-auto rounded-xl border border-border px-3 py-1.5"
            >{t("Recenter")}</button>
          )}
        </div>
      )}
      {!readOnly && (
        <div className="flex gap-2">
          <input
            className="h-10 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
            placeholder={t("Search location…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); locateSearch(); } }}
          />
          <button type="button" onClick={locateSearch} className="rounded-xl bg-primary px-3 text-sm text-primary-foreground">{t("Go")}</button>
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
            >➕ {t("Add")}</button>
            <button
              type="button"
              onClick={() => setMode("edit")}
              className={`px-3 py-1.5 border-l border-border ${mode === "edit" ? "bg-primary text-primary-foreground" : "bg-background"}`}
            >✎ {t("Edit / Delete")}</button>
          </div>
          <button
            type="button"
            onClick={undo}
            disabled={past.length === 0}
            className="rounded-xl border border-border px-3 py-1.5 text-xs disabled:opacity-40"
          >↶ {t("Undo")}</button>
          <button
            type="button"
            onClick={redo}
            disabled={future.length === 0}
            className="rounded-xl border border-border px-3 py-1.5 text-xs disabled:opacity-40"
          >↷ {t("Redo")}</button>
          {pts.length > 0 && (
            <button type="button" className="ml-auto text-xs text-destructive underline" onClick={() => commit([])}>{t("Clear all")}</button>
          )}
        </div>
      )}
      <div className="flex items-center justify-end">
        <div className="inline-flex overflow-hidden rounded-xl border border-border text-xs">
          <button
            type="button"
            onClick={() => sat && toggleBasemap()}
            className={`px-3 py-1.5 ${!sat ? "bg-primary text-primary-foreground" : "bg-background"}`}
          >🗺 {t("Map")}</button>
          <button
            type="button"
            onClick={() => !sat && toggleBasemap()}
            className={`px-3 py-1.5 border-l border-border ${sat ? "bg-primary text-primary-foreground" : "bg-background"}`}
          >🛰 {t("Satellite")}</button>
        </div>
      </div>
      <div ref={ref} className="w-full overflow-hidden rounded-2xl border border-border shadow-soft" style={{ height }} />
      {!readOnly && selected !== null && pts[selected] && (
        <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">{t("Corner")} {selected + 1} {t("of")} {pts.length}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected((s) => (s === null ? null : (s + 1) % pts.length))}
                className="rounded-xl border border-border px-2.5 py-1 text-xs"
              >{t("Next")} ›</button>
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-border px-2.5 py-1 text-xs">{t("Done")}</button>
            </div>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {pts[selected][0].toFixed(6)}, {pts[selected][1].toFixed(6)}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid grid-cols-3 gap-1">
              <span />
              <button type="button" onClick={() => nudge(step, 0)} className="rounded-lg border border-border px-2.5 py-1 text-xs">↑</button>
              <span />
              <button type="button" onClick={() => nudge(0, -step)} className="rounded-lg border border-border px-2.5 py-1 text-xs">←</button>
              <span className="grid place-items-center text-[10px] text-muted-foreground">{step}m</span>
              <button type="button" onClick={() => nudge(0, step)} className="rounded-lg border border-border px-2.5 py-1 text-xs">→</button>
              <span />
              <button type="button" onClick={() => nudge(-step, 0)} className="rounded-lg border border-border px-2.5 py-1 text-xs">↓</button>
              <span />
            </div>
            <div className="inline-flex overflow-hidden rounded-xl border border-border text-xs">
              {[0.5, 1, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStep(s)}
                  className={`px-2.5 py-1 ${step === s ? "bg-primary text-primary-foreground" : "bg-background"}`}
                >{s} m</button>
              ))}
            </div>
            <button
              type="button"
              onClick={deleteSelected}
              className="ml-auto rounded-xl bg-destructive px-3 py-1.5 text-xs text-destructive-foreground"
            >🗑 {t("Delete corner")}</button>
          </div>
        </div>
      )}
      {!readOnly && (
        <div className="text-xs text-muted-foreground">
          {selected !== null
            ? t("Drag the highlighted corner, or use the arrows / keyboard arrow keys for metre-precise adjustment. Delete key removes it.")
            : mode === "add"
              ? t("Tap map to add corners, or tap an edge to insert a vertex. Drag markers to fine-tune.")
              : t("Tap a corner to select it, drag to reshape, or tap an edge to insert a vertex.")}
        </div>
      )}
    </div>
  );
}
