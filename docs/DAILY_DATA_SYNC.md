# การค้นหาและอัปเดตข้อมูลรายวัน — Refs #10

เผยแพร่และเปิดใช้งาน production วันที่ 5 ตุลาคม 2026 เวลา 17:12 น. (Asia/Bangkok) ตามการอนุมัติใน Issue #10: `directory_sync_enabled=true`, `ranking_update_frequency=daily` ตรวจอ่านค่ากลับจาก D1 แล้ว มี audit `day-sync-1791195151093` ระบุการดำเนินการผ่าน Wrangler และหลักฐานอนุมัติ Cron production คือ `0 * * * *`; ณ เวลาตรวจยังไม่มี directory run รอบแรกคาดว่าเริ่ม 18:00 น. วันเดียวกัน ผล YouTube จริงยังไม่ยืนยัน

## การเปิดใช้งาน

1. ใช้ migration `0010_daily_directory_sync.sql` กับ D1 เดียวกับ Pages และ Worker หลังอนุมัติ release
2. ตั้ง `YOUTUBE_API_KEY` ที่ Worker และคง `UPDATER_RUN_TOKEN` สำหรับ manual statistics endpoint เดิม ห้ามส่ง secrets ไป frontend
3. Manager เปิด Admin → ตั้งค่าเว็บไซต์ เลือกความถี่การอัปเดต **ทุก 24 ชั่วโมง** และค้นหาและอัปเดตโปรไฟล์ **อัตโนมัติรายวัน** แล้วบันทึก
4. ใช้ cron เดิม `0 * * * *` และ deploy Worker กับ Pages ที่อ่าน schema ใหม่นี้

ค่า discovery เริ่มต้นเป็นปิดเพื่อให้ migration ไม่เริ่มเขียนข้อมูลจริงก่อนตรวจรับ การตั้งค่าสถิติเดิมไม่ถูกเปลี่ยนโดย migration รอบโปรไฟล์จะทำงานใน cron แรกที่มาถึงและครั้งต่อไปตามวัน Asia/Bangkok; ไม่ใช่การรับประกันเวลาตายตัวเมื่อ cron/API ล้มเหลว การตั้งค่ารอบสถิติและโปรไฟล์แยกกัน หากสถิติเป็น manual แต่เปิด discovery โปรไฟล์ยังทำงานรายวัน

## ข้อมูลและหลักฐาน

