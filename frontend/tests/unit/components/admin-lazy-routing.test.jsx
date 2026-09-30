import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
const chunks = vi.hoisted(() => ({ loaded: [] }));
vi.mock('@/admin/ChannelsTab', () => { chunks.loaded.push('channels'); return { default: () => <p>Channels chunk</p> }; });
vi.mock('@/admin/AgenciesTab', () => { chunks.loaded.push('agencies'); return { default: () => <p>Agencies chunk</p> }; });
vi.mock('@/admin/RankingsTab', () => { chunks.loaded.push('rankings'); return { default: () => <p>Rankings chunk</p> }; });
vi.mock('@/admin/tabs/UsersTab', () => { chunks.loaded.push('users'); return { UsersTab: () => <p>Users chunk</p> }; });
vi.mock('@/admin/tabs/SettingsTab', () => { chunks.loaded.push('settings'); return { SettingsTab: () => <p>Settings chunk</p> }; });
vi.mock('@/admin/tabs/ReportsTab', () => { chunks.loaded.push('reports'); return { ReportsTab: () => <p>Reports chunk</p> }; });
vi.mock('@/admin/tabs/AuditTab', () => { chunks.loaded.push('history'); return { AuditTab: () => <p>History chunk</p> }; });
vi.mock('@/admin/tabs/CategoriesTab', () => { chunks.loaded.push('categories'); return { CategoriesTab: () => <p>Categories chunk</p> }; });
vi.mock('@/admin/tabs/HomepageTemplateTab', () => { chunks.loaded.push('homepage'); return { HomepageTemplateTab: () => <p>Homepage chunk</p> }; });
import AdminPage from '@/admin/AdminPage';
const renderAdmin = path => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/admin/*" element={<AdminPage />} /></Routes></MemoryRouter>);
afterEach(() => vi.unstubAllGlobals());

it('does not load any tab chunk before authentication', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(Response.json({ setupRequired: false }, { status: 401 }))));
  renderAdmin('/admin/settings');
  await screen.findByRole('heading', { name: 'เข้าสู่ระบบผู้ดูแล' });
  expect(chunks.loaded).toEqual([]);
});

it('redirects staff away from manager routes without loading the restricted chunk', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(Response.json({ user: { username: 'staff', role: 'staff' }, csrfToken: 'fixture' }))));
  renderAdmin('/admin/users');
  expect(await screen.findByText('Channels chunk')).toBeInTheDocument();
  expect(chunks.loaded).toEqual(['channels']);
});
