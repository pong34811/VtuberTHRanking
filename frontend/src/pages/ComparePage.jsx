import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { vtubersAPI, compareAPI } from '../api/client'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ComparePage() {
  const [vtubers, setVtubers] = useState([])
  const [selected, setSelected] = useState([])
  const [category, setCategory] = useState('followers')
  const [compareData, setCompareData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    vtubersAPI.getList({ limit: 50 }).then((res) => {
      setVtubers(res.data.results)
    })
  }, [])

  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-3)
    )
  }

  const handleCompare = async () => {
    if (selected.length < 2) return
    setLoading(true)
    try {
      const res = await compareAPI.post({ vtubers: selected, category, months: 6 })
      setCompareData(res.data)
    } catch (err) {
      console.error('Compare failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const chartData = compareData?.vtubers?.length
    ? compareData.vtubers[0].history.map((_, idx) => {
        const point = { date: compareData.vtubers[0].history[idx]?.date }
        compareData.vtubers.forEach((v) => {
          point[v.name] = v.history[idx]?.value
        })
        return point
      })
    : []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">⚖️ เปรียบเทียบ VTuber</h1>

      <div className="flex gap-2 items-center">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm"
        >
          <option value="followers">ผู้ติดตาม</option>
          <option value="views">ยอดวิว</option>
        </select>
        <button
          onClick={handleCompare}
          disabled={selected.length < 2}
          className="px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          เปรียบเทียบ ({selected.length}/3)
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {vtubers.map((v) => (
          <button
            key={v.id}
            onClick={() => toggle(v.id)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              selected.includes(v.id)
                ? 'bg-[var(--color-accent)] border-[var(--color-accent)] text-white'
                : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-accent)]'
            }`}
          >
            {v.name}
          </button>
        ))}
      </div>

      {loading && <LoadingSpinner />}
      {compareData && (
        <div className="p-4 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)]">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a36" />
                <XAxis dataKey="date" stroke="#a1a1aa" fontSize={12} />
                <YAxis stroke="#a1a1aa" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a24', border: '1px solid #2a2a36', borderRadius: '8px' }} />
                <Legend />
                {compareData.vtubers.map((v) => (
                  <Line
                    key={v.id}
                    type="monotone"
                    dataKey={v.name}
                    stroke={v.color}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
