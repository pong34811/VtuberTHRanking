import { useEffect, useState } from 'react';
import DiscoveryHome from './discovery/DiscoveryHome';
import { homepageConfigAPI } from '../api/client';
import { DEFAULT_HOMEPAGE_TEMPLATE, normalizeHomepageTemplate } from '../../../shared/homepage-templates.js';

export default function HomePage({ templateOverride, previewMode = false }) {
  const [published, setPublished] = useState(DEFAULT_HOMEPAGE_TEMPLATE);

  useEffect(() => {
    if (templateOverride != null) return undefined;
    let active = true;
    homepageConfigAPI.get()
      .then(response => {
        if (active) setPublished(normalizeHomepageTemplate(response.data?.template));
      })
      .catch(() => {
        if (active) setPublished(DEFAULT_HOMEPAGE_TEMPLATE);
      });
    return () => { active = false; };
  }, [templateOverride]);

  return <DiscoveryHome templateId={normalizeHomepageTemplate(templateOverride ?? published)} previewMode={previewMode} />;
}
