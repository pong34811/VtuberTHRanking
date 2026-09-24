import { useEffect, useState } from 'react';
import { directoryAPI } from '../../api/client';
import { DIRECTORY_CATEGORIES } from '../../../../shared/directory.js';

function emptyData() {
  return { total: 0, results: [], category_counts: [], groups: [] };
}

export default function useDiscoveryData(templateId) {
  const [snapshot, setSnapshot] = useState({ templateId: null, data: emptyData() });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    setSnapshot({ templateId, data: emptyData() });
    setLoading(true);
    setError('');

    async function load() {
      try {
        const categoryFirst = templateId === 'category-first';
        const newestFirst = templateId === 'newest-first';
        const response = await directoryAPI.getList({
          sort: newestFirst ? 'created_at_desc' : 'name',
          limit: categoryFirst ? 1 : 12,
          offset: 0,
        });
        if (!active) return;

        const base = response.data;
        const categories = categoryFirst
          ? DIRECTORY_CATEGORIES.filter(category => base.category_counts?.some(item => item.category === category && item.count > 0))
          : [];
        const settled = categoryFirst
          ? await Promise.allSettled(categories.map(category => directoryAPI.getList({ category, sort: 'name', limit: 3, offset: 0 })))
          : [];
        if (!active) return;

        const groups = settled.map((result, index) => ({
          category: categories[index],
          results: result.status === 'fulfilled' ? result.value.data.results || [] : [],
          error: result.status === 'rejected' ? 'โหลดรายชื่อในหมวดหมู่นี้ไม่สำเร็จ' : '',
        }));
        setSnapshot({
          templateId,
          data: {
            ...emptyData(),
            total: base.total ?? 0,
            results: base.results || [],
            category_counts: base.category_counts || [],
            groups,
          },
        });
      } catch {
        if (active) setError('โหลดรายชื่อไม่สำเร็จ กรุณาลองอีกครั้ง');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [templateId, retryCount]);

  const currentTemplate = snapshot.templateId === templateId;
  return {
    data: currentTemplate ? snapshot.data : emptyData(),
    loading: loading || !currentTemplate,
    error: currentTemplate ? error : '',
    retry: () => setRetryCount(value => value + 1),
  };
}
