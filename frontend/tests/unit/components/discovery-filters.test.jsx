import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import DiscoveryHome from '@/pages/discovery/DiscoveryHome';
import App from '@/App';
import { directoryAPI, homepageConfigAPI } from '@/api/client';

vi.mock('@/api/client', () => ({
  directoryAPI: { getList: vi.fn() },
  homepageConfigAPI: { get: vi.fn() },
}));
vi.mock('@/components/ThemeSelector', () => ({ default: () => null }));

const aiko = { id: 1, name: 'Aiko', slug: 'aiko', category: 'gaming', affiliation: 'indie', avatar: '' };
const page = { total: 1, results: [aiko], category_counts: [{ category: 'gaming', count: 1 }] };

beforeEach(() => {
  vi.clearAllMocks();
  directoryAPI.getList.mockResolvedValue({ data: page });
  homepageConfigAPI.get.mockResolvedValue({ data: { template: 'search-first' } });
});
afterEach(cleanup);

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="location">{location.pathname + location.search}</output><button onClick={() => navigate(-1)}>Back</button></>;
}

it('filters inside discovery, preserves metadata on submit, and restores filters on back', async () => {
  render(<MemoryRouter initialEntries={['/discover?category=gaming&affiliation=indie']}><Navigation /><DiscoveryHome /></MemoryRouter>);
  await screen.findByRole('link', { name: /Aiko/ });
  fireEvent.change(screen.getByLabelText('ค้นหาชื่อ VTuber'), { target: { value: ' Aiko ' } });
  fireEvent.submit(screen.getByRole('search'));
  await waitFor(() => expect(directoryAPI.getList).toHaveBeenLastCalledWith({ q: 'Aiko', category: 'gaming', affiliation: 'indie', sort: 'name', limit: 12, offset: 0 }));
  expect(screen.getByTestId('location')).toHaveTextContent('/discover?q=Aiko&category=gaming&affiliation=indie');
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  await waitFor(() => expect(screen.getByLabelText('ค้นหาชื่อ VTuber')).toHaveValue(''));
  expect(directoryAPI.getList).toHaveBeenLastCalledWith({ category: 'gaming', affiliation: 'indie', sort: 'name', limit: 12, offset: 0 });
});

it('uses a filtered grid even with the category template and ignores invalid metadata', async () => {
  render(<MemoryRouter initialEntries={['/discover?q=Aiko&category=unknown&affiliation=indie']}><DiscoveryHome templateId="category-first" /></MemoryRouter>);
  await screen.findByRole('link', { name: /Aiko/ });
  expect(directoryAPI.getList).toHaveBeenLastCalledWith({ q: 'Aiko', affiliation: 'indie', sort: 'name', limit: 12, offset: 0 });
  expect(screen.getByLabelText('ค้นหาชื่อ VTuber')).toHaveValue('Aiko');
});

it('clears an empty search result without leaving discovery', async () => {
  directoryAPI.getList.mockResolvedValue({ data: { ...page, total: 0, results: [] } });
  render(<MemoryRouter initialEntries={['/discover?q=missing']}><Navigation /><DiscoveryHome /></MemoryRouter>);
  await screen.findByText('ไม่พบช่องที่ตรงกับตัวกรอง');
  fireEvent.click(screen.getByRole('link', { name: 'ล้างตัวกรอง' }));
  await waitFor(() => expect(directoryAPI.getList).toHaveBeenLastCalledWith({ sort: 'name', limit: 12, offset: 0 }));
  expect(screen.getByTestId('location')).toHaveTextContent('/discover');
});

it('clears an unsubmitted search draft when clearing category filters', async () => {
  render(<MemoryRouter initialEntries={['/discover?category=gaming']}><Navigation /><DiscoveryHome /></MemoryRouter>);
  await screen.findByRole('link', { name: /Aiko/ });
  const input = screen.getByLabelText('ค้นหาชื่อ VTuber');
  fireEvent.change(input, { target: { value: 'Aiko' } });
  expect(input).toHaveValue('Aiko');
  expect(screen.getByTestId('location').textContent).toBe('/discover?category=gaming');
  expect(directoryAPI.getList).toHaveBeenLastCalledWith({ category: 'gaming', sort: 'name', limit: 12, offset: 0 });

  fireEvent.click(screen.getByRole('link', { name: 'ล้างตัวกรอง' }));
  await waitFor(() => expect(directoryAPI.getList).toHaveBeenLastCalledWith({ sort: 'name', limit: 12, offset: 0 }));
  expect(screen.getByTestId('location').textContent).toBe('/discover');
  expect(input).toHaveValue('');
});

it('paginates discovery results without losing filters', async () => {
  directoryAPI.getList.mockResolvedValue({ data: { ...page, total: 25 } });
  render(<MemoryRouter initialEntries={['/discover?affiliation=indie']}><Navigation /><DiscoveryHome /></MemoryRouter>);
  await screen.findByRole('link', { name: /Aiko/ });
  fireEvent.click(screen.getByRole('link', { name: 'ถัดไป' }));
  await waitFor(() => expect(directoryAPI.getList).toHaveBeenLastCalledWith({ affiliation: 'indie', sort: 'name', limit: 12, offset: 12 }));
  fireEvent.click(screen.getByRole('link', { name: 'ก่อนหน้า' }));
  await waitFor(() => expect(directoryAPI.getList).toHaveBeenLastCalledWith({ affiliation: 'indie', sort: 'name', limit: 12, offset: 0 }));
});

it('keeps newer filter results when an older request finishes late', async () => {
  let finishOld;
  directoryAPI.getList.mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; })).mockResolvedValue({ data: { ...page, results: [{ ...aiko, id: 2, name: 'Biko', slug: 'biko' }] } });
  render(<MemoryRouter initialEntries={['/discover']}><DiscoveryHome /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('ค้นหาชื่อ VTuber'), { target: { value: 'Biko' } });
  fireEvent.submit(screen.getByRole('search'));
  await screen.findByRole('link', { name: /Biko/ });
  await act(async () => finishOld({ data: page }));
  expect(screen.queryByRole('link', { name: /Aiko/ })).not.toBeInTheDocument();
});

it('redirects legacy search URLs with their filters and removes the duplicate menu', async () => {
  render(<MemoryRouter initialEntries={['/search?q=Aiko&category=gaming']}><Navigation /><App /></MemoryRouter>);
  await screen.findByRole('heading', { name: 'ค้นพบ VTuber ไทย' });
  await waitFor(() => expect(directoryAPI.getList).toHaveBeenLastCalledWith({ q: 'Aiko', category: 'gaming', sort: 'name', limit: 12, offset: 0 }));
  expect(screen.getByTestId('location')).toHaveTextContent('/discover?q=Aiko&category=gaming');
  expect(screen.queryByRole('link', { name: 'ค้นหา' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'ค้นพบ' })).toHaveAttribute('aria-current', 'page');
});
