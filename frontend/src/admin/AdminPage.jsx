import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { authApi } from './api'
import AuthScreen from './AuthScreen'
import ChannelsTab from './ChannelsTab'
import RankingsTab from './RankingsTab'
import { AuditTab, CategoriesTab, ReportsTab, SettingsTab, UsersTab } from './ManagementTabs'
import { Button, Field, Modal, Notice, useSubmit } from './ui'
import './admin.css'

const baseTabs=[['channels','ช่อง'],['rankings','อันดับ'],['categories','หมวดหมู่'],['reports','รายงาน']]
const managerTabs=[['users','ผู้ใช้'],['history','ประวัติ'],['settings','ตั้งค่า']]

export default function AdminPage(){
 const [session,setSession]=useState(null),[checking,setChecking]=useState(true),[passwordOpen,setPasswordOpen]=useState(false)
 const loc=useLocation()
 const check=()=>{setChecking(true);authApi('/me').then(setSession).catch(()=>setSession(null)).finally(()=>setChecking(false))}
 useEffect(()=>{check();const unauthorized=()=>check();window.addEventListener('admin:unauthorized',unauthorized);return()=>window.removeEventListener('admin:unauthorized',unauthorized)},[])
 if(checking)return <div className="admin-boot">กำลังตรวจสอบการเข้าสู่ระบบ…</div>
 if(!session?.user)return <AuthScreen onAuthenticated={setSession}/>
 const {user,csrfToken}=session,isManager=user.role==='manager',tabs=isManager?[...baseTabs,...managerTabs]:baseTabs
 const logout=async()=>{try{await authApi('/logout',{method:'POST',csrfToken})}finally{setSession(null)}}
 const props={csrfToken,isManager,currentUser:user}
 const current=loc.pathname.split('/').pop()
 const title=tabs.find(([key])=>key===current)?.[1]||''
 const guard=element=>isManager?element:<Navigate to="../channels" replace/>
 return <div className="admin-app"><aside><a className="admin-brand" href="/"><b>VT</b><span>ผู้ดูแลระบบ<small>TH Ranking</small></span></a><nav aria-label="เมนูผู้ดูแล">{tabs.map(([key,label])=><NavLink key={key} to={'/admin/'+key} className={({isActive})=>isActive?'active':''}>{label}</NavLink>)}</nav><div className="admin-user"><strong>{user.display_name||user.username}</strong><small>{user.role}</small><button onClick={()=>setPasswordOpen(true)}>เปลี่ยนรหัสผ่าน</button><button onClick={logout}>ออกจากระบบ</button></div></aside><main><header className="admin-top"><div><p>ADMIN CONSOLE</p><h1>{title}</h1></div><button className="mobile-logout" onClick={logout}>ออกจากระบบ</button></header><Routes><Route index element={<Navigate to="channels" replace/>}/><Route path="channels" element={<ChannelsTab {...props}/>}/><Route path="rankings" element={<RankingsTab {...props}/>}/><Route path="categories" element={<CategoriesTab {...props}/>}/><Route path="reports" element={<ReportsTab {...props}/>}/><Route path="users" element={guard(<UsersTab {...props}/>)} /><Route path="history" element={guard(<AuditTab/>)} /><Route path="settings" element={guard(<SettingsTab {...props}/>)} /><Route path="*" element={<Navigate to="channels" replace/>}/></Routes></main>{passwordOpen&&<PasswordForm csrfToken={csrfToken} onClose={()=>setPasswordOpen(false)}/>}</div>
}
function PasswordForm({csrfToken,onClose}){const [form,setForm]=useState({currentPassword:'',newPassword:''}),[success,setSuccess]=useState('');const save=useSubmit(()=>authApi('/password',{method:'POST',csrfToken,body:form}),()=>{setSuccess('เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบอีกครั้ง');setTimeout(()=>window.dispatchEvent(new Event('admin:unauthorized')),900)});return <Modal title="เปลี่ยนรหัสผ่าน" onClose={onClose}><form onSubmit={save.submit}><Notice>{save.error}</Notice><Notice type="success">{success}</Notice><Field label="รหัสผ่านปัจจุบัน"><input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={e=>setForm({...form,currentPassword:e.target.value})}/></Field><Field label="รหัสผ่านใหม่"><input type="password" autoComplete="new-password" minLength="4" required value={form.newPassword} onChange={e=>setForm({...form,newPassword:e.target.value})}/></Field><Button className="primary" busy={save.busy}>เปลี่ยนรหัสผ่าน</Button></form></Modal>}
