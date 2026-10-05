import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProfilePage from '@/pages/ProfilePage';
import LeaderboardTable from '@/components/LeaderboardTable';
import CreatorCard from '@/pages/discovery/CreatorCard';
import { vtubersAPI } from '@/api/client';
import { localDateTime } from '@/admin/channels/Snapshots';

vi.mock('@/api/client', () => ({
  vtubersAPI: { getList: vi.fn(), getBySlug: vi.fn(), getHistory: vi.fn() },
}));
afterEach(() => vi.clearAllMocks());

function NavigationTestRoutes({ listing }) {
  const location = useLocation();
  return (
    <>
      {location.pathname.startsWith('/profile/') ? <ProfilePage /> : listing}
      <output data-testid="current-location">{location.pathname}{location.search}</output>
    </>
  );
}

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

it.each(['2026-08', '2026-10'])('labels profile ranks with the actual month %s and enabled metrics', async (month) => {
  vtubersAPI.getBySlug.mockResolvedValue({ data: {
    name: 'Aiko', ranking_month: month,
    category_choices: [{ value: 'views', label: 'ยอดวิวรวม' }],
    current_rank: { monthly_views: 1 },
  } });
  vtubersAPI.getHistory.mockResolvedValue({ data: { history: [] } });
  render(<MemoryRouter><ProfilePage /></MemoryRouter>);
  const heading = await screen.findByRole('heading', { name: 'อันดับปัจจุบัน' });
  const ranks = within(heading.closest('section'));
  const expectedMonth = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' })
    .format(new Date(`${month}-01T00:00:00+07:00`));
  expect(ranks.getByRole('heading', { name: `รายเดือน · ${expectedMonth}` })).toBeInTheDocument();
  expect(ranks.queryByText('เดือนนี้')).not.toBeInTheDocument();
  expect(ranks.queryByText('ผู้ติดตาม')).not.toBeInTheDocument();
  expect(ranks.getAllByText('ยอดวิวรวม')).toHaveLength(2);
  expect(ranks.getByText('#1')).toBeInTheDocument();
  expect(ranks.getByText('ยังไม่มีอันดับ')).toBeInTheDocument();
});

it('explains missing profile month metadata and an empty enabled category list', async () => {
  vtubersAPI.getBySlug.mockResolvedValue({ data: { name: 'Aiko', ranking_month: 'invalid', category_choices: [] } });
  vtubersAPI.getHistory.mockResolvedValue({ data: { history: [] } });
  render(<MemoryRouter><ProfilePage /></MemoryRouter>);
  expect(await screen.findByText('รายเดือน · ไม่ระบุเดือน')).toBeInTheDocument();
  expect(screen.getByText('ยังไม่มีหมวดอันดับที่เปิดใช้งาน')).toBeInTheDocument();
  expect(screen.queryByText('ยังไม่มีอันดับ')).not.toBeInTheDocument();
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

it('returns to the ranking pathname and query after opening a creator profile', async () => {
  vtubersAPI.getBySlug.mockResolvedValue({ data: { name: 'Aiko' } });
  vtubersAPI.getHistory.mockResolvedValue({ data: { history: [] } });
  const rankingPath = '/rankings?period=monthly&category=all';
  render(
    <MemoryRouter initialEntries={[rankingPath]}>
      <Routes>
        <Route path="*" element={<NavigationTestRoutes listing={(
          <LeaderboardTable
            rankings={[{ rank: 1, score: 42, vtuber: { id: 1, slug: 'aiko', name: 'Aiko' } }]}
            loading={false}
          />
        )} />} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('link', { name: /Aiko/ }));
  const backLink = await screen.findByRole('link', { name: /กลับไปสำรวจ VTuber/ });
  expect(backLink).toHaveAttribute('href', rankingPath);
  fireEvent.click(backLink);
  expect(screen.getByTestId('current-location')).toHaveTextContent(rankingPath);
});

it('returns to the discovery pathname and query after opening a creator card', async () => {
  vtubersAPI.getBySlug.mockResolvedValue({ data: { name: 'Aiko' } });
  vtubersAPI.getHistory.mockResolvedValue({ data: { history: [] } });
  const discoveryPath = '/discover?category=gaming&q=aiko&page=2';
  render(
    <MemoryRouter initialEntries={[discoveryPath]}>
      <Routes>
        <Route path="*" element={<NavigationTestRoutes listing={(
          <CreatorCard creator={{
            id: 1,
            slug: 'aiko',
            name: 'Aiko',
            category: 'gaming',
            affiliation: 'independent',
          }} />
        )} />} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.click(screen.getByRole('link', { name: /Aiko/ }));
  const backLink = await screen.findByRole('link', { name: /กลับไปสำรวจ VTuber/ });
  expect(backLink).toHaveAttribute('href', discoveryPath);
  fireEvent.click(backLink);
  expect(screen.getByTestId('current-location')).toHaveTextContent(discoveryPath);
});

it('does not use an external return location from profile navigation state', async () => {
  vtubersAPI.getBySlug.mockResolvedValue({ data: { name: 'Aiko' } });
  vtubersAPI.getHistory.mockResolvedValue({ data: { history: [] } });
  render(
    <MemoryRouter initialEntries={[{
      pathname: '/profile/aiko',
      state: { returnTo: { pathname: '//evil.example/steal', search: '?token=secret' } },
    }]}
    >
      <ProfilePage />
    </MemoryRouter>,
  );

  const backLink = await screen.findByRole('link', { name: /กลับไปสำรวจ VTuber/ });
  expect(backLink).toHaveAttribute('href', '/discover');
});
