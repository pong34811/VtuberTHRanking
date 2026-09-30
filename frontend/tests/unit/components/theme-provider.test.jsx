import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import ThemeProvider from '@/components/ThemeProvider';
import ThemeSelector from '@/components/ThemeSelector';

beforeEach(() => {
  // Node 26's global webstorage masks jsdom's storage in Vitest; use browser storage.
  vi.stubGlobal('localStorage', new JSDOM('', { url: 'https://theme.test' }).window.localStorage);
});
afterEach(() => { vi.unstubAllGlobals(); delete document.documentElement.dataset.theme; document.documentElement.classList.remove('dark'); });

it('shares the persisted theme and responds to system and cross-tab changes', async () => {
  let listener;
  const media = { matches: false, addEventListener: vi.fn((_, callback) => { listener = callback; }), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  window.localStorage.setItem('theme', 'system');
  const view = render(<ThemeProvider><ThemeSelector /><ThemeSelector /></ThemeProvider>);
  expect(document.documentElement.dataset.theme).toBe('light');
  act(() => { media.matches = true; listener(); });
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.documentElement).toHaveClass('dark');
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: 'light' })));
  expect(screen.getAllByRole('combobox').every(select => select.value === 'light')).toBe(true);
  expect(document.documentElement.dataset.theme).toBe('light');
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'dark' } });
  expect(window.localStorage.getItem('theme')).toBe('dark');
  expect(screen.getAllByRole('combobox')[1]).toHaveValue('dark');
  view.unmount();
  expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
});

it('supports a standalone selector without matchMedia and ignores invalid saved values', () => {
  vi.stubGlobal('matchMedia', undefined);
  window.localStorage.setItem('theme', 'unexpected');
  render(<ThemeSelector />);
  expect(screen.getByRole('combobox')).toHaveValue('system');
  expect(document.documentElement.dataset.theme).toBe('light');
});

it('can render on the server without window, storage or matchMedia', () => {
  vi.stubGlobal('window', undefined);
  expect(() => renderToString(<ThemeProvider><ThemeSelector /></ThemeProvider>)).not.toThrow();
});
