// Small client-only Leaflet preview with a single draggable pin.
import { useEffect, useRef } from "react";
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
  const onMoveRef = useRef(onMove);
  useEffect(() => { onMoveRef.current = onMove; }, [onMove]);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { attributionControl: false, zoomControl: true }).setView([lat, lng], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);

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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  return <div ref={ref} style={{ height }} className="w-full overflow-hidden rounded-md border" />;
}
