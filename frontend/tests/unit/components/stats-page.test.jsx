import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { rankingsAPI, summaryAPI } from '@/api/client';

vi.mock('@/api/client', () => ({
  rankingsAPI: { getList: vi.fn() },
  summaryAPI: { get: vi.fn() },
}));
vi.mock('@/components/ThemeSelector', () => ({ default: () => null }));

function renderStats(path = '/stats') {
  return render(<MemoryRouter initialEntries={[path]}><Navigation /><App /></MemoryRouter>);
}

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="ranking-url">{location.pathname + location.search}</output><button onClick={() => navigate(-1)}>ย้อนกลับ</button></>;
}

beforeEach(() => {
  vi.clearAllMocks();
  summaryAPI.get.mockResolvedValue({
    data: {
      total_vtubers: 2,
      latest_update: '2026-09-01T00:00:00.000Z',
      period_choices: [{ value: 'monthly', label: 'รายเดือน' }, { value: 'alltime', label: 'ทั้งหมด' }],
      category_choices: [{ value: 'followers', label: 'ผู้ติดตาม' }, { value: 'views', label: 'ยอดวิว' }, { value: 'videos', label: 'จำนวนคลิป' }],
    },
  });
  rankingsAPI.getList.mockResolvedValue({ data: { results: [], total: 0 } });
});

afterEach(() => cleanup());