- รีเฟรชชื่อช่อง รูป avatar และคำอธิบายจาก YouTube `channels.list` ของช่อง YouTube ในระบบ คง slug, หมวด, สังกัด, วันเดบิว, notes และสถานะ active/inactive
- เก็บค่าต้นทางล่าสุดใน `youtube_profile_state` แยกจากข้อมูลที่ผู้ดูแลแก้ อัปเดตเฉพาะฟิลด์ว่างหรือฟิลด์ที่ยังตรงกับค่าต้นทางครั้งก่อน รอบแรกเก็บ baseline และรักษาฟิลด์เดิมที่ไม่ว่างเพราะไม่มีหลักฐานว่าเป็นข้อมูลที่ผู้ดูแลตั้งเองหรือข้อมูลนำเข้า
- หากผู้ดูแลเปลี่ยนลิงก์ช่องขณะ fetch ค้าง จะไม่บันทึกโปรไฟล์เก่าทับช่องใหม่ ถ้าข้อมูลต้นทางไม่ครบ/ผิดรูปแบบ เก็บข้อมูลเดิมและบันทึก partial outcome
- แหล่ง roster ที่ตรวจและรองรับ: [Pixela official virtual influencers](https://www.pixela.me/virtual-influencers) อ่านเฉพาะลิงก์ YouTube ในการ์ดสมาชิก สถานะ Graduated เข้าคิวรอตรวจ ไม่ถูกเปิดใช้งานใหม่อัตโนมัติ ไม่อนุมานวันเดบิวจากวันสร้างช่อง
- ค้นหา YouTube `Thai VTuber` ตามวันสร้างช่อง ครั้งละไม่เกิน 10 ช่อง ผลค้นหาเป็นเพียงเบาะแส ต้องอ่านคำอธิบายจากช่องจริงที่มีบรรทัดประกาศชัดเจน เช่น `Independent Thai VTuber` หรือ `VTuber ไทยอิสระ` และไม่มีข้อความบ่งชี้สังกัด/เกษียณก่อนเพิ่มเป็นอิสระอัตโนมัติ รายการอื่นรอตรวจ ไม่มีการรับประกันว่าจะค้นพบ VTuber ไทยครบทุกช่อง
- Algorhythm Project ยังไม่มี adapter: เว็บไซต์ดึงไม่สำเร็จระหว่างตรวจครั้งนี้ เพิ่มแหล่งอื่นเมื่อยืนยัน roster/layout และหลักฐานสมาชิกได้
- ช่องใหม่ต้องผ่านการตรวจสถิติด้วย validator เดิมก่อนรับเข้า ไม่สร้าง snapshot ศูนย์สำหรับ counter ที่หาย/ซ่อน Snapshot และอันดับยังเขียนโดย pipeline สถิติเดิมทั้งหมด
- เก็บ candidate ตาม canonical channel ID และหลักฐานต้นทาง ไม่สร้างซ้ำเมื่อพบหลายแหล่ง รายการ imported/ignored คงสถานะไว้แม้ record ช่องถูกลบเพื่อป้องกันการนำกลับมาเอง ผู้ดูแลยังนำเข้าเองได้ผ่านเมนูจัดการช่อง

## ความล้มเหลวและตรวจรับ

Admin แสดงสถานะรอบโปรไฟล์ จำนวนที่ตรวจ/เพิ่ม/รอตรวจ และคิวหลักฐาน ใช้ **ข้ามช่องนี้** เพื่อหยุด admission ของ candidate แบบมี audit; การนำเข้าด้วยตนเองยังใช้หน้าจัดการช่องเดิม

รอบใช้ lease/fence และ D1 batch ตรวจเจ้าของ lease ทุก mutation รองรับ retry หลัง partial/failed โดยไม่เพิ่มช่องซ้ำ ความล้มเหลวของ directory ไม่หยุด pipeline สถิติ แต่สถิติยังคง atomic publication contract เดิม ถ้า discovery สำเร็จหลังสถิติของวันนั้นเผยแพร่แล้ว ช่องใหม่จะเข้าสถิติใน collection slot ถัดไป

มีเพดาน 40 YouTube requests และเวลา 60 วินาทีต่อ invocation; รอ cron ถัดไปหลัง partial ข้อมูลสมาชิกใหม่ที่เพิ่มสำเร็จแล้วถูกข้ามในการค้นหาครั้งต่อไป Source adapter ใช้ HTMLRewriter ของ Cloudflare ไม่มี dependency ใหม่ รูปแบบเว็บทางการเปลี่ยนหรือไม่มีการ์ดจะรายงาน partial แทนการเดา

ทดสอบด้วยข้อมูลจำลองและ ephemeral Miniflare D1/HTMLRewriter รวม daily gate ตามเวลาไทย, admission, snapshot/ranking, การรันชนกัน, malformed profile, hidden counter, source failure, retry, curated field/URL race, tombstone และ manager/CSRF/audit rollback พร้อม Cypress journey บันทึกค่ารายวันและข้าม candidate

อ้างอิง API: [YouTube channels.list](https://developers.google.com/youtube/v3/docs/channels/list), [search.list](https://developers.google.com/youtube/v3/docs/search/list), [Cloudflare HTMLRewriter](https://developers.cloudflare.com/workers/runtime-apis/html-rewriter/). Lifecycle/use-case approval ที่ยังไม่ยืนยันใน [policy review](YOUTUBE_DATA_POLICY_REVIEW.md) ต้องตรวจรับแยกก่อนเปิดใช้ production; งานนี้ไม่รับรอง compliance หรือแก้ retention ของ snapshot เดิม

## Issue #12 — Local approval queue (2026-10-06, awaiting release)

New YouTube discoveries/imports are pending until manager approval. Daily review moved to `/admin/channel-approvals`; Settings retains controls and history. Manual YouTube creation and imports announce `202 queued`; existing edits retain ordinary saves. Affiliation is explicitly selected and YouTube identity fixed. Search/page progress and cumulative/current counts are distinguished; evidence remains literal and uncertain. See [approval decisions and glossary](CHANNEL_APPROVALS.md). Apply migrations 0011/0012 only with separate release approval; no #12 production changes have been made. The Issue #10 paragraphs above describe its prior deployment, not the new approval behavior.
