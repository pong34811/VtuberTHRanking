import { useState, useEffect } from 'react'
import { rankingsAPI, summaryAPI } from '../api/client'
import PeriodSelector from '../components/PeriodSelector'
import CategorySelector from '../components/CategorySelector'
import LoadingSpinner from '../components/LoadingSpinner'
import TopThree from '../components/TopThree'
import LeaderboardTable from '../components/LeaderboardTable'

export default function HomePage() {
  const [rankings, setRankings] = useState([])
  const [summary, setSummary] = useState(null)
  const [period, setPeriod] = useState('monthly')
  const [category, setCategory] = useState('followers')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [rankingsRes, summaryRes] = await Promise.all([
          rankingsAPI.getList({ period, category, limit: 50 }),
          summaryAPI.get(),
        ])
        setRankings(rankingsRes.data.results)
        setSummary(summaryRes.data)
      } catch (err) {
        console.error('Failed to fetch rankings:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [period, category])

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">🏆 อันดับ VTuber ไทย</h1>
        <div className="flex gap-2">
          <PeriodSelector
            value={period}
            onChange={setPeriod}
            choices={summary?.period_choices || []}
          />
          <CategorySelector
            value={category}
            onChange={setCategory}
            choices={summary?.category_choices || []}
          />
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          <TopThree rankings={rankings} />
          <LeaderboardTable rankings={rankings} loading={loading} />
        </>
      )}
    </div>
  )
}
