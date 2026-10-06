export const candidateUpsert = `INSERT INTO directory_candidates
  (channel_id,name,source_url,reference_url,reason,status,checked_at,profile_json,evidence_json,review_json)
  VALUES (?,?,?,?,?,'pending',?,?,?,?)
  ON CONFLICT(channel_id) DO UPDATE SET name=excluded.name,reason=excluded.reason,
    checked_at=excluded.checked_at,profile_json=excluded.profile_json,
    evidence_json=excluded.evidence_json,
    review_json=CASE WHEN excluded.review_json='{}' THEN directory_candidates.review_json ELSE excluded.review_json END
  WHERE directory_candidates.status='pending'`;
export const canonicalYouTubeUrl = id => `https://www.youtube.com/channel/${id}`;
