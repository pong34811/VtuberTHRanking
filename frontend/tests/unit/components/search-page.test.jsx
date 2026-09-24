import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
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

function CurrentSearch() {
  return <output data-testid="current-search">{useLocation().search}</output>;
}

function SearchNavigation() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate('/search?q=Biko&category=singing')}>อีกคำค้น</button>
      <button onClick={() => navigate(-1)}>ย้อนกลับ</button>
      <CurrentSearch />
      <SearchPage />
    </>
  );
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

describe('Search page directory URL filters', () => {
  it('prefills encoded Thai search and clears URL filters permanently', async () => {
    render(
      <MemoryRouter initialEntries={['/search?q=%E0%B8%A1%E0%B8%B4%E0%B8%81%E0%B8%B8&category=gaming&affiliation=indie']}>
        <CurrentSearch />
        <SearchPage />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText('ชื่อช่อง')).toHaveValue('มิกุ');
    expect(screen.getByLabelText('ประเภทเนื้อหา')).toHaveValue('gaming');
    await waitFor(() => expect(vtubersAPI.getList).toHaveBeenLastCalledWith({ q: 'มิกุ', category: 'gaming', affiliation: 'indie' }));
    fireEvent.click(screen.getByRole('button', { name: 'ล้างตัวกรอง' }));
    await waitFor(() => expect(vtubersAPI.getList).toHaveBeenLastCalledWith({ q: '', category: '', affiliation: '' }));
    expect(screen.getByLabelText('ชื่อช่อง')).toHaveValue('');
    expect(screen.getByTestId('current-search')).toHaveTextContent('');
  });

  it('ignores unsupported metadata query filters', async () => {
    render(<MemoryRouter initialEntries={['/search?category=unknown&affiliation=unknown']}><SearchPage /></MemoryRouter>);

    await waitFor(() => expect(vtubersAPI.getList).toHaveBeenLastCalledWith({ q: '', category: '', affiliation: '' }));
    expect(screen.getByLabelText('ประเภทเนื้อหา')).toHaveValue('');
    expect(screen.getByLabelText('สังกัด')).toHaveValue('');
  });

  it('updates filters for navigation and restores them on back', async () => {
    render(<MemoryRouter initialEntries={['/search?q=Aiko&category=gaming']}><SearchNavigation /></MemoryRouter>);

    await waitFor(() => expect(vtubersAPI.getList).toHaveBeenLastCalledWith({ q: 'Aiko', category: 'gaming', affiliation: '' }));
    fireEvent.click(screen.getByRole('button', { name: 'อีกคำค้น' }));
    await waitFor(() => expect(vtubersAPI.getList).toHaveBeenLastCalledWith({ q: 'Biko', category: 'singing', affiliation: '' }));
    expect(screen.getByLabelText('ชื่อช่อง')).toHaveValue('Biko');
    fireEvent.click(screen.getByRole('button', { name: 'ย้อนกลับ' }));
    await waitFor(() => expect(vtubersAPI.getList).toHaveBeenLastCalledWith({ q: 'Aiko', category: 'gaming', affiliation: '' }));
    expect(screen.getByLabelText('ประเภทเนื้อหา')).toHaveValue('gaming');
  });
});
