import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { CategoriesTab } from '@/admin/tabs/CategoriesTab.jsx';
import { ReportsTab } from '@/admin/tabs/ReportsTab.jsx';
import { UsersTab } from '@/admin/tabs/UsersTab.jsx';
import { AuditTab } from '@/admin/tabs/AuditTab.jsx';
import { SettingsTab } from '@/admin/tabs/SettingsTab.jsx';
import { blank } from '@/admin/channels/options.js';
import { channelFields } from '@/admin/channels/options.js';
import { ChannelForm } from '@/admin/channels/ChannelForm.jsx';
import { YouTubeImport } from '@/admin/channels/YouTubeImport.jsx';
import { Snapshots } from '@/admin/channels/Snapshots.jsx';
import { UserForm } from '@/admin/tabs/UsersTab.jsx';
import ChannelsTab from '@/admin/ChannelsTab.jsx';
import RankingsTab from '@/admin/RankingsTab.jsx';
import AgenciesTab from '@/admin/AgenciesTab.jsx';

function mockFetch(body = { results: [] }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it('shows the selected ranking metric and changes metric with an accessible pressed state', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url) => {
    const category = new URL(String(url), 'http://localhost').searchParams.get('category');
    return {
      ok: true,
      json: async () => ({ results: [{ id: category, rank: 1, name: category, subscriber_count: 10, total_views: 20, video_count: 30 }] }),
    };
  }));

  render(<RankingsTab csrfToken="token" isManager={false} />);

  expect(await screen.findByText('followers')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'ผู้ติดตาม' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'ยอดดู' })).toHaveAttribute('aria-pressed', 'false');
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'ยอดดู' }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(new URL(String(fetch.mock.calls[1][0]), 'http://localhost').searchParams.get('category')).toBe('views');
  expect(screen.getByRole('button', { name: 'ยอดดู' })).toHaveAttribute('aria-pressed', 'true');
});

it('shows the categories console while entries load', async () => {
  mockFetch();

  render(<CategoriesTab csrfToken="token" />);

  expect(await screen.findByText('หมวดหมู่อันดับ')).toBeInTheDocument();
});

it('shows the reports console while entries load', async () => {
  mockFetch();

  render(<ReportsTab csrfToken="token" />);

  expect(await screen.findByText('รายงาน')).toBeInTheDocument();
});

it('shows the users console while entries load', async () => {
  mockFetch();

  render(<UsersTab csrfToken="token" currentUser={{ id: 1 }} />);

  expect(await screen.findByText('ผู้ใช้งาน')).toBeInTheDocument();
});

it('shows the audit console while entries load', async () => {
  mockFetch();

  render(<AuditTab />);

  expect(await screen.findByText('ประวัติการทำงาน')).toBeInTheDocument();
});

it('shows the settings form once settings load', async () => {
  mockFetch();

  render(<SettingsTab csrfToken="token" />);

  expect(await screen.findByText('ชื่อเว็บไซต์')).toBeInTheDocument();
});

it('shows partial pipeline runs with their frequency and published-set count', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async url => String(url).endsWith('/pipeline-runs')
    ? { ok: true, json: async () => ({ results: [{
      id: 'run-1', trigger_source: 'scheduled', frequency: 'weekly', status: 'partial',
      started_at: '2026-09-16T00:00:00.000Z', completed_at: '2026-09-16T00:01:00.000Z',
      channels_total: 8, snapshots_written: 7, rankings_published: 4, error_summary: '1 จาก 8 ช่องดึงสถิติไม่สำเร็จ',
    }] }) }
    : { ok: true, json: async () => ({ results: [] }) }));

  render(<SettingsTab csrfToken="token" />);

  expect(await screen.findByText('สำเร็จบางส่วน')).toBeInTheDocument();
  expect(screen.getByText('ตั้งเวลาทำงาน · ทุก 7 วัน')).toBeInTheDocument();
  expect(screen.getByText('4/6')).toBeInTheDocument();
  expect(screen.getByText('1 จาก 8 ช่องดึงสถิติไม่สำเร็จ')).toBeInTheDocument();
});

