# VTuber Admin Usability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let administrators scan ranking results and audit events without navigating three long tables or parsing raw JSON.

**Architecture:** Keep the existing admin routes and permissions. Show one metric table at a time in Rankings, use explicit Thai labels for rank-change states, and present readable audit summaries with raw details available on demand.

**Tech Stack:** React 19, existing admin API and UI components, CSS in `frontend/src/admin/admin.css`, Hono/Cloudflare Pages API.

**Spec:** `docs/superpowers/specs/2026-09-23-vtuber-ranking-product-design.md`

## Global Constraints

- “Keep existing admin actions and permissions. This design changes presentation and status messaging only.”
- “Keep the existing visual design system, routing/API stack, keyboard focus styles, and semantic controls.”
- “A zero rank change means the rank is unchanged; a missing prior rank is displayed separately.”
- “Keep raw JSON available in an expandable detail view.”

## Review Focus

- No ranking rows for the selected metric: show a metric-specific empty state.
- `rank_change` is `null`, `0`, positive, negative, or a legacy value: render a truthful Thai state without throwing.
- Audit `details` is already an object, valid JSON text, invalid JSON text, or empty: render a readable summary and preserve available raw content.
- Clipboard access is unavailable or denied: keep the audit details readable and do not fail the page.
- Narrow admin viewport: keep metric controls, timestamps, and audit disclosure usable without page-wide overflow.

---

### Task 1: Replace stacked ranking tables with metric tabs

**Files:**
- Modify: `frontend/src/admin/RankingsTab.jsx`
- Modify: `frontend/src/admin/admin.css`

**Interfaces:**
- Consumes: existing `GET /rankings` and `POST /rankings/calculate` endpoints; `rank_change` is nullable after the Public UX plan's helper change.
- Produces: one visible ranking table selected from followers, views, or videos.

- [ ] Group the selected metric controls with explicit current-state semantics:

```jsx
<div role="group" aria-label="ตัวชี้วัด">
  {metrics.map((metric) => (
    <button key={metric.value} type="button"
      aria-pressed={filters.category === metric.value}
      onClick={() => setFilters({ ...filters, category: metric.value })}>
      {metric.label}
    </button>
  ))}
</div>
```

- [ ] Default `filters.category` to `followers` and replace the “ทั้งหมด” option with three buttons in an accessible `role="group"` labeled “ตัวชี้วัด”.
- [ ] Fetch only the selected metric and render only its table; keep period and month filters unchanged.
- [ ] Render `null` change as “ไม่มีอันดับก่อนหน้า”, zero as “ไม่เปลี่ยน”, positive as `ขึ้น N`, and negative as `ลง N`.
- [ ] Keep manager-only recalculation and `useSubmit` feedback unchanged.
- [ ] Add responsive active/hover/focus states using existing CSS variables and target sizes.

### Task 2: Make audit history readable and expandable

**Files:**
- Modify: `frontend/src/admin/tabs/AuditTab.jsx`
- Modify: `frontend/src/admin/admin.css`

**Interfaces:**
- Consumes: existing `/audit-logs` rows (`action`, `target_type`, `target_id`, `details`, `created_at`, user name).
- Produces: a short Thai action label, a readable target/summary, and an expandable raw detail block.

- [ ] Parse `details` without letting malformed JSON break the table:

```js
function parseDetails(value) {
  if (value && typeof value === "object") return value;
  try { return JSON.parse(value || "{}"); }
  catch { return { raw: String(value || "") }; }
}
```

- [ ] Add local display maps for known action and target names; fall back to the raw value for unknown future values.
- [ ] Safely parse string `details`; show a compact summary for known fields and pretty JSON in `<details><summary>ดูรายละเอียด</summary>`.
- [ ] Add a “คัดลอกรายละเอียด” action that reports success only when Clipboard API succeeds; retain visible text when clipboard is unavailable.
- [ ] Replace the cramped target and detail columns with table classes that keep date/action readable and allow long identifiers to wrap inside details.
- [ ] Preserve audit permissions and the existing empty, loading, and error states.

## Completion review

- [ ] Confirm every admin route still uses its existing guard and no write action fires during page load.
- [ ] Inspect the five review-focus cases in final component branches and CSS.
- [ ] Compare the new table and details layout with the existing 900px mobile breakpoint.
