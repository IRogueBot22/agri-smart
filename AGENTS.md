# AgriSmart AI — Developer Guidelines

## Architecture Overview
- **Web App**: Built with TanStack Start (SSR), React 19, TypeScript, and Tailwind CSS.
- **Backend & Database**: Supabase (PostgreSQL, Auth, Realtime, Storage).
- **AI Engine**: Google Gemini Flash & OpenAI-compatible AI gateway for crop advisory, disease diagnosis, and weed detection.
- **Computer Vision Service**: Python FastAPI service running TensorFlow CNN models for leaf disease classification.
- **Mobile Apps**: Multi-platform client in Flutter (`flutter_app/`) and Capacitor bridge support (`MOBILE.md`).

## Development Principles
- Ensure all AI functions gracefully fall back when external services are unavailable.
- Always validate input schemas using Zod.
- Support offline-friendly operation where feasible and show clear connectivity feedback.
- Maintain responsive, accessible, and high-performance UI tailored for agricultural workflows.
