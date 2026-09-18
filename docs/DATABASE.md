# ฐานข้อมูล Cloudflare D1

ปรับตาม migrations เมื่อ 18 กันยายน 2026 ฐานข้อมูล vtuberthai-db ใช้ binding DB ทั้ง Pages Functions และ Worker

## Schema อ้างอิง

SQL ใน [frontend/migrations](../frontend/migrations/) เป็นแหล่งอ้างอิงหลัก ใช้ตามลำดับ:

| Migration | หน้าที่ |
|---|---|
| 0001_existing_schema.sql | vtubers, stats_snapshots, rankings |
| 0002_admin.sql | ข้อมูลช่องเพิ่ม, video_count, ผู้ใช้/session, categories, reports, audit_logs, settings |
| 0003_videos_category.sql | เพิ่ม videos และปรับ categories/rankings |
| 0004_channel_notes.sql | notes ภายใน |
| 0005_agencies.sql | agencies, agency_id และเชื่อมข้อมูลสังกัดเดิม |

## ตารางหลัก

| ตาราง | ข้อมูล |
|---|---|
| vtubers | id, name, slug (unique), bio, avatar, channel_url, platform, category, affiliation, agency_name, agency_id, is_active, country, debut_date, banner_url, youtube_url, twitch_url, x_url, notes, created_at, updated_at |
| agencies | id, name (unique ไม่แยกตัวพิมพ์), description, image_url, contact, youtube_channel_id (unique), created_at, updated_at |
| stats_snapshots | id, vtuber_id, followers, total_views, avg_views, video_count, recorded_at |
| rankings | id, vtuber_id, period, category, rank, score, rank_change, month, calculated_at, subscriber_count, total_views, video_count, status |

agency_id อ้าง agencies ด้วย ON DELETE RESTRICT ส่วน snapshots และ rankings อ้าง vtubers ด้วย ON DELETE CASCADE ข้อมูล notes ไม่ส่งออกใน public profile API

## ตารางผู้ดูแล

| ตาราง | หน้าที่ |
|---|---|
| users | username/email unique ไม่แยกตัวพิมพ์, password_hash, display_name, role manager/staff, status และเวลา |
| sessions | token_hash, user_id, csrf_token, expires_at, created_at |
| auth_attempts | ตัวนับและช่วงเวลาการพยายามเข้าสู่ระบบ |
| bootstrap_lock | ล็อกการตั้งค่าบัญชีแรก |
| categories | followers/views/videos, name, slug, description, sort_order, status |
| reports | รอบรายงาน หมวด ผู้สร้าง และ snapshot_json |
| audit_logs | ผู้ใช้ action target และ details |
| settings | setting_key, setting_value, description, updated_at |

settings เริ่มต้นมี site_name, site_status, current_ranking_period, ranking_update_frequency การเก็บค่าไม่ได้หมายความว่าทุกค่าถูกบังคับใช้ใน public API แล้ว

## ข้อกำหนดและดัชนี

- monthly เก็บ month แบบ YYYY-MM-01; alltime เก็บ NULL
- UNIQUE(period,category,month,vtuber_id) ป้องกันอันดับรายเดือนซ้ำ
- partial unique index rankings_alltime_unique ป้องกัน alltime ซ้ำเมื่อ month IS NULL
- snapshots_latest ใช้ vtuber_id, recorded_at DESC, id DESC
- มีดัชนี sessions_user, sessions_expiry, audit_logs_time, vtubers_agency_id
- เวลาส่วนใหญ่เก็บ TEXT; session และ auth_attempts เก็บเวลา INTEGER ตามโค้ด auth

## การพัฒนา

เพิ่ม migration หมายเลขถัดไปเมื่อเปลี่ยน schema และทดสอบบน local/test ก่อน ปรับ SQL ใน frontend/server และ worker/updater.js ให้ตรงกัน

API tests ใช้ D1 stub ใน frontend/tests/helpers/d1.js ซึ่งไม่รัน SQL จริง การเปลี่ยน schema จึงต้องตรวจ migration และ query กับฐานข้อมูลทดสอบด้วย
