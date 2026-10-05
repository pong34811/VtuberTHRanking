import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { directoryAPI, introHomepageConfigAPI } from '../api/client';
import { DEFAULT_INTRO_HOMEPAGE_TEMPLATE, normalizeIntroHomepageTemplate } from '../../../shared/intro-homepage-templates.js';
import './intro.css';

export function Sculpture({ compact = false }) {
  return <div className={`intro-scene${compact ? ' intro-scene--compact' : ''}`} aria-hidden="true">
    <div className="intro-ground" /><div className="intro-platform" /><div className="intro-orbit" />
    <div className="intro-object"><b>V</b><small>VT / TH</small></div>
    {!compact && <><div className="intro-floating intro-floating--search"><b>✦</b><span>ค้นหา</span></div><div className="intro-floating intro-floating--rank"><b>↗</b><span>สำรวจอันดับ</span></div></>}
    <div className="intro-sphere" /><div className="intro-sphere intro-sphere--small" />
  </div>;
}

function readCounts(data) {
  if (!Array.isArray(data?.affiliation_counts) || !Number.isSafeInteger(data.total) || data.total < 0 || data.affiliation_counts.some(item => !item || typeof item.affiliation !== 'string' || !Number.isSafeInteger(item.count) || item.count < 0)) throw new Error('Invalid counts');
  const counts = Object.fromEntries(['indie', 'agency'].map(group => {
    const matches = data.affiliation_counts.filter(item => item.affiliation === group);
    if (matches.length > 1) throw new Error('Invalid counts');
    return [group, matches[0]?.count ?? 0];
  }));
  if (!Number.isSafeInteger(counts.indie + counts.agency) || counts.indie + counts.agency > data.total) throw new Error('Invalid total');
  return counts;
}

function CreatorCounts({ previewMode }) {
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(!previewMode);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (previewMode) return undefined;
    let active = true;
    setLoading(true); setError(false); setCounts(null);
    directoryAPI.getList({ limit: 1 })
      .then(response => { const next = readCounts(response.data); if (active) setCounts(next); })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [previewMode, retry]);
  const items = [
    ['ทั้งหมด', counts ? counts.indie + counts.agency : null, 'วีทูปเบอร์อิสระ + วีทูปเบอร์สังกัด'],
    ['วีทูปเบอร์อิสระ', counts?.indie, 'ช่องในกลุ่มอิสระ'],
    ['วีทูปเบอร์สังกัด', counts?.agency, 'ช่องในกลุ่มสังกัด'],
  ];
  return <section className="intro-counts" aria-label="จำนวน VTuber ไทยในทำเนียบ" aria-busy={loading}>
    <dl>{items.map(([label, count, note]) => <div key={label}><dt>{label}</dt><dd>{count == null ? '—' : count.toLocaleString('th-TH')} <span>ช่อง</span></dd><small>{note}</small></div>)}</dl>
    <p role="status">{previewMode ? 'ตัวอย่างรูปแบบ — จำนวนจริงจะแสดงในหน้าเว็บไซต์' : loading ? 'กำลังโหลดจำนวนช่อง…' : error ? 'โหลดจำนวนช่องไม่สำเร็จ' : 'จำนวนช่องที่ทีมงานรวบรวมในทำเนียบ อาจยังไม่ครอบคลุมทุกช่อง'} {error && <button type="button" onClick={() => setRetry(value => value + 1)}>ลองอีกครั้ง</button>}</p>
  </section>;
}

