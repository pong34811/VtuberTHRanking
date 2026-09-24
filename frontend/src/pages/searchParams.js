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
  const query = params.toString();
  return `/search${query ? `?${query}` : ""}`;
}
