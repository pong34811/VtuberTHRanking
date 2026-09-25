# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Public visitors use the directory to discover Thai VTubers. The homepage should support visitors who prefer browsing creator portraits and visitors who arrive with a name or category in mind. Managers and staff maintain channel records and settings in the existing admin area.

## Product Purpose

VTuber Thai Ranking maintains a searchable directory of Thai VTuber channels alongside periodic YouTube statistics and rankings. Success means visitors can find a creator, open an accurate profile, and reach the public statistics when they want them.

## Positioning

The product combines a Thai VTuber directory with profile-level historical YouTube statistics. Directory discovery is based on creator metadata; ranking and performance data have their own statistics experience.

## Operating Context

The public web experience includes the homepage, searchable directory, creator profiles, and `/stats`. Managers and staff maintain records through the existing admin area. Statistics are collected periodically and are not real-time.

## Capabilities and Constraints

- Creator records provide names, profile slugs, avatars, content categories, affiliations, and directory-added dates where available.
- Directory search and category or affiliation filters use existing profile metadata.
- Public performance rankings and their methodology remain on `/stats`.
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
- Keep ranking metrics separate from homepage curation.
- Make search, category navigation, and creator profiles easy to reach.
- Preserve clear recovery and accessible keyboard interaction states.

## Accessibility & Inclusion

The public directory must work with keyboard navigation, visible focus, semantic headings, accessible search labels, responsive layouts, and avatar fallbacks.
