import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

export default function TrendChart({ data, dataKey, color = 'var(--primary)', periodLabel = 'ช่วงเวลาที่เลือก' }) {
  const pointCount = new Set((data ?? []).map((point) => point.date).filter(Boolean)).size
  if (pointCount < 2) {
    const message = pointCount === 0
      ? `ยังไม่มีข้อมูลย้อนหลังในช่วง ${periodLabel}`
      : `มีข้อมูลย้อนหลัง 1 จุดในช่วง ${periodLabel} ยังแสดงแนวโน้มไม่ได้`
    return <p role="status" className="text-center text-[var(--muted-foreground)] py-8">{message}</p>
  }

  const formatted = data.map((d) => ({
    date: d.date,
    value: d[dataKey] ?? d.value,
  }))
  const metricLabel = dataKey === 'followers' ? 'ผู้ติดตาม' : 'วิว'

  return (
    <>
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
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>ข้อมูลแนวโน้ม {metricLabel} ({periodLabel})</caption>
        <thead>
          <tr>
            <th scope="col">วันที่</th>
            <th scope="col">{metricLabel}</th>
          </tr>
        </thead>
        <tbody>
          {formatted.map(({ date, value }, index) => (
            <tr key={`${date}-${index}`}>
              <td><time dateTime={date}>{date}</time></td>
              <td>{value ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
