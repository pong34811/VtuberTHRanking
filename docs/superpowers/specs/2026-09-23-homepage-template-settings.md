# VTuber Thai Ranking — Homepage Templates

**Status:** Proposed for review
**Date:** 2026-09-23

> Superseded by the approved discovery Home and dedicated Stats design in [2026-09-24-discovery-home-and-stats-design.md](2026-09-24-discovery-home-and-stats-design.md). This September 23 document is retained as a historical proposal.

## Objective

Let a manager choose a curated Homepage layout, inspect it with current public ranking data, and publish it without changing ranking data or calculation rules. Make the site's purpose clear to new visitors while letting returning visitors reach the ranking table quickly.

## Product principles

- Homepage templates change the order and emphasis of existing content only. They do not change ranking values, metric definitions, data sources, routes, or permissions for other admin actions.
- Every template keeps the same trust and navigation essentials: current channel count, YouTube as the source, latest snapshot date, period and metric controls, the leaderboard, ranking methodology, and links to search, compare, or profiles.
- Do not imply that unsupported features such as live activity, popularity trends, favorites, or non-YouTube data exist.
- A preview is a draft. It does not affect the public Homepage until a manager saves it.

## Homepage templates

Expose three curated templates, selected by stable IDs. The existing ranking-focused design is the initial default.

| ID | Admin name | Content order and emphasis |
| --- | --- | --- |
| `ranking-first` | อันดับเด่น | Existing order: hero and actions, dataset summary, ranking-method disclosure, leaderboard and filters, discovery/search/compare close. |
| `discovery-first` | ค้นพบ VTuber | Hero emphasizes search and comparison; dataset summary; discovery/search/compare prompt; leaderboard and filters; ranking-method disclosure. |
| `compact-ranking` | อันดับแบบกระชับ | Compact hero and dataset summary; leaderboard and filters near the top; ranking-method disclosure; discovery/search/compare close. |

All three use the existing public content and components where possible. Each layout must adapt to mobile widths and retain semantic headings, accessible controls, and the same current ranking data. The compact version reduces introductory space; it does not remove methodology or source information.

## Admin experience

- Add a manager-only **หน้าแรก** tab at `/admin/homepage`, separate from general system settings. Staff do not see the tab and are redirected using the existing manager-only route pattern.
- Show the three templates as selectable cards with a short description and compact visual thumbnail. Clearly mark the currently published template.
- Selecting a card changes only the draft preview. Render the selected layout with the current summary and ranking data, and label it **ตัวอย่าง — ยังไม่เผยแพร่**. Do not navigate away from Admin from links shown inside the preview.
- Provide a **บันทึกเป็นหน้าแรก** action. It saves the selected template, updates the published marker, and reports success. While saving, prevent duplicate submissions. If saving fails, keep the draft selected, show the error, and do not report success.
- On load failure, explain that template settings could not be loaded and provide a retry action. A failed preview data request should use the same loading/error treatment as the public Home data it reuses.
- If the draft is already the published selection, disable the save action or clearly indicate there are no changes.
- Protect both the route and its API with a manager-role check. Keep the existing session and CSRF behavior.

## Persistence and public behavior

- Store one `homepage_template` key in the existing key/value `settings` table. No schema migration is required.
- Add manager-protected `GET` and `PUT /settings/homepage-template` routes under the existing Admin API group for reading and saving this one setting. Use a `homepage_template` field in the JSON response and request. Accept only the three registered template IDs; reject unknown values without changing the published setting. Record successful changes in the existing audit log.
- Add the normalized active template ID to the public `/summary/` response. This is presentation configuration, not private admin data.
- If the setting is absent or contains an unrecognized value, return `ranking-first`. The public Home also falls back to `ranking-first` if the field is missing, so older data and cached/error responses continue to render.
- After a successful save, the public Homepage uses the new template on its next load. Selecting or previewing without saving has no public effect.

## Acceptance criteria

1. A manager can open `/admin/homepage`, see the active template, select each preset, and preview it with current public data.
2. A draft preview is clearly distinguished from the published state. Leaving the tab without saving does not change the public Homepage.
3. Saving a different preset persists the selection, creates an audit entry, and causes the public Homepage to render that preset on its next load.
4. Staff cannot use either the Admin route or the Admin settings API to read or change the homepage template.
5. Unknown or missing template values safely resolve to `ranking-first`; unknown values sent by an Admin request are rejected.
6. The three public layouts retain the shared data, methodology, ranking controls, and discovery links and remain usable on mobile and by keyboard.
7. Existing ranking calculations, API ranking results, and other Admin settings remain unchanged.

## Verification

- Unit tests cover the template registry, layout selection, missing/invalid public value fallback, and invalid Admin template rejection.
- Admin API tests cover manager authorization, persistence, and audit behavior.
- Component tests cover each layout's shared content, preview draft labeling, save states, and error states.
- Cypress E2E covers the manager flow from selecting and previewing a preset through saving and seeing it on the public Home. It also confirms that staff cannot open or call the template settings resource.
- Run the existing automated and E2E suites as part of verification, preserving the current uncommitted test work in the workspace.

## Out of scope

- A free-form page builder, custom section ordering, per-section visibility controls, or user-authored templates.
- Changes to ranking math, period definitions, snapshot data, or available metrics.
- New content feeds or data fields that the current product does not provide.
- Changes to site-wide navigation, authentication, or unrelated Admin settings.
