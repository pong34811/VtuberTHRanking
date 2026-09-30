import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ProfilePage from '@/pages/ProfilePage';
import { vtubersAPI } from '@/api/client';
import { localDateTime } from '@/admin/channels/Snapshots';

vi.mock('@/api/client', () => ({
  vtubersAPI: { getList: vi.fn(), getBySlug: vi.fn(), getHistory: vi.fn() },
}));
afterEach(() => vi.clearAllMocks());

it('uses the profile image and falls back if it fails', async () => {
  vtubersAPI.getBySlug.mockResolvedValue({ data: { name: 'Aiko', avatar: 'https://example.com/aiko.png' } });
  vtubersAPI.getHistory.mockResolvedValue({ data: { history: [] } });
  const { container } = render(<MemoryRouter><ProfilePage /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Aiko' });
  expect(screen.getByRole('link', { name: /กลับไปสำรวจ VTuber/ })).toHaveAttribute('href', '/discover');
  const avatar = container.querySelector('img');
  expect(avatar).toHaveAttribute('src', 'https://example.com/aiko.png');
  fireEvent.error(avatar);
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByText('A')).toBeInTheDocument();
});

it('formats snapshot datetime-local values without shifting the local clock', () => {
  const date = new Date(2026, 8, 17, 17, 30);
  expect(localDateTime(date)).toBe('2026-09-17T17:30');
});

it('shows current profile ranks and distinguishes missing rankings', async () => {
  vtubersAPI.getBySlug.mockResolvedValue({ data: { name: 'Aiko', current_rank: { monthly_followers: 2, alltime_videos: 7 } } });
  vtubersAPI.getHistory.mockResolvedValue({ data: { history: [] } });
  render(<MemoryRouter><ProfilePage /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'อันดับปัจจุบัน' });
  expect(screen.getByText('#2')).toBeInTheDocument();
  expect(screen.getByText('#7')).toBeInTheDocument();
  expect(screen.getAllByText('ยังไม่มีอันดับ')).toHaveLength(4);
});

it('offers discovery recovery instead of retrying a permanent missing profile', async () => {
  vtubersAPI.getBySlug.mockRejectedValue({ response: { status: 404 } });
  vtubersAPI.getHistory.mockRejectedValue({ response: { status: 404 } });
  render(<MemoryRouter><ProfilePage /></MemoryRouter>);

  expect(await screen.findByRole('heading', { name: 'ไม่พบช่องนี้', level: 1 })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'ค้นหาช่องในค้นพบ' })).toHaveAttribute('href', '/discover');
  expect(screen.queryByRole('button', { name: 'ลองอีกครั้ง' })).not.toBeInTheDocument();
});

it('shows a safe YouTube creator action, latest snapshot time and video count', async () => {
  vtubersAPI.getBySlug.mockResolvedValue({ data: {
    name: 'Aiko', channel_url: 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv',
    latest_stats: { followers: 123, total_views: 456, video_count: 7, recorded_at: '2026-09-01T00:00:00.000Z' },
  } });
  vtubersAPI.getHistory.mockResolvedValue({ data: { history: [] } });
  const { container } = render(<MemoryRouter><ProfilePage /></MemoryRouter>);

  const action = await screen.findByRole('link', { name: 'ดูช่องบน YouTube' });
  expect(action).toHaveAttribute('href', 'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv');
  expect(action).toHaveAttribute('rel', 'noopener noreferrer');
  expect(container.querySelector('time')).toHaveAttribute('dateTime', '2026-09-01T00:00:00.000Z');
  expect(screen.getByRole('heading', { name: 'จำนวนคลิป' }).parentElement).toHaveTextContent('7');
});
