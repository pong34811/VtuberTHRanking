# VTuber Public Discovery Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Home explain the Thai VTuber ranking product and make public channel labels, history states, and rank changes clear.

**Architecture:** Keep React routes and API contracts stable except for making missing rank history distinct from an unchanged rank. Put Thai labels in one shared frontend helper, keep Home summary and ranking requests independent, and share trend-data states between profile and comparison pages.

**Tech Stack:** React 19, React Router 7, Vite, Tailwind CSS 4, existing Hono/Cloudflare Pages API, Recharts.

**Spec:** `docs/superpowers/specs/2026-09-23-vtuber-ranking-product-design.md`

## Global Constraints

- “Monthly ranking continues to mean ranking by accumulated channel totals at the snapshot used for that calendar ranking period. It does not mean the amount gained during that month.”
- “YouTube is the current data source. The Home page must not imply other platforms are already included.”
- “Keep the existing neutral color tokens, light/dark theme support, typography, shared header, and component library.”
- “Preserve current URL routes, public API contracts, keyboard focus styles, semantic headings/tables, skip navigation, and accessible names.”
- “At narrow widths, stack the intro actions and data facts cleanly; keep period and metric controls operable without horizontal page scrolling.”
- “Do not add a trending section that the current API cannot support.”

## Review Focus

- Summary request fails while rankings load: keep the leaderboard usable and label summary values unavailable.
- Ranking request fails while summary loads: show a ranking retry state without erasing the site facts.
- Unknown category or affiliation values: show a safe Thai fallback instead of an internal enum.
- Profile history has zero or one point: retain profile data and explain the available history coverage.
- Missing prior rank versus unchanged rank: expose distinct values to public and admin interfaces.

---

### Task 1: Centralize public channel labels

**Files:**
- Create: `frontend/src/components/channelLabels.js`
- Modify: `frontend/src/components/VTuberCard.jsx`
- Modify: `frontend/src/components/LeaderboardTable.jsx`
- Modify: `frontend/src/pages/SearchPage.jsx`
- Modify: `frontend/src/pages/ProfilePage.jsx`

**Interfaces:**
- Produces: `categoryLabel(value)` and `affiliationLabel(value)`, each returning a Thai display string for known enum values and a safe Thai fallback for unknown values.

- [ ] Create the mapping helper with this display contract:

```js
const categories = {
  gaming: "เกม", singing: "ร้องเพลง", chatting: "พูดคุย", art: "วาดรูป",
  asmr: "ASMR", education: "ความรู้", other: "อื่นๆ",
};
const affiliations = { indie: "อิสระ", agency: "สังกัด" };
export const categoryLabel = (value) => categories[value] ?? "อื่นๆ";
export const affiliationLabel = (value) => affiliations[value] ?? "ไม่ระบุสังกัด";
```

- [ ] Replace user-facing raw enum values in cards, leaderboard rows, profile chips, and Search filters with the shared labels.
- [ ] Preserve raw enum values as `<option value>` so API filters continue to use the existing values.

### Task 2: Rebuild Home around discovery and ranking clarity

**Files:**
- Modify: `frontend/src/pages/HomePage.jsx`
- Modify: `frontend/src/pages/home.css`
- Modify: `frontend/src/components/LeaderboardTable.jsx`

**Interfaces:**
- Consumes: existing `rankingsAPI.getList({ period, category, limit })` and `summaryAPI.get()` responses.
- Produces: a first screen with site purpose, Search and leaderboard actions, data-source/count/snapshot facts, period explanation, and a single scannable leaderboard.

- [ ] Use this hierarchy in the existing page landmarks:

```jsx
<section className="home-hero" aria-labelledby="home-title">
  <p className="home-kicker">สำรวจช่องครีเอเตอร์เสมือนจริงของไทย</p>
  <h1 id="home-title">สำรวจอันดับ VTuber ไทย</h1>
  <p>ค้นหา VTuber ไทยและติดตามยอดผู้ติดตาม ยอดวิว และจำนวนคลิปจาก YouTube</p>
  <a href="#rankings">ดูอันดับ</a>
  <Link to="/search">ค้นหา VTuber</Link>
</section>
```

