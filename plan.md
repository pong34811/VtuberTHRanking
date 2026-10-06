# แผนพัฒนา VtuberTHRanking และติดตามงานผ่าน GitHub Issues

วันที่: 5 ตุลาคม 2026 (Asia/Bangkok)

## 1. เป้าหมายและกติกา

ทำให้ผู้ใช้ค้นหา VTuber เปิดโปรไฟล์ และเข้าใจอันดับได้ง่ายขึ้น เริ่มจากตรวจเว็บไซต์ปัจจุบัน แล้วใช้กระบวนการเดียวกันกับงานใหม่ทุกงาน

- ทำงานบน `main` ในโฟลเดอร์หลักเท่านั้น ไม่สร้าง branch หรือ worktree ใหม่
- ใช้ GitHub Issues ของ `pong34811/VtuberTHRanking` เป็นทะเบียนงาน
- เจ้าของโครงการอนุมัติผ่านแชต Codex โดยระบุหมายเลข Issue; อนุมัติเป็นชุดได้หากระบุรายการชัดเจน
- แยกการอนุมัติเริ่มแก้ไข การ push/deploy และการปิด Issue
- การอนุมัติแผนหรือให้ตรวจเว็บไซต์ ไม่ถือเป็นการอนุมัติแก้ทุก Issue ที่พบ

## 2. รับงาน ตรวจสอบ และวิเคราะห์

สำหรับงานใหม่แต่ละรายการ สรุปสิ่งที่ต้องการ ผู้ใช้ที่ได้รับผลกระทบ พฤติกรรมปัจจุบัน ผลลัพธ์ที่คาดหวัง และเงื่อนไขตรวจรับ ถ้าข้อมูลสำคัญไม่ครบ ให้ถามก่อนกำหนดวิธีแก้

รอบแรกตรวจเว็บไซต์ปัจจุบันครอบคลุม:

- หน้าอันดับ `/`, `/home`, `/stats`: หมวด สังกัด ช่วงเวลา และความเข้าใจตัวเลข
- `/discover` และโปรไฟล์: ค้นหา กรอง แบ่งหน้า ลิงก์ รูปภาพ และประวัติสถิติ
- Admin: สิทธิ์ผู้ใช้ ฟอร์ม การบันทึก และ template preview
- มือถือ เดสก์ท็อป คีย์บอร์ด รวมถึง loading, empty, error และ retry
- ประสิทธิภาพ: เวลาโหลด จำนวนคำขอ และ query ที่เกี่ยวข้องกับเส้นทางหลัก

เทียบเอกสารกับโค้ดและ tests ปัจจุบัน ไม่ถือแผนเก่าหรือรายการคงเหลือว่าเป็นปัญหาที่ยังเกิดอยู่ ตรวจบน local ด้วยข้อมูลจำลอง ส่วนที่ต้องใช้สิทธิ์หรือข้อมูลเพิ่มเติมให้ระบุว่า **ยังไม่ได้ตรวจยืนยัน**

วิเคราะห์ต้นเหตุและเสนอวิธีแก้ที่ใช้ส่วนประกอบเดิมก่อน จัดลำดับงานตามผลกระทบ: ปัญหาที่ทำงานหลักไม่ได้ → อุปสรรคที่เกิดบ่อย → การปรับปรุงเพิ่มเติม

## 3. เปิด Issue ก่อนรออนุมัติเริ่มงาน

ตรวจ Issue เดิมก่อนสร้างใหม่ แยกหนึ่ง Issue ต่อปัญหาที่แก้และตรวจรับได้อย่างอิสระ หากหลายอาการมาจากต้นเหตุเดียวกัน ให้รวมเป็นงานเดียว

แต่ละ Issue ต้องมี:

- ปัญหาและผลกระทบ พร้อมหลักฐานหรือขั้นตอนทำซ้ำ
- พฤติกรรมปัจจุบันและผลลัพธ์ที่ต้องการ
- ต้นเหตุที่ยืนยันแล้ว หรือข้อสงสัยที่ต้องตรวจเพิ่ม
- แนวทางแก้ ขอบเขต ลำดับความสำคัญ และงานที่ต้องทำก่อน
- เกณฑ์ตรวจรับ วิธีทดสอบ และผลกระทบต่อ API/schema หากเกี่ยวข้อง

ใช้ labels ที่มีอยู่ เช่น `bug`, `enhancement`, `accessibility`, `documentation` หรือ `question` และบันทึกสถานะกระบวนการในเนื้อหา Issue:

**รออนุมัติเริ่ม → กำลังดำเนินการ → รอตรวจรับ → เสร็จสิ้น**

ส่งรายการหมายเลข Issue และลิงก์ให้เจ้าของโครงการพิจารณา เริ่มเฉพาะรายการที่อนุมัติชัดเจน พร้อมบันทึกหลักฐานอนุมัติใน Issue ถ้าสร้าง Issue ไม่สำเร็จ ให้รายงานข้อจำกัดและเก็บรายละเอียดสำหรับลองใหม่ ไม่ข้ามไปแก้โค้ด

## 4. แก้ไข ทดสอบ และส่งตรวจรับ

แก้ต้นเหตุบน `main` ภายในขอบเขตที่อนุมัติ ถ้าพบงานเพิ่มเติม ให้เปิด Issue ใหม่และรออนุมัติรายการนั้นก่อน

- เพิ่ม regression test สำหรับพฤติกรรมที่เปลี่ยน
- รัน tests ที่เกี่ยวข้องและ production build; รัน Cypress เมื่อเปลี่ยน user journey
- ตรวจ SQL/migrations กับ SQLite หรือ local D1 เมื่อมีการเปลี่ยนฐานข้อมูล
- ตรวจ UI บนมือถือ เดสก์ท็อป และคีย์บอร์ดเมื่อเกี่ยวข้อง
- งานประสิทธิภาพต้องเปรียบเทียบก่อนและหลังในสภาพทดสอบเดียวกัน

