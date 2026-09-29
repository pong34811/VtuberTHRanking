import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import { rankingsAPI, summaryAPI } from '@/api/client';

vi.mock('@/api/client', () => ({
  rankingsAPI: { getList: vi.fn() },
  summaryAPI: { get: vi.fn() },
}));
vi.mock('@/components/ThemeSelector', () => ({ default: () => null }));

function renderStats(path = '/stats') {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
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
  it('keeps ranking controls usable when the summary fails', async () => {
    summaryAPI.get.mockRejectedValue(new Error('summary unavailable'));
    renderStats();

    expect(await screen.findByText('โหลดข้อมูลภาพรวมไม่สำเร็จ')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ยอดวิว' }));
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenLastCalledWith({ period: 'monthly', category: 'views', limit: 100, offset: 0 }));
    fireEvent.click(screen.getByRole('button', { name: 'ทั้งหมด' }));
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenLastCalledWith({ period: 'alltime', category: 'views', limit: 100, offset: 0 }));
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
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenCalledWith({ period: 'alltime', category: 'followers', limit: 100, offset: 0 }));
    fireEvent.click(screen.getByRole('link', { name: 'วีทูปเบอร์อิสระ' }));
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenLastCalledWith({
      period: 'alltime', category: 'followers', affiliation: 'indie', limit: 100, offset: 0,
    }));
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
    });
    expect(screen.getByText('แสดง 101 จาก 101 ช่อง')).toBeInTheDocument();
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
