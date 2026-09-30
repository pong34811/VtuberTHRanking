import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import AdminPage from '@/admin/AdminPage';
import ThemeProvider from '@/components/ThemeProvider';

const session = { user: { id: 'u1', username: 'manager', display_name: 'Manager', role: 'manager' }, csrfToken: 'fixture' };
const renderAdmin = (path = '/admin/channels') => render(<ThemeProvider><MemoryRouter initialEntries={[path]}><Routes><Route path="/admin/*" element={<AdminPage />} /></Routes></MemoryRouter></ThemeProvider>);
afterEach(() => vi.unstubAllGlobals());

it.each(['network', '500'])('keeps a %s auth check failure distinct from logged out and retries locally', async (failure) => {
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => failure === 'network' ? Promise.reject(new Error('Network unavailable')) : Promise.resolve(Response.json({ message: 'Service unavailable' }, { status: 500 })))
    .mockImplementation(url => Promise.resolve(Response.json(String(url).endsWith('/me') ? session : { results: [] }))));
  renderAdmin();
  expect(await screen.findByRole('alert')).toHaveTextContent(/unavailable/);
  expect(screen.queryByRole('heading', { name: 'เข้าสู่ระบบผู้ดูแล' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }));
  expect(await screen.findByRole('heading', { name: 'คลังช่อง VTuber' }, { timeout: 5000 })).toBeInTheDocument();
});

it('offers theme selection on the logged-out screen without entering credentials', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(Response.json({ setupRequired: false }, { status: 401 }))));
  renderAdmin();
  await screen.findByRole('heading', { name: 'เข้าสู่ระบบผู้ดูแล' });
  expect(screen.getByRole('combobox', { name: 'ธีมหน้าจอ' })).toBeInTheDocument();
});

it('offers mobile password, logout and theme actions with the existing password dialog', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(url => Promise.resolve(Response.json(String(url).endsWith('/me') ? session : { results: [] }))));
  renderAdmin();
  await screen.findByRole('heading', { name: 'คลังช่อง VTuber' });
  const mobile = within(screen.getByRole('group', { name: 'บัญชีผู้ใช้บนมือถือ' }));
  expect(mobile.getByRole('button', { name: 'ออกจากระบบ' })).toBeInTheDocument();
  expect(mobile.getByRole('combobox', { name: 'ธีมหน้าจอ' })).toBeInTheDocument();
  fireEvent.click(mobile.getByRole('button', { name: 'เปลี่ยนรหัสผ่าน' }));
  expect(screen.getByRole('dialog', { name: 'เปลี่ยนรหัสผ่าน' })).toBeInTheDocument();
});

it('rechecks a failed list session once and does not loop on auth/me 401', async () => {
  let checks = 0;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(url => String(url).endsWith('/me')
    ? Promise.resolve(Response.json(++checks === 1 ? session : { setupRequired: false }, { status: checks === 1 ? 200 : 401 }))
    : Promise.resolve(Response.json({ message: 'Expired' }, { status: 401 }))));
  renderAdmin();
  expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบผู้ดูแล' })).toBeInTheDocument();
  expect(checks).toBe(2);
});
