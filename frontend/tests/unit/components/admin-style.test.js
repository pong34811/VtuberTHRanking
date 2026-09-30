import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const css = readFileSync('src/admin/admin.css', 'utf8');

it('uses the theme foreground token for legacy primary buttons', () => {
  expect(css.match(/\.admin-modal button\.primary\s*\{([^}]+)\}/)[1]).toContain('color: var(--primary-foreground)');
});

it('does not leak bare table selectors into public SPA routes', () => {
  expect(css).not.toMatch(/(?:^|[{},])\s*(?:table|th|td|tbody\s+tr)[\s,{]/m);
});
