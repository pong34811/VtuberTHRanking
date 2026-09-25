import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { directoryAPI } from '@/api/client';
import { CreatorCard, directoryAddedDate } from '@/pages/discovery/CreatorCard';
import DiscoveryHome from '@/pages/discovery/DiscoveryHome';

vi.mock('@/api/client', () => ({
  directoryAPI: { getList: vi.fn() },
}));

const aiko = {
  id: 1,
  name: 'Aiko',
  slug: 'aiko',
  avatar: '',
  category: 'gaming',
  affiliation: 'indie',
  created_at: '2026-09-01 00:00:00',
};
const page = {
  total: 1,
  count: 1,
  limit: 12,
  offset: 0,
  results: [aiko],
  category_counts: [{ category: 'gaming', count: 1 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  directoryAPI.getList.mockResolvedValue({ data: page });
});

afterEach(() => cleanup());

function CurrentLocation() {
  const location = useLocation();
  return <output data-testid="current-location">{location.pathname + location.search}</output>;
}

describe('Discovery home renderer', () => {
  it('orders newest mode by directory addition date', async () => {
    render(<MemoryRouter><DiscoveryHome templateId="newest-first" /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: /Aiko/ })).toBeInTheDocument();
    expect(directoryAPI.getList).toHaveBeenCalledWith({ sort: 'created_at_desc', limit: 12, offset: 0 });
    expect(screen.getByRole('heading', { name: 'เพิ่มเข้ารายการล่าสุด' })).toBeInTheDocument();
    expect(screen.getByText('วันที่แสดงคือวันที่เพิ่มช่องเข้าทำเนียบ')).toBeInTheDocument();
    expect(screen.getByText(directoryAddedDate(aiko.created_at).label)).toHaveAttribute('datetime', '2026-09-01T00:00:00.000Z');
  });

  it('requests each nonempty category independently of the first result page', async () => {
    directoryAPI.getList.mockImplementation(params => Promise.resolve({ data: params.category
      ? { total: 1, count: 1, results: [{ id: 2, name: 'Biko', slug: 'biko', category: params.category, affiliation: 'indie', avatar: '', created_at: null }], category_counts: [] }
      : { total: 20, count: 1, results: [], category_counts: [{ category: 'singing', count: 20 }] }
    }));
    render(<MemoryRouter><DiscoveryHome templateId="category-first" /></MemoryRouter>);
    expect(await screen.findByRole('link', { name: /Biko/ })).toBeInTheDocument();
    expect(directoryAPI.getList).toHaveBeenCalledWith({ category: 'singing', sort: 'name', limit: 3, offset: 0 });
    expect(screen.getByRole('link', { name: /ร้องเพลง.*20/ })).toHaveAttribute('href', '/search?category=singing');
  });

  it('keeps category counts available when one category sample fails', async () => {
    directoryAPI.getList.mockImplementation(params => params.category
      ? Promise.reject(new Error('unavailable'))
      : Promise.resolve({ data: { ...page, results: [], category_counts: [{ category: 'singing', count: 20 }] } }));
    render(<MemoryRouter><DiscoveryHome templateId="category-first" /></MemoryRouter>);
    expect(await screen.findByText('โหลดรายชื่อในหมวดหมู่นี้ไม่สำเร็จ')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ร้องเพลง.*20/ })).toHaveAttribute('href', '/search?category=singing');
    expect(directoryAPI.getList).toHaveBeenCalledWith({ category: 'singing', sort: 'name', limit: 3, offset: 0 });
  });

  it('never invents a directory-added date', () => {
    expect(directoryAddedDate('invalid')).toBeNull();
    expect(directoryAddedDate(null)).toBeNull();
    expect(directoryAddedDate('2026-02-30 00:00:00')).toBeNull();
    expect(directoryAddedDate('2026-09-20 00:00:00').iso).toBe('2026-09-20T00:00:00.000Z');
  });

  it('contains search submit and creator links in Admin preview', async () => {
    render(<MemoryRouter initialEntries={['/admin/homepage']}><CurrentLocation /><DiscoveryHome previewMode /></MemoryRouter>);
    await screen.findByRole('link', { name: /Aiko/ });
    fireEvent.change(screen.getByLabelText('ค้นหาชื่อ VTuber'), { target: { value: 'Aiko' } });
    fireEvent.submit(screen.getByRole('search'));
    fireEvent.click(screen.getByRole('link', { name: /Aiko/ }));
    expect(screen.getByTestId('current-location')).toHaveTextContent('/admin/homepage');
  });

  it('retries a failed directory request', async () => {
    directoryAPI.getList.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue({ data: page });
    render(<MemoryRouter><DiscoveryHome /></MemoryRouter>);
    await screen.findByText('โหลดรายชื่อไม่สำเร็จ กรุณาลองอีกครั้ง');
    fireEvent.click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }));
    expect(await screen.findByRole('link', { name: /Aiko/ })).toBeInTheDocument();
  });

  it('keeps newer template results when an old request finishes late', async () => {
    let finishOld;
    const biko = { ...aiko, id: 2, name: 'Biko', slug: 'biko' };
    directoryAPI.getList.mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; })).mockResolvedValue({ data: { ...page, results: [biko] } });
    const { rerender } = render(<MemoryRouter><DiscoveryHome templateId="search-first" /></MemoryRouter>);
    rerender(<MemoryRouter><DiscoveryHome templateId="newest-first" /></MemoryRouter>);
    await screen.findByRole('link', { name: /Biko/ });
    await act(async () => finishOld({ data: page }));
    expect(screen.queryByRole('link', { name: /Aiko/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Biko/ })).toBeInTheDocument();
  });

  it('shows an empty state and search link for an empty directory', async () => {
    directoryAPI.getList.mockResolvedValue({ data: { ...page, total: 0, count: 0, results: [], category_counts: [] } });
    render(<MemoryRouter><DiscoveryHome /></MemoryRouter>);
    expect(await screen.findByText('ยังไม่มีรายชื่อให้แสดง')).toBeInTheDocument();
    expect(screen.getAllByRole('link').some(link => link.getAttribute('href') === '/search')).toBe(true);
  });

  it('falls back to an initial when a creator image fails', () => {
    const { container } = render(<MemoryRouter><CreatorCard creator={{ ...aiko, avatar: 'https://example.com/aiko.png' }} /></MemoryRouter>);
    fireEvent.error(container.querySelector('img'));
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('A')).toBeInTheDocument();
  });
});
