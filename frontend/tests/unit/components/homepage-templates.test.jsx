import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { directoryAPI, homepageConfigAPI, rankingsAPI, summaryAPI } from '@/api/client';
import HomePage from '@/pages/HomePage';
import { HOMEPAGE_TEMPLATES } from '@/pages/homepageTemplates';

vi.mock('@/api/client', () => ({
  directoryAPI: { getList: vi.fn() },
  homepageConfigAPI: { get: vi.fn() },
  rankingsAPI: { getList: vi.fn() },
  summaryAPI: { get: vi.fn() },
}));

const aiko = { id: 1, name: 'Aiko', slug: 'aiko', category: 'gaming', affiliation: 'indie', avatar: '', created_at: '2026-09-01 00:00:00' };
const directoryPage = { total: 1, count: 1, results: [aiko], category_counts: [{ category: 'gaming', count: 1 }] };

function renderHome(props = {}, initialEntry = '/') {
  return render(<MemoryRouter initialEntries={[initialEntry]}><CurrentPath /><HomePage {...props} /></MemoryRouter>);
}

function CurrentPath() {
  const location = useLocation();
  return <output data-testid="current-path">{location.pathname + location.search}</output>;
}

beforeEach(() => {
  vi.clearAllMocks();
  directoryAPI.getList.mockResolvedValue({ data: directoryPage });
  homepageConfigAPI.get.mockResolvedValue({ data: { template: 'search-first' } });
  rankingsAPI.getList.mockResolvedValue({ data: { results: [], total: 0 } });
  summaryAPI.get.mockResolvedValue({ data: {} });
});
afterEach(() => cleanup());

describe('homepage template registry', () => {
  it.each([
    ['search-first', 'ค้นหาก่อน', 'ค้นหา'],
    ['category-first', 'เลือกหมวดหมู่', 'หมวดหมู่'],
    ['newest-first', 'เพิ่มเข้ารายการล่าสุด', 'วันที่เพิ่ม'],
  ])('registry describes %s with its agreed metadata', (id, label, hint) => {
    expect(HOMEPAGE_TEMPLATES[id]).toMatchObject({ id, label, description: expect.stringContaining(hint) });
    expect(HOMEPAGE_TEMPLATES[id]).not.toHaveProperty('sectionOrder');
  });
});

describe('homepage template rendering', () => {
  it.each([
    ['search-first', 'ค้นพบ VTuber ไทย'],
    ['category-first', 'ค้นพบผ่านหมวดหมู่'],
    ['newest-first', 'เพิ่มเข้ารายการล่าสุด'],
  ])('renders the published %s directory', async (template, title) => {
    homepageConfigAPI.get.mockResolvedValue({ data: { template } });
    const { container } = renderHome();

    expect(await screen.findByRole('link', { name: /Aiko/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(container.querySelector('.homepage')).toHaveAttribute('data-template', template);
    expect(screen.getByRole('link', { name: /ดูสถิติ/ })).toHaveAttribute('href', '/stats');
    expect(summaryAPI.get).not.toHaveBeenCalled();
    expect(rankingsAPI.getList).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', {}],
    ['invalid', { template: 'custom-layout' }],
    ['legacy', { template: 'discovery-first' }],
  ])('uses search-first when public configuration is %s', async (_label, config) => {
    homepageConfigAPI.get.mockResolvedValue({ data: config });
    const { container } = renderHome();

    expect(await screen.findByRole('heading', { level: 1, name: 'ค้นพบ VTuber ไทย' })).toBeInTheDocument();
    expect(container.querySelector('.homepage')).toHaveAttribute('data-template', 'search-first');
  });

  it('uses search-first when config fails while directory succeeds', async () => {
    homepageConfigAPI.get.mockRejectedValue(new Error('unavailable'));
    const { container } = renderHome();

    await screen.findByRole('link', { name: /Aiko/ });
    expect(container.querySelector('.homepage')).toHaveAttribute('data-template', 'search-first');
    expect(summaryAPI.get).not.toHaveBeenCalled();
    expect(rankingsAPI.getList).not.toHaveBeenCalled();
  });

  it('uses an Admin override without reading published configuration', async () => {
    const { container } = renderHome({ templateOverride: 'newest-first', previewMode: true }, '/admin/homepage');

    await screen.findByRole('heading', { level: 1, name: 'เพิ่มเข้ารายการล่าสุด' });
    expect(container.querySelector('.homepage')).toHaveAttribute('data-template', 'newest-first');
    expect(homepageConfigAPI.get).not.toHaveBeenCalled();
    expect(summaryAPI.get).not.toHaveBeenCalled();
    expect(rankingsAPI.getList).not.toHaveBeenCalled();
  });

  it('submits a name search to the search route with the query encoded', async () => {
    renderHome();
    await screen.findByRole('link', { name: /Aiko/ });
    fireEvent.change(screen.getByLabelText('ค้นหาชื่อ VTuber'), { target: { value: 'มิกุ' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByTestId('current-path')).toHaveTextContent('/search?q=%E0%B8%A1%E0%B8%B4%E0%B8%81%E0%B8%B8');
  });

  it('keeps preview form and creator links inside the current Admin route', async () => {
    renderHome({ templateOverride: 'search-first', previewMode: true }, '/admin/homepage');
    await screen.findByRole('link', { name: /Aiko/ });
    fireEvent.change(screen.getByLabelText('ค้นหาชื่อ VTuber'), { target: { value: 'Aiko' } });
    fireEvent.submit(screen.getByRole('search'));
    fireEvent.click(screen.getByRole('link', { name: /Aiko/ }));
    expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/homepage');
  });
});
