# Minimal UI and theme implementation

User approved minimal ranking layout, four-page redesign, dark/light/system themes and Cloudflare deployment.

- [x] Theme: shared CSS variables, initial pre-paint preference, saved setting and OS change listener.
- [x] Shared UI: responsive navigation, compact ranking rows, avatar fallback, accessible selection and loading states.
- [x] Pages: ranking filters and metadata, request race protection, user-visible failures, bounded compare selection, date-aligned graph data.
- [x] Verify production build and browser rendering at desktop/mobile widths; exercise navigation, theme persistence, search and compare.
- [x] Deploy existing Cloudflare Pages project with D1 binding and verify live API and routes.

Preserve existing backend migration changes. No database mutations or migrations. Missing data uses empty states.

## Verification and delivery

Production build passed with Node 24.19.0 (existing Node 16 is incompatible with Vite 8). Browser checks passed: desktop dark theme, 375px mobile light theme, preference persistence after reload, search, profile charts and two-channel comparison. No browser console errors observed. Build retains a large-bundle advisory (693 KB uncompressed).

Deployed to existing Cloudflare Pages + Functions project, with existing D1 binding. Production: https://vtuberthai-ranking.pages.dev ; deployment: https://0ba84734.vtuberthai-ranking.pages.dev . All four routes and summary/ranking API endpoints returned HTTP 200 after deployment. Existing data contains VTuber A/B/C; data ingestion was not changed.
