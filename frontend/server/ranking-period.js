// Ranking periods follow Bangkok time (UTC+7), including the first hours of a month.
export const currentMonth = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 7);
