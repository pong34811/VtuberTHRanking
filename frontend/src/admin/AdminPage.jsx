import { useEffect, useState } from 'react'
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
 const [session,setSession]=useState(null),[checking,setChecking]=useState(true),[setupRequired,setSetupRequired]=useState(false),[tab,setTab]=useState('channels'),[passwordOpen,setPasswordOpen]=useState(false)
 const check=()=>{setChecking(true);authApi('/me').then(setSession).catch(e=>{setSession(null);setSetupRequired(Boolean(e.data?.setupRequired))}).finally(()=>setChecking(false))}
 useEffect(()=>{check();const unauthorized=()=>check();window.addEventListener('admin:unauthorized',unauthorized);return()=>window.removeEventListener('admin:unauthorized',unauthorized)},[])
 if(checking)return <div className="admin-boot">กำลังตรวจสอบการเข้าสู่ระบบ…</div>
 if(!session?.user)return <AuthScreen setupRequired={setupRequired} onAuthenticated={setSession}/>
 const {user,csrfToken}=session,isManager=user.role==='manager',tabs=isManager?[...baseTabs,...managerTabs]:baseTabs
 const logout=async()=>{try{await authApi('/logout',{method:'POST',csrfToken})}finally{setSession(null)}}
 const props={csrfToken,isManager,currentUser:user}
 const content={channels:<ChannelsTab {...props}/>,rankings:<RankingsTab {...props}/>,categories:<CategoriesTab {...props}/>,reports:<ReportsTab {...props}/>,users:<UsersTab {...props}/>,history:<AuditTab/>,settings:<SettingsTab {...props}/>}[tab]
 return <div className="admin-app"><aside><a className="admin-brand" href="/"><b>VT</b><span>ผู้ดูแลระบบ<small>TH Ranking</small></span></a><nav aria-label="เมนูผู้ดูแล">{tabs.map(([key,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}>{label}</button>)}</nav><div className="admin-user"><strong>{user.display_name||user.username}</strong><small>{user.role}</small><button onClick={()=>setPasswordOpen(true)}>เปลี่ยนรหัสผ่าน</button><button onClick={logout}>ออกจากระบบ</button></div></aside><main><header className="admin-top"><div><p>ADMIN CONSOLE</p><h1>{tabs.find(([key])=>key===tab)?.[1]}</h1></div><button className="mobile-logout" onClick={logout}>ออกจากระบบ</button></header>{content}</main>{passwordOpen&&<PasswordForm csrfToken={csrfToken} onClose={()=>setPasswordOpen(false)}/>}</div>
}
function PasswordForm({csrfToken,onClose}){const [form,setForm]=useState({currentPassword:'',newPassword:''}),[success,setSuccess]=useState('');const save=useSubmit(()=>authApi('/password',{method:'POST',csrfToken,body:form}),()=>{setSuccess('เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบอีกครั้ง');setTimeout(()=>window.dispatchEvent(new Event('admin:unauthorized')),900)});return <Modal title="เปลี่ยนรหัสผ่าน" onClose={onClose}><form onSubmit={save.submit}><Notice>{save.error}</Notice><Notice type="success">{success}</Notice><Field label="รหัสผ่านปัจจุบัน"><input type="password" autoComplete="current-password" required value={form.currentPassword} onChange={e=>setForm({...form,currentPassword:e.target.value})}/></Field><Field label="รหัสผ่านใหม่"><input type="password" autoComplete="new-password" minLength="8" required value={form.newPassword} onChange={e=>setForm({...form,newPassword:e.target.value})}/></Field><Button className="primary" busy={save.busy}>เปลี่ยนรหัสผ่าน</Button></form></Modal>}