เมื่อผ่าน ให้บันทึก commit พร้อม `Refs #หมายเลข` หลีกเลี่ยงข้อความที่ปิด Issue อัตโนมัติ เช่น `Fixes #หมายเลข` หรือ `Closes #หมายเลข`

รายงานสิ่งที่แก้ หลักฐานทดสอบ ภาพก่อน/หลังสำหรับ UI และข้อจำกัดที่เหลือ Issue ยังคงเปิดในสถานะ **รอตรวจรับ** หากไม่ผ่านการตรวจรับ ให้แก้ต่อใน Issue เดิมตามข้อเสนอแนะ โดยไม่ขยายขอบเขตเอง

## 5. เผยแพร่และปิดงานหลังอนุมัติ

- Push/deploy เฉพาะเมื่อเจ้าของโครงการอนุมัติชัดเจน หลังตรวจผล local แล้ว
- หลัง deploy ตรวจเส้นทางที่เปลี่ยนและรายงานผล ไม่ทดลองเขียนข้อมูล production
- ปิด Issue เป็น **เสร็จสิ้น** เฉพาะเมื่อได้รับอนุมัติปิดหมายเลขนั้น
- หากอนุมัติ deploy อย่างเดียว Issue ยังเปิดอยู่ หากรับงาน local โดยยังไม่ deploy ให้บันทึกสถานะการเผยแพร่ตามจริง
- การปิดงานต้องมีสรุปผล commit ที่เกี่ยวข้อง และหลักฐานตรวจรับใน Issue

แผนนี้เป็นแหล่งอ้างอิงกระบวนการเดียว โดยเชื่อมจาก `AGENTS.md` และ skill `vtuberthranking` ไม่ต้องสร้างสำเนาอีกไฟล์ใน `docs/`

ยังไม่กำหนดการเปลี่ยน API หรือ schema ล่วงหน้า การเปลี่ยนดังกล่าวต้องระบุและได้รับอนุมัติใน Issue ของงานนั้น ไม่เปลี่ยนสูตรอันดับ ขยายแพลตฟอร์ม หรือเพิ่มบริการใหม่เพียงเพราะพบข้อเสนอในเอกสารเก่า

## 6. แผนหน้าแรก 3D และ Template ที่เลือกจาก Admin

เพิ่มแผนตามคำขอวันที่ 5 ตุลาคม 2026 สถานะ **อนุมัติ #4, #6 และ #7 แล้ว / implementation local ผ่านการทดสอบ / รอตรวจรับ** ต้นแบบเป็นไฟล์ออกแบบแยกจากเว็บไซต์จริง การเลือกแบบและการขอเขียนแผนไม่ใช่การอนุมัติ push/deploy หรือปิด Issue

