import { youtubeChannelLookup } from './youtube-profile.js';

export const candidateUpsert = `INSERT INTO directory_candidates
  (channel_id,name,source_url,reference_url,reason,status,checked_at,profile_json,evidence_json,review_json)
  SELECT ?,?,?,?,?,'pending',?,?,?,? WHERE NOT EXISTS (${youtubeChannelLookup})
  ON CONFLICT(channel_id) DO UPDATE SET name=excluded.name,reason=excluded.reason,
    checked_at=excluded.checked_at,profile_json=excluded.profile_json,
    evidence_json=excluded.evidence_json,
    review_json=CASE WHEN excluded.review_json='{}' THEN directory_candidates.review_json ELSE excluded.review_json END
  WHERE directory_candidates.status='pending'`;
export const canonicalYouTubeUrl = id => `https://www.youtube.com/channel/${id}`;

export const youtubeChannelAlias = item => {
  const handle = item.snippet?.customUrl || item.inputHandle;
  return typeof handle === 'string' && /^@[^/?#\s]+$/.test(handle) ? `https://www.youtube.com/${handle}` : canonicalYouTubeUrl(item.id);
};
