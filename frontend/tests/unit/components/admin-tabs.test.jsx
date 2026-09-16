import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function mockFetch(body = { results: [] }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }));
}

afterEach(() => {
  vi.unstubAllGlobals();
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

it('shows the channel editor fields', async () => {
  mockFetch();

  render(<ChannelForm value={{ ...blank }} csrfToken="token" onClose={() => {}} onSaved={() => {}} />);

  expect(await screen.findByText('ชื่อช่อง')).toBeInTheDocument();
  expect(await screen.findByText('หมายเหตุ')).toBeInTheDocument();
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

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
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
