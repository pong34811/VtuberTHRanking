# YouTube snapshot / ranking — policy review

ตรวจเอกสารทางการและ source ใน worktree วันที่ **2026-10-01 (Asia/Bangkok)**; policy pages ระบุ Last updated **2026-09-14 UTC**.[1][2]

**ข้อสรุปเชิงวิศวกรรม:** ยังไม่มีหลักฐานเพียงพอให้รับรองการเปิด public leaderboard, comparison และประวัติระยะยาวใน use case นี้ ควรผ่าน approval และ lifecycle gates ด้านล่างก่อนขยายการใช้งานจริง รายงานนี้ไม่ใช่ legal approval หรือคำตัดสินว่าโครงการ compliant/noncompliant และไม่ได้เปลี่ยน code, metric, retention หรือข้อมูล production

ขอบเขต: `docs/{RANKING_ALGORITHM,DATABASE,API_SPEC,PROJECT_STRUCTURE}.md`, `worker/updater.js`, `frontend/server/{admin,public,ranking-service}.js`, `shared/{ranking,snapshot-policy}.js`, migrations `0001`/`0008` และเอกสารออกแบบที่ค้นพบ ไม่อ่าน secret/`.env`, ไม่เรียก YouTube ด้วย credential, ไม่ตรวจ live D1, consent records หรือ Google audit console ข้อค้นพบใน repo ด้านล่างจึงเป็น **static evidence** ไม่ใช่ผลตรวจระบบ production

## 1. ข้อเท็จจริงจาก policy กับการตีความสำหรับโครงการ

| เรื่อง | ข้อเท็จจริงทางการ | การตีความ / gate สำหรับโครงการ |
|---|---|---|
| Public vs Authorized Data | `Non-Authorized Data` คือข้อมูลที่เข้าถึงได้โดยไม่ใช้ `User Credentials`; `Authorized Data` ต้องมี active user อนุญาตผ่าน credentials ดังกล่าว.[1] `channels.list` รองรับ `id`, `forHandle`, `statistics`; `mine` ต้องเป็น authorized request.[4] | API key ฝั่ง server และ admin login ของเว็บไม่ใช่ OAuth consent ของเจ้าของช่อง Public counters ไม่ได้กลายเป็น Authorized Data เพราะถูกเพิ่มเข้า roster หรือสังกัดยินยอมทั่วไป |
| Public statistics retention | III.E.4.b ระบุชัดว่า statistics ที่เป็น Non-Authorized Data ห้ามเก็บเกิน 30 วัน; III.E.4.d อนุญาต temporary storage ของ limited Non-Authorized Data ไม่เกิน 30 calendar days แล้วต้อง delete หรือ refresh.[1] | การดึงค่าปัจจุบันใหม่ไม่ใช่เหตุให้เก็บ observation เก่าไม่จำกัด ควรลบ historical rows ที่หมดอายุ ไม่เลื่อน `recorded_at` หรือเรียกการเผยแพร่อันดับซ้ำว่า refresh ข้อมูลต้นทาง |
| Authorized statistics | III.E.4.b ให้เก็บประเภทที่ระบุเท่าที่จำเป็นตาม specific consent ของ active user แต่ต้องตรวจ authorization ทุก 30 วัน; ตัวอย่างกำหนดให้ตรวจ resource deletion ด้วย และ III.E.3 จำกัดการเข้าถึง Authorized Data ให้ authorizing user/agents ที่อนุมัติ.[1] | OAuth เพียงอย่างเดียวไม่ใช่ใบอนุญาตให้ทำ public cross-channel rankings ต้องออกแบบ scopes, consent, visibility และ deletion แยกจาก amendment gate |
| Derived metrics / leaderboard | หลักทั่วไป III.E.4.h ห้ามใช้ API Data สร้าง derived metrics; III.L ระบุว่า additional policies ใช้กับ **audited developers** ที่มี analytics use case และ explicitly applied for permission ตั้งแต่ June 01, 2026.[1] Amendment มีตัวอย่างอนุญาต channel comparison, leaderboards และ historical analysis แต่ subject to acceptance; ห้าม presentation ที่ก่อ harassment/brigading.[2] | อย่าเหมารวมว่า leaderboard ถูกห้ามเสมอ หรือเปิดได้ทันทีเพราะมีหน้า amendment ต้องมีหลักฐาน accepted use case ครอบคลุมเว็บไซต์/API นี้; disclaimer หรือการใช้ raw count ไม่แทนการผ่าน gate |
| Extended storage | เมื่อ use case accepted สำหรับ additional derived metrics, statistical endpoint metrics และ derived metrics เก็บได้สูงสุด **36 calendar months**; titles, creator names, descriptions, comment text ยังต้องตาม 30-day refresh/deletion policy.[2] | 36 เดือนเป็น conditional ceiling ไม่ใช่ default และไม่ครอบคลุมทุก field ใน profile/report ต้องแยก statistical observations จาก imported metadata และใช้เวลาต้นทาง ไม่ใช่ publication time เป็นฐานอายุ |
| Aggregation | III.E.2 จำกัด aggregation ให้ช่องภายใต้ content owner เดียวที่ YouTube รับรอง และให้ owner นั้นดูเท่านั้น; ห้ามใช้ aggregation เพื่อหา insights เกี่ยวกับธุรกิจ YouTube.[1] | `agency_id` ของเว็บไม่พิสูจน์ YouTube-recognized content owner; public `total_followers_all` ต้องให้ผู้พิจารณา/YouTube ยืนยันขอบเขต ไม่อนุมานว่าการรับ amendment อนุญาตทุก aggregate |