งานหน้าแรกหลักติดตามใน [Issue #4](https://github.com/pong34811/VtuberTHRanking/issues/4) ส่วนระบบเลือก Template ติดตามใน [Issue #6](https://github.com/pong34811/VtuberTHRanking/issues/6) งานนี้ขยายจากหน้าแรกแบบเดียวใน #4 ให้เลือกเปลี่ยนได้ โดยต้องอนุมัติขอบเขตของ #6 เพิ่มก่อน implementation

### 6.1 แบบหลักและตัวเลือกอีก 4 แบบ

ใช้ **แบบ 4 — Sculpture Index 3D** เป็นค่าเริ่มต้นตามที่เจ้าของเลือก ลบทั้งส่วน “สามทางเข้าสู่โลก VTuber ไทย” คำอธิบาย และการ์ดทำเนียบ/โปรไฟล์/อันดับทั้งสามใบออกจากแบบนี้ตามคำยืนยันล่าสุด

เพิ่มหัวข้อ **“เกี่ยวกับเรา”** ตามคำขอเพิ่มเติม โดยวางหลังส่วนแนะนำหลัก (Hero) และก่อน “อ่านข้อมูลอย่างเข้าใจ” ใช้ข้อความสองย่อหน้า อ่านง่าย ไม่เพิ่มการ์ดสามใบที่ขอลบกลับมา:

> **VTuberTH Rankings** เป็นเว็บไซต์รวบรวมข้อมูลและจัดอันดับ VTuber ไทยจากสถิติของช่อง YouTube เพื่อให้คุณค้นพบช่องที่สนใจ ทำความรู้จักผ่านโปรไฟล์ และสำรวจอันดับได้ในที่เดียว
>
> คุณสามารถดูอันดับตามจำนวนผู้ติดตาม ยอดวิวรวม และจำนวนคลิป พร้อมเลือกช่วงเวลาที่ต้องการสำรวจ ทำเนียบช่องรวบรวมโดยทีมงาน จึงอาจยังไม่ครอบคลุม VTuber ไทยทุกช่อง

ส่วน “เกี่ยวกับเรา” อธิบายตัวเว็บไซต์และเป้าหมาย ส่วน “อ่านข้อมูลอย่างเข้าใจ” อธิบายยอดสะสม รอบเดือน และข้อจำกัดของ snapshot แยกบทบาทกัน เนื้อหาเกี่ยวกับเราเป็นข้อความร่วมของทั้งห้า Template เมื่อ implementation โดยจัด desktop เป็นหัวข้อซ้าย/รายละเอียดขวา และมือถือเป็นคอลัมน์เดียว ไม่เพิ่มระบบแก้ข้อความใน Admin ในรอบนี้ ต้นแบบที่อัปเดตรอบนี้คือแบบ 4 ที่เจ้าของเลือก

เพิ่มหัวข้อ **“นิยาม วีทูปเบอร์ไทย”** ต่อจากเกี่ยวกับเรา และก่อนอ่านข้อมูลอย่างเข้าใจ ตามคำขอเจ้าของ โดยใช้ข้อความ:

> วีทูปเบอร์ไทย คือครีเอเตอร์ในชุมชนไทยที่ใช้ตัวละครหรืออวตารเสมือนเป็นตัวแทนในการสร้างเนื้อหาและพูดคุยกับผู้ชม
>
> ในนิยามของเว็บไซต์นี้ **วีทูปเบอร์ไทยที่เปิดตัวอย่างเป็นทางการ คือผู้ที่ขึ้นไลฟ์สตรีมเดบิว** เพื่อแนะนำตัวละคร ทำความรู้จักกับผู้ชม และประกาศเริ่มต้นเส้นทางในฐานะวีทูปเบอร์
>
> ไลฟ์สตรีมเดบิวจึงเป็นจุดเริ่มต้นของการเปิดตัวอย่างเป็นทางการตามนิยามนี้

เน้นย่อหน้าการเดบิวด้วยแถบสี accent พื้นอ่อน และข้อความตัวหนา อ่านง่ายบน desktop/mobile เป็นนิยามสำหรับเว็บไซต์ ไม่อ้างว่ามีหน่วยงานรับรอง เนื้อหานี้เป็นข้อความร่วมทั้งห้า Template เมื่อ implementation; การเพิ่มข้อความไม่เปลี่ยนการนับ active profiles การคัดเข้าทำเนียบ สูตรอันดับ หรือเพิ่มการตรวจหลักฐาน/วันที่เดบิวในระบบโดยอัตโนมัติ หากต้องการใช้เป็นเกณฑ์คัดช่องจริง ให้เปิดขอบเขตข้อมูลและวิธีตรวจรับใน Issue แยก

เพิ่ม **แถบจำนวน VTuber ไทย 3 ช่อง** ระหว่าง Hero กับเกี่ยวกับเรา ตามคำขอเพิ่มเติม:

แบบ 4 วางเส้นแบ่งสีดำ **ใต้แถบจำนวนและ caption ก่อนเกี่ยวกับเรา** แทนเส้นเหนือแถบจำนวนตามคำขอปรับล่าสุด ใช้ตำแหน่งเดียวกันทั้ง desktop และ mobile

| ชื่อที่แสดง | วิธีนับ |
| --- | --- |
| ทั้งหมด | จำนวนวีทูปเบอร์อิสระ + จำนวนวีทูปเบอร์สังกัด |
| วีทูปเบอร์อิสระ | จำนวนช่องที่ `affiliation = indie` และ `is_active = 1` |
| วีทูปเบอร์สังกัด | จำนวนช่องที่ `affiliation = agency` และ `is_active = 1` |

นับจากทำเนียบช่องที่เปิดเผยอยู่ในเว็บ ไม่ใช่จำนวนที่มีอันดับหรือจำนวน VTuber ไทยทั่วประเทศ ใช้ caption “จำนวนช่องในทำเนียบที่ทีมงานรวบรวม” และหน่วย “ช่อง” ทั้งหมดต้องคำนวณจากสองกลุ่มตามคำขอ ไม่ใช้จำนวนรายการในหน้าปัจจุบันหรือค่าที่กรองตามอันดับ

ใช้ `affiliation_counts` ที่มีใน `GET /api/v1/directory/?limit=1` ซึ่งเป็น global facets ของ active profiles อยู่แล้ว เรียกหนึ่งครั้งโดยไม่ส่งคำค้น/หมวด/สังกัด ไม่ต้องโหลดรายชื่อทั้งหมดหรือเพิ่ม endpoint/schema การโหลดจำนวนแยกจาก intro config เพื่อให้ข้อความแนะนำและปุ่มใช้งานได้แม้คำขอใดล้มเหลว

Loading แสดง “—” กับสถานะกำลังโหลด; error แสดง “—” กับข้อความโหลดจำนวนไม่สำเร็จและ retry ไม่แปลงเป็น 0; success-empty จึงแสดง 0 จริง ตรวจ response ให้เป็น counts จำนวนเต็มไม่ติดลบก่อนแสดง/รวม ค่า affiliation อื่นไม่รวมในทั้งหมดของสองกลุ่มนี้ และข้อมูลขาดรูปแบบต้องไม่ถูกสรุปเป็นศูนย์โดยเงียบ ๆ

เมื่อ implementation ให้ทั้งห้า Template มีแถบจำนวนด้วยรูปแบบตาม theme ตนเอง Desktop สามช่องเรียงแนวนอนและมือถือเรียงลง ต้นแบบแบบ 4 รอบนี้ใช้ “—” พร้อมข้อความว่ายังไม่เชื่อมข้อมูลจริง ไม่ใช้จำนวนสมมติเป็นข้อมูลจริง

| หมายเลขต้นแบบ | Template ID ที่เสนอ | ชื่อ | แนวทาง |
| --- | --- | --- | --- |
| 1 | `paper-atelier-3d` | Paper Atelier 3D | โทนอุ่น สีครีม/ส้ม วัตถุมีมิติแบบงานกระดาษ |
| 2 | `neon-portal-3d` | Neon Portal 3D | พื้นเข้ม โลโก้นูนสีมินต์ แสงและกรอบสีน้ำเงิน |
| 3 | `candy-world-3d` | Candy World 3D | พาสเทลม่วง/ชมพู รูปทรงโค้ง แสงเงานุ่ม |
| 4 | `sculpture-index-3d` | Sculpture Index 3D | ค่าเริ่มต้น ขาว/ดำ/แดง ตัวอักษรเด่น รูปทรงเหลี่ยม |
| 5 | `soft-garden-3d` | Soft Garden 3D | โทนเขียว/ครีม วัตถุนูนและการ์ดบรรยากาศสงบ |

รวม **5 ตัวเลือก: แบบหลัก 1 แบบ + ทางเลือก 4 แบบ** อีกสี่แบบรักษาองค์ประกอบตามต้นแบบของตน การลบส่วนการ์ดข้างต้นใช้กับแบบ 4 เท่านั้น ไม่เพิ่ม switch เปิด/ปิด section ในรอบนี้

ต้นแบบอ้างอิงคือ `design-1-3d.html` ถึง `design-5-3d.html` ใน Codex visualization directory ของแชตนี้ ก่อน implementation ให้นำเฉพาะเนื้อหา/รูปแบบที่เลือกเข้า source และเก็บภาพอ้างอิงที่จำเป็นใน repository ไม่พึ่งไฟล์ Temp, absolute path บนเครื่อง หรือ preview server พอร์ต 4174 ในเว็บไซต์จริง

### 6.2 แยกหน้าแรกออกจากหน้าค้นพบ

หน้าแนะนำเว็บไซต์อยู่ `/` ตาม #4 หน้าอันดับคง `/home` และ `/stats` และทำเนียบคง `/discover` ลิงก์อันดับเดิมที่ `/` พร้อม ranking query ต้องรักษาบริบทตามเกณฑ์ #4

ระบบ Template ปัจจุบันชื่อ `homepage_template` แต่ใช้กับ **หน้าค้นพบ** มี ID `search-first`, `category-first`, `newest-first` ให้คงค่าและ API เดิม ไม่ใส่ห้า ID ใหม่ลง allowlist นี้

เพิ่มเมนู **“หน้าแรก”** ที่ `/admin/intro-homepage` สำหรับ manager เลือกห้าแบบข้างต้น และคงเมนู **“หน้าค้นพบ”** ที่ `/admin/homepage` สำหรับสามแบบเดิม การเปลี่ยนหน้าแรกไม่เปลี่ยนหน้าค้นพบ และย้อนกลับมาเลือกแบบ 4 ได้ตลอด

### 6.3 ขั้นตอนใช้งานใน Admin

1. เข้าเมนูหน้าแรก อ่านค่าที่เผยแพร่อยู่จาก API แล้วแสดงชื่อแบบปัจจุบัน
2. แสดงตัวเลือกทั้งห้า พร้อม thumbnail ชื่อ คำอธิบายสั้น และ badge “เผยแพร่อยู่” ให้แบบ 4 ระบุว่าเป็นค่าเริ่มต้น
3. คลิกเลือกแบบเพื่อเปลี่ยน **draft** และ preview เท่านั้น แสดงข้อความ “ตัวอย่าง — ยังไม่เผยแพร่” เมื่อ draft ต่างจากค่าปัจจุบัน
4. Preview ใช้ component เดียวกับหน้า public และ theme/layout ที่เลือก ย่อให้เห็นได้ใน Admin; ลิงก์และการค้นหาต้องไม่พาออกจาก Admin ไม่เขียนข้อมูลระหว่าง preview
5. กด “บันทึกหน้าแรก” จึงเขียน setting และ audit ปิดปุ่มเมื่อค่าไม่เปลี่ยนหรือกำลังบันทึก แสดงผลสำเร็จหรือ error/retry ให้ชัดเจน
6. หลังบันทึก ผู้ชมที่เปิดหรือโหลดหน้าแรกใหม่เห็นแบบที่เลือก และเปิด Admin ใหม่ยังอ่านค่าเดิมได้ ไม่ทำ live polling

รักษาพฤติกรรม save race ของ pattern เดิม: หากเริ่มบันทึก A แล้วผู้ใช้เลือก B ระหว่างรอ เมื่อ A สำเร็จให้ published เป็น A แต่ draft ยังเป็น B การบันทึกล้มเหลวต้องไม่ทิ้ง draft หรือกล่าวว่าเผยแพร่สำเร็จ

### 6.4 ข้อมูลและ API ที่เสนอใน Issue #6

ใช้ตาราง `settings` เดิม เพิ่ม key **`intro_homepage_template`** แยกจาก `homepage_template` ใช้ shared allowlist และ normalize ของหน้าแนะนำสำหรับทั้ง API และ frontend

| API | พฤติกรรม |
| --- | --- |
| `GET /api/v1/admin/settings/intro-homepage-template` | manager เท่านั้น; คืน `{ intro_homepage_template: ID }` |
| `PUT /api/v1/admin/settings/intro-homepage-template` | manager เท่านั้น; รับ `{ intro_homepage_template: ID }` และคืน `{ ok: true, intro_homepage_template: ID }` เมื่อบันทึกสำเร็จ |
| `GET /api/v1/intro-homepage-config/` | public; คืนเฉพาะ `{ template: ID }` ที่ normalize แล้ว ไม่เปิดเผยข้อมูลผู้ดูแลหรือ audit |

ค่า missing/invalid ในฐานข้อมูลอ่านเป็น `sculpture-index-3d`; การเขียนรับเฉพาะห้า ID และปฏิเสธ ID อื่นด้วย 400 ใช้ parameterized SQL และบันทึก upsert setting กับ audit ใน D1 batch เดียวตาม pattern เดิม รักษา session, manager guard, CSRF และ origin checks ของ mounted API

ไม่ต้องเพิ่มตารางหรือแก้ schema: default ทำบน read และสร้าง setting เมื่อ save ไม่ต้อง migration เพื่อ seed ค่า ถ้าระหว่าง implementation พบเหตุให้เปลี่ยน schema ให้บันทึกขอบเขตเพิ่มใน Issue และใช้ migration ใหม่ตามลำดับ

Public config ใช้ `Cache-Control: no-store` เช่น endpoint เดิม หน้าแรกแสดงแบบ 4 ได้ทันทีโดยไม่รอข้อมูล ranking/directory; เมื่อ config สำเร็จจึงใช้แบบที่เผยแพร่ หาก config ล้มเหลวยังมีหน้าแนะนำและลิงก์ที่ใช้ได้ และ ignore response ที่ล้าสมัยเมื่อออกจากหน้า

### 6.5 แนวทาง implementation และลำดับส่งมอบ

1. **หน้าแรกหลัก (#4):** เพิ่ม component หน้าแนะนำแยกจาก `HomePage.jsx` เดิมที่ใช้สำหรับ discovery พร้อมแบบ 4 ล่าสุด เมนู route, metadata/canonical/sitemap และลิงก์ public จริง ปุ่มไป `/discover` และ `/home` ไม่คัดลอก anchor จำลองของต้นแบบ
2. **ตัวเลือกอีกสี่แบบ (#6):** เพิ่ม registry/normalize ของ intro templates แยกจาก discovery ใช้ component เนื้อหาร่วมและ CSS ของแต่ละแบบ เปลี่ยนเฉพาะ layout/สี/ภาพ 3D ตามต้นแบบ ไม่สร้าง generic template engine หรือ CMS
3. **API/persistence (#6):** เพิ่ม endpoints และ setting key ข้างต้น พร้อมตรวจสิทธิ์ validation, atomic audit และ fallback
4. **Admin (#6):** ใช้รูปแบบ draft/preview/save และ UI primitives ที่มีอยู่ เพิ่มหน้าเลือก intro template โดยคง discovery tab เดิม ไม่สร้าง abstraction กลางเพียงเพราะสองหน้าคล้ายกัน
5. **Public และตรวจรับ (#6):** เชื่อม config กับ intro page ทดสอบสลับครบทุกแบบ รีเฟรช และกลับมาแบบ 4; metadata ของหน้าแรกยังอธิบายเว็บไซต์เดียวกัน ไม่เปลี่ยน URL ตาม template

ใช้ CSS perspective/transform และแสงเงาสำหรับมิติ 3D ไม่เพิ่ม Three.js/WebGL หรือ dependency ใหม่ในรอบนี้ พื้นที่ข้อความ ปุ่ม ตาราง และ navigation ต้องอ่าน/แตะได้ตามปกติ ภาพตกแต่งเป็น `aria-hidden`; focus-visible, light/dark และ reduced-motion ต้องใช้งานได้ ไม่มี animation อัตโนมัติที่รบกวนการอ่าน

### 6.6 เกณฑ์ตรวจรับและการทดสอบ

- หน้าแรกเริ่มด้วยแบบ 4 และไม่มีหัวข้อ/คำอธิบาย/การ์ดสามใบที่เจ้าของขอลบ; อีกสี่แบบตรงกับต้นแบบที่เลือก
- หน้าแรกทุก Template มีหัวข้อ “เกี่ยวกับเรา” และข้อความตามส่วน 6.1 สื่อว่าเป็นเว็บไซต์จัดอันดับ VTuber ไทยจาก YouTube พร้อมอธิบายความครอบคลุมของทำเนียบ โดยไม่มีคำกล่าวว่าจัดอันดับคุณภาพหรือครอบคลุมทุกช่อง
- มี “นิยาม วีทูปเบอร์ไทย” และเน้นการขึ้นไลฟ์สตรีมเดบิวเป็นการเปิดตัวอย่างเป็นทางการตามนิยามเว็บไซต์ โดยไม่แสดงว่าข้อมูลแต่ละช่องผ่านการตรวจเดบิวแล้วเมื่อระบบยังไม่มีการตรวจนั้น
- เลือกทั้งห้าแบบใน Admin แล้ว preview เปลี่ยนโดยยังไม่ PUT; ลิงก์ใน preview ไม่ออกจาก Admin
- บันทึกแล้วค่าคงอยู่หลัง refresh ทั้ง Admin และ public; สลับกลับแบบ 4 ได้ หน้าค้นพบยังใช้ setting ของตนเอง
- manager ใช้ endpoints ได้; staff, unauthenticated, invalid IDs และ invalid CSRF/origin ถูกปฏิเสธตาม contract; save เขียน audit คู่กับ setting
- ทดสอบ missing/invalid stored value, load error/retry, save error/retry และเลือก draft ใหม่ระหว่าง pending save
- public config หรือ directory counts ล้มเหลว/กลับมาหลัง unmount ไม่ทำให้หน้าแรกหายหรืออัปเดตผิดหน้า; โหลด counts ด้วย directory request ขนาดเล็กหนึ่งครั้ง ไม่เรียก ranking หรือไล่โหลด directory ทุกหน้า
- จำนวนทั้งหมดเท่ากับอิสระบวกสังกัดจาก active directory facets ใน response เดียว ไม่ใช่จำนวนช่องที่มีสถิติ; ทดสอบ counts เช่น 7 + 3 = 10, successful empty, loading, error/retry, malformed counts และกรณีมี affiliation อื่น
- ทดสอบมือถือ 390px, แท็บเล็ต 768px และ desktop 1280px ทั้ง light/dark ไม่มี page overflow ภาพ 3D ไม่บังเนื้อหา และใช้ keyboard/reduced-motion ได้
- เพิ่ม regression ด้วย Vitest/Testing Library, API integration และ Cypress journey สำหรับ manager เลือก/บันทึกและผู้ชมเห็นแบบใหม่ รวมทั้ง regression หน้าค้นพบเดิม
- ยืนยัน persistence และ audit ด้วย SQLite/local D1 ไม่ใช้แต่ mock; รัน `npm test`, `npm run build`, `npm run test:e2e` และ local D1 API smoke ที่เกี่ยวข้องเมื่อ implementation เสร็จ

เจ้าของโครงการอนุมัติ #4, #6 และ #7 ในแชต Codex แล้ว ผล implementation และการทดสอบล่าสุดอยู่ส่วน 8 ส่วน push/deploy และปิด Issue ยังคงอนุมัติแยกตามส่วน 5

## 7. แผนหน้าอันดับและค้นพบ 3D

ติดตาม [Issue #7](https://github.com/pong34811/VtuberTHRanking/issues/7) สถานะ **มีต้นแบบ / รออนุมัติ implementation** ตามคำขอออกแบบเมนูอันดับทั้งหมด อิสระ สังกัด และค้นพบ ยังไม่เปลี่ยน app source

- ใช้ Sculpture Index 3D โทนขาวดำแดงต่อจากหน้าแรก เมนูที่เลือกเป็นแผ่นยก เงานูนบนปุ่ม/แผงควบคุม และวัตถุตกแต่ง 3D ขนาดเล็ก ตารางวางราบ ตัวเลขชิดขวา อ่านง่าย
- หน้าอันดับทั้งสามใช้ `StatsPage` ร่วมกัน รักษา affiliation, period, category, month และ q เมื่อเปลี่ยนกลุ่ม ล้าง offset ตามเดิม อันดับเฉพาะกลุ่มแสดงอันดับรวมใต้ชื่อและไม่แสดง movement ของกลุ่ม
- หน้าค้นพบรักษา `DiscoveryHome` ทั้งสาม template และ setting เดิม กรองชื่อ หมวด สังกัด แบ่งหน้า และเข้าโปรไฟล์จากการ์ด ไม่ใช้สถิติอันดับจัดเรียงทำเนียบ
- ใช้ CSS กับ UI เดิม ไม่เพิ่ม WebGL/dependency/API/schema รักษาธีมปัจจุบัน focus-visible/reduced-motion การโหลด error/retry/empty และความหมาย snapshot เวลาไทย; ประเด็นข้อมูล error เป็นศูนย์ติดตาม #5
- ต้นแบบ `public-3d.html` อยู่นอก repo บน preview port 4174 มีสี่เมนูกดได้ ชื่อ/ตัวเลขสมมติชัดเจน การค้นหาและตัวกรองทดลองได้ เดือนใช้ข้อมูลจำลองชุดเดียวเพื่อดู layout ไม่ใช่ประวัติจริง เปิดโปรไฟล์เป็น dialog ตัวอย่าง ไม่มี API/admin persistence
- เชื่อมปุ่มค้นพบและดูอันดับในต้นแบบหน้าแรกแบบ 4 ไปหน้าตัวอย่างใหม่แล้ว หน้า public กลับหน้าแรกได้
- ตรวจต้นแบบ 1280px และ 390px: สลับครบสี่เมนู, จำนวนกลุ่มละ 3 จาก 6 ช่อง, เปลี่ยน metric/period, ค้นหา/ไม่พบ, กรองเพลงกับอิสระเหลือ Yuki Demo ช่องเดียว หน้าจอมือถือไม่มี page overflow ตารางเลื่อนภายในเท่านั้น
- ก่อนส่ง implementation ต้องตรวจ light/dark, keyboard, browser back/URL, ทุก discovery template, loading/error/empty พร้อม tests/build/Cypress ตามส่วน 4; ผลตรวจต้นแบบไม่ใช่ผลทดสอบ app

เริ่มแก้เว็บไซต์จริงเฉพาะเมื่ออนุมัติ #7 ชัดเจน Push/deploy/ปิด Issue แยกตามส่วน 5

ปรับข้อกำหนด header ตามคำขอล่าสุด: หน้าแรกแบบ 4 และหน้าจัดอันดับ/อิสระ/สังกัด/ค้นพบใช้ header เดียวกัน เรียงเมนู **หน้าแรก / จัดอันดับ / วีทูปเบอร์อิสระ / วีทูปเบอร์สังกัด** เปลี่ยนชื่อเมนูอันดับทั้งหมดเป็นจัดอันดับ หน้าค้นพบยังเข้าจาก CTA หน้าแรก/หน้าอันดับ ไม่อยู่ในเมนูหลักสี่รายการนี้

ปรับเพิ่มเติม: เปลี่ยนชื่อ “ค้นพบ VTuber” เป็น **ค้นหา** และเพิ่มเมนูท้าย header ร่วมเป็น **หน้าแรก / จัดอันดับ / วีทูปเบอร์อิสระ / วีทูปเบอร์สังกัด / ค้นหา** แทนข้อกำหนดสี่เมนูข้างต้น เมนูค้นหาเชื่อมหน้าทำเนียบ `/discover` เดิมและมี active state ของตนเอง ไม่เปลี่ยน API หรือ route จริง

## 8. ผล implementation local — รอตรวจรับ

เจ้าของโครงการตอบ **อนุมัติ #4, #6 และ #7** ในแชต Codex วันที่ 5 ตุลาคม 2026 และบันทึกหลักฐานในทั้งสาม Issue ก่อนแก้โค้ด ทำบน `main` ใน primary checkout

- หน้าแรก `/` ใช้ Sculpture Index 3D เป็นค่าเริ่มต้น มีเกี่ยวกับเรา นิยามเดบิว และจำนวนจาก directory facets ในคำขอ `limit=1` เดียว Loading/error/malformed แสดง —, successful empty แสดง 0; ข้อมูล local ไม่มีช่องจึงแสดง 0 ตามจริง
- Header ร่วมครบห้าเมนูล่าสุด หน้าแรก / จัดอันดับ / วีทูปเบอร์อิสระ / วีทูปเบอร์สังกัด / ค้นหา; ลิงก์อันดับเดิมที่ root พร้อม query redirect ไป `/home` รักษา query ทั้งฝั่ง React และ Pages HTML
- หน้าอันดับและ discovery ใช้ CSS 3D แต่ตารางวางราบ คงสูตร/filter/สาม discovery templates เดิม และข้อมูล metadata-only
- เพิ่ม `/admin/intro-homepage` สำหรับ manager, ห้าแบบ preview/draft/save, config/API ตามส่วน 6.4 ใช้ settings เดิม ไม่มี migration ใหม่ ไม่มี dependency ใหม่ Preview ใช้ component จริงและไม่ออกจาก Admin ไม่เรียกจำนวนจริง
- รักษา auth/CSRF/origin, allowlist และ setting+audit atomic batch; ทดสอบ save race และ rollback เมื่อ audit ล้มเหลว
- Vitest **46 files / 526 tests ผ่าน**; production build ผ่าน; Cypress full run 9 specs พบ assertion ชื่อเมนูเก่า 1 จุด (31/32 ผ่าน) แก้ expectation แล้วรันสอง specs ที่เกี่ยวข้องผ่าน **9/9 tests**; รวม current tests ครบ 9 specs / 32 journeys ผ่าน ไม่มี app defect ค้างจากการทดสอบนี้
- SQLite และ ephemeral Miniflare D1 ยืนยัน config persistence/audit ผ่าน mounted API; local Wrangler migrate migrations เดิม 0008/0009 แล้ว smoke `intro-homepage-config`, `directory?limit=1`, `homepage-config` ตอบ 200
- Cypress ตรวจ 390/768/1280px, สลับ light/dark, สลับ/บันทึก/refresh ครบห้าแบบและกลับแบบ 4, preview containment, preserved discovery settings และ legacy ranking URLs
- พรีวิวเว็บไซต์จริงที่ `http://127.0.0.1:5180/` กับ API local ที่ 8788; ต้นแบบ 4174 ยังคงเป็น reference แยกจาก app

ยังไม่ push/deploy และยังไม่ปิด #4/#6/#7 รอเจ้าของตรวจรับและอนุมัติขั้นตอนเผยแพร่ต่างหาก #5 ยังคงเป็นงานแยกที่ไม่อนุมัติในรอบนี้

### ตรวจรับเพิ่มเติม #7 — ระยะขอบส่วนค้นหา

เจ้าของรายงาน UI เพี้ยนที่ `/discover` ใน viewport 811px พบว่า CSS discovery ที่โหลดภายหลังทับ padding ของการ์ด 3D เพราะ specificity เท่ากัน เพิ่ม specificity ของ public header ทั้ง desktop/mobile ให้ระยะขอบคงอยู่ ตรวจ Cypress ครบสาม discovery templates ที่ 390/811/1280px ทั้ง light/dark พร้อม regression assertion ระยะขอบและ overflow: 8/8 tests ผ่าน; Vitest 526 tests และ production build ผ่าน ตรวจภาพจริงที่ local 5180 แล้ว ยังรอตรวจรับใน #7 ไม่ push/deploy หรือปิด Issue

## 9. คอลัมน์เปลี่ยนแปลงรายเดือน — Issue #8

เจ้าของอนุมัติ #8 ในแชตหลังเสนอ Issue วันที่ 5 ตุลาคม 2026 ให้โหมดรายเดือนแสดง `-` ทุกแถวในคอลัมน์เปลี่ยนแปลง ทั้ง `/home?period=monthly` และ `/stats` พร้อมคำอธิบายสำหรับ screen reader และข้อความท้ายตารางที่สอดคล้อง โหมดทั้งหมดคง NEW/ขึ้น/ลง/อันดับเท่าเดิม กลุ่มอิสระและสังกัดยังไม่แสดงคอลัมน์นี้ ไม่เปลี่ยน API สูตรอันดับ หรือฐานข้อมูล

Implementation local ผ่าน Vitest และ build; Cypress stats 8/8 journeys ผ่าน รวมการสลับรายเดือน/ทั้งหมด ภาพ `monthly-change-dashes-fixture.png` เป็นข้อมูลจำลองสำหรับตรวจ UI รอตรวจรับ ยังไม่ push/deploy หรือปิด #8

## 10. Responsive header — Issue #9

เจ้าของอนุมัติ #9 ในแชตวันที่ 5 ตุลาคม 2026 ปรับ header ร่วมที่ความกว้างไม่เกิน 980px เป็นโลโก้ ธีม และปุ่มเมนูในแถวเดียว เปิดห้าเมนูเมื่อกด ปิดเมื่อเลือกหน้า/URL เปลี่ยนหรือกด Escape คืน focus ให้ปุ่ม และใช้ aria-expanded/aria-controls จอใหญ่แสดงเมนูเดิม ไม่มี dependency/API/schema เปลี่ยน

ตรวจ 320/390/789/980/1280px, light/dark, ไม่ล้น, active state และ query preservation ผ่าน Cypress; full run 10 specs ได้ 34/35 ผ่าน โดย test ใหม่ส่ง Enter ไม่เปิดปุ่มใน Cypress จึงใช้ click ตรวจการเปิดและ keyboard Escape แล้วรัน spec ใหม่ผ่าน 1/1 ยืนยัน Enter และ Escape แยกบนเบราว์เซอร์จริงที่ 789px ผ่าน รวม current journeys 35 ผ่าน Vitest 528 tests และ build ผ่าน รอตรวจรับ ยังไม่ push/deploy หรือปิด #9

## 11. ค้นหาและอัปเดตข้อมูลรายวัน — Issue #10

เจ้าของขอค้นหา VTuber ไทยและอัปเดตทั้งโปรไฟล์กับสถิติ YouTube ลงฐานข้อมูลอัตโนมัติ และตอบ **อนุมัติ** หลังเสนอ #10 ในแชตวันที่ 5 ตุลาคม 2026 บันทึกหลักฐานใน Issue ก่อน implementation บน `main` ใน primary checkout

- ใช้ cron เดิมทุกต้นชั่วโมง แยก directory sync วันละครั้งตามวันประเทศไทยจาก pipeline สถิติที่รองรับ daily อยู่แล้ว Directory ล้มเหลวไม่หยุดสถิติ
- เพิ่ม migration `0010_daily_directory_sync.sql`: source baseline/provenance, candidate queue/tombstones, directory lease/fence และ run outcomes; ไม่มี dependency ใหม่
- รีเฟรชชื่อ/avatar/bio เฉพาะฟิลด์ว่างหรือยังตรงกับต้นทางครั้งก่อน รอบแรกคงฟิลด์เดิมที่ไม่มีหลักฐาน ownership รักษา slug, สังกัด, วันเดบิว, notes, inactive และการแก้ไข/เปลี่ยน URL ขณะ fetch ค้าง
- อ่านการ์ดรายชื่อทางการ Pixela ด้วย HTMLRewriter และค้นหาอิสระผ่าน YouTube ใหม่สุดไม่เกิน 10 ช่องต่อครั้ง รับเข้าอัตโนมัติเฉพาะหลักฐานชัดเจนและสถิติครบ รายการ Graduated/กำกวม/ซ่อน counter รอตรวจ ไม่เดาสังกัดหรือวันเดบิว ARP ยังดึงเว็บไม่ได้จึงไม่มี adapter ในรอบนี้
- Admin มีสวิตช์รายวัน ผลรอบโปรไฟล์ คิวพร้อมแหล่งอ้างอิง และปุ่มข้ามแบบ manager/CSRF/audit ใช้ shared natural-key lookup กับ manual import เพื่อไม่เพิ่มช่องเดิมซ้ำจาก canonical URL หรือ handle ที่มีหลักฐานตรงกัน
- Vitest **48 files / 541 tests ผ่าน** บน Node 24; production build ผ่าน; Cypress system-history **4/4 journeys ผ่าน** รวม save/refresh/ignore และ 390px ไม่ล้น มีภาพ fixture `frontend/cypress/screenshots/system-history.cy.js/daily-directory-sync-settings.png`
- Ephemeral Miniflare ใช้ D1 และ HTMLRewriter จริง ตรวจ daily gate, partial/retry, hidden counters, concurrent runs, fence takeover, profile/URL edit races, inactive/deletion tombstones และ atomic ranking publication เดิม; Wrangler local migration ผ่าน
- ตรวจ parser กับหน้า Pixela จริงวันที่นี้ได้ 20 การ์ด: Graduated 5 และไม่ติด marker 15 ไม่ได้ใช้ผลนี้เขียน production หรือยืนยัน activity นอกเหนือจากสถานะบนต้นทาง

- push origin main `d120edf` แล้ว; deploy Worker `vtuberthai-updater` (version `3ec60057`) ที่ `https://vtuberthai-updater.datainformation.workers.dev` พร้อม triggers `0 * * * *`; apply migration `0010_daily_directory_sync.sql` บน D1 remote `vtuberthai-db` แล้ว 8 commands ผ่าน; deploy Pages `vtuberthai-ranking` ที่ `https://9f976785.vtuberthai-ranking.pages.dev` 24 files
- smoke production: `intro-homepage-config/` → `{"template":"sculpture-index-3d"}` 200; `directory/?limit=1` → 200 ข้อมูล production ยังไม่สูญหาย (27 ช่อง); `admin/settings` ไม่มี auth → 401 ตาม contract; ไม่มี secrets ถูกส่งไป frontend

เจ้าของอนุมัติ push/deploy และเปิดอัปเดตรายวันในแชตแล้ว ([หลักฐานอนุมัติ](https://github.com/pong34811/VtuberTHRanking/issues/10#issuecomment-5990737508)) วันที่ 5 ตุลาคม 2026 เวลา 17:12:39 น. (Asia/Bangkok) เปิด production ผ่าน authenticated Wrangler D1: `directory_sync_enabled=true`, `ranking_update_frequency=daily` พร้อม audit `day-sync-1791195151093` บันทึกวิธีดำเนินการและหลักฐานอนุมัติ อ่านกลับยืนยันทั้งสองค่าและ audit แล้ว Worker มี secret names `YOUTUBE_API_KEY`/`UPDATER_RUN_TOKEN` และ Cloudflare schedules API ยืนยัน cron `0 * * * *`; public directory ตอบ 200 หลังเปิด ณ เวลาตรวจยังไม่มี directory run รอบแรกคาดว่าจะเริ่ม 18:00 น. วันนี้ จึงยังไม่ยืนยันผล YouTube จริง Issue #10 ยังเปิดอยู่รออนุมัติปิดแยกต่างหาก

## 12. ช่องใหม่รอผู้จัดการอนุมัติ — Issue #12 (local)

เจ้าของอนุมัติ #12 ในแชตและ Issue ก่อน implementation บน main วันที่ 6 ตุลาคม 2026 ช่อง YouTube ใหม่จาก discovery/manual import/ChannelForm เข้าคิว 202 ก่อนเผยแพร่ ไม่มี public channel หรือสถิติอันดับจนผู้จัดการอนุมัติ ยังคง existing-channel editorial editing, source ownership, auth/CSRF, leases และ atomic publication เดิม

Admin มี lazy route `/admin/channel-approvals` สำหรับ manager: ค้นหาชื่อ/แบ่งหน้า 20 ช่อง ตรวจคำอธิบายจริงและลิงก์ HTTPS YouTube เลือกประเภทสังกัดเองก่อนอนุมัติ และข้ามรายการ คง YouTube identity/แพลตฟอร์มเดิม แยกการตรวจประจำวันออกจาก Settings ซึ่งยังมีสวิตช์และผลรอบ UI บอก queued ตามจริงทั้งแบบฟอร์มและ import; staff ไม่เข้าคิวจัดการ ยอดเข้าคิวใหม่สะสมต่างจากจำนวน pending ปัจจุบัน YouTube Search ไม่รับประกันรายชื่อครบทั้งหมด

ดู [คำศัพท์และการตัดสินใจ](docs/CHANNEL_APPROVALS.md) และ [แผน #12](docs/superpowers/plans/2026-10-05-channel-approvals.md) ต้องใช้ migrations 0011/0012 เมื่อได้รับอนุมัติ release แยก งานรอบนี้ local/synthetic เท่านั้น ยังไม่ push/deploy หรือปิด #12 ผลตรวจสุดท้ายบันทึกหลัง tests/build/Cypress/local D1 ผ่าน

Local Task2 verification: Node24 unit/Admin 35 files /301 tests passed; three synthetic Cypress specs9/9 passed; production build passed; actual ephemeral D1 queue/concurrent-approval smoke1/1 passed (4 unrelated tests skipped). Final focused coverage adds stale approval and malformed pagination checks; final report records its result. No production data, push/deploy or Issue closure. Mandatory independent review pending.
