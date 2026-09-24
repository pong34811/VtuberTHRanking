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
  const [minFollowers, setMinFollowers] = useState("");
  const [maxFollowers, setMaxFollowers] = useState("");
  const [sort, setSort] = useState("name");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const parsedMinFollowers = minFollowers === "" ? null : Number(minFollowers);
  const parsedMaxFollowers = maxFollowers === "" ? null : Number(maxFollowers);
  const invalidFollowerBound = [parsedMinFollowers, parsedMaxFollowers].some(
    (value) => value !== null && (!Number.isSafeInteger(value) || value < 0),
  );
  const followerRangeError = invalidFollowerBound
    ? "กรุณาระบุจำนวนผู้ติดตามเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป"
    : parsedMinFollowers !== null && parsedMaxFollowers !== null && parsedMinFollowers > parsedMaxFollowers
      ? "จำนวนขั้นต่ำต้องไม่เกินจำนวนสูงสุด"
      : "";
  const hasFilters = Boolean(query || category || affiliation || minFollowers || maxFollowers || sort !== "name");

  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setAffiliation("");
    setMinFollowers("");
    setMaxFollowers("");
    setSort("name");
  };

  useEffect(() => {
    let active = true;
    if (followerRangeError) {
      setResults([]);
      setLoading(false);
      setError("");
      return () => { active = false; };
    }
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      const params = { q: query.trim(), category, affiliation };
      if (minFollowers !== "") params.min_followers = parsedMinFollowers;
      if (maxFollowers !== "") params.max_followers = parsedMaxFollowers;
      if (sort !== "name") params.sort = sort;
      vtubersAPI
        .getList(params)
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
  }, [query, category, affiliation, minFollowers, maxFollowers, sort, followerRangeError, retry]);

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
        <div className="filter-field follower-range-field">
          <label>ช่วงผู้ติดตาม</label>
          <div className="follower-range-control">
            <label className="sr-only" htmlFor="followers-min">ผู้ติดตามตั้งแต่</label>
            <input id="followers-min" aria-label="ผู้ติดตามตั้งแต่" type="number" min="0" step="1" inputMode="numeric" value={minFollowers} onChange={(e) => setMinFollowers(e.target.value)} placeholder="ขั้นต่ำ" className="control-input" />
            <span aria-hidden="true">ถึง</span>
            <label className="sr-only" htmlFor="followers-max">ผู้ติดตามถึง</label>
            <input id="followers-max" aria-label="ผู้ติดตามถึง" type="number" min="0" step="1" inputMode="numeric" value={maxFollowers} onChange={(e) => setMaxFollowers(e.target.value)} placeholder="สูงสุด" className="control-input" />
          </div>
        </div>
        <div className="filter-field">
          <label htmlFor="search-sort">เรียงผลลัพธ์</label>
          <select id="search-sort" aria-label="เรียงผลลัพธ์" value={sort} onChange={(e) => setSort(e.target.value)} className="control-input">
            <option value="name">ชื่อ A–Z</option>
            <option value="followers_desc">ผู้ติดตามมากไปน้อย</option>
            <option value="followers_asc">ผู้ติดตามน้อยไปมาก</option>
          </select>
        </div>
        {hasFilters && <button className="clear-button" onClick={clearFilters}>ล้างตัวกรอง</button>}
      </section>

      {followerRangeError ? (
        <p className="filter-error" role="alert">{followerRangeError}</p>
      ) : loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Feedback error={error} retry={() => setRetry((x) => x + 1)} />
      ) : (
        <section aria-live="polite">
          <div className="result-heading"><h2>ผลการค้นหา</h2><span>{results.length.toLocaleString("th-TH")} ช่อง</span></div>
          <div className="ranking-list">
            {results.map((v) => <VTuberCard key={v.id} vtuber={v} rank="-" score={null} rankChange={null} followers={v.followers} />)}
            {results.length === 0 && <div className="empty-state"><strong>ไม่พบช่องที่ตรงกับตัวกรอง</strong><span>ลองใช้คำค้นที่สั้นลง หรือล้างตัวกรองบางรายการ</span>{hasFilters && <button className="secondary-button" onClick={clearFilters}>แสดงทุกช่อง</button>}</div>}
          </div>
        </section>
      )}
    </div>
  );
}
