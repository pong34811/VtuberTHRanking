import { render, screen, within } from '@testing-library/react';
import TrendChart from '@/components/TrendChart.jsx';

describe('TrendChart', () => {
  it('exposes exact metric values and full dates in an accessible data table', () => {
    render(
      <TrendChart
        data={[
          { date: '2026-07-01', followers: 1_234, total_views: 1_234_567 },
          { date: '2026-08-01', followers: 1_345, total_views: 7_654_321 },
        ]}
        dataKey="total_views"
        periodLabel="6 เดือน"
      />,
    );

    const table = screen.getByRole('table', { name: 'ข้อมูลแนวโน้ม วิว (6 เดือน)' });
    expect(within(table).getByRole('columnheader', { name: 'วันที่' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'วิว' })).toBeInTheDocument();
    expect(within(table).getByText('2026-07-01')).toHaveAttribute('datetime', '2026-07-01');
    expect(within(table).getByText('2026-08-01')).toHaveAttribute('datetime', '2026-08-01');
    expect(within(table).getByText('1234567')).toBeInTheDocument();
    expect(within(table).getByText('7654321')).toBeInTheDocument();
    expect(within(table).queryByText('1234')).not.toBeInTheDocument();
  });

  it('keeps the empty-history status when there are no dated points', () => {
    render(<TrendChart data={[]} dataKey="followers" periodLabel="6 เดือน" />);

    expect(screen.getByRole('status')).toHaveTextContent('ยังไม่มีข้อมูลย้อนหลังในช่วง 6 เดือน');
  });

  it('keeps the one-point status when there is only one dated point', () => {
    render(
      <TrendChart
        data={[{ date: '2026-08-01', followers: 1_234 }]}
        dataKey="followers"
        periodLabel="6 เดือน"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('มีข้อมูลย้อนหลัง 1 จุดในช่วง 6 เดือน ยังแสดงแนวโน้มไม่ได้');
  });
});
