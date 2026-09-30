// Small client-only Leaflet preview with a single draggable pin.
import { useEffect, useRef, useState } from "react";
import L from "leaflet";

export function LocationPinMap({
  lat,
  lng,
  onMove,
  height = 180,
}: {
  lat: number;
  lng: number;
  onMove: (lat: number, lng: number) => void;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const baseRef = useRef<L.TileLayer | null>(null);
  const satRef = useRef<L.TileLayer | null>(null);
  const satOnRef = useRef(false);
  const onMoveRef = useRef(onMove);
  const [satOn, setSatOn] = useState(false);
  useEffect(() => { onMoveRef.current = onMove; }, [onMove]);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { attributionControl: false, zoomControl: true }).setView([lat, lng], 15);
    baseRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    // Esri World Imagery — free satellite basemap swapped in by the overlay button.
    satRef.current = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19 }
    );

    const icon = L.divIcon({
      className: "",
      html: `<div style="width:18px;height:18px;border-radius:9999px;background:hsl(var(--primary));border:3px solid white;box-shadow:0 1px 6px rgba(0,0,0,.4)"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    const marker = L.marker([lat, lng], { draggable: true, icon }).addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      onMoveRef.current(p.lat, p.lng);
    });
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onMoveRef.current(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;
    setTimeout(() => map.invalidateSize(), 60);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      baseRef.current = null;
      satRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleBasemap() {
    const map = mapRef.current;
    if (!map) return;
    const next = !satOnRef.current;
    if (satOnRef.current) { baseRef.current?.addTo(map); satRef.current?.remove(); }
    else { satRef.current?.addTo(map); baseRef.current?.remove(); }
    satOnRef.current = next;
    setSatOn(next);
    markerRef.current?.bringToFront();
  }

  // Keep the pin in sync when coordinates change from outside (e.g. re-detect).
  useEffect(() => {
    const m = markerRef.current;
    const map = mapRef.current;
    if (!m || !map) return;
    const cur = m.getLatLng();
    if (Math.abs(cur.lat - lat) > 1e-7 || Math.abs(cur.lng - lng) > 1e-7) {
      m.setLatLng([lat, lng]);
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng]);

  return (
    <div className="relative w-full overflow-hidden rounded-md border" style={{ height }}>
      <div ref={ref} className="h-full w-full" />
      <button
        type="button"
        onClick={toggleBasemap}
        className={`absolute right-2 top-2 z-[500] rounded-lg px-2.5 py-1 text-xs shadow-soft ${satOn ? "bg-primary text-primary-foreground" : "bg-background text-foreground"}`}
      >{satOn ? "🛰 Satellite" : "🗺 Map"}</button>
    </div>
  );
}
