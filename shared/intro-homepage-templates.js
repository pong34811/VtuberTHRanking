export const INTRO_HOMEPAGE_TEMPLATES = Object.freeze([
  { id: 'paper-atelier-3d', label: 'Paper Atelier 3D', description: 'โทนครีมและส้ม งานกระดาษมีมิติ' },
  { id: 'neon-portal-3d', label: 'Neon Portal 3D', description: 'พื้นเข้ม แสงมินต์และวงโคจร' },
  { id: 'candy-world-3d', label: 'Candy World 3D', description: 'พาสเทลม่วงชมพู รูปทรงโค้งนุ่ม' },
  { id: 'sculpture-index-3d', label: 'Sculpture Index 3D', description: 'ขาว ดำ แดง ตัวอักษรเด่น · ค่าเริ่มต้น' },
  { id: 'soft-garden-3d', label: 'Soft Garden 3D', description: 'เขียวและครีม บรรยากาศสงบ' },
]);
export const INTRO_HOMEPAGE_TEMPLATE_IDS = Object.freeze(INTRO_HOMEPAGE_TEMPLATES.map(template => template.id));
export const DEFAULT_INTRO_HOMEPAGE_TEMPLATE = 'sculpture-index-3d';
export const normalizeIntroHomepageTemplate = value =>
  INTRO_HOMEPAGE_TEMPLATE_IDS.includes(value) ? value : DEFAULT_INTRO_HOMEPAGE_TEMPLATE;
