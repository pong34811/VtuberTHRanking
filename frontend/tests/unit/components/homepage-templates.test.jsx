import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rankingsAPI, summaryAPI } from '@/api/client';
import HomePage from '@/pages/HomePage';
import { HOMEPAGE_TEMPLATES } from '@/pages/homepageTemplates';

vi.mock('@/api/client', () => ({
  rankingsAPI: { getList: vi.fn() },
  summaryAPI: { get: vi.fn() },
}));

const sectionNames = ['home-summary', 'home-method', 'home-rankings', 'home-discovery'];
const expectedOrders = {
  'ranking-first': ['home-summary', 'home-method', 'home-rankings', 'home-discovery'],
  'discovery-first': ['home-summary', 'home-discovery', 'home-rankings', 'home-method'],
  'compact-ranking': ['home-summary', 'home-rankings', 'home-method', 'home-discovery'],
};

const sectionOrder = container => Array.from(container.querySelector('.homepage').children)
  .filter(node => sectionNames.some(name => node.classList.contains(name)))
  .map(node => sectionNames.find(name => node.classList.contains(name)));

function renderHome(props = {}) {
  return render(<MemoryRouter><HomePage {...props} /></MemoryRouter>);
}

function CurrentPath() {
  const location = useLocation();
  return <output data-testid="current-path">{location.pathname}</output>;
}

beforeEach(() => {
  vi.clearAllMocks();
  rankingsAPI.getList.mockResolvedValue({ data: { results: [], total: 0 } });
  summaryAPI.get.mockResolvedValue({
    data: {
      total_vtubers: 2,
      latest_update: '2026-09-01T00:00:00.000Z',
      homepage_template: 'ranking-first',
    },
  });
});
afterEach(() => cleanup());

describe('homepage template registry', () => {
  it.each([
    ['ranking-first', 'อันดับเด่น', false],
    ['discovery-first', 'ค้นพบ VTuber', false],
    ['compact-ranking', 'อันดับแบบกระชับ', true],
  ])('registry describes %s with its agreed metadata', (id, label, compactHero) => {
    expect(HOMEPAGE_TEMPLATES[id]).toMatchObject({
      id,
      label,
      description: expect.any(String),
      compactHero,
      sectionOrder: expectedOrders[id].map(name => name.replace('home-', '')),
    });
  });
});

describe('homepage template rendering', () => {
  it.each(Object.keys(expectedOrders))('%s preserves trust content and follows its section order', async id => {
    summaryAPI.get.mockResolvedValue({
      data: {
        total_vtubers: 2,
        latest_update: '2026-09-01T00:00:00.000Z',
        homepage_template: id,
      },
    });
    const { container } = renderHome();

    await screen.findByRole('heading', { name: 'อันดับที่กำลังจับตา' });
    expect(container.querySelector('.homepage')).toHaveAttribute('data-template', id);
    expect(sectionOrder(container)).toEqual(expectedOrders[id]);
    expect(screen.getByRole('heading', {
      name: id === 'discovery-first' ? 'ค้นพบ VTuber ไทย' : 'สำรวจอันดับ VTuber ไทย',
    })).toBeInTheDocument();
    expect(screen.getByText('YouTube')).toBeInTheDocument();
    expect(screen.getByText('วิธีจัดอันดับ')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'ช่วงเวลา' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'จัดอันดับตาม' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /เปรียบเทียบช่อง/ }).map(link => link.getAttribute('href')))
      .toEqual(id === 'discovery-first' ? ['/compare', '/compare'] : ['/compare']);
    expect(screen.getAllByRole('link', { name: /ค้นหา VTuber/ }).map(link => link.getAttribute('href')))
      .toEqual(['/search', '/search']);
  });

  it.each([
    ['missing', {}],
    ['invalid', { homepage_template: 'custom-layout' }],
  ])('ranking-first is used when the summary template is %s', async (_label, summary) => {
    summaryAPI.get.mockResolvedValue({ data: summary });
    const { container } = renderHome();

    await screen.findByRole('heading', { name: 'อันดับที่กำลังจับตา' });
    expect(container.querySelector('.homepage')).toHaveAttribute('data-template', 'ranking-first');
    expect(sectionOrder(container)).toEqual(expectedOrders['ranking-first']);
  });

  it('ranking-first remains active when summary loading fails', async () => {
    summaryAPI.get.mockRejectedValue(new Error('summary unavailable'));
    const { container } = renderHome();

    await screen.findByRole('status');
    expect(container.querySelector('.homepage')).toHaveAttribute('data-template', 'ranking-first');
    expect(screen.getByText('โหลดข้อมูลภาพรวมไม่สำเร็จ')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'อันดับที่กำลังจับตา' })).toBeInTheDocument();
  });

  it('keeps preview links inside the current Admin route', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/homepage']}>
        <CurrentPath />
        <HomePage templateOverride="discovery-first" previewMode />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'อันดับที่กำลังจับตา' });

    fireEvent.click(screen.getAllByRole('link', { name: /ค้นหา VTuber/ })[0]);

    expect(screen.getByTestId('current-path')).toHaveTextContent('/admin/homepage');
  });
});
