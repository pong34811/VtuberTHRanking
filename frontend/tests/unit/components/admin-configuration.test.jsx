import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import RankingsTab from '@/admin/RankingsTab';
import { ReportsTab } from '@/admin/tabs/ReportsTab';
import { CategoriesTab } from '@/admin/tabs/CategoriesTab';
import { SettingsTab } from '@/admin/tabs/SettingsTab';

const categories = [
  { id: 'followers', slug: 'followers', name: 'Audience', sort_order: 2, status: 'active' },
  { id: 'views', slug: 'views', name: 'Watch count', sort_order: 1, status: 'active' },
  { id: 'videos', slug: 'videos', name: 'Uploads', sort_order: 3, status: 'inactive' },
  { id: 'unsupported', slug: 'likes', name: 'Unsupported', sort_order: 0, status: 'active' },
];
afterEach(() => vi.unstubAllGlobals());
const stub = (rows = []) => vi.stubGlobal('fetch', vi.fn(url => Promise.resolve(Response.json({ results: String(url).endsWith('/categories') ? categories : rows }))));

it('uses validated category names, ordering and status for ranking selectors', async () => {
  stub([{ id: 1, name: 'Alpha', rank: 1, total_views: 10 }]);
  render(<RankingsTab isManager />);
  const first = await screen.findByRole('button', { name: 'Watch count' });
  expect(first).toHaveAttribute('aria-pressed', 'true');
  const group = screen.getByRole('group', { name: 'ตัวชี้วัด' });
  expect(within(group).getAllByRole('button').map(button => button.textContent)).toEqual(['Watch count', 'Audience']);
  expect(screen.queryByRole('button', { name: 'Uploads' })).not.toBeInTheDocument();
  expect(screen.queryByText('Unsupported')).not.toBeInTheDocument();
  await waitFor(() => expect(fetch.mock.calls.find(([url]) => String(url).includes('/rankings?'))?.[0]).toContain('category=views'));
});

it('identifies populated reports by period, configured metric and month before download', async () => {
  stub([
    { id: 'audience-report', report_type: 'monthly', report_period: '2026-08', category_id: 'followers', total_vtubers: 3, generated_at: '2026-09-01T00:00:00Z' },
    { id: 'uploads-report', report_type: 'alltime', report_period: 'alltime', category_id: 'videos', total_vtubers: 2, generated_at: '2026-09-01T00:00:00Z' },
  ]);
  render(<ReportsTab csrfToken="fixture" />);
  const monthly = await screen.findByRole('button', { name: 'ดาวน์โหลด CSV รายเดือน · Audience · 2026-08 (audience-report)' });
  const row = monthly.closest('tr');
  expect(within(row).getByText('รายเดือน')).toBeInTheDocument();
  expect(within(row).getByText('Audience')).toBeInTheDocument();
  expect(within(row).getByText('2026-08')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'ดาวน์โหลด CSV ตลอดกาล · Uploads · ทุกช่วงเวลา (uploads-report)' })).toBeInTheDocument();
  expect(within(screen.getByRole('combobox', { name: 'ตัวชี้วัด' })).getAllByRole('option').map(option => option.textContent)).toEqual(['Watch count', 'Audience']);
  fireEvent.submit(screen.getByRole('button', { name: 'สร้างรายงาน' }).closest('form'));
  expect(JSON.parse(fetch.mock.calls.find(([, options]) => options.method === 'POST')[1].body)).toMatchObject({ period: 'monthly', category: 'views' });
});

it('keeps a category metric identifier immutable while saving operational fields only', async () => {
  stub();
  render(<CategoriesTab csrfToken="fixture" isManager />);
  fireEvent.click(await screen.findByRole('button', { name: 'แก้ไขหมวดหมู่ Audience' }));
  const dialog = screen.getByRole('dialog', { name: 'แก้ไขหมวดหมู่' });
  const slug = within(dialog).getByRole('textbox', { name: 'Slug' });
  expect(slug).toHaveAttribute('readonly');
  expect(slug).toHaveAccessibleDescription('รหัสตัวชี้วัดคงที่ ไม่สามารถเปลี่ยนได้');
  fireEvent.change(within(dialog).getByRole('textbox', { name: 'ชื่อ' }), { target: { value: 'New audience label' } });
  fireEvent.submit(within(dialog).getByRole('button', { name: 'บันทึก' }).closest('form'));
  await waitFor(() => expect(fetch.mock.calls.some(([, options]) => options.method === 'PUT')).toBe(true));
  const body = JSON.parse(fetch.mock.calls.find(([, options]) => options.method === 'PUT')[1].body);
  expect(body).toMatchObject({ name: 'New audience label', slug: 'followers' });
  expect(Object.keys(body).sort()).toEqual(['name', 'slug', 'sort_order', 'status']);
});

it('describes real site controls and displays configured pipeline publication totals', async () => {
  vi.stubGlobal('fetch', vi.fn(url => Promise.resolve(Response.json({ results: String(url).endsWith('/settings') ? [
    { setting_key: 'site_name', setting_value: 'Fixture site' },
    { setting_key: 'current_ranking_period', setting_value: '2026-08' },
    { setting_key: 'ranking_update_frequency', setting_value: 'monthly' },
  ] : [
    { id: 'configured-run', status: 'succeeded', rankings_published: 4, rankings_expected: 4, started_at: '2026-09-01T00:00:00Z', frequency: 'monthly' },
    { id: 'legacy-run', status: 'succeeded', rankings_published: 6, started_at: '2026-09-01T00:00:00Z', frequency: 'daily' },
  ] }))));
  render(<SettingsTab csrfToken="fixture" />);
  expect(await screen.findByText('4/4')).toBeInTheDocument();
  expect(screen.getByText('6/6')).toBeInTheDocument();
  expect(screen.queryByText(/สำเร็จเมื่อเก็บสถิติและเผยแพร่ครบ 6/)).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'สถานะเว็บไซต์' })).toHaveAccessibleDescription(/API สาธารณะ/);
  expect(screen.getByLabelText('เดือนอันดับปัจจุบัน')).toHaveAccessibleDescription(/เดือนเริ่มต้น/);
  expect(screen.getByRole('combobox', { name: 'ความถี่การอัปเดต' })).toHaveAccessibleDescription(/เก็บสถิติ.*30 วัน.*เดือนปฏิทิน/);
});