describe('Stats page', () => {
  it.each(['/?category=followers', '/home', '/stats', '/home?category=followers'])('uses an enabled category at %s without requesting a disabled one', async (path) => {
    summaryAPI.get.mockResolvedValue({ data: { category_choices: [{ value: 'views', label: 'ยอดวิว' }] } });
    renderStats(path);
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenCalledTimes(1));
    expect(rankingsAPI.getList.mock.calls[0][0].category).toBe('views');
    expect(screen.getByRole('button', { name: 'ยอดวิว' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/โหลดอันดับไม่สำเร็จ/)).not.toBeInTheDocument();
  });

  it('does not request rankings when no categories are enabled', async () => {
    summaryAPI.get.mockResolvedValue({ data: { category_choices: [] } });
    renderStats();
    expect(await screen.findByText('ยังไม่มีหมวดอันดับที่เปิดใช้งาน')).toBeInTheDocument();
    expect(rankingsAPI.getList).not.toHaveBeenCalled();
  });

  it.each(['filter', 'unmount'])('aborts old pagination on %s and ignores its late response', async (action) => {
    let resolveOld;
    rankingsAPI.getList.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    const view = renderStats('/home');
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenCalledTimes(1));
    const oldSignal = rankingsAPI.getList.mock.calls[0][1].signal;
    if (action === 'filter') {
      fireEvent.click(screen.getByRole('button', { name: 'ยอดวิว' }));
      await waitFor(() => expect(rankingsAPI.getList).toHaveBeenCalledTimes(2));
    } else view.unmount();
    expect(oldSignal.aborted).toBe(true);
    await act(async () => resolveOld({ data: { total: 2, results: [{ rank: 1, score: 1, vtuber: { name: 'Stale', slug: 'stale' } }] } }));
    expect(rankingsAPI.getList).toHaveBeenCalledTimes(action === 'filter' ? 2 : 1);
    expect(screen.queryByText('Stale')).not.toBeInTheDocument();
    expect(screen.queryByText(/โหลดอันดับไม่สำเร็จ/)).not.toBeInTheDocument();
  });

  it('restores a shared metric, period, archive month and affiliation from the URL', async () => {
    renderStats('/home?period=monthly&category=views&month=2026-08&affiliation=agency');
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenLastCalledWith({ period: 'monthly', category: 'views', month: '2026-08', affiliation: 'agency', limit: 100, offset: 0 }, { signal: expect.any(AbortSignal) }));
    expect(screen.getByRole('button', { name: 'ยอดวิว' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'รายเดือน' })).toHaveAttribute('aria-pressed', 'true');
  });
  it('updates shareable filters and restores them on browser back', async () => {
    renderStats('/stats?affiliation=indie&month=2026-08');
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'ยอดวิว' }));
    expect(screen.getByTestId('ranking-url')).toHaveTextContent('category=views');
    fireEvent.click(screen.getByRole('button', { name: 'ทั้งหมด' }));
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenLastCalledWith({ period: 'alltime', category: 'views', affiliation: 'indie', limit: 100, offset: 0 }, { signal: expect.any(AbortSignal) }));
    fireEvent.click(screen.getByRole('button', { name: 'ย้อนกลับ' }));
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenLastCalledWith({ period: 'monthly', category: 'views', month: '2026-08', affiliation: 'indie', limit: 100, offset: 0 }, { signal: expect.any(AbortSignal) }));
  });

  it('offers published archive months and keeps the selected filters when switching group', async () => {
    summaryAPI.get.mockResolvedValue({ data: {
      ranking_month: '2026-09', available_months: ['2026-09', '2026-08'],
      category_choices: [{ value: 'views', label: 'ยอดวิวรวม' }],
    } });
    renderStats('/stats?period=monthly&category=views&affiliation=agency');
    const month = await screen.findByLabelText('เดือนอันดับ');
    fireEvent.change(month, { target: { value: '2026-08' } });
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenLastCalledWith({ period: 'monthly', category: 'views', month: '2026-08', affiliation: 'agency', limit: 100, offset: 0 }, { signal: expect.any(AbortSignal) }));
    fireEvent.click(screen.getByRole('link', { name: 'วีทูปเบอร์อิสระ' }));
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenLastCalledWith({ period: 'monthly', category: 'views', month: '2026-08', affiliation: 'indie', limit: 100, offset: 0 }, { signal: expect.any(AbortSignal) }));
    expect(screen.getByRole('heading', { name: /ยอดสะสม ณ เดือน 2026-08/ })).toBeInTheDocument();
  });
  it('keeps ranking controls usable when the summary fails', async () => {
    summaryAPI.get.mockRejectedValue(new Error('summary unavailable'));
    renderStats();

    expect(await screen.findByText('โหลดข้อมูลภาพรวมไม่สำเร็จ')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ยอดวิว' }));
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenLastCalledWith({ period: 'monthly', category: 'views', limit: 100, offset: 0 }, { signal: expect.any(AbortSignal) }));
    fireEvent.click(screen.getByRole('button', { name: 'ทั้งหมด' }));
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenLastCalledWith({ period: 'alltime', category: 'views', limit: 100, offset: 0 }, { signal: expect.any(AbortSignal) }));
  });

  it('retries rankings without refetching the successful summary', async () => {
    rankingsAPI.getList.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue({ data: { results: [], total: 0 } });
    renderStats();

    await screen.findByText('โหลดอันดับไม่สำเร็จ กรุณาลองอีกครั้ง');
    fireEvent.click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }));
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenCalledTimes(2));
    expect(summaryAPI.get).toHaveBeenCalledTimes(1);
    expect(screen.getByText('วิธีจัดอันดับ')).toBeInTheDocument();
  });

  it('opens the all ranking at /home and filters the ranking menu by affiliation', async () => {
    renderStats('/home');
    expect(await screen.findByRole('heading', { name: 'อันดับวีทูปเบอร์ไทยทั้งหมด', level: 1 })).toBeInTheDocument();
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenCalledWith({ period: 'alltime', category: 'followers', limit: 100, offset: 0 }, { signal: expect.any(AbortSignal) }));
    fireEvent.click(screen.getByRole('link', { name: 'วีทูปเบอร์อิสระ' }));
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenLastCalledWith({
      period: 'alltime', category: 'followers', affiliation: 'indie', limit: 100, offset: 0,
    }, { signal: expect.any(AbortSignal) }));
    expect(await screen.findByRole('heading', { name: 'อันดับวีทูปเบอร์อิสระ', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'วีทูปเบอร์อิสระ' })).toHaveAttribute('aria-current', 'page');
  });

  it('loads every page of an affiliation ranking', async () => {
    const row = index => ({ rank: index + 1, score: 100 - index, rank_change: 0, vtuber: {
      id: index + 1, slug: `channel-${index}`, name: `Channel ${index}`, category: 'gaming', affiliation: 'agency',
    } });
    rankingsAPI.getList
      .mockResolvedValueOnce({ data: { results: Array.from({ length: 100 }, (_, index) => row(index)), total: 101 } })
      .mockResolvedValueOnce({ data: { results: [row(100)], total: 101 } });
    renderStats('/home?affiliation=agency');
    expect(await screen.findByRole('link', { name: /Channel 100/ })).toBeInTheDocument();
    expect(rankingsAPI.getList).toHaveBeenNthCalledWith(2, {
      period: 'alltime', category: 'followers', affiliation: 'agency', limit: 100, offset: 100,
    }, { signal: expect.any(AbortSignal) });
    expect(screen.getByText('แสดง 101 จาก 101 ช่อง')).toBeInTheDocument();
  });

  it('shows the latest snapshot time explicitly in Bangkok time', async () => {
    renderStats('/home');

    expect(await screen.findByText(/เวลาไทย/)).toBeInTheDocument();
    expect(screen.getByText(/07:00/)).toBeInTheDocument();
  });

  it('explains that monthly rankings are cumulative snapshots, not monthly gains', async () => {
    renderStats('/home?period=monthly&month=2026-08');

    expect(await screen.findByText(/ยอดสะสมของ snapshot ณ เดือนที่เลือก ไม่ใช่ยอดที่เพิ่มขึ้นในเดือนนั้น/)).toBeInTheDocument();
  });

  it.each(['/home?period=monthly', '/stats'])('shows a dash for every monthly movement at %s and restores alltime indicators', async path => {
    const results = [null, 'NEW', 0, 2, -3].map((change, index) => ({
      rank: index + 1, score: 100 - index, rank_change: change,
      vtuber: { id: index + 1, name: `Channel ${index}`, slug: `channel-${index}`, category: 'gaming', affiliation: 'indie' },
    }));
    rankingsAPI.getList.mockResolvedValue({ data: { results, total: results.length } });
    renderStats(path);
    await screen.findByRole('table');
    expect(screen.getAllByLabelText('ไม่แสดงการเปลี่ยนแปลงอันดับรายเดือน')).toHaveLength(5);
    screen.getAllByLabelText('ไม่แสดงการเปลี่ยนแปลงอันดับรายเดือน').forEach(cell => expect(cell).toHaveTextContent(/^\-$/));
    expect(screen.queryByText('NEW')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ทั้งหมด' }));
    expect(await screen.findAllByText('NEW')).toHaveLength(2);
    expect(screen.getByLabelText('อันดับไม่เปลี่ยน')).toHaveTextContent('—');
    expect(screen.getByLabelText('ขึ้นมา 2 อันดับ')).toHaveTextContent('↑2');
    expect(screen.getByLabelText('ลงไป 3 อันดับ')).toHaveTextContent('↓3');
    fireEvent.click(screen.getByRole('button', { name: 'รายเดือน' }));
    await screen.findAllByLabelText('ไม่แสดงการเปลี่ยนแปลงอันดับรายเดือน');
    fireEvent.click(screen.getByRole('link', { name: 'วีทูปเบอร์อิสระ' }));
    await screen.findByRole('table');
    expect(screen.queryByRole('columnheader', { name: 'เปลี่ยนแปลง' })).not.toBeInTheDocument();
  });

  it('filters fetched rankings by a shareable name query and clears it without losing other filters', async () => {
    const row = (id, name) => ({ rank: id, score: 100 - id, rank_change: 0, vtuber: {
      id, slug: name.toLowerCase().replaceAll(' ', '-'), name, category: 'gaming', affiliation: 'indie',
    } });
    rankingsAPI.getList.mockResolvedValue({ data: { results: [row(1, 'Alpha Channel'), row(2, 'Beta Channel')], total: 2 } });
    renderStats('/home?period=monthly&category=views&month=2026-08&affiliation=indie');

    const search = await screen.findByRole('searchbox', { name: 'ค้นหาชื่อช่อง' });
    await screen.findByRole('link', { name: /Alpha Channel/ });
    fireEvent.change(search, { target: { value: 'alpha' } });

    await waitFor(() => expect(screen.getByTestId('ranking-url')).toHaveTextContent(/q=alpha/));
    expect(screen.getByTestId('ranking-url')).toHaveTextContent(/period=monthly/);
    expect(screen.getByTestId('ranking-url')).toHaveTextContent(/category=views/);
    expect(screen.getByTestId('ranking-url')).toHaveTextContent(/month=2026-08/);
    expect(screen.getByTestId('ranking-url')).toHaveTextContent(/affiliation=indie/);
    expect(screen.getByRole('link', { name: /Alpha Channel/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Beta Channel/ })).not.toBeInTheDocument();
    expect(screen.getByText('แสดง 1 จาก 2 ช่อง')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'missing' } });
    expect(await screen.findByText('ไม่พบช่องที่ตรงกับการค้นหา')).toBeInTheDocument();
    expect(screen.getByText('แสดง 0 จาก 2 ช่อง')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ล้างการค้นหา' }));
    expect(search).toHaveValue('');
    await waitFor(() => expect(screen.getByTestId('ranking-url')).not.toHaveTextContent(/q=/));
    expect(screen.getByTestId('ranking-url')).toHaveTextContent(/period=monthly/);
    expect(screen.getByTestId('ranking-url')).toHaveTextContent(/category=views/);
    expect(screen.getByTestId('ranking-url')).toHaveTextContent(/month=2026-08/);
    expect(screen.getByTestId('ranking-url')).toHaveTextContent(/affiliation=indie/);
    expect(screen.getByRole('link', { name: /Beta Channel/ })).toBeInTheDocument();
    expect(screen.getByText('แสดง 2 จาก 2 ช่อง')).toBeInTheDocument();
    expect(rankingsAPI.getList).toHaveBeenCalledTimes(1);
  });

  it('clears the previous group count when a new group fails to load', async () => {
    rankingsAPI.getList
      .mockResolvedValueOnce({ data: { results: [], total: 12 } })
      .mockRejectedValueOnce(new Error('unavailable'));
    renderStats('/home');
    const count = (await screen.findByText('ช่องในอันดับที่เลือก')).closest('article').querySelector('strong');
    await waitFor(() => expect(count).toHaveTextContent('12'));
    fireEvent.click(screen.getByRole('link', { name: 'วีทูปเบอร์อิสระ' }));
    expect(await screen.findByText('โหลดอันดับไม่สำเร็จ กรุณาลองอีกครั้ง')).toBeInTheDocument();
    expect(count).toHaveTextContent('—');
  });
});
