import { useId, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Search } from 'lucide-react';
import { DIRECTORY_CATEGORIES } from '../../../../shared/directory.js';
import { affiliationLabel, categoryLabel } from '../../components/channelLabels';
import { directorySearchHref } from '../searchParams';
import CreatorCard from './CreatorCard';
import useDiscoveryData from './useDiscoveryData';
import './discovery.css';

const templates = {
  'search-first': { title: 'ค้นพบ VTuber ไทย', description: 'ค้นหาช่องจากชื่อ ประเภทเนื้อหา หรือสังกัด แล้วเลือกช่องที่อยากรู้จักต่อ' },
  'category-first': { title: 'ค้นพบผ่านหมวดหมู่', description: 'เลือกหมวดที่สนใจ แล้วสำรวจช่อง VTuber ไทยในแบบของคุณ' },
  'newest-first': { title: 'เพิ่มเข้ารายการล่าสุด', description: 'รายชื่อเรียงตามวันที่เพิ่มเข้าระบบ แสดงเมื่อข้อมูลวันที่ถูกต้อง' },
};

function containPreviewLink(event) {
  if (event.target instanceof Element && event.target.closest('a')) event.preventDefault();
}

function CategoryLink({ category, count }) {
  return <Link className="discovery-category" to={directorySearchHref({ category })}>
    <span>{categoryLabel(category)}</span><strong>{count.toLocaleString('th-TH')}</strong>
  </Link>;
}

function CreatorGrid({ results, showAddedDate = false }) {
  return <div className="discovery-grid">{results.map(creator => <CreatorCard key={creator.id} creator={creator} showAddedDate={showAddedDate} />)}</div>;
}

export default function DiscoveryHome({ templateId = 'search-first', previewMode = false }) {
  const searchId = useId();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { data, loading, error, retry } = useDiscoveryData(templateId);
  const template = templates[templateId] || templates['search-first'];
  const counts = DIRECTORY_CATEGORIES.map(category => ({
    category,
    count: data.category_counts.find(item => item.category === category)?.count || 0,
  })).filter(item => item.count > 0);

  const submitSearch = event => {
    event.preventDefault();
    if (!previewMode) navigate(directorySearchHref({ q: query }));
  };

  return (
    <div className="homepage discovery-home" data-template={templateId} onClickCapture={previewMode ? containPreviewLink : undefined}>
      <header className="discovery-header">
        <div>
          <p className="discovery-eyebrow">VTUBER THAILAND · DISCOVER</p>
          <h1>{template.title}</h1>
          <p>{template.description}</p>
        </div>
        <Link className="discovery-stats-link" to="/stats">ดูสถิติ <ArrowUpRight aria-hidden="true" /></Link>
      </header>

      {templateId === 'search-first' && <>
        <form className="discovery-search" role="search" onSubmit={submitSearch}>
          <label htmlFor={searchId}>ค้นหาชื่อ VTuber</label>
          <div className="discovery-search-row">
            <input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="เช่น Aiko, Miku..." />
            <button type="submit"><Search aria-hidden="true" />ค้นหา</button>
          </div>
        </form>
        <section className="discovery-category-section" aria-label="เลือกตามหมวดหมู่">
          <div className="discovery-category-list">
            {counts.map(item => <CategoryLink key={item.category} {...item} />)}
          </div>
          <div className="discovery-shortcuts">
            <Link to={directorySearchHref({ affiliation: 'indie' })}>{affiliationLabel('indie')}</Link>
            <Link to={directorySearchHref({ affiliation: 'agency' })}>{affiliationLabel('agency')}</Link>
          </div>
        </section>
      </>}

      {templateId === 'category-first' && <section className="discovery-category-section" aria-label="หมวดหมู่ VTuber">
        <h2>เลือกหมวดที่สนใจ</h2>
        <div className="discovery-category-list">
          {counts.map(item => <CategoryLink key={item.category} {...item} />)}
        </div>
      </section>}

      {templateId === 'newest-first' && <>
        <div className="discovery-date-note">วันที่ด้านล่างคือวันที่เพิ่มช่องเข้ารายการ ไม่ใช่วันเดบิวต์</div>
        <Link className="discovery-search-all" to="/search">ค้นหารายชื่อทั้งหมด <ArrowUpRight aria-hidden="true" /></Link>
      </>}

      <section className="discovery-content" aria-label="รายชื่อ VTuber" aria-busy={loading}>
        {loading ? <p className="discovery-status" role="status">กำลังโหลดรายชื่อ VTuber…</p> : error ? (
          <div className="discovery-error" role="alert"><p>{error}</p><button type="button" onClick={retry}>ลองอีกครั้ง</button></div>
        ) : data.total === 0 ? (
          <div className="discovery-empty"><h2>ยังไม่มีรายชื่อให้แสดง</h2><p>ลองค้นหาช่อง VTuber ที่คุณสนใจ</p><Link to="/search">ไปหน้าค้นหา</Link></div>
        ) : templateId === 'category-first' ? (
          <div className="discovery-groups">
            {data.groups.map(group => (
              <section className="discovery-group" key={group.category} aria-labelledby={`discovery-${group.category}`}>
                <div className="discovery-group-heading">
                  <div><h2 id={`discovery-${group.category}`}>{categoryLabel(group.category)}</h2><span>{data.category_counts.find(item => item.category === group.category)?.count?.toLocaleString('th-TH') || 0} ช่อง</span></div>
                  <Link to={directorySearchHref({ category: group.category })}>ดูทั้งหมด <ArrowUpRight aria-hidden="true" /></Link>
                </div>
                {group.error ? <div className="discovery-error" role="alert"><span>{group.error}</span><button type="button" onClick={retry}>ลองอีกครั้ง</button></div> : group.results.length
                  ? <CreatorGrid results={group.results.slice(0, 3)} />
                  : <p className="discovery-group-empty">ยังไม่มีช่องในหมวดนี้ <Link to="/search">ค้นหาช่อง</Link></p>}
              </section>
            ))}
          </div>
        ) : (
          <>
            <div className="discovery-content-heading"><h2>{templateId === 'newest-first' ? 'ช่องที่เพิ่มล่าสุด' : 'ช่องที่น่าค้นพบ'}</h2><span>{data.total.toLocaleString('th-TH')} ช่องในรายการ</span></div>
            <CreatorGrid results={data.results} showAddedDate={templateId === 'newest-first'} />
          </>
        )}
      </section>
    </div>
  );
}
