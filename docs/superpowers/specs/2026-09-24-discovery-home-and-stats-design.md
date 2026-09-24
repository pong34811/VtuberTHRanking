# VTuber Thai Ranking — Discovery Homepage and Stats Page

**Status:** Proposed for review
**Date:** 2026-09-24

## Objective

Turn the public homepage into a directory for discovering Thai VTubers, with three genuinely different layouts that a manager can choose in the existing Admin page. Move the existing ranking table and its controls to `/stats`. Keep ranking data, formulas, snapshot collection, and Admin permissions as they are.

## Product principles

- The homepage helps visitors find creators using profile metadata already stored in D1: name, avatar, content category, affiliation, and directory-added date.
- Homepage curation must not depend on follower counts, view counts, rank, rank changes, or other performance metrics.
- “มาใหม่” means recently added to this directory, based on `vtubers.created_at`; it does not mean recently debuted.
- Keep creator names, avatars, categories, and affiliations sourced from profile records. Do not invent activity, recommendations, counts, or social proof.
- Ranking information remains available on `/stats`, with its existing metric definitions and data source disclosure.
- Preserve the existing manager-only template selector, draft preview, save flow, setting persistence, and audit behavior.
- No new data provider or ongoing paid service is part of this change.

## Public information architecture

| Route | Purpose |
| --- | --- |
| `/` | Discover VTubers through the published directory template. |
| `/stats` | Existing ranking summary, period and metric controls, leaderboard, and methodology. |
| `/search` | Full searchable directory with existing filters. Homepage search and category links may prefill filters through query parameters. |
| `/profile/:slug` | Existing creator profile. |
| `/compare` | Existing channel comparison. |
| `/admin/homepage` | Existing manager-only template selection, preview, and publishing. |

Add a visible navigation link to `/stats`. The table and its period/category controls move from `/` to `/stats`; ranking values and API semantics remain the same. The ranking summary and methodology stay with the stats experience so the source and meaning of metrics are visible beside the table.

## Homepage visual direction

Use a directory and fanzine-inspired presentation for Thai VTuber discovery: compact editorial headings, expressive but restrained category accents, real creator avatars, and immediately usable search or category navigation. Keep the first screen focused on finding a creator. Do not use an oversized abstract hero or large decorative art in place of creator content.

All templates share the same visual language, navigation, creator-card behavior, profile links, and accessible interaction states. They differ in the main discovery task and ordering of directory content, not merely by reordering the current ranking sections.

## Homepage templates

Use stable IDs `search-first`, `category-first`, and `newest-first`. The published selection remains stored in the existing `settings.homepage_template` row; no schema migration is needed. The initial/default template is `search-first`.

| ID | Admin name | Main experience |
| --- | --- | --- |
| `search-first` | ค้นหาก่อน | Put a labeled creator search control first, followed by category/affiliation shortcuts and a compact set of creator cards. Submitting search opens `/search` with the entered query. |
| `category-first` | เลือกหมวดหมู่ | Lead with content-category tiles or groups, with counts derived only from active profile records. Follow with a small, alphabetically ordered sample of creator cards grouped by category. Selecting a category opens `/search` with that category preselected. |
| `newest-first` | เพิ่มเข้ารายการล่าสุด | Lead with creator cards ordered by `created_at` descending, with a stable tie-breaker. Label the section “เพิ่มเข้ารายการล่าสุด” and show a directory-added date where available. Never label these creators as debuting or live. |

Category shortcuts use the categories already supported by profile records: gaming, singing, chatting, art, ASMR, education, and other. Affiliation shortcuts may use indie and agency. Category counts are grouped over all active profile records, independent of pagination, and labeled as directory counts. Do not infer these counts from the current page of results.

For missing avatars, show the existing initial-based fallback. If a profile lacks a usable `created_at`, do not fabricate a date; keep its ordering deterministic and omit the date label. If a template has no matching creators, show a useful empty state linking to the full search page.

## Data flow and API boundaries

### Homepage configuration

Add a public `GET /homepage-config/` resource that returns only the normalized published template ID, for example `{ "template": "search-first" }`. It must not return ranking metrics, admin data, or the full settings table. Missing or unrecognized stored values resolve to `search-first`.

