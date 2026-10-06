import { expect, it } from 'vitest';
import { youtubeReference, readYouTubeProfile, isIndependentThaiVTuber } from '../../../../shared/youtube-profile.js';

it('requires canonical YouTube references and complete, safe source profiles', () => {
  const id = `UC${'a'.repeat(22)}`;
  expect(youtubeReference(`https://www.youtube.com/channel/${id}/`)).toEqual({ id });
  expect(youtubeReference('https://youtube.com/@creator')).toEqual({ forHandle: '@creator' });
  for (const url of ['https://youtube.com.evil.invalid/@creator', 'https://user:password@youtube.com/@creator', 'javascript:alert(1)', 'https://youtube.com/watch?v=x']) expect(youtubeReference(url)).toBeNull();
  const item = { id, snippet: { title: 'Creator', description: 'Independent Thai VTuber', thumbnails: {} } };
  expect(readYouTubeProfile(item)).toEqual({ name: 'Creator', bio: 'Independent Thai VTuber', avatar: '' });
  for (const snippet of [{ title: '', description: '' }, { title: 'Creator' }, { title: 'Creator', description: false }, { ...item.snippet, thumbnails: { medium: { url: 'javascript:alert(1)' } } }]) expect(readYouTubeProfile({ id, snippet })).toBeNull();
  expect(isIndependentThaiVTuber(readYouTubeProfile(item))).toBe(true);
  for (const bio of ['I watch independent Thai VTuber streams', 'Not an independent Thai VTuber', 'Former independent Thai VTuber, now an agency member', 'Thai VTuber fan. Indie games enthusiast', 'Independent Thai VTuber\nAgency member now']) expect(isIndependentThaiVTuber({ bio })).toBe(false);
});

it('rejects literal/encoded dot segments and malformed path encodings before URL normalizes identity', () => {
  const id=`UC${'z'.repeat(22)}`;
  for(const path of [`/channel/./${id}`,`/channel/../channel/${id}`,`/channel/%2e/${id}`,`/channel/.%2E/channel/${id}`,`/channel/%2e%2e/channel/${id}`,`/channel/%/${id}`,`/channel/%GG/${id}`,`/channel/%FF/${id}`]) {
    expect(youtubeReference(`https://www.youtube.com${path}`)).toBeNull();
  }
  expect(youtubeReference(`https://www.youtube.com/channel/${id}/?view=creator#about`)).toEqual({id});
  expect(youtubeReference('https://www.youtube.com/@%63reator/')).toEqual({forHandle:'@creator'});
});
