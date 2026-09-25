import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import AdminPage from '@/admin/AdminPage';

afterEach(() => vi.unstubAllGlobals());

function renderAdmin() {
  return render(<MemoryRouter initialEntries={['/admin']}>
    <Routes><Route path="/admin/*" element={<AdminPage />} /></Routes>
  </MemoryRouter>);
}

it('offers initial setup from the session response and enters admin after creating the manager', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const status = url.endsWith('/me') ? 401 : 200;
    const data = url.endsWith('/me') ? { setupRequired: true }
      : url.endsWith('/setup') ? { user: { id: '1', username: 'admin', display_name: 'Admin', role: 'manager', status: 'active' }, csrfToken: 'csrf' }
        : { results: [] };
    return { ok: status === 200, status, json: async () => data };
  }));
  const user = userEvent.setup();
  renderAdmin();
  expect(await screen.findByRole('heading', { name: 'ตั้งค่าผู้ดูแลคนแรก' })).toBeInTheDocument();
  await user.type(screen.getByLabelText('รหัสตั้งค่า'), 'private-setup-token');
  await user.type(screen.getByLabelText('ชื่อผู้ใช้'), 'admin');
  await user.type(screen.getByLabelText('รหัสผ่าน', { exact: true }), 'long-review-password');
  await user.click(screen.getByRole('button', { name: 'สร้างบัญชีผู้ดูแล' }));
  expect(await screen.findByRole('heading', { name: 'คลังช่อง VTuber' })).toBeInTheDocument();
  const setupCall = fetch.mock.calls.find(([url]) => url === '/api/v1/auth/setup');
  expect(JSON.parse(setupCall[1].body)).toEqual({ username: 'admin', password: 'long-review-password', setupToken: 'private-setup-token' });
});

it('keeps existing short-password login available and displays failures', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url) => ({
    ok: false, status: 401,
    json: async () => url.endsWith('/me') ? { setupRequired: false } : { message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
  })));
  const user = userEvent.setup();
  renderAdmin();
  expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบผู้ดูแล' })).toBeInTheDocument();
  expect(screen.queryByLabelText('รหัสตั้งค่า')).not.toBeInTheDocument();
  await user.type(screen.getByLabelText('ชื่อผู้ใช้'), 'admin');
  await user.type(screen.getByLabelText('รหัสผ่าน'), 'abcd');
  await user.click(screen.getByRole('button', { name: 'เข้าสู่ระบบ' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'));
  const loginCall = fetch.mock.calls.find(([url]) => url === '/api/v1/auth/login');
  expect(JSON.parse(loginCall[1].body)).toEqual({ username: 'admin', password: 'abcd' });
});
