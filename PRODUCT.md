# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Public visitors see the Thai VTuber ranking on `/` and `/home`, with menus for all, independent, and agency channels. Visitors can browse creator portraits on `/discover` or search by name and category. Managers and staff maintain channel records and settings in the existing admin area.

## Product Purpose

VTuber Thai Ranking maintains a searchable directory of Thai VTuber channels alongside periodic YouTube statistics and rankings. Success means visitors can find a creator, open an accurate profile, and reach the public statistics when they want them.

## Positioning

The product combines rankings from recorded YouTube statistics with a Thai VTuber directory. Directory discovery is based on creator metadata; ranking filters use the existing published ranks.

## Operating Context

The public web experience includes ranking pages at `/`, `/home`, and `/stats`, the discovery gallery at `/discover`, searchable directory, and creator profiles. Managers and staff maintain records through the existing admin area. Statistics are collected periodically and are not real-time.

## Capabilities and Constraints

- Creator records provide names, profile slugs, avatars, content categories, affiliations, and directory-added dates where available.
- Directory search and category or affiliation filters use existing profile metadata.
- Public performance rankings and their methodology are available on `/`, `/home`, and `/stats`; the `/home` menu filters by affiliation and numbers ranks within each group while retaining the overall rank as secondary context.
- Preserve existing routes, profile links, search behavior, homepage template publishing, admin permissions, and data APIs.
- Do not fabricate live status, debut dates, recommendations, social proof, or performance claims. “Recently added” refers only to the directory-added date.
- This homepage redesign does not change data providers, collection schedules, ranking formulas, or database schemas.

## Brand Commitments

The product name is VTuber Thai Ranking. Existing user-facing copy is primarily in Thai.

## Evidence on Hand

- Existing creator records and real profile avatars from the directory API.
- Product requirements and approved homepage behavior in `docs/superpowers/specs/2026-09-24-discovery-home-and-stats-design.md`.
- Public routes and current workflows in `docs/PRD.md`.
- No verified testimonials, live-status feed, editorial recommendation source, or debut-date source is part of this homepage request.

## Product Principles

- Use real creator records and metadata as the basis for discovery.
- Keep ranking metrics separate from the curated discovery gallery.
- Make search, category navigation, and creator profiles easy to reach.
- Preserve clear recovery and accessible keyboard interaction states.

## Accessibility & Inclusion

The public directory must work with keyboard navigation, visible focus, semantic headings, accessible search labels, responsive layouts, and avatar fallbacks.
