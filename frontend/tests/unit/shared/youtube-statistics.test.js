import { describe, expect, it } from 'vitest';
import { readYouTubeStatistics } from '../../../../shared/youtube-statistics.js';

const valid = { subscriberCount: '12300', viewCount: '456789', videoCount: '89' };

describe('shared YouTube statistics validation', () => {
  it.each([0, '0'])('accepts genuine zero counters (%j) without treating them as missing', zero => {
    expect(readYouTubeStatistics({ hiddenSubscriberCount: false, subscriberCount: zero, viewCount: zero, videoCount: zero }))
      .toEqual({ ok: true, followers: 0, total_views: 0, video_count: 0 });
  });

  it('preserves the public counters returned by YouTube without estimating extra digits', () => {
    expect(readYouTubeStatistics(valid)).toEqual({ ok: true, followers: 12300, total_views: 456789, video_count: 89 });
  });

  it.each([undefined, '12300'])('rejects hidden subscribers even when a counter is present (%j)', subscriberCount => {
    expect(readYouTubeStatistics({ ...valid, subscriberCount, hiddenSubscriberCount: true }))
      .toEqual({ ok: false, reason: 'YouTube subscriber count is hidden' });
  });

  it.each(['true', 'false', 0, 1, null, {}])('rejects a malformed hidden flag (%j) rather than assuming public counts', hiddenSubscriberCount => {
    expect(readYouTubeStatistics({ ...valid, hiddenSubscriberCount }))
      .toEqual({ ok: false, reason: 'YouTube returned invalid statistics' });
  });

  it.each([undefined, null])('reports absent statistics (%j)', stats => {
    expect(readYouTubeStatistics(stats)).toEqual({ ok: false, reason: 'YouTube returned no channel statistics' });
  });

  it.each([[], 'statistics', false, 1])('rejects malformed statistics objects (%j)', stats => {
    expect(readYouTubeStatistics(stats)).toEqual({ ok: false, reason: 'YouTube returned invalid statistics' });
  });

  it.each(['subscriberCount', 'viewCount', 'videoCount'])('requires %s instead of fabricating zero', field => {
    const stats = { ...valid };
    delete stats[field];
    expect(readYouTubeStatistics(stats)).toEqual({ ok: false, reason: 'YouTube returned incomplete statistics' });
    expect(readYouTubeStatistics({ ...valid, [field]: null })).toEqual({ ok: false, reason: 'YouTube returned incomplete statistics' });
  });

  it.each(['subscriberCount', 'viewCount', 'videoCount'])('rejects invalid or unsafe %s values', field => {
    for (const value of [true, false, '', ' ', '-1', '1.5', '1e3', -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '9007199254740992', {}]) {
      expect(readYouTubeStatistics({ ...valid, [field]: value })).toEqual({ ok: false, reason: 'YouTube returned invalid statistics' });
    }
  });

  it.each(['subscriberCount', 'viewCount', 'videoCount'])('reports a malformed JSON counter in %s without invoking object conversion', field => {
    const value = JSON.parse('{"toString":"bad"}');
    expect(readYouTubeStatistics({ ...valid, [field]: value })).toEqual({ ok: false, reason: 'YouTube returned invalid statistics' });
  });
});
