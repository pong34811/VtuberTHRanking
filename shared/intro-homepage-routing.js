export const hasLegacyRankingQuery = search => {
  const params = new URLSearchParams(search);
  return ['affiliation', 'period', 'category', 'month', 'q', 'offset'].some(key => params.has(key));
};
