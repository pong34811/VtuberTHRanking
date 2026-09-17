import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

export default function TrendChart({ data, dataKey, color = 'var(--primary)' }) {
  if (!data?.length) {
    return <p className="text-center text-[var(--muted-foreground)] py-8">ไม่มีข้อมูลกราฟ</p>
  }

  const formatted = data.map((d) => ({
    date: d.date,
    value: d[dataKey] ?? d.value,
  }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="date"
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickFormatter={(v) => v.slice(5)}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-card)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              color: 'var(--color-text)',
            }}
            formatter={(v) => [v?.toLocaleString() ?? '—', dataKey === 'followers' ? 'ผู้ติดตาม' : 'วิว']}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={formatted.length === 1 ? { r: 4 } : false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
