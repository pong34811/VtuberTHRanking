// Isolate operational metadata in legacy query-shaping tests. The mounted
// site-config/public-data suites exercise these queries against actual SQL.
export function withPublicConfig(db) {
  return {
    ...db,
    prepare(sql) {
      if (/^SELECT setting_key,setting_value FROM settings\b/.test(sql)) {
        const statement = { bind() { return statement; }, async all() { return { results: [] }; } };
        return statement;
      }
      if (/^SELECT id,name,sort_order,status FROM categories\b/.test(sql)) {
        return { async all() { return { results: [
          { id: 'followers', name: 'ผู้ติดตาม', sort_order: 1, status: 'active' },
          { id: 'views', name: 'ยอดวิว', sort_order: 2, status: 'active' },
          { id: 'videos', name: 'จำนวนคลิป', sort_order: 3, status: 'active' },
        ] }; } };
      }
      return db.prepare(sql);
    },
  };
}