- [ ] Keep request state independent: the ranking effect owns `rankings`, `loading`, and `error`; the summary effect owns `summary` and `summaryError`:

```js
useEffect(() => {
  let active = true;
  setLoading(true);
  rankingsAPI.getList({ period, category, limit: 50 })
    .then((response) => { if (active) setRankings(response.data.results); })
    .catch(() => { if (active) setError("โหลดอันดับไม่สำเร็จ กรุณาลองอีกครั้ง"); })
    .finally(() => { if (active) setLoading(false); });
  return () => { active = false; };
}, [period, category, retry]);
```

- [ ] Replace the generic heading with the approved discovery headline and concise Thai description; link the primary action to `#rankings` and the second action to `/search`.
- [ ] Add an expandable “วิธีจัดอันดับ” explanation for the three metrics and the monthly accumulated-snapshot meaning; describe all-time as latest accumulated totals.
- [ ] Display the summary date as the latest data snapshot date. Do not call it a ranking publication time.
- [ ] Split the rankings and summary fetch paths so either response can render when the other fails. Keep a retry control scoped to the failed section.
- [ ] Keep the period and metric selectors beside the table, announce the selected metric and row count, and retain the route to the full Search directory.
- [ ] Add the compact Search/Compare prompt after the leaderboard; do not add unsupported trending or voting data.
- [ ] Add responsive rules for 390px and 360px widths while preserving channel identity, table labels, theme tokens, and focus visibility.

### Task 3: Distinguish new rankings from unchanged rankings

**Files:**
- Modify: `frontend/server/admin-domain.js`
- Modify: `frontend/src/components/ChangeIndicator.jsx`
- Modify: `frontend/src/pages/HomePage.jsx`
- Modify: `frontend/src/admin/RankingsTab.jsx`

**Interfaces:**
- Produces: `competitionRanks(rows, category, previous)` returns `rank_change: null` when a channel has no previous rank and an integer (including `0`) when a previous rank exists.
- Consumes: nullable `rank_change` in the existing API payload and D1 column.

- [ ] Implement the missing-baseline distinction without changing rank order:

```js
rank_change: old.has(row.vtuber_id) ? old.get(row.vtuber_id) - rank : null
```

- [ ] Change the ranking helper so absence from the previous ranking produces `null`, while equal ranks produce `0`.
- [ ] Render `null` as “ใหม่” or “ไม่มีอันดับก่อนหน้า” with an accessible label; render `0` as “ไม่เปลี่ยน”; retain arrows for positive and negative changes.
- [ ] Replace the ambiguous Home endnote with a short legend matching those states.
- [ ] Keep existing stored rows valid; new semantics take effect as each ranking set is recalculated.

### Task 4: Make profile and comparison history states honest

**Files:**
- Modify: `frontend/src/pages/ProfilePage.jsx`
- Modify: `frontend/src/pages/ComparePage.jsx`
- Modify: `frontend/src/components/TrendChart.jsx`

**Interfaces:**
- Consumes: existing history arrays from `vtubersAPI.getHistory()` and `compareAPI.post()`.
- Produces: a trend chart only when at least two distinct dates exist; otherwise a concise coverage message that includes the number of available points.

- [ ] Gate the graph on distinct dates and provide a status message below that threshold:

```js
const pointCount = new Set((data ?? []).map((point) => point.date)).size;
if (pointCount < 2) {
  return <p role="status">มีข้อมูลย้อนหลัง {pointCount} จุด ยังแสดงแนวโน้มไม่ได้</p>;
}
```

- [ ] Load profile and history independently so a history error does not hide the profile; offer a separate history retry.
- [ ] Show “ยังไม่มีข้อมูลย้อนหลัง” for zero points and explain that one point cannot show a trend; retain the latest statistic on the profile card.
- [ ] In Compare, show a data-coverage message when fewer than two distinct dates are returned, even if a single chart point exists.
- [ ] Keep the six-month requested range visible and preserve current selection and metric controls.

## Completion review

- [ ] Inspect the final diff against every spec section and confirm routes/API parameters/theme tokens are preserved.
- [ ] Check the five review-focus cases by reading the final state and tracing each request/data branch; do not claim runtime verification unless it was explicitly requested and performed.
