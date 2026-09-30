export const CANONICAL_ORIGIN = 'https://vtuberthai-ranking.pages.dev';
export const DEFAULT_SITE_NAME = 'VTuberThai Ranking';

export function getPageMetadata({ pathname = '/', search = '', siteName = DEFAULT_SITE_NAME, profile = null, notFound = false, maintenance = false } = {}) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(search);
  const affiliation = params.get('affiliation');
  const group = affiliation === 'indie' ? 'วีทูปเบอร์อิสระ' : affiliation === 'agency' ? 'วีทูปเบอร์สังกัด' : 'วีทูปเบอร์ไทยทั้งหมด';
  let heading = 'ไม่พบหน้านี้';
  let description = 'ลิงก์อาจไม่ถูกต้องหรือถูกย้ายแล้ว ค้นหาช่อง VTuber ได้จากหน้าค้นพบ';
  let status = 404;
  let canonicalPath = path;
  let indexable = false;
  let type = 'website';

  if (['/', '/home', '/stats'].includes(path)) {
    heading = path === '/stats' ? `อันดับรายเดือน · ${group}` : `อันดับ${group}`;
    description = 'สำรวจอันดับ VTuber ไทยจากยอดสะสมของช่อง YouTube ที่บันทึกไว้ในระบบ พร้อมเลือกตัวชี้วัดและเดือนย้อนหลัง';
    canonicalPath = path === '/' ? '/home' : path;
    if (['indie', 'agency'].includes(affiliation)) canonicalPath += `?affiliation=${affiliation}`;
    status = 200;
    indexable = true;
  } else if (path === '/discover') {
    heading = 'ค้นพบ VTuber ไทย';
    description = 'ค้นหาช่อง VTuber ไทยในทำเนียบที่ทีมงานรวบรวม เลือกตามชื่อ แนวเนื้อหาและสังกัด โดยไม่อ้างว่าครอบคลุมทุกช่อง';
    status = 200;
    indexable = true;
  } else if (/^\/profile\/[^/]+$/.test(path)) {
    heading = profile?.name ? `โปรไฟล์ ${profile.name}` : 'โปรไฟล์ VTuber';
    description = profile?.bio || 'ดูโปรไฟล์ ช่อง YouTube และแนวโน้มสถิติของ VTuber ไทย';
    status = 200;
    indexable = true;
    type = 'profile';
  } else if (/^\/admin(?:\/|$)/.test(path)) {
    heading = 'จัดการเว็บไซต์';
    description = 'ระบบจัดการข้อมูลสำหรับผู้ดูแลเว็บไซต์';
    status = 200;
  }

  if (notFound) {
    heading = /^\/profile\//.test(path) ? 'ไม่พบช่องนี้' : 'ไม่พบหน้านี้';
    description = 'ลิงก์อาจถูกย้ายหรือยังไม่มีในทำเนียบ กลับไปค้นหาช่องจากหน้าค้นพบ';
    status = 404;
    indexable = false;
  }
  if (maintenance) {
    heading = 'เว็บไซต์กำลังปรับปรุง';
    description = 'กรุณากลับมาอีกครั้งภายหลัง ผู้ดูแลยังเข้าระบบจัดการได้';
    status = 503;
    indexable = false;
  }

  return {
    heading,
    title: `${heading} | ${siteName || DEFAULT_SITE_NAME}`,
    description: String(description).slice(0, 180),
    canonical: `${CANONICAL_ORIGIN}${canonicalPath}`,
    image: `${CANONICAL_ORIGIN}/social-card.svg`,
    robots: indexable ? 'index,follow' : 'noindex,nofollow',
    status,
    type,
  };
}
