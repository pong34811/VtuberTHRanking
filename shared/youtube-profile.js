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
export const youtubeChannelLookup = `WITH RECURSIVE source(url,alias) AS (VALUES (?,?)),
  raw(vtuber_id,url) AS (SELECT id,COALESCE(youtube_url,'') FROM vtubers UNION ALL SELECT id,COALESCE(channel_url,'') FROM vtubers),
  without_query AS (SELECT vtuber_id,substr(url,1,instr(url||'?','?')-1) AS url FROM raw),
  clean AS (SELECT vtuber_id,replace(replace(replace(trim(substr(url,1,instr(url||'#','#')-1)),char(9),''),char(10),''),char(13),'') AS url FROM without_query),
  decoded(vtuber_id,remaining,bytes) AS (
    SELECT vtuber_id,url,'' FROM clean WHERE instr(url,'%')>0
    UNION ALL SELECT vtuber_id,
      substr(remaining,CASE WHEN substr(remaining,1,1)='%' THEN 4 ELSE 2 END),
      bytes||CASE WHEN substr(remaining,1,1)='%' THEN substr(remaining,2,2) ELSE hex(substr(remaining,1,1)) END
    FROM decoded WHERE remaining<>''
  ),
  urls AS (SELECT vtuber_id,url FROM clean WHERE instr(url,'%')=0
    UNION ALL SELECT vtuber_id,CAST(unhex(bytes) AS TEXT) FROM decoded WHERE remaining=''),
  authority AS (SELECT vtuber_id,lower(substr(url,1,instr(url,':')-1)) AS scheme,
    ltrim(replace(substr(url,instr(url,':')+1),char(92),'/'),'/') AS rest FROM urls),
  locations AS (SELECT vtuber_id,scheme,lower(substr(rest,1,instr(rest||'/','/')-1)) AS host,
    substr(rest,instr(rest||'/','/')) AS path FROM authority),
  normalized AS (SELECT vtuber_id,'https://www.youtube.com'||rtrim(path,'/') AS url FROM locations
    WHERE scheme IN ('http','https') AND replace(replace(replace(substr(host,1,instr(host||':',':')-1),'。','.'),'．','.'),'｡','.') IN ('youtube.com','www.youtube.com','m.youtube.com'))
  SELECT v.id FROM vtubers v CROSS JOIN source
  LEFT JOIN youtube_profile_state s ON s.vtuber_id=v.id
    AND json_extract(s.reference_json,'$.youtube_url')=COALESCE(v.youtube_url,'')
    AND json_extract(s.reference_json,'$.channel_url')=COALESCE(v.channel_url,'')
  WHERE s.source_url=source.url OR EXISTS (SELECT 1 FROM normalized n WHERE n.vtuber_id=v.id
    AND (n.url IN (source.url,source.alias) OR (instr(source.alias,'/@')>0 AND lower(n.url)=lower(source.alias))))
  ORDER BY v.id LIMIT 1`;
