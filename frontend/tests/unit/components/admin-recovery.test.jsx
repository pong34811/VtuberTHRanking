import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AgenciesTab from '@/admin/AgenciesTab';
import ChannelsTab from '@/admin/ChannelsTab';
import { CategoriesTab } from '@/admin/tabs/CategoriesTab';
import { UsersTab } from '@/admin/tabs/UsersTab';
import { ReportsTab } from '@/admin/tabs/ReportsTab';
import { AuditTab } from '@/admin/tabs/AuditTab';
import { Snapshots } from '@/admin/channels/Snapshots';
import { useList } from '@/admin/tabs/useList';

afterEach(() => vi.unstubAllGlobals());
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

it.each([
  ['agencies', AgenciesTab, 'ยังไม่มีสังกัด'],
  ['categories', CategoriesTab, 'ยังไม่มีข้อมูล'],
  ['users', UsersTab, 'ยังไม่มีข้อมูล'],
  ['reports', ReportsTab, 'ยังไม่มีข้อมูล'],
  ['history', AuditTab, 'ยังไม่มีข้อมูล'],
  ['channels', ChannelsTab, 'ยังไม่มีช่อง VTuber'],
])('keeps the %s error separate from empty data and offers a local retry', async (_, Tab, emptyLabel) => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('List unavailable')).mockImplementation(() => Promise.resolve(Response.json({ results: [] }))));
  render(<Tab csrfToken="token" currentUser={{ id: 'u1' }} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('List unavailable');
  expect(screen.queryByText(emptyLabel)).not.toBeInTheDocument();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'ลองอีกครั้ง' }));
  expect(await screen.findByText(emptyLabel)).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('aborts the previous list request on retry and ignores its late result', async () => {
  const old = deferred();
  vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(old.promise).mockImplementation(() => Promise.resolve(Response.json({ results: [{ id: 2 }] }))));
  const view = renderHook(() => useList('/agencies'));
  const oldSignal = fetch.mock.calls[0][1].signal;
  await act(async () => { await view.result.current.load(); });
  expect(oldSignal.aborted).toBe(true);
  await act(async () => { old.resolve(Response.json({ results: [{ id: 1 }] })); });
  expect(view.result.current.rows).toEqual([{ id: 2 }]);
  fetch.mockImplementationOnce(() => new Promise(() => {}));
  act(() => { view.result.current.load(); });
  const latestSignal = fetch.mock.calls[2][1].signal;
  view.unmount();
  expect(latestSignal.aborted).toBe(true);
});

it('rejects a malformed list contract instead of claiming no data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(Response.json({ message: 'not a list' }))));
  const view = renderHook(() => useList('/users'));
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  expect(view.result.current.error).toMatch(/ตอบกลับไม่ถูกต้อง/);
});

it('aborts the channel loader when the console is unmounted', () => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  const view = render(<ChannelsTab />);
  const signal = fetch.mock.calls[0][1].signal;
  view.unmount();
  expect(signal.aborted).toBe(true);
});

it('loads the new snapshot identity and ignores the previous channel response', async () => {
  const old = deferred();
  vi.stubGlobal('fetch', vi.fn((url) => String(url).includes('/1/') ? old.promise : Promise.resolve(Response.json({ results: [{ id: 2, followers: 222, recorded_at: '2026-09-30T00:00:00Z' }] }))));
  const view = render(<Snapshots channel={{ id: 1 }} />);
  const oldSignal = fetch.mock.calls[0][1].signal;
  view.rerender(<Snapshots channel={{ id: 2 }} />);
  expect(await screen.findAllByText('222')).not.toHaveLength(0);
  expect(oldSignal.aborted).toBe(true);
  await act(async () => { old.resolve(Response.json({ results: [{ id: 1, followers: 111, recorded_at: '2026-09-30T00:00:00Z' }] })); });
  expect(screen.queryByText('111')).not.toBeInTheDocument();
});
