import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import IntroPage from '@/pages/IntroPage';
import IntroHomepageTemplateTab from '@/admin/tabs/IntroHomepageTemplateTab';
import { directoryAPI, introHomepageConfigAPI } from '@/api/client';
import { adminApi } from '@/admin/api';
import { INTRO_HOMEPAGE_TEMPLATE_IDS } from '../../../../shared/intro-homepage-templates.js';
vi.mock('@/api/client', () => ({ directoryAPI: { getList: vi.fn() }, introHomepageConfigAPI: { get: vi.fn() } }));
vi.mock('@/admin/api', () => ({ adminApi: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); directoryAPI.getList.mockResolvedValue({ data: { total: 10, affiliation_counts: [{ affiliation: 'indie', count: 7 }, { affiliation: 'agency', count: 3 }] } }); introHomepageConfigAPI.get.mockResolvedValue({ data: { template: 'sculpture-index-3d' } }); adminApi.mockResolvedValue({ intro_homepage_template: 'sculpture-index-3d' }); });
afterEach(cleanup);
const page = props => render(<MemoryRouter><IntroPage {...props} /></MemoryRouter>);
it('loads tiny global directory counts and website copy without restoring the removed cards', async () => {
  const { container } = page();
  await waitFor(() => expect(container.querySelector('.intro-counts dd').textContent).toContain('10'));
  expect([...container.querySelectorAll('.intro-counts dd')].map(e => e.textContent.trim())).toEqual(['10 ช่อง', '7 ช่อง', '3 ช่อง']);
  expect(directoryAPI.getList).toHaveBeenCalledWith({ limit: 1 });
  expect(screen.getByRole('heading', { name: 'เกี่ยวกับเรา' })).toBeInTheDocument();
  expect(screen.getByText(/คือผู้ที่ขึ้นไลฟ์สตรีมเดบิว/)).toBeInTheDocument();
  expect(container.querySelector('.intro-paths')).toBeNull();
  expect(screen.getByRole('link', { name: 'ค้นหา ↗' })).toHaveAttribute('href', '/discover');
});
it.each([{ total: 0, affiliation_counts: [], expected: '0' }, { total: 5, affiliation_counts: [{ affiliation: 'indie', count: 5 }], expected: '5' }])('handles real empty and absent groups', async data => {
  directoryAPI.getList.mockResolvedValue({ data });
  const { container } = page();
  await waitFor(() => expect(container.querySelector('.intro-counts dd').textContent).toContain(data.expected));
  expect(container.querySelectorAll('.intro-counts dd')[2].textContent).toContain('0');
});
it.each([null, { total: 10, affiliation_counts: [{ affiliation: 'indie', count: '7' }] }, { total: 0, affiliation_counts: [{ affiliation: 'indie', count: -1 }] }])('shows unavailable counts for malformed data and supports retry', async data => {
  directoryAPI.getList.mockResolvedValueOnce({ data });
  const { container } = page();
  const retry = await screen.findByRole('button', { name: 'ลองอีกครั้ง' });
  expect(container.querySelector('.intro-counts dd').textContent).toContain('—');
  fireEvent.click(retry);
  await waitFor(() => expect(container.querySelector('.intro-counts dd').textContent).toContain('10'));
});
it('falls back after config failure, ignores late responses after unmount, and contains every template preview', async () => {
  introHomepageConfigAPI.get.mockRejectedValueOnce(new Error('offline'));
  const first = page();
  await waitFor(() => expect(first.container.querySelector('.intro-page')).toHaveAttribute('data-template', 'sculpture-index-3d'));
  first.unmount();
  for (const id of INTRO_HOMEPAGE_TEMPLATE_IDS) {
    const result = page({ templateOverride: id, previewMode: true });
    expect(result.container.querySelector('.intro-page')).toHaveAttribute('data-template', id);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    act(() => screen.getByRole('link', { name: 'ค้นหา ↗' }).dispatchEvent(click));
    expect(click.defaultPrevented).toBe(true);
    result.unmount();
  }
  expect(directoryAPI.getList).toHaveBeenCalledTimes(1);
});
it('keeps a new draft when an earlier save resolves and reports save failures', async () => {
  let finish;
  adminApi.mockResolvedValueOnce({ intro_homepage_template: 'sculpture-index-3d' }).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockRejectedValueOnce(new Error('save offline'));
  render(<MemoryRouter><IntroHomepageTemplateTab csrfToken="token" /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: /Paper Atelier/ }));
  fireEvent.click(screen.getByRole('button', { name: 'บันทึกหน้าแรก' }));
  fireEvent.click(screen.getByRole('button', { name: /Candy World/ }));
  await act(async () => finish({ intro_homepage_template: 'paper-atelier-3d' }));
  expect(screen.getByTestId('intro-homepage-preview')).toHaveAttribute('data-template-override', 'candy-world-3d');
  expect(adminApi).toHaveBeenLastCalledWith('/settings/intro-homepage-template', { method: 'PUT', csrfToken: 'token', body: { intro_homepage_template: 'paper-atelier-3d' } });
  expect(within(screen.getByRole('group', { name: 'แม่แบบหน้าแรก' })).getAllByRole('button')).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: 'บันทึกหน้าแรก' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('save offline');
  expect(screen.getByTestId('intro-homepage-preview')).toHaveAttribute('data-template-override', 'candy-world-3d');
  expect(directoryAPI.getList).not.toHaveBeenCalled();
});

it('retries a settings load failure without publishing a draft', async () => {
  adminApi.mockRejectedValueOnce(new Error('load offline')).mockResolvedValueOnce({ intro_homepage_template: 'neon-portal-3d' });
  render(<MemoryRouter><IntroHomepageTemplateTab csrfToken="token" /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('load offline');
  fireEvent.click(screen.getByRole('button', { name: 'ลองโหลดอีกครั้ง' }));
  expect(await screen.findByRole('button', { name: /Neon Portal/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'บันทึกหน้าแรก' })).toBeDisabled();
  expect(adminApi).toHaveBeenCalledTimes(2);
});
it('ignores stale directory responses after leaving the page', async () => {
  let finish;
  directoryAPI.getList.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const old = page(); old.unmount();
  directoryAPI.getList.mockResolvedValueOnce({ data: { total: 0, affiliation_counts: [] } });
  const current = page();
  await waitFor(() => expect(current.container.querySelector('.intro-counts dd').textContent).toContain('0'));
  await act(async () => finish({ data: { total: 999, affiliation_counts: [{ affiliation: 'indie', count: 999 }] } }));
  expect(current.container.querySelector('.intro-counts dd').textContent).toContain('0');
});
