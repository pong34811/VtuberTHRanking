import { HOMEPAGE_TEMPLATE_IDS } from '../../../shared/homepage-templates.js';

const templateMetadata = {
  'ranking-first': {
    label: 'อันดับเด่น',
    description: 'เริ่มจากภาพรวมและวิธีจัดอันดับ แล้วดูตารางอันดับ',
    compactHero: false,
    sectionOrder: ['summary', 'method', 'rankings', 'discovery'],
  },
  'discovery-first': {
    label: 'ค้นพบ VTuber',
    description: 'ชวนค้นหาและเปรียบเทียบช่อง ก่อนสำรวจอันดับ',
    compactHero: false,
    sectionOrder: ['summary', 'discovery', 'rankings', 'method'],
  },
  'compact-ranking': {
    label: 'อันดับแบบกระชับ',
    description: 'พาไปดูอันดับได้เร็วขึ้น พร้อมข้อมูลและวิธีจัดอันดับ',
    compactHero: true,
    sectionOrder: ['summary', 'rankings', 'method', 'discovery'],
  },
};

export const HOMEPAGE_TEMPLATES = Object.freeze(Object.fromEntries(
  HOMEPAGE_TEMPLATE_IDS.map(id => [
    id,
    Object.freeze({ ...templateMetadata[id], id, sectionOrder: Object.freeze(templateMetadata[id].sectionOrder) }),
  ]),
));
