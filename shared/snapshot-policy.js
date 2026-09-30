function sqlAlias(alias) {
  if (typeof alias !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) throw new Error('Invalid SQL alias');
  return alias;
}

export function latestSnapshotOrder(alias = 's') {
  const name = sqlAlias(alias);
  return `julianday(${name}.recorded_at) DESC, ${name}.id DESC`;
}

export function rankingEligibility(alias = 'v') {
  const name = sqlAlias(alias);
  return `${name}.is_active = 1 AND COALESCE(${name}.platform, 'youtube') = 'youtube'`;
}
