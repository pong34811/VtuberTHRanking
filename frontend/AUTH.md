# Auth System Documentation

## Overview

ระบบ auth ใช้ username และ password สำหรับเข้าสู่ระบบ admin panel

## Setup (ตั้งค่าครั้งแรก)

### 1. ตั้งค่า Environment Variable

ตั้งค่า `ADMIN_SETUP_TOKEN` ใน Cloudflare Pages:

```
Cloudflare Dashboard → Pages → vtuberthai-ranking → Settings → Environment variables
```

### 2. สร้าง Admin User

เข้าไปที่ `/admin` แล้วกรอก:
- รหัสตั้งค่า (ADMIN_SETUP_TOKEN)
- ชื่อผู้ใช้ (username)
- รหัสผ่าน (password) - ต้องยาว 4-128 ตัวอักษร

## API Endpoints

### POST `/api/v1/auth/setup`
สร้าง admin user ครั้งแรก

**Request:**
```json
{
  "setupToken": "your-admin-setup-token",
  "username": "admin",
  "password": "your-secure-password"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "username": "admin",
    "display_name": "admin",
    "email": "admin@admin.local",
    "role": "manager",
    "status": "active"
  },
  "csrfToken": "csrf-token"
}
```

### POST `/api/v1/auth/login`
เข้าสู่ระบบ

**Request:**
```json
{
  "username": "admin",
  "password": "your-secure-password"
}
```

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "username": "admin",
    "display_name": "admin",
    "email": "admin@admin.local",
    "role": "manager",
    "status": "active"
  },
  "csrfToken": "csrf-token"
}
```

### POST `/api/v1/auth/logout`
ออกจากระบบ (ต้องมี session)

### GET `/api/v1/auth/me`
ดึงข้อมูลผู้ใช้ปัจจุบัน

### POST `/api/v1/auth/password`
เปลี่ยนรหัสผ่าน

**Request:**
```json
{
  "currentPassword": "old-password",
  "newPassword": "new-secure-password"
}
```

## Security Features

### Rate Limiting
- Setup: 10 ครั้งต่อ IP ต่อ 15 นาที
- Login (IP): 30 ครั้งต่อ 15 นาที
- Login (username): 10 ครั้งต่อ 15 นาที

### Session Management
- Session ใช้ HTTP-only cookie
- Session หมดอายุใน 8 ชั่วโมง
- CSRF token ตรวจสอบทุก POST/PUT/DELETE request

### Password Hashing
- PBKDF2-SHA256, 600,000 iterations
- Random salt 16 bytes
- Timing-safe comparison

### Origin Checking
- ตรวจสอบ Origin header สำหรับทุก non-GET request
- อนุญาตเฉพาะ vtuberthai-ranking.pages.dev และ localhost

## Database Schema

### users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'user',
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME,
  last_login_at DATETIME
);
```

### sessions
```sql
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### bootstrap_lock
```sql
CREATE TABLE bootstrap_lock (id INTEGER PRIMARY KEY);
```
ใช้ตรวจสอบว่าตั้งค่า admin แล้วหรือยัง

### auth_attempts
```sql
CREATE TABLE auth_attempts (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
```
ใช้สำหรับ rate limiting

## Frontend Components

### AuthScreen.jsx
หน้าเข้าสู่ระบบ/ตั้งค่า admin

### AdminPage.jsx
หน้า admin หลัก ตรวจสอบ session ก่อนแสดงผล

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ADMIN_SETUP_TOKEN` | รหัสสำหรับตั้งค่า admin ครั้งแรก (ถ้าไม่ตั้ง จะข้ามการตรวจ token เหลือแค่ username+password) |
| `ENVIRONMENT` | production/development |
