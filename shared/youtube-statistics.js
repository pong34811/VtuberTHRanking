// Keep worker collection and Admin import on the same counter validation rules.
export function readYouTubeStatistics(stats) {
  if (stats == null) return { ok: false, reason: 'YouTube returned no channel statistics' };
  if (typeof stats !== 'object' || Array.isArray(stats)) {
    return { ok: false, reason: 'YouTube returned invalid statistics' };
  }
  if (stats.hiddenSubscriberCount !== undefined && typeof stats.hiddenSubscriberCount !== 'boolean') {
    return { ok: false, reason: 'YouTube returned invalid statistics' };
  }
  if (stats.hiddenSubscriberCount === true) {
    return { ok: false, reason: 'YouTube subscriber count is hidden' };
  }
  const raw = [stats.subscriberCount, stats.viewCount, stats.videoCount];
  if (raw.some(value => value == null)) {
    return { ok: false, reason: 'YouTube returned incomplete statistics' };
  }
  if (!raw.every(value => typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value)))) {
    return { ok: false, reason: 'YouTube returned invalid statistics' };
  }
  const values = raw.map(Number);
  if (!values.every(value => Number.isSafeInteger(value) && value >= 0)) {
    return { ok: false, reason: 'YouTube returned invalid statistics' };
  }
  return { ok: true, followers: values[0], total_views: values[1], video_count: values[2] };
}
