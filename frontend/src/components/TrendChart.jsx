import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

export default function TrendChart({ data, dataKey, color = '#8b5cf6' }) {
  if (!data?.length) {
    return <p className="text-center text-[var(--color-muted)] py-8">ไม่มีข้อมูลกราฟ</p>
  }

  const formatted = data.map((d) => ({
    date: d.date,
    value: d[dataKey] || d.value,
  }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a36" />
          <XAxis
            dataKey="date"
            stroke="#a1a1aa"
            fontSize={12}
            tickFormatter={(v) => v.slice(5)}
          />
          <YAxis
            stroke="#a1a1aa"
            fontSize={12}
            tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1a1a24',
              border: '1px solid #2a2a36',
              borderRadius: '8px',
              color: '#e4e4e7',
            }}
            formatter={(v) => [v.toLocaleString(), dataKey === 'followers' ? 'ผู้ติดตาม' : 'วิว']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
