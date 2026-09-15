import { useState } from 'react'
import { authApi, messageOf } from './api'
import { Button, Field, Notice } from './ui'

export default function AuthScreen({ setupRequired, onAuthenticated }) {
  const [setup, setSetup] = useState({ setupToken: '', username: '', display_name: '', email: '', password: '' })
  const [login, setLogin] = useState({ username: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const data = setupRequired ? setup : login
  const setData = setupRequired ? setSetup : setLogin
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('')
    try { onAuthenticated(await authApi(setupRequired ? '/setup' : '/login', { method: 'POST', body: data })) }
    catch (err) { setError(messageOf(err)) } finally { setBusy(false) }
  }
  return <main className="admin-auth"><form className="admin-card" onSubmit={submit}>
    <div className="admin-logo">VT</div><h1>{setupRequired ? 'ตั้งค่าผู้จัดการคนแรก' : 'เข้าสู่ระบบผู้ดูแล'}</h1>
    <p>{setupRequired ? 'กรอกรหัสตั้งค่าที่ได้รับและสร้างบัญชีผู้จัดการ' : 'จัดการข้อมูลอันดับ VTuber ไทย'}</p>
    <Notice>{error}</Notice>
    {setupRequired && <><Field label="รหัสตั้งค่า"><input type="password" autoComplete="off" required value={setup.setupToken} onChange={e => setSetup({...setup, setupToken:e.target.value})}/></Field><Field label="ชื่อที่แสดง"><input required value={setup.display_name} onChange={e => setSetup({...setup, display_name:e.target.value})}/></Field><Field label="อีเมล"><input type="email" required value={setup.email} onChange={e => setSetup({...setup, email:e.target.value})}/></Field></>}
    <Field label="ชื่อผู้ใช้"><input autoComplete="username" required value={data.username} onChange={e => setData({...data, username:e.target.value})}/></Field>
    <Field label="รหัสผ่าน"><input type="password" autoComplete={setupRequired ? 'new-password' : 'current-password'} minLength="8" required value={data.password} onChange={e => setData({...data, password:e.target.value})}/></Field>
    <Button className="primary" busy={busy} type="submit">{setupRequired ? 'สร้างบัญชีผู้จัดการ' : 'เข้าสู่ระบบ'}</Button>
  </form></main>
}
