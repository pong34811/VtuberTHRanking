import { HOMEPAGE_TEMPLATE_IDS } from '../../../shared/homepage-templates.js';

const templateMetadata = {
  'search-first': {
    label: 'ค้นหาก่อน',
    description: 'เริ่มจากช่องค้นหา พร้อมทางลัดเลือกหมวดหมู่และสังกัด',
  },
  'category-first': {
    label: 'เลือกหมวดหมู่',
    description: 'สำรวจกลุ่ม VTuber ตามหมวดหมู่ พร้อมจำนวนช่องในแต่ละหมวด',
  },
  'newest-first': {
    label: 'เพิ่มเข้ารายการล่าสุด',
    description: 'พบช่องที่เพิ่มเข้ารายการล่าสุด โดยแสดงวันที่เพิ่มข้อมูล',
  },
};

export const HOMEPAGE_TEMPLATES = Object.freeze(Object.fromEntries(
  HOMEPAGE_TEMPLATE_IDS.map(id => [id, Object.freeze({ ...templateMetadata[id], id })]),
));
