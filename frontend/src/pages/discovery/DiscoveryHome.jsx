import { useEffect, useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Search } from 'lucide-react';
import { DIRECTORY_AFFILIATIONS, DIRECTORY_CATEGORIES } from '../../../../shared/directory.js';
import { affiliationLabel, categoryLabel } from '../../components/channelLabels';
import { directorySearchHref, readDirectorySearch } from '../searchParams';
import CreatorCard from './CreatorCard';
import useDiscoveryData from './useDiscoveryData';
import './discovery.css';
import { Sculpture } from '../IntroPage';

const templates = {
  'search-first': { title: 'ค้นหา VTuber ไทย', description: 'สำรวจภาพและโปรไฟล์ VTuber ไทย แล้วเลือกค้นหาต่อจากชื่อ หมวด หรือสังกัด' },
  'category-first': { title: 'ค้นพบผ่านหมวดหมู่', description: 'เลือกหมวดที่สนใจ แล้วสำรวจช่อง VTuber ไทยในแบบของคุณ' },
  'newest-first': { title: 'เพิ่มเข้ารายการล่าสุด', description: 'รายชื่อเรียงตามวันที่เพิ่มเข้าระบบ แสดงเมื่อข้อมูลวันที่ถูกต้อง' },
};

function containPreviewLink(event) {
  if (event.target instanceof Element && event.target.closest('a')) event.preventDefault();
}

function CategoryLink({ category, count, filters }) {
  return <Link className={`discovery-category discovery-category--${category}`} to={directorySearchHref({ ...filters, category })}>
    <span>{categoryLabel(category)}</span><strong>{count.toLocaleString('th-TH')}</strong>
  </Link>;
}

function CreatorGrid({ results, showAddedDate = false }) {
  return <div className="discovery-grid">{results.map(creator => <CreatorCard key={creator.id} creator={creator} showAddedDate={showAddedDate} />)}</div>;
}

function LoadingGallery() {
  return <>
    <p className="discovery-status sr-only" role="status">กำลังโหลดรายชื่อ VTuber…</p>
    <div className="discovery-grid discovery-grid--loading" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => <div className="discovery-skeleton-card" key={index}>
        <div className="discovery-skeleton-image" />
        <div className="discovery-skeleton-line discovery-skeleton-line--name" />
        <div className="discovery-skeleton-line discovery-skeleton-line--meta" />
      </div>)}
    </div>
  </>;
}

