import { DIRECTORY_AFFILIATIONS, DIRECTORY_CATEGORIES } from "../../../shared/directory.js";

export function readDirectorySearch(search) {
  const params = new URLSearchParams(search);
  const category = params.get("category") || "";
  const affiliation = params.get("affiliation") || "";

  return {
    q: (params.get("q") || "").trim(),
    category: DIRECTORY_CATEGORIES.includes(category) ? category : "",
    affiliation: DIRECTORY_AFFILIATIONS.includes(affiliation) ? affiliation : "",
  };
}

export function directorySearchHref(filters = {}) {
  const clean = readDirectorySearch(new URLSearchParams(filters).toString());
  const params = new URLSearchParams(
    Object.entries(clean).filter(([, value]) => value),
  );

  if (filters.view === "all") params.set("view", "all");
  if (Number.isSafeInteger(filters.offset) && filters.offset > 0) params.set("offset", String(filters.offset));
  const discoveryQuery = params.toString();
  return `/discover${discoveryQuery ? `?${discoveryQuery}` : ""}`;
}
