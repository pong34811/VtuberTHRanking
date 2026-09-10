import { useState, useEffect } from 'react'
import { vtubersAPI } from '../api/client'
import VTuberCard from '../components/VTuberCard'
import LoadingSpinner from '../components/LoadingSpinner'

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [affiliation, setAffiliation] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchResults()
    }, 300)
    return () => clearTimeout(timer)
  }, [query, category, affiliation])

  const fetchResults = async () => {
    setLoading(true)
    try {
      const params = {}
      if (query) params.q = query
      if (category) params.category = category
      if (affiliation) params.affiliation = affiliation
      const res = await vtubersAPI.getList(params)
      setResults(res.data.results)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">🔍 ค้นหา VTuber</h1>

      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ค้นหาจากชื่อ..."
          className="flex-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm"
        >
          <option value="">ทุกแนวหน้า</option>
          <option value="gaming">Gaming</option>
          <option value="singing">Singing</option>
          <option value="chatting">Chatting</option>
          <option value="art">Art</option>
          <option value="asmr">ASMR</option>
          <option value="education">Education</option>
        </select>
        <select
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
      ) : (
        <div className="space-y-2">
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
            <p className="text-center text-[var(--color-muted)] py-8">ไม่พบข้อมูล</p>
          )}
        </div>
      )}
    </div>
  )
}