Remove `homepage_template` from the public `/summary/` response. `/summary/` remains dedicated to the stats page and its current aggregate ranking context. The homepage loads template configuration independently from directory data. If configuration cannot be loaded, render `search-first` and keep the directory usable.

### Directory metadata

Add a public `GET /directory/` resource for active creator profile metadata. It supports bounded pagination and the metadata filters needed by homepage layouts: text query, category, affiliation, and sort by `name` or `created_at_desc`. The response includes total count and records with only directory fields, such as `id`, `name`, `slug`, `avatar`, `category`, `affiliation`, and `created_at`. Return category facet counts across all active profile records, independent of the selected result page.

The endpoint must not select or return `stats_snapshots`, follower counts, ranking rows, scores, or rank changes. Use deterministic ordering for ties. The newest layout orders by `created_at DESC` and then stable profile fields/ID. Existing `/vtubers/` behavior remains available to search and other current consumers.

Homepage search and category links pass their chosen `q` or `category` as query parameters to `/search`. The Search page initializes its existing controls from valid query parameters and continues using its existing API behavior, including follower filters and sorting when the visitor chooses them.

### Stats page

`/stats` uses the existing `/summary/` and `/rankings/` resources for the current table, filters, update date, source disclosure, and methodology. Remove the homepage template field from `/summary/`; do not change ranking response fields, metric choices, calculations, retention, snapshots, or the updater Worker as part of this design.

## Admin template selection

Keep the current manager-only `/admin/homepage` page and `GET`/`PUT /settings/homepage-template` API. Update the selector labels, descriptions, visual previews, and draft preview to reflect the three directory layouts. The preview uses the same metadata-only directory resource as the public homepage. Selecting a template remains a draft until saved. Preserve manager authorization, CSRF handling, audit logging, save/error states, and the existing settings table.

When reading an existing setting with one of the legacy IDs (`ranking-first`, `discovery-first`, or `compact-ranking`), normalize it to `search-first` so the public page and Admin page render safely without a database migration. Admin writes accept only the new IDs. The manager can publish a new selection through the existing save flow.

## Loading, error, and accessibility behavior

- Load configuration and directory metadata independently. A configuration failure falls back to `search-first`; a directory failure shows an inline error with a retry action.
- Keep a clear loading state for creator cards and category counts. Do not display stale metric values as directory content.
- Provide an empty state for an empty directory or a category with no active creators, with a route to `/search`.
- Search fields, category controls, navigation, cards, and retry actions must have accessible names and work by keyboard. Preserve visible focus, semantic headings, and sufficient contrast.
- Layouts must work from narrow mobile screens through desktop. Keep meaningful creator content and a discovery action visible early on mobile.
- Handle failed avatar images using the existing fallback behavior.

## Acceptance criteria

1. `/` renders the published discovery template and falls back to `search-first` if the public configuration is missing or invalid.
2. The three templates provide distinct search-first, category-first, and directory-newest experiences with shared creator-card and navigation behavior.
3. Homepage cards and category choices are sourced from active creator metadata. Ranking and performance metrics do not affect homepage ordering, category counts, or selection.
4. The newest layout is ordered by `created_at` and accurately describes records as newly added to the directory, never as recent debuts.
5. `/stats` contains the existing ranking table, selectors, methodology, source, and update context; its ranking results and definitions are unchanged.
6. Homepage search and category shortcuts open `/search` with their corresponding valid filters preselected.
7. A manager can preview a draft template and publish it using the existing Admin flow. Staff access, audit behavior, CSRF, and save/error behavior remain unchanged.
8. Legacy stored template IDs and missing settings resolve to `search-first`; no database migration is required.
9. Directory API responses contain no ranking or snapshot metrics. The existing `/vtubers/` API remains compatible with its current consumers.
10. Loading, retry, empty, missing-avatar, keyboard, and responsive states are defined for the public directory and Admin preview.

## Out of scope

- Changing YouTube API collection, adding another platform/provider, changing Worker schedules, or changing ranking formulas, snapshots, or retention.
- Changing the current public availability of rankings or deciding whether the existing ranking data has separate provider-policy implications.
- User accounts, personalization, favorites, recommendations, feeds, notifications, or manual editorial curation.
- A custom page builder or arbitrary section ordering.
- Replacing the existing search, profile, compare, or Admin architecture beyond the query-prefill and template-preview adaptations described above.
