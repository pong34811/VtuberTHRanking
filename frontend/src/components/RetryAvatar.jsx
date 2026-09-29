import { useEffect, useState } from 'react';

export default function RetryAvatar({ src, fallback, ...imageProps }) {
  const [retry, setRetry] = useState({ src, attempt: 0, token: '' });
  const attempt = retry.src === src ? retry.attempt : 0;

  useEffect(() => {
    if (attempt !== 1) return undefined;
    const timer = setTimeout(() => setRetry(current => current.src === src && current.attempt === 1
      ? { ...current, attempt: 2 }
      : current), 500);
    return () => clearTimeout(timer);
  }, [src, attempt]);

  const onError = () => {
    if (attempt === 0) setRetry({ src, attempt: 1, token: String(Date.now()) });
    else if (attempt === 2) setRetry({ src, attempt: 3, token: retry.token });
  };

  if (!src || attempt === 1 || attempt === 3) return fallback;
  let imageSrc = src;
  if (attempt === 2) {
    try {
      const retryUrl = new URL(src, document.baseURI);
      retryUrl.searchParams.set('_avatar_retry', retry.token);
      imageSrc = retryUrl.href;
    } catch {
      return fallback;
    }
  }
  return <img {...imageProps} src={imageSrc} onError={onError} />;
}
