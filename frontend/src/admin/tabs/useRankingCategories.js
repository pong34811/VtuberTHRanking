import { useMemo } from 'react';
import { useList } from './useList';

const supported = new Set(['followers', 'views', 'videos']);

export function useRankingCategories() {
  const list = useList('/categories');
  const categories = useMemo(() => {
    const seen = new Set();
    return list.rows.filter(row => {
      if (!supported.has(row.id) || row.slug !== row.id || seen.has(row.id) ||
          typeof row.name !== 'string' || !row.name.trim() ||
          !['active', 'inactive'].includes(row.status) || !Number.isInteger(row.sort_order)) return false;
      seen.add(row.id);
      return true;
    }).sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  }, [list.rows]);
  return { ...list, categories, choices: categories.filter(row => row.status === 'active') };
}
