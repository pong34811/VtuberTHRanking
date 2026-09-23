import { useState, useEffect } from "react";
import { vtubersAPI } from "../api/client";
import VTuberCard from "../components/VTuberCard";
import Feedback from "../components/Feedback";
import LoadingSpinner from "../components/LoadingSpinner";
import { affiliationLabel, categoryLabel } from "../components/channelLabels";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const hasFilters = Boolean(query || category || affiliation);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      vtubersAPI
        .getList({ q: query.trim(), category, affiliation })
        .then((res) => {
          if (active) setResults(res.data.results);
        })
        .catch(() => {
          if (active) setError("ค้นหาไม่สำเร็จ กรุณาลองอีกครั้ง");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, category, affiliation, retry]);

  return (
    <div>
      <p className="eyebrow">DISCOVER CHANNELS</p>
      <h1 className="text-3xl font-semibold">ค้นหา VTuber</h1>
      <p className="page-intro">ค้นหาจากชื่อ แล้วกรองประเภทเนื้อหาหรือสังกัดได้ทันที</p>
      <section className="filter-panel" aria-label="ตัวกรองการค้นหา">
        <div className="search-field">
          <label htmlFor="vtuber-search">ชื่อช่อง</label>
          <input
          id="vtuber-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาจากชื่อ..."
          className="control-input"
          />
        </div>
        <div className="filter-field">
          <label htmlFor="category-filter">ประเภทเนื้อหา</label>
          <select id="category-filter"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="control-input"
        >
          <option value="">ทุกประเภท</option>
          <option value="gaming">{categoryLabel("gaming")}</option>
          <option value="singing">{categoryLabel("singing")}</option>
          <option value="chatting">{categoryLabel("chatting")}</option>
          <option value="art">{categoryLabel("art")}</option>
          <option value="asmr">{categoryLabel("asmr")}</option>
          <option value="education">{categoryLabel("education")}</option>
          <option value="other">{categoryLabel("other")}</option>
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor="affiliation-filter">สังกัด</label>
          <select id="affiliation-filter"
          value={affiliation}
          onChange={(e) => setAffiliation(e.target.value)}
          className="control-input"
        >
          <option value="">ทุกสังกัด</option>
          <option value="indie">{affiliationLabel("indie")}</option>
          <option value="agency">{affiliationLabel("agency")}</option>
          </select>
        </div>
        {hasFilters && <button className="clear-button" onClick={() => { setQuery(""); setCategory(""); setAffiliation(""); }}>ล้างตัวกรอง</button>}
      </section>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Feedback error={error} retry={() => setRetry((x) => x + 1)} />
      ) : (
        <section aria-live="polite">
          <div className="result-heading"><h2>ผลการค้นหา</h2><span>{results.length.toLocaleString("th-TH")} ช่อง</span></div>
          <div className="ranking-list">
            {results.map((v) => <VTuberCard key={v.id} vtuber={v} rank="-" score={null} rankChange={null} />)}
            {results.length === 0 && <div className="empty-state"><strong>ไม่พบช่องที่ตรงกับตัวกรอง</strong><span>ลองใช้คำค้นที่สั้นลง หรือล้างตัวกรองบางรายการ</span>{hasFilters && <button className="secondary-button" onClick={() => { setQuery(""); setCategory(""); setAffiliation(""); }}>แสดงทุกช่อง</button>}</div>}
          </div>
        </section>
      )}
    </div>
  );
}
