# VTuber Thai Ranking — Contact-sheet Homepage

**Date:** 2026-09-24
**Status:** Implemented and accepted by the finish review; deployment status is tracked separately.
**Scope:** The public discovery homepage and its existing Admin draft preview.

## Overview

The user selected `contact-sheet` with the `code` build path in [the recorded decision](../../../.impeccable/questions/086abb39.answer.json). This choice supersedes the provisional fan-zine cover composition. The selected direction was implemented from code; the decision's `comp` field is a choice reference, not evidence of a generated visual comp.

This brief records a page composition within the existing VTuber Thai Ranking identity. It supplements the approved [discovery homepage and stats design](2026-09-24-discovery-home-and-stats-design.md) and the [surface contract](../../../.impeccable/build/spec.json). Their data, route, publishing, and permission requirements continue to apply. The contact sheet is a homepage decision and does not establish a replacement global identity.

Real creator portraits are the main browsing content. A compact Thai heading, search, directory count, and statistics link support visitors who arrive with a particular creator in mind. The surrounding presentation uses thin rules and compact captions so the portraits remain prominent.

## Colors

The page inherits the existing theme's text, background, card, and border colors. Purple marks links, search actions, and focus: the light-theme accent is `#6e53d5`, with `#5d43bd` for filled actions; the dark-theme equivalents are `#c0adff` and `#7459d1`. Small category dots distinguish the existing categories. Warm separators in creator metadata are secondary details. These values are scoped to the discovery surface.

## Typography

The page uses `Noto Sans Thai` with a sans-serif fallback. The main heading is compact and bold (`clamp(1.8rem, 3.8cqi, 2.75rem)`, weight 800); section titles are smaller (`clamp(1.05rem, 2cqi, 1.22rem)`). Creator names use a compact caption size (`0.92rem`, weight 750), with smaller category and affiliation text (`0.79rem`). At phone widths the heading and metadata reduce further, while search input text remains `1rem`.

Full creator names wrap, including unusually long names. Captions do not truncate identity information to keep all cards the same height.

Agency-affiliated creators show `สังกัด` followed by the stored agency name in their caption and accessible link label. Blank or missing agency names retain the generic affiliation label; independent creators continue to show `อิสระ`. Long agency names wrap within the card.

## Layout

The default `search-first` desktop view uses a narrow left index (`172px`) for categories and affiliations. The main area contains the heading and search above a gallery of four equal columns. Images are square, cropped with `object-fit: cover`; gallery spacing is `26px` vertically and `16px` horizontally. The index and gallery use available width without forcing the page wider.

Responsive behavior follows the discovery container's width so it works inside the Admin preview as well as the public page:

| Container width | Index and controls | Gallery |
| --- | --- | --- |
| Above `860px` | Left index beside the heading and content | Four columns in search-first and newest-first; three per category group |
| `561px`–`860px` | Header, then an independently scrollable horizontal filter strip, then content | Three columns |
| Up to `560px` | Stacked heading and search; count and statistics link below search; horizontal filters | Two columns with `20px` row gaps and `12px` column gaps |

The three existing content modes retain their meaning. `search-first` provides search plus category and affiliation navigation. `category-first` retains grouped samples of up to three creators and category links. `newest-first` uses the full content width without the left index, keeps its directory-added date explanation, and shows valid added dates on cards.

## Elevation & Depth

Gallery entries rest flat on the page. Thin borders, spacing, and the portraits provide structure. Search receives a restrained focus ring. Portrait hover enlarges the image within its clipped square, so the entry keeps its place in the grid.

## Shapes

Square portraits have minimal rounding (`4px`). Search has a slightly softer outline (`6px`). The portrait arrow uses a circular overlay, and missing avatars use a circular initial inside the same square portrait area. Existing empty and error containers retain their larger rounding; they are recovery states rather than gallery entries.

## Components

- **Portrait-to-profile:** The whole entry links to its existing creator profile. Pointer hover scales its image to `1.035` and reveals an arrow; keyboard focus reveals the arrow and a visible accent outline. Touch devices keep the arrow visible. Reduced motion disables transitions, and the page has no entrance animation.
- **Search and index:** Search submits to `/search` with `q`. Categories and affiliations open `/search` with the corresponding existing filter. Directory counts describe active profile records. `/stats` remains directly accessible.
- **Data and modes:** Creator names, avatars, categories, affiliations, directory totals, and directory-added dates come from existing directory data. Ranking metrics remain on `/stats`; no featured selection or new recommendation claim is introduced. Existing routes, APIs, theme selection, and homepage template IDs remain in use.
- **Admin preview:** The same page composition responds to the preview container. Existing link containment and search containment prevent preview interactions from navigating away. Template selection, publishing, permissions, and persistence keep their established behavior.
- **Recovery and access:** Loading uses square skeletons with a status announcement. Directory errors provide retry, empty states link to search, and absent or failed images show initials. Semantic headings, accessible search labels, keyboard focus, and light and dark themes remain part of the surface contract.

## Do's and Don'ts

- **Do** keep creator images and complete names central to browsing.
- **Do** keep the filter strip's horizontal scrolling inside its container.
- **Do** preserve the distinct search, category, and directory-newest modes when adjusting the presentation.
- **Don't** interpret directory-added dates as debut dates, or introduce live-status, performance, or recommendation claims into gallery captions.
- **Don't** promote this homepage's index, grid, or local accent choices into rules for every product surface.

The completion handoff reports 41 targeted homepage, Admin, and template tests passing, along with the production build. Browser checks found no horizontal page overflow at viewport widths of `1440px`, `791px`, and `390px`, and a public search for Amelie returned a matching result. The finish reviewer accepted the desktop, mobile, and user captures in `.impeccable/review/contact-sheet-{desktop,mobile,user}.png` with no material fixes required. These are implementation and review results; they do not establish that a new deployment has completed.

Source evidence: `frontend/src/pages/discovery/DiscoveryHome.jsx`, `CreatorCard.jsx`, and `discovery.css`. No global design document or design sidecar update is required for this page-specific decision.
