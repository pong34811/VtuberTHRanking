# ผลตรวจหน้าเว็บ — 17 กันยายน 2026

## ขอบเขตและวิธีตรวจ

ตรวจเส้นทางใน App และ AdminPage, components, ฟอร์ม และ API contract ที่หน้าเว็บเรียกใช้ โดยเก็บการเปลี่ยน Homepage จากงานก่อนหน้าไว้

| หน้า | วิธีตรวจ | ผลและสิ่งที่แก้ |
|---|---|---|
| Homepage | ตรวจการเปลี่ยนแปลงเดิมและปรับ Cypress assertions | อัปเดต expectations ให้ตรงกับหัวข้อและข้อความใหม่ |
| ค้นหา /search | เบราว์เซอร์กับข้อมูลจริง + component test | ค้นหา Urana ได้ 1 ช่อง; เพิ่มหมวดอื่น ๆ และตัดช่องว่างหัวท้ายคำค้น |
| โปรไฟล์ /profile/:slug | เบราว์เซอร์กับข้อมูลจริงที่ 390px + component test | ใช้รูปจริงพร้อม fallback, เพิ่มลิงก์กลับ, ปรับ bio และลำดับ heading; แสดงจุดกราฟกรณีมีข้อมูลวันเดียว |
| เปรียบเทียบ /compare | เบราว์เซอร์กับข้อมูลจริงที่ 390px + component tests | เลือก 2 ช่องและโหลดกราฟสำเร็จ; ป้องกันนำช่องออกขณะรอผล; แยก loading จาก empty state; แสดงจุดข้อมูล |
| เส้นทางที่ไม่มีอยู่ | เบราว์เซอร์ | แสดงข้อความไม่พบหน้าและลิงก์กลับ แทนหน้าว่าง |
| เข้าสู่ระบบ /admin | ตรวจโค้ดและเบราว์เซอร์ | ฟอร์มแสดงผล; ไม่ได้ส่งข้อมูลล็อกอิน |
| จัดการช่อง /admin/channels | ตรวจโค้ด + component tests | แก้ Alert ที่ไม่ได้ import ซึ่งทำให้หน้าล้มเมื่อ API ล้มเหลว; เพิ่ม retry และล้าง error เดิม |
| สังกัด /admin/agencies | ตรวจโค้ด + component test | ใช้ useList ที่แก้การค้าง error และป้องกันผลตอบกลับเก่าทับข้อมูลใหม่ |
| จัดอันดับ /admin/rankings | ตรวจโค้ด + component tests | ป้องกันผลตอบกลับของตัวกรองเก่าทับข้อมูลล่าสุด |
| หมวดหมู่ /admin/categories | ตรวจ API contract + component tests | แสดงปุ่มแก้ไขเฉพาะ manager ตามสิทธิ์ฝั่ง server; ส่งเฉพาะฟิลด์ที่แก้ได้ |
| รายงาน /admin/reports | ตรวจโค้ด + component/API tests เดิม | ตรวจฟอร์มและการจัดการ download error; ใช้ useList ที่ปรับปรุงแล้ว |
| ผู้ใช้งาน /admin/users | ตรวจโค้ด + component tests | แสดง error เมื่อปิดใช้งานผู้ใช้ไม่สำเร็จ; ปรับ dialog ร่วม |
| ประวัติ /admin/history | ตรวจโค้ด + component test | ใช้ useList ที่แก้ไขแล้ว; ตรวจตารางและสิทธิ์ manager |
| ตั้งค่า /admin/settings | ตรวจโค้ด + component tests | แสดง load error และ retry; ไม่แสดงฟอร์มค่าเริ่มต้นเมื่อโหลดล้มเหลว; แสดงข้อความบันทึกสำเร็จ |
| สถิติช่อง / ช่องแก้ไข / นำเข้า YouTube | ตรวจโค้ด + component tests | แก้เวลา datetime-local ไม่ให้คลาดเคลื่อนจาก UTC; จัดการ load error ของสถิติพร้อม retry |
| Dialog และ layout ร่วม | ตรวจโค้ด + component test | dialog เดิมใช้ Radix เพื่อชื่อที่อ่านได้, focus trap และ Escape; จำกัด CSS padding ของหน้าสาธารณะไม่ให้ทับหน้า admin |
| ออกจากระบบ | ตรวจโค้ด | เมื่อ logout API ล้มเหลว แสดง error แทนการแสดงว่าออกจากระบบแล้ว |

## การตรวจยืนยัน

- Vitest: 138 tests ผ่านใน 9 files รวม regression tests เพิ่ม 13 รายการ
- ตรวจ production build และ git diff --check
- ค้นหา → โปรไฟล์ และเลือกสองช่อง → กราฟเปรียบเทียบ ทำงานกับ API จริง
- ไม่พบ horizontal overflow จากการวัด DOM ในหน้าโปรไฟล์และเปรียบเทียบที่ viewport 390px

## ข้อจำกัด

- หน้าแอดมินหลังล็อกอินตรวจจาก source และ API/component tests จำลอง ไม่ได้ตรวจ visual หรือส่งฟอร์มด้วย session ผู้ดูแลจริง
- ไม่ได้สร้าง แก้ไข หรือลบข้อมูลจริง, ดาวน์โหลดรายงานจริง, นำเข้าข้อมูล YouTube หรือเผยแพร่เว็บ
- ไม่ได้รัน Cypress suite; ปรับ assertions หน้าแรกที่ล้าสมัยไว้แล้ว
- การตรวจนี้ไม่ใช่ accessibility audit เต็มรูปแบบหรือการตรวจทุก viewport/ทุกสถานะเครือข่าย
