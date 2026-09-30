// Ranking periods follow Bangkok time (UTC+7), including the first hours of a month.
export const currentMonth = (timestamp = Date.now()) => new Date(timestamp + 7 * 3600000).toISOString().slice(0, 7);