it('shows readable audit action, target, and expanded details', async () => {
  mockFetch({ results: [{
    id: 7, created_at: '2026-09-16T00:00:00.000Z', username: 'manager', display_name: 'Manager',
    action: 'update', target_type: 'vtuber', target_id: 3,
    details: JSON.stringify({ fields: ['name', 'followers'], name: 'Aiko' }),
  }] });

  render(<AuditTab />);

  expect(await screen.findByText('แก้ไข')).toBeInTheDocument();
  expect(screen.getByText('ช่อง VTuber')).toBeInTheDocument();
  expect(screen.getByText('ฟิลด์ที่แก้ไข: name, followers · ชื่อ: Aiko')).toBeInTheDocument();
  fireEvent.click(screen.getByText('ดูรายละเอียด'));
  expect(screen.getByText(/"fields"/)).toBeInTheDocument();
});

it('shows the channel editor fields', async () => {
  mockFetch();

  render(<ChannelForm value={{ ...blank }} csrfToken="token" onClose={() => {}} onSaved={() => {}} />);

  expect(await screen.findByText('ชื่อช่อง')).toBeInTheDocument();
  expect(await screen.findByText('หมายเหตุ')).toBeInTheDocument();
});

it('shows agencies in the channel editor when affiliation is selected', async () => {
  mockFetch({ results: [{ id: 4, name: 'PIXELA' }] });
  render(<ChannelForm value={{ ...blank }} csrfToken="token" onClose={() => {}} onSaved={() => {}} />);
  fireEvent.change(screen.getByLabelText('ประเภทสังกัด'), { target: { value: 'agency' } });
  expect(await screen.findByRole('option', { name: 'PIXELA' })).toBeInTheDocument();
});

it('shows the agencies management page', async () => {
  mockFetch({ results: [{ id: 4, name: 'PIXELA', description: 'Agency', image_url: '', contact: 'https://example.com', channel_count: 2 }] });
  render(<AgenciesTab csrfToken="token" />);
  expect(await screen.findByText('PIXELA')).toBeInTheDocument();
  expect(screen.getByText('เพิ่มข้อมูลจาก YouTube')).toBeInTheDocument();
});

it('shows the YouTube import prompt', async () => {
  mockFetch();

  render(<YouTubeImport csrfToken="token" onClose={() => {}} onSaved={() => {}} />);

  expect(await screen.findByText('Channel ID / @handle / ลิงก์')).toBeInTheDocument();
});

it('shows an empty snapshot history for a channel without stats', async () => {
  mockFetch();

  render(<Snapshots channel={{ id: 3, name: 'Aiko' }} csrfToken="token" />);

  expect(await screen.findByText('ยังไม่มีสถิติ')).toBeInTheDocument();
});

it('shows the channels console with an empty library', async () => {
  mockFetch();

  render(<ChannelsTab csrfToken="token" />);

  expect(await screen.findByText('คลังช่อง VTuber')).toBeInTheDocument();
  expect(await screen.findByText('ยังไม่มีช่อง VTuber')).toBeInTheDocument();
});

it('lists channels with their platform labels', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ id: 1, name: 'Aiko', slug: 'aiko', agency_name: 'Indie', platform: 'youtube', is_active: 1 }],
      }),
    }),
  );

  render(<ChannelsTab csrfToken="token" />);

  expect(await screen.findByText('Aiko')).toBeInTheDocument();
  expect(await screen.findByText('YouTube')).toBeInTheDocument();
});

it('submits only channel contract fields when editing', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, id: 1 }) });
  vi.stubGlobal('fetch', fetchMock);
  const { container } = render(
    <ChannelForm
      value={{ ...blank, id: 1, name: 'Aiko', slug: 'aiko', created_at: 'x', updated_at: 'y' }}
      csrfToken="token"
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );

  fireEvent.submit(container.querySelector('form'));

  await waitFor(() => expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'PUT')).toBe(true));
  const sent = JSON.parse(fetchMock.mock.calls.find(([, options]) => options?.method === 'PUT')[1].body);
  expect(sent).not.toHaveProperty('id');
  expect(sent).not.toHaveProperty('created_at');
  expect(Object.keys(sent).sort()).toEqual([...channelFields].sort());
});

it('submits only user contract fields when editing', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, id: 'u2' }) });
  vi.stubGlobal('fetch', fetchMock);
  const { container } = render(
    <UserForm
      value={{ id: 'u2', username: 'biko', display_name: 'Biko', email: 'b@example.com', role: 'staff', status: 'active', password: '', created_at: 'x' }}
      csrfToken="token"
      onClose={() => {}}
      onSaved={() => {}}
    />,
  );

  fireEvent.submit(container.querySelector('form'));

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(sent).toEqual({ display_name: 'Biko', email: 'b@example.com', role: 'staff', status: 'active', password: '' });
});

