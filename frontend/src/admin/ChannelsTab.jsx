import { useEffect, useState } from 'react'
import { adminApi } from './api'
import { Button, Card, Empty, Field, Loading, Modal, Notice, fmtDate, fmtNumber, useSubmit } from './ui'

const blank = { name:'',slug:'',bio:'',avatar:'',agency_name:'',country:'Thailand',debut_date:'',banner_url:'',youtube_url:'',twitch_url:'',x_url:'',category:'',affiliation:'',channel_url:'',platform:'YouTube',is_active:true }
const fields = [['name','ชื่อช่อง'],['slug','Slug'],['agency_name','สังกัด'],['country','ประเทศ'],['debut_date','วันเดบิวต์','date'],['avatar','URL รูปโปรไฟล์','url'],['banner_url','URL แบนเนอร์','url'],['youtube_url','YouTube URL','url'],['twitch_url','Twitch URL','url'],['x_url','X URL','url'],['channel_url','Channel URL','url'],['platform','แพลตฟอร์ม'],['category','ประเภทคอนเทนต์'],['affiliation','Affiliation']]

export default function ChannelsTab({ csrfToken }) {
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[editing,setEditing]=useState(null),[snapshots,setSnapshots]=useState(null)
  const load=()=>{setLoading(true);adminApi('/vtubers').then(d=>setRows(d.results||[])).catch(e=>setError(e.message)).finally(()=>setLoading(false))}
  useEffect(load,[])
  return <><Card title="ช่อง VTuber" actions={<button className="primary" onClick={()=>setEditing({...blank})}>เพิ่มช่อง</button>}><Notice>{error}</Notice>{loading?<Loading/>:rows.length?<div className="admin-table-wrap"><table><thead><tr><th>ช่อง</th><th>สังกัด</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.name}</strong><small>{row.slug}</small></td><td>{row.agency_name||row.affiliation||'—'}</td><td><span className={`pill ${row.is_active?'active':''}`}>{row.is_active?'ใช้งาน':'ปิดใช้งาน'}</span></td><td className="actions"><button onClick={()=>setSnapshots(row)}>สถิติ</button><button onClick={()=>setEditing({...blank,...row,is_active:Boolean(row.is_active)})}>แก้ไข</button></td></tr>)}</tbody></table></div>:<Empty>ยังไม่มีช่อง VTuber</Empty>}</Card>
  {editing&&<ChannelForm value={editing} csrfToken={csrfToken} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);load()}}/>}
  {snapshots&&<Snapshots channel={snapshots} csrfToken={csrfToken} onClose={()=>setSnapshots(null)}/>}</>
}

function ChannelForm({value,csrfToken,onClose,onSaved}){
 const [form,setForm]=useState(value), isEdit=Boolean(value.id)
 const {busy,error,submit}=useSubmit(()=>adminApi(`/vtubers${isEdit?`/${value.id}`:''}`,{method:isEdit?'PUT':'POST',body:form,csrfToken}),onSaved)
 return <Modal title={isEdit?'แก้ไขช่อง':'เพิ่มช่อง'} onClose={onClose}><form onSubmit={submit}><Notice>{error}</Notice><div className="admin-grid">{fields.map(([key,label,type])=><Field key={key} label={label}><input type={type||'text'} required={['name','slug'].includes(key)} value={form[key]??''} onChange={e=>setForm({...form,[key]:e.target.value})}/></Field>)}<Field label="รายละเอียด" wide><textarea rows="4" value={form.bio||''} onChange={e=>setForm({...form,bio:e.target.value})}/></Field><label className="check wide"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})}/> เปิดใช้งานช่องนี้</label></div><div className="form-actions"><button type="button" className="ghost" onClick={onClose}>ยกเลิก</button><Button className="primary" busy={busy}>บันทึก</Button></div></form></Modal>
}

function Snapshots({channel,csrfToken,onClose}){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[form,setForm]=useState({followers:'',total_views:'',video_count:'',recorded_at:new Date().toISOString().slice(0,16)})
 const load=()=>adminApi(`/vtubers/${channel.id}/snapshots`).then(d=>setRows(d.results||[])).finally(()=>setLoading(false))
 useEffect(load,[])
 const {busy,error,submit}=useSubmit(()=>adminApi(`/vtubers/${channel.id}/snapshots`,{method:'POST',csrfToken,body:{...form,followers:Number(form.followers),total_views:Number(form.total_views),video_count:Number(form.video_count),recorded_at:new Date(form.recorded_at).toISOString()}}),()=>{setForm({...form,followers:'',total_views:'',video_count:''});load()})
 return <Modal title={`สถิติ · ${channel.name}`} onClose={onClose}><form onSubmit={submit}><Notice>{error}</Notice><div className="admin-grid"><Field label="ผู้ติดตาม"><input type="number" min="0" required value={form.followers} onChange={e=>setForm({...form,followers:e.target.value})}/></Field><Field label="ยอดดูรวม"><input type="number" min="0" required value={form.total_views} onChange={e=>setForm({...form,total_views:e.target.value})}/></Field><Field label="จำนวนวิดีโอ"><input type="number" min="0" required value={form.video_count} onChange={e=>setForm({...form,video_count:e.target.value})}/></Field><Field label="เวลาที่บันทึก"><input type="datetime-local" required value={form.recorded_at} onChange={e=>setForm({...form,recorded_at:e.target.value})}/></Field></div><Button className="primary" busy={busy}>เพิ่มสถิติ</Button></form><h3>ประวัติสถิติ</h3>{loading?<Loading/>:rows.length?<div className="admin-table-wrap"><table><thead><tr><th>วันที่</th><th>ผู้ติดตาม</th><th>ยอดดู</th><th>วิดีโอ</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.id||i}><td>{fmtDate(r.recorded_at)}</td><td>{fmtNumber(r.followers)}</td><td>{fmtNumber(r.total_views)}</td><td>{fmtNumber(r.video_count)}</td></tr>)}</tbody></table></div>:<Empty/>}</Modal>
}
