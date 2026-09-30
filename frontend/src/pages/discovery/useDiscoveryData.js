import { useEffect, useState } from 'react';
import { directoryAPI } from '../../api/client';
import { DIRECTORY_CATEGORIES } from '../../../../shared/directory.js';

function emptyData() {
  return { total: 0, results: [], category_counts: [], affiliation_counts: [], groups: [] };
}

export default function useDiscoveryData(templateId, { q = '', category = '', affiliation = '', offset = 0, viewAll = false } = {}) {
  const requestKey = JSON.stringify([templateId, q, category, affiliation, offset, viewAll]);
  const [snapshot, setSnapshot] = useState({ requestKey: null, data: emptyData() });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    setSnapshot({ requestKey, data: emptyData() });
    setLoading(true);
    setError('');

    async function load() {
      try {
        const categoryFirst = templateId === 'category-first' && !q && !category && !affiliation && !offset && !viewAll;
        const newestFirst = templateId === 'newest-first';
        const response = await directoryAPI.getList({
          ...(q && { q }),
          ...(category && { category }),
          ...(affiliation && { affiliation }),
          sort: newestFirst ? 'created_at_desc' : 'name',
          limit: categoryFirst ? 1 : 12,
          offset,
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
          requestKey,
          data: {
            ...emptyData(),
            total: base.total ?? 0,
            results: base.results || [],
            category_counts: base.category_counts || [],
            affiliation_counts: base.affiliation_counts || [],
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
  }, [templateId, q, category, affiliation, offset, viewAll, requestKey, retryCount]);

  const currentTemplate = snapshot.requestKey === requestKey;
  return {
    data: currentTemplate ? snapshot.data : emptyData(),
    loading: loading || !currentTemplate,
    error: currentTemplate ? error : '',
    retry: () => setRetryCount(value => value + 1),
  };
}
