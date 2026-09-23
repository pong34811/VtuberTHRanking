# VTuber Thai Ranking — Home and Product Improvement Design

**Status:** Proposed for review
**Date:** 2026-09-23

## Objective

Make the public Home page explain the purpose of the site to first-time visitors while keeping rank checking fast for returning visitors. Improve the most visible usability problems found in the public pages and admin console. Then make ranking publication dependable and observable so the public ranking stays current without an operator having to remember a manual calculation step.

## Product assumptions

- Monthly ranking continues to mean ranking by accumulated channel totals at the snapshot used for that calendar ranking period. It does not mean the amount gained during that month.
- All-time ranking means accumulated channel totals from the latest available snapshot.
- This keeps the current product behavior and ranking formula. A change to monthly growth ranking would be a separate product decision and would need a formula and historical data review.
- YouTube is the current data source. The Home page must not imply other platforms are already included.

## Recommended design direction

Use an editorial discovery page for Thai VTubers, with a clear path from understanding the site to exploring a channel or checking a metric. Keep the existing neutral color tokens, light/dark theme support, typography, shared header, and component library. Add personality with stronger Thai headline hierarchy, a restrained channel-art accent, and clear ranked-data cards; keep motion decorative and respect reduced-motion settings.

The first screen should answer three questions: what the site ranks, what data the ranking uses, and where a visitor should go next.

## Home page structure

1. **Intro / hero**
   - Heading: “สำรวจอันดับ VTuber ไทย” (final copy can be refined during implementation).
   - One short explanation that the site helps visitors discover and compare Thai VTuber YouTube channels.
   - Primary action: jump to the ranking list.
   - Secondary action: search for a VTuber.
   - Keep Compare available in the global navigation and as a secondary page action.
2. **Dataset facts**
   - Show the number of channels, data source, and latest snapshot date from the existing summary API.
   - Label the date as the data snapshot date; do not imply the ranking was recalculated at that exact time unless the API confirms it.
3. **Ranking explainer**
   - Briefly explain the period controls and the three metrics: followers, views, and videos.
   - For monthly ranking, state that the score uses accumulated totals from that period's snapshot. Provide a concise “วิธีจัดอันดับ” disclosure that can be expanded without leaving Home.
   - For all-time ranking, state that it uses the latest accumulated totals.
4. **Interactive leaderboard**
   - Keep metric and period selection adjacent to the table and visibly mark the current selection.
   - Keep the ranking table as the main scan surface; retain rank, channel, metric value, and rank change.
   - Use localized Thai labels for category and affiliation.
   - Keep the current 50-row cap visible and provide a clear route to Search for the full directory.
5. **Discovery close**
   - End the page with a compact search/compare prompt rather than inventing an unsupported “trending” section.

## Shared public-page improvements

- Use one shared category/affiliation label mapper across Home, Search, and Profile so internal enum values do not appear in user-facing text.
- If a profile or comparison has too few history points to show a trend, show the available period and a plain explanation that history is still building.
- Let the main profile load independently when history fails; likewise, a summary failure on Home must not hide a successfully loaded leaderboard.
- Preserve current URL routes, public API contracts, keyboard focus styles, semantic headings/tables, skip navigation, and accessible names.

## Admin usability improvements

- In Rankings, default to one metric at a time (or tabs) instead of stacking three full tables. Explain whether a zero change means unchanged or has no prior comparison data.
- In History, show a readable action name and short summary first. Put raw JSON and identifiers in an expandable detail view with a copy action; allocate enough width to date and action columns.
- Keep existing admin actions and permissions. This design changes presentation and status messaging only.

## Next system: ranking refresh and publication pipeline

Current documented flow separates scheduled snapshot collection from manual ranking calculation. The next system should connect the two steps and expose each run's outcome.

- After a successful snapshot refresh, calculate the affected monthly and all-time ranking sets using the approved existing formula.
- Make each run idempotent so retrying after a partial failure does not duplicate or corrupt published rankings.
- Publish a complete ranking set atomically; public readers should see the previous complete set until the new set is ready.
- Record run start/end time, period, number of channels processed, and a concise success/failure reason for the admin console.
- Keep an operator-triggered recalculation path and make manual corrections auditable.
- Respect Cloudflare Worker execution and D1 batch limits. Confirm the current collection cap, retry behavior, and schema before implementation; do not assume a larger batch fits one invocation.
- Do not add email alerts, new ranking formulas, new social platforms, or public accounts in this phase.

## Responsive and interaction requirements

- At narrow widths, stack the intro actions and data facts cleanly; keep period and metric controls operable without horizontal page scrolling.
- Keep leaderboard values and rank-change meaning readable at 390px and 360px widths. Avoid removing channel identity solely to fit the table.
- Ensure buttons and touch targets meet the existing accessible sizing direction, focus is visible, and all controls work with keyboard input.
- Loading, empty, partial-data, and failure states must distinguish the leaderboard from summary/history data.

## Success criteria

- A first-time visitor can identify the site's purpose, source, ranking metrics, and next action from the initial Home view.
- A visitor can switch period and metric and understand what the displayed values represent.
- Internal category/affiliation codes no longer appear on public pages.
- Missing summary or history data does not unnecessarily hide otherwise usable rankings or profile information.
- Admin users can scan ranking results and audit events without reading raw JSON or scrolling through unrelated full tables.
- Scheduled ranking refresh produces either a complete new ranking set or a visible, actionable failure state; public users never see a partially published set.

## Out of scope

- Changing the monthly formula to month-over-month growth.
- Adding Twitch or other platform rankings.
- User accounts, favorites, voting, notifications, or news feeds.
- Replacing the existing visual design system or routing/API stack.
- Deploying changes to the public Cloudflare site as part of this design approval.

## Implementation sequence after design approval

1. Update Home and shared public labels/data states.
2. Refine Rankings and History admin scan surfaces.
3. Design and implement the ranking refresh/publication pipeline after checking current Worker, D1, and Cron constraints.
4. Verify the approved UI behavior and pipeline failure/retry cases before any deployment.
