import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { vtubersAPI } from '@/api/client';
import SearchPage from '@/pages/SearchPage';

vi.mock('@/api/client', () => ({
  vtubersAPI: { getList: vi.fn(), getBySlug: vi.fn(), getHistory: vi.fn() },
  compareAPI: { post: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vtubersAPI.getList.mockResolvedValue({ data: { results: [] } });
});

afterEach(() => cleanup());

function renderSearchPage() {
  return render(<MemoryRouter><SearchPage /></MemoryRouter>);
}

describe('Search page follower filters', () => {
  it('sends the follower range and sort to the API and shows current followers', async () => {
    vtubersAPI.getList.mockResolvedValue({
      data: {
        results: [{ id: 1, name: 'Aiko', slug: 'aiko', category: 'gaming', affiliation: 'indie', followers: 450 }],
      },
    });
    renderSearchPage();
    expect(await screen.findByText('450 ผู้ติดตาม')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('ผู้ติดตามตั้งแต่'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('ผู้ติดตามถึง'), { target: { value: '900' } });
    fireEvent.change(screen.getByLabelText('เรียงผลลัพธ์'), { target: { value: 'followers_desc' } });

    await waitFor(() => expect(vtubersAPI.getList).toHaveBeenLastCalledWith({
      q: '',
      category: '',
      affiliation: '',
      min_followers: 100,
      max_followers: 900,
      sort: 'followers_desc',
    }));
  });

  it('explains an inverted follower range and offers to clear all filters', async () => {
    renderSearchPage();
    await screen.findByText('ผลการค้นหา');

    fireEvent.change(screen.getByLabelText('ผู้ติดตามตั้งแต่'), { target: { value: '900' } });
    fireEvent.change(screen.getByLabelText('ผู้ติดตามถึง'), { target: { value: '100' } });

    expect(screen.getByRole('alert')).toHaveTextContent('จำนวนขั้นต่ำต้องไม่เกินจำนวนสูงสุด');
    fireEvent.click(screen.getByRole('button', { name: 'ล้างตัวกรอง' }));
    expect(screen.getByLabelText('ผู้ติดตามตั้งแต่')).toHaveValue(null);
    expect(screen.getByLabelText('ผู้ติดตามถึง')).toHaveValue(null);
    expect(screen.getByLabelText('เรียงผลลัพธ์')).toHaveValue('name');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
