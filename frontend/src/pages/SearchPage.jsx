import { useState, useEffect } from "react";
import { vtubersAPI } from "../api/client";
import VTuberCard from "../components/VTuberCard";
import Feedback from "../components/Feedback";
import LoadingSpinner from "../components/LoadingSpinner";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const timer = setTimeout(() => {
      vtubersAPI
        .getList({ q: query, category, affiliation })
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ค้นหา VTuber</h1>

      <p className="page-intro">ค้นพบช่องใหม่ หรือค้นหาช่องที่คุณติดตาม</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          aria-label="ค้นหาจากชื่อ"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาจากชื่อ..."
          className="flex-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
        />
        <select
          aria-label="ประเภทเนื้อหา"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm"
        >
          <option value="">ทุกประเภท</option>
          <option value="gaming">Gaming</option>
          <option value="singing">Singing</option>
          <option value="chatting">Chatting</option>
          <option value="art">Art</option>
          <option value="asmr">ASMR</option>
          <option value="education">Education</option>
        </select>
        <select
          aria-label="สังกัด"
          value={affiliation}
          onChange={(e) => setAffiliation(e.target.value)}
          className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm"
        >
          <option value="">ทุกสังกัด</option>
          <option value="indie">Indie</option>
          <option value="agency">Agency</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : error ? (
        <Feedback error={error} retry={() => setRetry((x) => x + 1)} />
      ) : (
        <div className="ranking-list">
          {results.map((v) => (
            <VTuberCard
              key={v.id}
              vtuber={v}
              rank="-"
              score={null}
              rankChange={null}
            />
          ))}
          {results.length === 0 && (
            <p className="text-center text-[var(--color-muted)] py-8">
              ไม่พบข้อมูล
            </p>
          )}
        </div>
      )}
    </div>
  );
}
