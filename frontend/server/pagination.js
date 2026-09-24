export const pageInteger = (value, fallback, minimum, maximum = Number.MAX_SAFE_INTEGER) => {
  if (!/^\d+$/.test(value || '')) return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
};
