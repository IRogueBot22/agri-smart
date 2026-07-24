
## Scope adjustment (important)

Lovable builds one codebase: a React web app on TanStack Start with Lovable Cloud (Postgres + Auth + Storage) and Lovable AI Gateway. It cannot produce a separate Flutter app, Node/Express server, MongoDB Atlas database, or Python microservices.

I'll deliver AgriSmart AI as a **mobile-first responsive web app** that covers all 20 screens end-to-end, using the same green farmer-friendly theme. It works great on phones (add-to-homescreen capable) and desktop.

## Stack

- TanStack Start (React 19) + Tailwind v4, shadcn/ui, Poppins font, green theme (#2E7D32 / #4CAF50 / #FFC107)
- Lovable Cloud: Auth (email+password + Google), Postgres with RLS, Storage (leaf photo uploads)
- Lovable AI Gateway (google/gemini-3.6-flash for text advisories, google/gemini-3.6-flash for leaf-image disease detection via multimodal input)
- Leaflet + OpenStreetMap tiles + leaflet-draw for polygon drawing; Turf.js for area calculation from polygon (real, live)
- Open-Meteo API for current weather + 7-day forecast (real, live, no key)
- Nominatim for location search
- Recharts for yield / market trend charts

## Live data used
- Weather: Open-Meteo (temp, humidity, wind, rainfall, 7-day forecast) from field centroid
- Location: Nominatim search + browser geolocation
- Area: computed from drawn polygon coords via Turf (`area` in m² → acres/hectares)
- AI advisories: real calls to Lovable AI for crop, fertilizer, irrigation, yield, disease

## Screens (all 20)

1. Splash → 2–4. Onboarding (3 pages, swipeable) → 5. Login → 6. Register (full name, phone, email, password, village, district, state) → 7. Home dashboard (greeting, weather card, farm summary, today's AI recommendation, quick actions, bottom nav) → 8. My Fields list → 9. Draw Field on Map (search, geolocate, draw polygon, edit, delete, auto area) → 10. Field Details (map + polygon + metadata + edit/delete/AI) → 11. AI Crop Recommendation (auto weather/area/season; user picks soil + water) → 12. Weather (7-day + advisory) → 13. Disease Detection (upload/camera leaf photo) → 14. Disease Result → 15. Fertilizer Recommendation → 16. Irrigation Advisory → 17. Yield Prediction (with trend chart) → 18. Market Prices (with weekly trend, search, filter) → 19. Notifications (weather/disease/harvest/scheme/market) → 20. Profile (photo, name, phone, village, language toggle EN/HI, dark mode, logout). Plus Government Schemes list + Scheme Details as sub-routes off the dashboard.

## Data model (Lovable Cloud / Postgres)

- `profiles` (id → auth.users, full_name, phone, village, district, state, avatar_url, language, dark_mode)
- `fields` (id, user_id, name, crop, soil_type, water_source, polygon jsonb, centroid_lat, centroid_lng, area_acres, image_url)
- `recommendations` (id, user_id, field_id, kind: crop|fertilizer|irrigation|yield, payload jsonb, created_at)
- `disease_scans` (id, user_id, field_id, image_url, disease, confidence, recommendation, created_at)
- `government_schemes` (id, title, description, benefits, eligibility, documents, official_url, apply_url, category, image_url) — seeded with ~10 real Indian schemes (PM-KISAN, PMFBY, KCC, PMKSY, Soil Health Card, etc.)
- `market_prices` (id, crop, market, price_per_quintal, recorded_on) — seeded with sample recent prices
- `notifications` (id, user_id, kind, title, body, read, created_at)

RLS: user-owned tables scoped to `auth.uid()`. Schemes + market_prices readable by `anon` + `authenticated`.

## Server functions (createServerFn, `src/lib/*.functions.ts`)

- `getWeather({lat,lng})` → Open-Meteo passthrough with derived advisory
- `recommendCrop({fieldId, soil, water})` → gathers weather+area, calls Lovable AI, saves to recommendations
- `recommendFertilizer` / `recommendIrrigation` / `predictYield` → same pattern
- `detectDisease({imageUrl})` → multimodal call to google/gemini-3.6-flash with the uploaded leaf image, returns {disease, confidence, recommendation}, saves scan
- `listMarketPrices` / `listSchemes` / `listNotifications`

## Routes

Public: `/`, `/onboarding`, `/auth` (login+register tabs), `/schemes`, `/schemes/$id`
Authenticated (`_authenticated/`): `/home`, `/fields`, `/fields/new`, `/fields/$id`, `/advisor` (hub for crop/fertilizer/irrigation/yield), `/disease`, `/weather`, `/market`, `/notifications`, `/profile`. Bottom nav on all authenticated pages.

## Design

Mobile-first, max-w-md main column with phone-like feel on desktop. Poppins, rounded-2xl cards, soft green gradients, Material 3 feel, dark mode toggle wired to `.dark` class, subtle animations on cards and nav.

## Out of scope for v1 (call out to user)

- Separate admin dashboard, Flutter app, standalone Node/Python services, MongoDB, Cloudinary, push notifications (in-app only)
- Government scheme list is seeded (not scraped live); can wire an official feed later if one exists
- Market prices are seeded sample data; can integrate a real Agmarknet feed later

## Build order

1. Enable Lovable Cloud, provision LOVABLE_API_KEY, configure Google auth
2. Theme + Poppins + design tokens + bottom nav shell
3. Auth (login/register) + profile row auto-create trigger
4. Migrations + seed data (schemes, market_prices)
5. Fields + Leaflet polygon drawing + Turf area
6. Weather server fn + weather screen + home dashboard
7. AI advisories (crop/fertilizer/irrigation/yield) via Lovable AI Gateway
8. Disease detection (Storage upload + multimodal AI call)
9. Market prices + schemes + notifications + profile
10. Head metadata per route, polish, dark mode