export default function IntroPage({ templateOverride, previewMode = false }) {
  const [published, setPublished] = useState(DEFAULT_INTRO_HOMEPAGE_TEMPLATE);
  useEffect(() => {
    if (templateOverride != null) return undefined;
    let active = true;
    introHomepageConfigAPI.get().then(response => {
      if (active) setPublished(normalizeIntroHomepageTemplate(response.data?.template));
    }).catch(() => { if (active) setPublished(DEFAULT_INTRO_HOMEPAGE_TEMPLATE); });
    return () => { active = false; };
  }, [templateOverride]);
  const template = normalizeIntroHomepageTemplate(templateOverride ?? published);
  const containPreview = event => {
    if (previewMode && event.target instanceof Element && event.target.closest('a')) event.preventDefault();
  };
  return <div className="intro-page" data-template={template} onClickCapture={containPreview}>
    <section className="intro-hero">
      <div className="intro-copy"><p className="intro-eyebrow">DIRECTORY / PROFILES / RANKINGS</p><h1>VTUBER<br /><em>THAI INDEX.</em></h1>
        <p className="intro-lead">ค้นหา VTuber ไทย<br />รู้จักผ่านโปรไฟล์ และอ่านอันดับอย่างเข้าใจ</p>
        <div className="intro-actions"><Link to="/discover">ค้นหา ↗</Link><Link to="/home" className="intro-secondary">ดูอันดับ ↗</Link></div>
        <p className="intro-caption">สำรวจตามความสนใจ · อ่านสถิติจากข้อมูลที่บันทึกไว้</p>
      </div><div className="intro-visual"><Sculpture /><p className="intro-art-caption">VT / TH — CREATOR INDEX</p></div>
    </section>
    <CreatorCounts previewMode={previewMode} />
    {template !== DEFAULT_INTRO_HOMEPAGE_TEMPLATE && <section className="intro-paths" aria-label="เริ่มสำรวจเว็บไซต์">
      {[['01', 'ค้นหาช่อง', 'ค้นหาตามชื่อ แนวเนื้อหา และสังกัด', '/discover'], ['02', 'รู้จักผ่านโปรไฟล์', 'ดูข้อมูลช่องและสถิติของครีเอเตอร์ที่สนใจ', '/discover'], ['03', 'สำรวจอันดับ', 'เลือกตัวชี้วัดและช่วงเวลาที่ต้องการดู', '/home']].map(([number, title, text, to]) => <Link key={number} to={to}><span>{number}</span><h2>{title}</h2><p>{text}</p><b>เริ่มสำรวจ ↗</b></Link>)}
    </section>}
    <section className="intro-section"><h2>เกี่ยวกับเรา</h2><div><p><strong>VTuberTH Rankings</strong> เป็นเว็บไซต์รวบรวมข้อมูลและจัดอันดับ VTuber ไทยจากสถิติของช่อง YouTube เพื่อให้คุณค้นพบช่องที่สนใจ ทำความรู้จักผ่านโปรไฟล์ และสำรวจอันดับได้ในที่เดียว</p><p>คุณสามารถดูอันดับตามจำนวนผู้ติดตาม ยอดวิวรวม และจำนวนคลิป พร้อมเลือกช่วงเวลาที่ต้องการสำรวจ ทำเนียบช่องรวบรวมโดยทีมงาน จึงอาจยังไม่ครอบคลุม VTuber ไทยทุกช่อง</p></div></section>
    <section className="intro-section"><h2>นิยาม วีทูปเบอร์ไทย</h2><div><p>วีทูปเบอร์ไทย คือครีเอเตอร์ในชุมชนไทยที่ใช้ตัวละครหรืออวตารเสมือนเป็นตัวแทนในการสร้างเนื้อหาและพูดคุยกับผู้ชม</p><div className="intro-debut"><span>การเปิดตัวอย่างเป็นทางการ</span><p>ในนิยามของเว็บไซต์นี้ <strong>วีทูปเบอร์ไทยที่เปิดตัวอย่างเป็นทางการ คือผู้ที่ขึ้นไลฟ์สตรีมเดบิว</strong> เพื่อแนะนำตัวละคร ทำความรู้จักกับผู้ชม และประกาศเริ่มต้นเส้นทางในฐานะวีทูปเบอร์</p></div><p className="intro-caption">ไลฟ์สตรีมเดบิวจึงเป็นจุดเริ่มต้นของการเปิดตัวอย่างเป็นทางการตามนิยามนี้</p></div></section>
    <section className="intro-section intro-method"><h2>อ่านข้อมูลอย่างเข้าใจ</h2><div><p>อันดับรายเดือนใช้ยอดสะสม ณ รอบเดือนที่เลือก ไม่ใช่ยอดที่เพิ่มขึ้นระหว่างเดือน</p><p>สถิติ YouTube เป็นข้อมูลที่บันทึกไว้ในระบบ ไม่ใช่ข้อมูลเรียลไทม์หรือคะแนนคุณภาพของช่อง</p><p>ทำเนียบรวบรวมโดยทีมงาน จึงอาจยังไม่ครอบคลุม VTuber ไทยทุกช่อง</p></div></section>
  </div>;
}