**หลักฐานถ้อยคำที่เป็น gate:** “These policies are only applicable to audited developers with analytics use cases that have explicitly applied for permission…” (III.L).[1] หน้า amendment ระบุ “If your use case is accepted for additional derived metrics, you may store some statistical data for a duration beyond 30 days.”[2]

ช่องทางตามเอกสาร: [YouTube API form](https://support.google.com/youtube/contact/yt_api_form), เลือก `Section 5: Use Cases, API Integration, and Feature Implementation` → `Analytics & Reporting` เพื่อยอมรับ amendment; ต้องใช้ร่วมกับเงื่อนไข audited/permission ใน III.L ไม่ใช่ตีความว่ากด form เท่ากับอนุมัติแล้ว.[1][2]

### Refresh และ deletion ที่ต้องแยกกัน

- ต้องพยายามให้ stored API Data ตรงข้อมูลปัจจุบัน แสดง latest available data; historical presentation ทำได้เมื่ออธิบายบริบทเวลาอย่างถูกต้อง แต่ข้อความนี้ไม่ยกเว้น storage limits.[1]
- คำขอลบ stored user data / การลบบัญชีที่สื่อเจตนาหยุดเข้าถึง: ลบเร็วที่สุดและภายใน **7 calendar days**; อธิบายว่าการลบที่เว็บไม่ลบข้อมูลบน YouTube.[1]
- หากถอน consent ผ่านกลไกของ client: revoke token ทันที แล้วลบ Authorized Data ที่ได้ตาม consent ภายใน **7 calendar days**; หากถอนผ่าน Google security settings: ตรวจ token validity เป็นระยะและลบ API Data ที่เกี่ยวข้องเร็วที่สุด ภายใน **30 calendar days** ตามหัวข้อ User Authentication and Authorization → Revocation.[1]
- **ข้อเสนอ ไม่ใช่ deadline ใหม่ของ YouTube:** ใช้ deletion queue ภายใน 7 วันเป็น operational target ทั้งสองเส้นทางเมื่อทำได้ และตรวจ consent/availability ไม่ให้เลยรอบ 30 วัน; purge ต้องรวมสำเนาใน staging, publication journal, report JSON, cache, exports ที่ระบบควบคุม และกำหนด backup/restore suppression กับผู้รับผิดชอบ

## 2. API counters: ความหมายและ precision

- `statistics.subscriberCount` **rounded down to three significant figures**; `hiddenSubscriberCount` บอกว่าจำนวนผู้ติดตามเปิดเผยสาธารณะหรือไม่ จึงไม่ใช่จำนวนละเอียดแบบ exact และ missing/hidden ต้องไม่เท่ากับ zero โดยอัตโนมัติ.[3]
- `statistics.videoCount` คือจำนวน **public videos** รวมถึงเมื่อ owner ดูข้อมูลเอง; ไม่ใช่จำนวน uploads ทั้งหมดหรือจำนวนวิดีโอในช่วงเดือนนั้น.[3]
- `statistics.viewCount` รวมยอดดูวิดีโอทุก format ของช่อง; เอกสารปัจจุบันระบุเปลี่ยนตั้งแต่ **August 24, 2026** ให้ long-form, Live และ Shorts นับเมื่อเริ่มเล่น รวม autoplay, hover และ click/tap จึงต้องมี definition-change marker หากวิเคราะห์ข้ามวันนั้น.[3]
- **ข้อเสนอสำหรับ contract:** เก็บ returned counter, `collected_at`, `source`, `authorization_mode`, `metric_definition_version`, `expires_at`, `data_quality` และ hidden/missing flags แยกกัน; ไม่ประมาณค่าที่ YouTube ซ่อน ไม่เพิ่ม significant digits และไม่ตีความผลต่างเล็ก ๆ ว่า growth ละเอียดกว่าความแม่นของ API
- **ข้อเสนอ UX:** ใช้ “ผู้ติดตาม YouTube (ค่าปัดลงจาก API)” ไม่ใช่ followers ทุกแพลตฟอร์ม; แสดง `as of`, missing/stale state และ methodology ของ ties ข้อมูล API และ metric ของเว็บไซต์ต้องมี provenance ชัดเจน โดยไม่กล่าวว่า YouTube รับรองอันดับ.[1][2]

## 3. Repo-specific evidence และความเสี่ยง

ตารางนี้บันทึก baseline ตอน audit ก่อนเพิ่ม ingestion safeguard ด้านล่าง; line references เป็นของ baseline ไม่ใช่ตำแหน่งหลังแก้ไข

| Evidence ใน source ที่ตรวจ | ความเสี่ยง / งานที่ควรเปิด ticket |
|---|---|
| [`worker/updater.js`](../worker/updater.js):68–70 และ [`admin.js`](../frontend/server/admin.js):205–224 เรียก official `youtube/v3/channels` ด้วย server API key ไม่มี user OAuth ใน ingestion ที่ตรวจ | ตรงแนวทาง official API แต่ข้อมูลสถิติเส้นทางนี้เข้าลักษณะ Non-Authorized Data; ไม่พบหลักฐาน audit/amendment acceptance ในเอกสารที่ค้น ไม่เท่ากับยืนยันว่าเจ้าของโครงการไม่มีหลักฐานนอก repo |
| `updater.js`:204–211 ใช้ `subscriberCount ?? 0`; `admin.js`:246–247 ใช้ `subscriberCount || 0` และไม่จัดการ `hiddenSubscriberCount` | unavailable counters อาจถูกบันทึก/จัดอันดับเป็นศูนย์ Need null/quality state และ exclusion rule ที่ชัดเจนก่อนเชื่อถือ ranking |
| `updater.js`:222–264 เขียน staging, snapshots, materialized rankings และ publication rows; [`0008_reliable_ranking_publication.sql`](../frontend/migrations/0008_reliable_ranking_publication.sql):25–58 เพิ่ม checkpoint/journal; ไม่พบ age-based purge ในเส้นทางที่ตรวจ | การเพิ่ม snapshot ล่าสุดไม่ได้ลบสำเนาเก่า immutable journal ไม่ควรแปลว่าเก็บ API Data ถาวร ต้องมี lifecycle ของทุกสำเนาและไม่ resurrect หลัง restore/retry |
| [`public.js`](../frontend/server/public.js):170–250 มี history/compare ย้อนหลัง default 6, สูงสุด 12 เดือน และ daily observations; :260–263 ใช้ `SUM(latest.followers)` สำหรับ public total | API เปิด historical comparison/aggregation แม้ public UI ไม่มีหน้า compare แล้ว Need gate ที่ server ไม่ใช่ซ่อน menu อย่างเดียว; subscriber sum ไม่ใช่ unique audience |
| [`snapshot-policy.js`](../shared/snapshot-policy.js):6–14 มีเพียง latest ordering และ active/YouTube eligibility; `ranking-service.js`:17–23, :39–44 มี upper cutoff แต่ไม่มี lower age cutoff | ชื่อ “policy” ไม่ได้บังคับ retention; latest snapshot อาจเก่าเกินอายุหาก collection หยุด และ carry-forward archive อาจคัด observation เก่ามาเผยแพร่ซ้ำ ต้องใช้ expiry/freshness checks ตาม grant จริง |
| [`ranking-service.js`](../frontend/server/ranking-service.js):9–31 และ [`shared/ranking.js`](../shared/ranking.js):12–19 ให้ `score` เท่ากับ raw counter, ties ได้อันดับเดียวกัน และ `rank_change` เป็นผลต่างอันดับ | เป็น raw-counter ranking ไม่ใช่ custom quality score; amendment ยกตัวอย่างห้ามแสดง subscriber count เป็น “score”.[2] Field ภายในไม่พิสูจน์ UI misrepresentation แต่ควรใช้ metric label ที่ตรงจริงและ review contract; rank movement ไม่ใช่ subscriber growth |
| `admin.js`:91–97 รับ manual snapshots; :130–141 ฝัง ranking rows ใน `reports.snapshot_json` และดาวน์โหลด CSV; :243–275 import ชื่อ/avatar/bio พร้อมสถิติ; Worker ขอเฉพาะ statistics | Manual data ไม่มี source/authorization/expiry แยก; reports เก็บ counters/metadata ซ้ำและ may outlive channel removal; metadata import ไม่ได้ refresh ตาม Worker จึงต้องติดตาม provenance และ refresh/delete ต่างจาก statistical retention |

**เอกสารไม่ตรง implementation ปัจจุบัน:** `API_SPEC.md` ระบุ summary ใช้ `MAX` แต่ source ใช้ `SUM`; `DATABASE.md`/`RANKING_ALGORITHM.md` ยังอธิบาย publication แบบเก่าและ monthly เป็น 30 วัน ขณะที่ Worker ใช้ Thai calendar month slots และ fenced publication batch พร้อม archive/journal รายงานนี้ให้น้ำหนัก source ที่อ่านมากกว่า spec เก่า และไม่ได้แก้เอกสารเหล่านั้น

## 4. Implementable next steps / approval gates (ยังไม่ได้ดำเนินการ)

1. **G0 — owner evidence:** ขอผู้รับผิดชอบส่ง non-secret audit/acceptance evidence, API Client/project mapping, accepted use case, amendment version, วันที่และ scope ของ permission ให้ผู้พิจารณา โดยครอบคลุม raw-counter leaderboard, `rank_change`, public compare/history, aggregate total และ retention ไม่ขอ credential; หากขอบเขตไม่ชัดให้ยืนยันกับ YouTube ก่อนถือว่าผ่าน
2. **G1 — release decision:** เจ้าของผลิตภัณฑ์และผู้ดูแล policy ตัดสิน public features ตาม G0; ก่อนผ่านให้เสนอ fixture ที่ระบุชัดหรือ directory ที่ไม่แสดง counters/ranks โดยยังต้องตรวจ provenance ของ imported metadata **ไม่เปลี่ยน feature flags ใน audit นี้** การปิด UI อย่างเดียวไม่ปิด API หรือ ingestion
3. **G2 — lifecycle design:** ทำ field/copy inventory และเลือก default public-cache path (30 วัน) หรือ accepted statistical-history path (ไม่เกิน 36 calendar months ตาม grant).[1][2] แยก metadata 30-day refresh, consent-based authorized path, absolute observation expiry และ deletion queue; วาง refresh ก่อน deadline พร้อม margin สำหรับ failure และไม่ใช้ calendar-month cron เป็น TTL enforcement
4. **G3 — future engineering:** เพิ่ม schema/quality flags และ nullable missing counters; server-side permission/freshness checks บน ingestion/public/admin/export; scheduled purge ที่ทำงานแม้ collection manual/ล้มเหลว, invalidation ของ rankings/reports/journal, suppression หลัง owner deletion และ policy-safe retry/restore; เก็บ audit proof โดยไม่เก็บ deleted counters ใน log อีกสำเนา
5. **G4 — verification ก่อน release:** tests เวลา expiry boundary, refresh failure, hidden/missing vs real zero, rounded ties, stale carry-forward, revoked consent, channel unavailable/deleted, report/cache purge, restore และ gated API access; ทดสอบ purge บน test D1 จริงนอกจาก mock และให้ owner ตรวจ read-back evidence ของ deletion โดยไม่ใช้ production สำหรับทดลอง
6. **G5 — presentation/terms review:** แยก raw count/third-party metric, ใส่เวลาต้นทางและ view-definition boundary, ไม่มี framing “war/battle” ที่ชวน harassment; ทบทวน privacy/deletion contact, YouTube attribution และขอบเขต API redistribution ของ `/api/v1/*` กับ III.I.15 ก่อนเปิด integration ภายนอก.[1][2]

**Blockers ที่ยังไม่ยืนยัน:** audit/amendment acceptance และขอบเขต grant; OAuth/creator consent ถ้าจะใช้ authorized path; อายุ/สำเนาจริงใน D1, cache, reports และ backups; scheduled cleanup นอกเส้นทาง source ที่ตรวจ; production attribution/privacy/deletion workflow ต้องขอ evidence ไม่ใช่เดาว่ามีหรือไม่มี ไม่ใช่การรับรองทางกฎหมาย และการเปิด use case ใหม่ต้องให้ผู้รับผิดชอบอนุมัติแยกจากงาน UI

## 5. Ingestion safeguard ที่เพิ่มหลัง audit (local worktree)

- `shared/youtube-statistics.js` เป็น validator ร่วมของ `worker/updater.js` และ `frontend/server/admin.js`: ปฏิเสธ hidden subscriber count แม้ response ส่งตัวเลขมาด้วย, counters ที่ missing/null, hidden flag ชนิดผิด และ counters ที่ไม่ใช่ non-negative safe integers; ศูนย์จริง (`0` / `"0"`) ยังรับได้
- Worker บันทึกเหตุผลรายช่องและจบรอบเป็น `partial` โดยไม่ stage/write/publish snapshots หรืออันดับใหม่ หากช่องในรอบใดมีสถิติไม่พร้อม; publication เดิมคงอยู่ตาม atomic contract เดิม และ retry ได้เมื่อ API ส่งสถิติครบ นี่ไม่ใช่การรับรองว่าข้อมูลเดิมยัง fresh หรืออยู่ใน retention limit
- Admin channel import คืน HTTP 502 พร้อมเหตุผลก่อนเปลี่ยน metadata, สร้างช่อง, เขียน snapshot หรือ audit success log; agency metadata import ไม่ต้องใช้ counters จึงไม่เปลี่ยนเส้นทางนั้น
- ไม่เปลี่ยน schema, ไม่บันทึก nullable observations, ไม่ลบ/ย้อนแก้ historical zeros และไม่ deploy. การเก็บ partial metrics โดยให้ช่องยังอยู่ในอันดับยอดวิว/คลิปต้องออกแบบ quality/provenance และ eligibility ต่อ metric แยกต่างหาก ไม่แทน null ด้วยศูนย์หรือคัดลอกค่าครั้งก่อนมาปลอมเป็น observation ใหม่
- Regression coverage: shared validator, mounted Admin + transactional SQLite pipeline และ ephemeral Miniflare D1 ตรวจ hidden/missing/invalid vs real zero, no partial persistence, publication preservation และ valid retry โดยใช้ synthetic YouTube responses ไม่เรียก API จริงหรือ production DB
- Approval, retention, expiry/deletion และสำเนาข้อมูลเดิมยังเป็น blockers ตาม G0–G5; safeguard นี้แก้การ fabricate counter เท่านั้น ไม่ใช่ compliance approval

## Sources

[1] https://developers.google.com/youtube/terms/developer-policies — YouTube API Services - Developer Policies  |  Google for Developers
[2] https://developers.google.com/youtube/terms/derived-metrics-policy — Additional policies for derived metrics and data storage  |  YouTube  |  Google for Developers
[3] https://developers.google.com/youtube/v3/docs/channels — Channels  |  YouTube Data API  |  Google for Developers
[4] https://developers.google.com/youtube/v3/docs/channels/list — Channels: list
