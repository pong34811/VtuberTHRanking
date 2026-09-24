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

function renderStats() {
  return render(<MemoryRouter initialEntries={['/stats']}><App /></MemoryRouter>);
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
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenLastCalledWith({ period: 'monthly', category: 'views', limit: 50 }));
    fireEvent.click(screen.getByRole('button', { name: 'ทั้งหมด' }));
    await waitFor(() => expect(rankingsAPI.getList).toHaveBeenLastCalledWith({ period: 'alltime', category: 'views', limit: 50 }));
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
});