it('recovers from a failed channels request without crashing', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockRejectedValueOnce(new Error('Channel service unavailable'))
    .mockResolvedValue({ ok: true, json: async () => ({ results: [] }) }));
  render(<ChannelsTab csrfToken="token" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Channel service unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }));
  expect(await screen.findByText('ยังไม่มีช่อง VTuber')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('does not expose default settings after a failed load and allows retry', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockRejectedValueOnce(new Error('Settings unavailable'))
    .mockResolvedValue({ ok: true, json: async () => ({ results: [{ setting_key: 'site_name', setting_value: 'VTuber Thai' }] }) }));
  render(<SettingsTab csrfToken="token" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Settings unavailable');
  expect(screen.queryByRole('button', { name: 'บันทึกการตั้งค่า' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }));
  expect(await screen.findByLabelText('ชื่อเว็บไซต์')).toHaveValue('VTuber Thai');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('reports snapshot load failure instead of claiming there are no stats', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Snapshots unavailable')));
  render(<Snapshots channel={{ id: 3, name: 'Aiko' }} csrfToken="token" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Snapshots unavailable');
  expect(screen.queryByText('ยังไม่มีสถิติ')).not.toBeInTheDocument();
});

it('limits category editing to managers', async () => {
  mockFetch({ results: [{ id: 'followers', name: 'Followers', slug: 'followers', sort_order: 1, status: 'active' }] });
  const view = render(<CategoriesTab csrfToken="token" isManager={false} />);
  await screen.findByText('Followers');
  expect(screen.queryByRole('button', { name: 'แก้ไข' })).not.toBeInTheDocument();
  view.rerender(<CategoriesTab csrfToken="token" isManager />);
  expect(screen.getByRole('button', { name: 'แก้ไข' })).toBeInTheDocument();
});

it('shows failures when disabling a user', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_, options) => options?.method === 'PUT'
    ? { ok: false, status: 409, json: async () => ({ message: 'Cannot disable this user' }) }
    : { ok: true, json: async () => ({ results: [{ id: 'u2', display_name: 'Staff', username: 'staff', status: 'active', role: 'staff' }] }) }));
  render(<UsersTab csrfToken="token" currentUser={{ id: 'u1' }} />);
  fireEvent.click(await screen.findByRole('button', { name: 'ปิดใช้งาน' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot disable this user');
});

it('announces a successful settings save', async () => {
  mockFetch({ results: [{ setting_key: 'site_name', setting_value: 'VTuber Thai' }, { setting_key: 'current_ranking_period', setting_value: '2026-09' }] });
  render(<SettingsTab csrfToken="token" />);
  const input = await screen.findByLabelText('ชื่อเว็บไซต์');
  fireEvent.submit(input.closest('form'));
  expect(await screen.findByRole('status')).toHaveTextContent('บันทึกการตั้งค่าแล้ว');
  fireEvent.change(input, { target: { value: 'Changed' } });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('names the user editor dialog and supports Escape', async () => {
  const onClose = vi.fn();
  render(<UserForm value={{ username: '', display_name: '', email: '', role: 'staff', status: 'active', password: '' }} csrfToken="token" onClose={onClose} onSaved={() => {}} />);
  expect(screen.getByRole('dialog', { name: 'เพิ่มผู้ใช้' })).toBeInTheDocument();
  fireEvent.keyDown(document.activeElement, { key: 'Escape', code: 'Escape' });
  await waitFor(() => expect(onClose).toHaveBeenCalled());
});

it('does not replace current rankings with a slower previous filter response', async () => {
  let finishOld;
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async url => {
    const category = new URL(String(url), 'http://localhost').searchParams.get('category');
    if (category === 'followers' && !finishOld) {
      return new Promise(resolve => { finishOld = () => resolve({ ok: true, json: async () => ({ results: [{ id: 'old', rank: 1, name: 'Old result', followers: 10 }] }) }); });
    }
    return { ok: true, json: async () => ({ results: [{ id: category, rank: 1, name: 'Current views', total_views: 500 }] }) };
  }));
  render(<RankingsTab csrfToken="token" isManager={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'ยอดดู' }));
  expect(await screen.findByText('Current views')).toBeInTheDocument();
  await act(async () => finishOld());
  await waitFor(() => expect(screen.queryByText('Old result')).not.toBeInTheDocument());
  expect(screen.getByText('Current views')).toBeInTheDocument();
});
