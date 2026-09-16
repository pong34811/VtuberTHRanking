import { afterEach, describe, expect, it, vi } from 'vitest';
import { createD1Stub } from '../../helpers/d1.js';
import { updateAll } from '../../../../worker/updater.js';

afterEach(() => vi.restoreAllMocks());

describe('updateAll', () => {
  it('skips updates when the ranking frequency is manual', async () => {
    const { db } = createD1Stub([{ setting_value: 'manual' }]);

    const manualEnv = { DB: db };

    expect(await updateAll(manualEnv)).toEqual({ ok: true, skipped: 'manual', freq: 'manual' });
  });

  it('skips updates when the configured interval is not due', async () => {
    const { db } = createD1Stub([
      { setting_value: 'hourly' },
      { last_run: new Date().toISOString() },
    ]);

    const notDueResult = await updateAll({ DB: db });

    expect(notDueResult).toMatchObject({ ok: true, skipped: 'not due', freq: 'hourly' });
  });

  it('updates valid channels and reports entries without channel ids', async () => {
    const channelId = `UC${'a'.repeat(22)}`;
    const { db, calls } = createD1Stub([
      { setting_value: 'hourly' },
      { last_run: null },
      {
        results: [
          { id: 1, youtube_url: `https://youtube.com/channel/${channelId}` },
          { id: 2, youtube_url: 'https://youtube.com/@without-channel-id' },
        ],
      },
      { success: true },
    ]);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ statistics: { subscriberCount: '123', viewCount: '4567', videoCount: '89' } }] }),
    }));

    const result = await updateAll({ DB: db, YOUTUBE_API_KEY: 'test-key' });

    expect(result.updated).toBe(1);
    expect(result.errors).toEqual([{ id: 2, reason: 'no channel id' }]);
    expect(fetch).toHaveBeenCalledWith(
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=test-key`,
      { headers: { Referer: 'https://vtuberthai-ranking.pages.dev' } },
    );
    expect(calls.at(-1)).toMatchObject({
      sql: expect.stringContaining('INSERT INTO stats_snapshots'),
      values: [1, 123, 4567, 89, expect.any(String)],
      operation: 'run',
    });
  });
});
