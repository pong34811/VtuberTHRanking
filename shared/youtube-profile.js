export function youtubeReference(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password || !['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) return null;
    const id = url.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})\/?$/)?.[1];
    if (id) return { id };
    const handle = url.pathname.match(/^\/(@[^/?#]+)\/?$/)?.[1];
    return handle ? { forHandle: decodeURIComponent(handle) } : null;
  } catch { return null; }
}

export function readYouTubeProfile(item) {
  if (!/^UC[A-Za-z0-9_-]{22}$/.test(item?.id || '')) return null;
  const snippet = item.snippet;
  if (typeof snippet?.title !== 'string' || !snippet.title.trim() || snippet.title.length > 100 || typeof snippet.description !== 'string') return null;
  const avatar = snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '';
  if (typeof avatar !== 'string' || avatar.length > 2048) return null;
  if (avatar) {
    try { const url = new URL(avatar); if (url.protocol !== 'https:' || url.username || url.password) return null; }
    catch { return null; }
  }
  return { name: snippet.title.trim(), avatar, bio: snippet.description.slice(0, 5000) };
}

// A creator's explicit self-description is primary evidence; keywords in search results are not.
export function isIndependentThaiVTuber(profile) {
  // ponytail: explicit declaration lines only; ambiguous prose stays pending for human review.
  if (/\b(?:agency|agencies|former|previously|graduated|retired)\b|สังกัด|อดีต|แกรด|เลิกเป็น/i.test(profile.bio)) return false;
  return /^(?:(?:I am|I'm) an? )?(?:independent|indie) Thai VTuber[.!]?\s*$|^(?:วีทู[ปบ]เบอร์\s*ไทย|VTuber\s*ไทย)\s*อิสระ[.!]?\s*$/im.test(profile.bio);
}

// Canonical URLs and recorded handle identities share one natural-key lookup for both import paths.
export const youtubeChannelLookup = `WITH source(url,alias) AS (VALUES (?,?)) SELECT v.id FROM vtubers v CROSS JOIN source
  LEFT JOIN youtube_profile_state s ON s.vtuber_id=v.id
    AND json_extract(s.reference_json,'$.youtube_url')=COALESCE(v.youtube_url,'')
    AND json_extract(s.reference_json,'$.channel_url')=COALESCE(v.channel_url,'')
  WHERE s.source_url=source.url
    OR rtrim(replace(replace(replace(v.youtube_url,'http://','https://'),'https://youtube.com/','https://www.youtube.com/'),'https://m.youtube.com/','https://www.youtube.com/'),'/') IN (source.url,source.alias)
    OR rtrim(replace(replace(replace(v.channel_url,'http://','https://'),'https://youtube.com/','https://www.youtube.com/'),'https://m.youtube.com/','https://www.youtube.com/'),'/') IN (source.url,source.alias)
    OR (instr(source.alias,'/@')>0 AND (
      lower(rtrim(replace(replace(replace(v.youtube_url,'http://','https://'),'https://youtube.com/','https://www.youtube.com/'),'https://m.youtube.com/','https://www.youtube.com/'),'/'))=lower(source.alias)
      OR lower(rtrim(replace(replace(replace(v.channel_url,'http://','https://'),'https://youtube.com/','https://www.youtube.com/'),'https://m.youtube.com/','https://www.youtube.com/'),'/'))=lower(source.alias)))
  ORDER BY v.id LIMIT 1`;