export default function DiscoveryHome({ templateId = 'search-first', previewMode = false }) {
  const searchId = useId();
  const { search } = useLocation();
  const filters = readDirectorySearch(previewMode ? '' : search);
  const params = new URLSearchParams(previewMode ? '' : search);
  const requestedOffset = Number(params.get('offset'));
  const offset = Number.isSafeInteger(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0;
  const viewAll = params.get('view') === 'all';
  const hasFilters = Boolean(filters.q || filters.category || filters.affiliation);
  const categoryGroups = templateId === 'category-first' && !hasFilters && !offset && !viewAll;
  const [query, setQuery] = useState(filters.q);
  useEffect(() => setQuery(filters.q), [filters.q]);
  const navigate = useNavigate();
  const { data, loading, error, retry } = useDiscoveryData(templateId, { ...filters, offset, viewAll });
  const template = templates[templateId] || templates['search-first'];
  const counts = DIRECTORY_CATEGORIES.map(category => ({
    category,
    count: data.category_counts.find(item => item.category === category)?.count || 0,
  })).filter(item => item.count > 0);
  const affiliationCounts = DIRECTORY_AFFILIATIONS.map(affiliation => ({
    affiliation,
    count: data.affiliation_counts.find(item => item.affiliation === affiliation)?.count || 0,
  }));

  const submitSearch = event => {
    event.preventDefault();
    if (!previewMode) navigate(directorySearchHref({ ...filters, q: query }));
  };

  return (
    <div className="homepage discovery-home" data-template={templateId} onClickCapture={previewMode ? containPreviewLink : undefined}>
      <div className="discovery-layout">
      <header className={`discovery-header discovery-header--${templateId}`}>
        <div className="discovery-heading">
          <h1>{template.title}</h1>
          <p>{template.description}</p>
          <div className="discovery-hero-art"><Sculpture compact /></div>
        </div>
        <div className="discovery-header-tools">
          <form className="discovery-search" role="search" onSubmit={submitSearch}>
            <div className="discovery-search-row">
              <Search aria-hidden="true" />
              <label className="sr-only" htmlFor={searchId}>ค้นหาชื่อ VTuber</label>
              <input id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาชื่อ VTuber" />
              <button type="submit" aria-label="ค้นหา"><ArrowUpRight aria-hidden="true" /></button>
            </div>
          </form>
          <div className="discovery-header-meta">
            <Link className="discovery-stats-link" to="/stats">ดูสถิติ <ArrowUpRight aria-hidden="true" /></Link>
            <span className="discovery-count-stamp">{loading ? 'กำลังโหลดรายชื่อ' : <><strong>{data.total.toLocaleString('th-TH')}</strong> ช่องในทำเนียบ</>}</span>
          </div>
        </div>
      </header>

      <p className="discovery-date-note">ทำเนียบนี้รวบรวมช่องโดยทีมงาน ไม่ใช่รายชื่อ VTuber ไทยทั้งหมด · หมวดอื่นๆ รวมช่องที่ยังไม่ได้จำแนกแนวหลัก</p>

      {templateId === 'search-first' && <>
        <section className="discovery-category-section" aria-label="เลือกตามหมวดหมู่">
          <Link className="discovery-index-all" to="/discover?view=all"><span>รายชื่อทั้งหมด</span><ArrowUpRight aria-hidden="true" /></Link>
          <div className="discovery-filter-group">
            <h2>เลือกดูตามแนว</h2>
            <div className="discovery-category-list">
              {counts.map(item => <CategoryLink key={item.category} {...item} filters={filters} />)}
            </div>
          </div>
          <div className="discovery-filter-group discovery-filter-group--affiliation">
            <h2>วีทูปเบอร์ไทย</h2>
            <div className="discovery-shortcuts">
              {affiliationCounts.map(({ affiliation, count }) => <Link key={affiliation} to={directorySearchHref({ ...filters, affiliation })}>
                <span>{affiliationLabel(affiliation)}</span>
                <strong>{count.toLocaleString('th-TH')}</strong>
                <ArrowUpRight aria-hidden="true" />
              </Link>)}
            </div>
          </div>
        </section>
      </>}

      {templateId === 'category-first' && <section className="discovery-category-section" aria-label="หมวดหมู่ VTuber">
        <div className="discovery-filter-group">
          <h2>เลือกดูตามแนว</h2>
          <div className="discovery-category-list">
            {counts.map(item => <CategoryLink key={item.category} {...item} filters={filters} />)}
          </div>
        </div>
      </section>}

      {templateId === 'newest-first' && <>
        <div className="discovery-date-note">วันที่แสดงคือวันที่เพิ่มช่องเข้าทำเนียบ</div>
        <Link className="discovery-search-all" to="/discover?view=all">ดูรายชื่อทั้งหมด <ArrowUpRight aria-hidden="true" /></Link>
      </>}

      <section className="discovery-content" aria-label="รายชื่อ VTuber" aria-busy={loading}>
        {hasFilters && <div className="discovery-content-heading">
          <p>{[filters.q && `ชื่อ: ${filters.q}`, filters.category && categoryLabel(filters.category), filters.affiliation && affiliationLabel(filters.affiliation)].filter(Boolean).join(' · ')}</p>
          <Link to="/discover" onClick={() => { if (!previewMode) setQuery(''); }}>ล้างตัวกรอง</Link>
        </div>}
        {loading ? <LoadingGallery /> : error ? (
          <div className="discovery-error" role="alert"><p>{error}</p><button type="button" onClick={retry}>ลองอีกครั้ง</button></div>
        ) : data.total === 0 ? (
          <div className="discovery-empty"><h2>{hasFilters ? 'ไม่พบช่องที่ตรงกับตัวกรอง' : 'ยังไม่มีรายชื่อให้แสดง'}</h2><p>ลองค้นหาช่อง VTuber ที่คุณสนใจ</p><Link to="/discover?view=all">ดูรายชื่อทั้งหมด</Link></div>
        ) : categoryGroups ? (
          <div className="discovery-groups">
            {data.groups.map(group => (
              <section className="discovery-group" key={group.category} aria-labelledby={`discovery-${group.category}`}>
                <div className="discovery-group-heading">
                  <div><h2 id={`discovery-${group.category}`}>{categoryLabel(group.category)}</h2><span>{data.category_counts.find(item => item.category === group.category)?.count?.toLocaleString('th-TH') || 0} ช่อง</span></div>
                  <Link to={directorySearchHref({ category: group.category })}>ดูทั้งหมด <ArrowUpRight aria-hidden="true" /></Link>
                </div>
                {group.error ? <div className="discovery-error" role="alert"><span>{group.error}</span><button type="button" onClick={retry}>ลองอีกครั้ง</button></div> : group.results.length
                  ? <CreatorGrid results={group.results.slice(0, 3)} />
                  : <p className="discovery-group-empty">ยังไม่มีช่องในหมวดนี้ <Link to="/discover?view=all">ดูรายชื่อทั้งหมด</Link></p>}
              </section>
            ))}
          </div>
        ) : (
          <>
            <div className="discovery-content-heading">
              <h2>{hasFilters ? 'ผลการค้นหา' : templateId === 'newest-first' ? 'เพิ่มเข้าทำเนียบล่าสุด' : 'เริ่มสำรวจแกลเลอรี'}</h2>
              <Link to="/discover?view=all">ดูรายชื่อทั้งหมด <ArrowUpRight aria-hidden="true" /></Link>
            </div>
            <CreatorGrid results={data.results} showAddedDate={templateId === 'newest-first'} />
            {(offset > 0 || offset + 12 < data.total) && <nav className="discovery-content-heading" aria-label="หน้ารายชื่อ VTuber">
              {offset > 0 && <Link to={directorySearchHref({ ...filters, view: 'all', offset: Math.max(0, offset - 12) })}>ก่อนหน้า</Link>}
              <span>หน้า {Math.floor(offset / 12) + 1} · {data.total.toLocaleString('th-TH')} ช่อง</span>
              {offset + 12 < data.total && <Link to={directorySearchHref({ ...filters, view: 'all', offset: offset + 12 })}>ถัดไป</Link>}
            </nav>}
          </>
        )}
      </section>
      </div>
    </div>
  );
}
