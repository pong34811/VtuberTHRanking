import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ChannelsTab from '@/admin/ChannelsTab';
afterEach(() => vi.unstubAllGlobals());
function stub(result) { vi.stubGlobal('fetch',vi.fn(async (url,options={}) => Response.json(options.method === 'POST' ? result : {results:[]}))); }
for (const manager of [true,false]) it(`announces queued import without publishing or reloading for manager=${manager}`,async () => {
  stub({ok:true,queued:true,name:'Synthetic creator',channel_id:`UC${'a'.repeat(22)}`});
  render(<ChannelsTab csrfToken="fixture" isManager={manager} />);
  await screen.findByText('ยังไม่มีช่อง VTuber');
  fireEvent.click(screen.getByRole('button',{name:'ดึงข้อมูล YouTube'}));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox'),{target:{value:'@synthetic'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'ดึงข้อมูล',exact:true}));
  await screen.findByText(/ส่งช่องเข้าคิวรอผู้จัดการอนุมัติแล้ว ยังไม่แสดงบนเว็บไซต์/);
  expect(fetch.mock.calls.filter(([url]) => url.endsWith('/vtubers'))).toHaveLength(1);
  expect(Boolean(screen.queryByRole('link',{name:'ไปที่ช่องรออนุมัติ'}))).toBe(manager);
});
it('announces manual YouTube creation as queued and preserves ordinary import refresh', async () => {
  stub({ok:true,queued:true});render(<ChannelsTab csrfToken="fixture" isManager />);
  fireEvent.click(screen.getByRole('button',{name:'เพิ่มช่องใหม่'}));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByRole('textbox',{name:'ชื่อช่อง'}),{target:{value:'Synthetic creator'}});
  fireEvent.change(within(dialog).getByRole('textbox',{name:'Slug'}),{target:{value:'synthetic-creator'}});
  fireEvent.change(within(dialog).getByRole('textbox',{name:'YouTube URL'}),{target:{value:'https://www.youtube.com/@synthetic'}});
  fireEvent.click(within(dialog).getByRole('button',{name:'บันทึก',exact:true}));
  await screen.findByText(/ส่งช่องเข้าคิวรอผู้จัดการอนุมัติแล้ว ยังไม่แสดงบนเว็บไซต์/);
  expect(fetch.mock.calls.filter(([url,options]) => url.endsWith('/vtubers') && options.method === 'GET')).toHaveLength(1);
  fetch.mockImplementation(async (url,options={}) => Response.json(options.method === 'POST' ? {ok:true,updated:true,id:8} : {results:[]}));
  fireEvent.click(screen.getByRole('button',{name:'ดึงข้อมูล YouTube'}));
  fireEvent.change(screen.getByRole('dialog').querySelector('input'),{target:{value:'@existing'}});
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'ดึงข้อมูล',exact:true}));
  await screen.findByText('บันทึกข้อมูลช่องแล้ว');
  await waitFor(() => expect(fetch.mock.calls.filter(([url,options]) => url.endsWith('/vtubers') && options.method === 'GET')).toHaveLength(2));
});
