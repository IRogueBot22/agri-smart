/**
 * Proximity cache for reverse-geocoding results.
 *
 * Reverse geocoding returns the same administrative region for any point
 * within a few hundred metres, so we reuse a cached entry when the new
 * coordinates fall inside `RADIUS_M` of a stored one. Entries live in
 * localStorage (survives reloads and works offline) and expire after 30 days.
 */

import type { ReverseGeocodeResult } from "@/lib/geocode.functions";

const KEY = "agri-geocache:v1";
const RADIUS_M = 400; // points closer than this share a region
const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 120;

type Entry = { lat: number; lng: number; at: number; result: ReverseGeocodeResult };

function read(): Entry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Entry[];
    const now = Date.now();
    return Array.isArray(list) ? list.filter((e) => e && now - e.at < TTL_MS) : [];
  } catch {
    return [];
  }
}

function write(list: Entry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
  } catch {
    /* quota / private mode — ignore */
  }
}

/** Approximate distance in metres (equirectangular, fine at these scales). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = (((b.lng - a.lng) * Math.PI) / 180) * Math.cos(((a.lat + b.lat) / 2 * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng) * R;
}

/** Nearest cached result within RADIUS_M, or null. */
export function getCachedGeocode(lat: number, lng: number): ReverseGeocodeResult | null {
  const list = read();
  let best: { d: number; e: Entry } | null = null;
  for (const e of list) {
    const d = distanceMeters({ lat, lng }, { lat: e.lat, lng: e.lng });
    if (d <= RADIUS_M && (!best || d < best.d)) best = { d, e };
  }
  if (!best) return null;
  // Refresh recency so hot locations stay in the cache.
  write([best.e, ...list.filter((x) => x !== best!.e)]);
  return best.e.result;
}

export function setCachedGeocode(lat: number, lng: number, result: ReverseGeocodeResult) {
  const list = read().filter((e) => distanceMeters({ lat, lng }, { lat: e.lat, lng: e.lng }) > RADIUS_M / 2);
  write([{ lat, lng, at: Date.now(), result }, ...list]);
}
