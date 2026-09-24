import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SearchPage from '@/pages/SearchPage';
import ProfilePage from '@/pages/ProfilePage';
import { vtubersAPI } from '@/api/client';
import { localDateTime } from '@/admin/channels/Snapshots';

vi.mock('@/api/client', () => ({
  vtubersAPI: { getList: vi.fn(), getBySlug: vi.fn(), getHistory: vi.fn() },
}));
afterEach(() => vi.clearAllMocks());

it('can filter channels in the other category', async () => {
  vtubersAPI.getList.mockResolvedValue({ data: { results: [] } });
  render(<MemoryRouter><SearchPage /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('ประเภทเนื้อหา'), { target: { value: 'other' } });
  await screen.findByText('ไม่พบช่องที่ตรงกับตัวกรอง');
  expect(vtubersAPI.getList).toHaveBeenLastCalledWith({ q: '', category: 'other', affiliation: '' });
});

it('uses the profile image and falls back if it fails', async () => {
  vtubersAPI.getBySlug.mockResolvedValue({ data: { name: 'Aiko', avatar: 'https://example.com/aiko.png' } });
  vtubersAPI.getHistory.mockResolvedValue({ data: { history: [] } });
  const { container } = render(<MemoryRouter><ProfilePage /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'Aiko' });
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
