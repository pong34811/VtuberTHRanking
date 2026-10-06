import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { ChannelApprovalsTab } from '@/admin/tabs/ChannelApprovalsTab';
const id = `UC${'a'.repeat(22)}`;
const row = { channel_id: id, name: 'Synthetic creator', checked_at: '2026-10-05 00:00:00', profile_json: JSON.stringify({name:'Synthetic creator',bio:'An uncertain debut statement'}), review_json: JSON.stringify({ affiliation:'indie', notes:'Reviewed draft' }), evidence_json: JSON.stringify([{kind:'youtube-profile',source:`https://www.youtube.com/channel/${id}`,description:'Primary text'}, {kind:'search-hint',source:'javascript:alert(1)',query:'Thai VTuber'}]) };
afterEach(() => vi.unstubAllGlobals());
function stub(handler) { vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
  const path = new URL(url, 'https://fixture.test');
  if (path.pathname.endsWith('/directory-sync')) return Response.json({runs:[{candidates_checked:8,candidates_new:2,candidates_duplicate:3,candidates_unavailable:3}],sweep:{query_index:4,completed:0,remaining_items:2}});
  if (path.pathname.endsWith('/agencies')) return Response.json({results:[{id:7,name:'Synthetic agency'}]});
  return handler(path, options);
})); }
it('paginates then resets offset for name search and rejects unsafe evidence links', async () => {
  stub(path => Response.json({results:[row],total:path.searchParams.get('q') ? 1 : 21,limit:20,offset:Number(path.searchParams.get('offset'))}));
  render(<ChannelApprovalsTab csrfToken="fixture" />);
  await screen.findByText('Synthetic creator');
  expect(screen.getAllByRole('link').every(link => link.href.startsWith('https://www.youtube.com/'))).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'หน้าถัดไป'}));
  await screen.findByText('หน้า 2');
  fireEvent.change(screen.getByRole('textbox',{name:'ค้นหาชื่อช่อง'}),{target:{value:'Synthetic'}});
  fireEvent.click(screen.getByRole('button',{name:'ค้นหา',exact:true}));
  await screen.findByText('รออนุมัติ 1 ช่อง ตามชื่อ “Synthetic”');
  expect(fetch.mock.calls.some(([url]) => url.includes('q=Synthetic&limit=20&offset=0'))).toBe(true);
});
it('requires explicit affiliation, locks identity and approves metadata without inventing statistics', async () => {
  let approved = false;
  stub((path, options) => { if (options.method === 'POST') { approved = true; return Response.json({ok:true,id:9,channel_id:id,snapshot:false},{status:201}); } return Response.json({results:approved ? [] : [row],total:approved ? 0 : 1,limit:20,offset:0}); });
  render(<ChannelApprovalsTab csrfToken="fixture" />);
  fireEvent.click(await screen.findByRole('button',{name:'ตรวจและอนุมัติ'}));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByRole('button',{name:'อนุมัติช่อง'})).toBeDisabled();
  expect(within(dialog).getByRole('combobox',{name:'ประเภทสังกัด'})).toHaveValue('');
  expect(within(dialog).getByRole('textbox',{name:'YouTube URL'})).toHaveAttribute('readonly');
  expect(within(dialog).getByRole('combobox',{name:'แพลตฟอร์ม'})).toBeDisabled();
  fireEvent.change(within(dialog).getByRole('combobox',{name:'ประเภทสังกัด'}),{target:{value:'agency'}});
  fireEvent.change(await within(dialog).findByRole('combobox',{name:'ชื่อสังกัด'}),{target:{value:'7'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'อนุมัติช่อง'}));
  await screen.findByText('อนุมัติข้อมูลช่องแล้ว ยังไม่มีสถิติ YouTube ที่พร้อมใช้งาน');
  const [url, options] = fetch.mock.calls.find(([,options]) => options.method === 'POST');
  expect(url).toContain(`/directory-candidates/${id}/approve`);
  expect(options.headers['X-CSRF-Token'] || options.headers['x-csrf-token']).toBe('fixture');
  expect(JSON.parse(options.body)).toMatchObject({affiliation:'agency',agency_id:7,platform:'youtube',youtube_url:`https://www.youtube.com/channel/${id}`,notes:'Reviewed draft'});
  await screen.findByText('ไม่พบช่องรออนุมัติ');
});
it('retains stale ignore errors without false success and retries failed lists', async () => {
  let failed = true;
  stub((path, options) => options.method === 'POST' ? Response.json({error:'stale'},{status:409}) : failed ? Response.json({error:'unavailable'},{status:503}) : Response.json({results:[row],total:1,limit:20,offset:0}));
  render(<ChannelApprovalsTab csrfToken="fixture" />);
  await screen.findByRole('button',{name:'ลองอีกครั้ง'});
  failed = false;
  fireEvent.click(await screen.findByRole('button',{name:'ลองอีกครั้ง'}));
  fireEvent.click(await screen.findByRole('button',{name:'ข้ามรายการ'}));
  await screen.findByText('รายการนี้เปลี่ยนไปแล้ว กรุณารีเฟรชคิว');
  expect(screen.queryByText('ข้ามรายการแล้ว')).not.toBeInTheDocument();
  expect(screen.getByText('Synthetic creator')).toBeInTheDocument();
});

it('keeps the review open after stale approval and rejects malformed pagination', async () => {
  let malformed = true;
  stub((path, options) => options.method === 'POST' ? Response.json({message:'stale'},{status:409}) : Response.json({results:[row],total:malformed ? '1' : 1,limit:20,offset:0}));
  render(<ChannelApprovalsTab csrfToken="fixture" />);
  await screen.findByText('ข้อมูลหน้าคิวไม่ถูกต้อง');
  expect(screen.queryByText('Synthetic creator')).not.toBeInTheDocument();
  malformed = false; fireEvent.click(screen.getByRole('button',{name:'ลองอีกครั้ง'}));
  fireEvent.click(await screen.findByRole('button',{name:'ตรวจและอนุมัติ'}));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByRole('combobox',{name:'ประเภทสังกัด'}),{target:{value:'indie'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'อนุมัติช่อง'}));
  await within(dialog).findByText('รายการนี้เปลี่ยนไปแล้ว กรุณาปิดและรีเฟรชคิวก่อนตรวจใหม่');
  expect(screen.queryByText('อนุมัติช่องแล้ว')).not.toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});
