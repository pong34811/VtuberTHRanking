import { Link, useLocation } from 'react-router-dom';
import ChangeIndicator from './ChangeIndicator';
import { affiliationLabel, categoryLabel } from './channelLabels';
import RetryAvatar from './RetryAvatar';

function ChannelAvatar({ vtuber }) {
  return <RetryAvatar src={vtuber.avatar} className="avatar" alt="" loading="lazy" fallback={<span className="avatar" aria-hidden="true">{vtuber.name.charAt(0)}</span>} />;
}

export default function LeaderboardTable({ rankings, loading, metric = 'คะแนน', showChange = true, period = 'alltime' }) {
  const location = useLocation();
  if (loading) return null;
  if (!rankings?.length) return <div className="empty-state"><strong>ยังไม่มีอันดับในช่วงเวลานี้</strong><span>ลองเลือกช่วงเวลาหรือหมวดสถิติอื่น</span></div>;
  return (
    <div>
      <p className="home-table-scroll-hint">เลื่อนตารางแนวนอนเพื่อดูข้อมูลครบ</p>
      <div className="home-table-wrap" role="region" aria-label="ตารางอันดับ เลื่อนแนวนอนเพื่อดูข้อมูลครบ" tabIndex={0}>
      <table className="home-table">
        <caption className="sr-only">อันดับ VTuber ตาม{metric}</caption>
        <thead><tr><th scope="col">อันดับ</th><th scope="col">ช่อง VTuber</th><th scope="col" className="home-number">{metric}</th>{showChange && <th scope="col" className="home-change">เปลี่ยนแปลง</th>}</tr></thead>
        <tbody>{rankings.map(item => (
          <tr key={item.vtuber.id}>
            <td className="home-rank">{String(item.rank).padStart(2, '0')}</td>
            <th scope="row"><Link to={`/profile/${item.vtuber.slug}`} state={{ returnTo: { pathname: location.pathname, search: location.search } }} className="home-channel"><ChannelAvatar vtuber={item.vtuber} /><span><span className="home-channel-name">{item.vtuber.name}</span><span className="home-channel-meta">{categoryLabel(item.vtuber.category)} · {affiliationLabel(item.vtuber.affiliation)}{item.vtuber.affiliation === 'agency' && typeof item.vtuber.agency_name === 'string' && item.vtuber.agency_name.trim() ? ` ${item.vtuber.agency_name.trim()}` : ''}{item.overall_rank != null && ` · อันดับรวม #${item.overall_rank.toLocaleString('th-TH')}`}</span></span></Link></th>
            <td className="home-number">{item.score?.toLocaleString('th-TH') ?? '—'}</td>
            {showChange && <td className="home-change">{period === 'monthly' ? <span aria-label="ไม่แสดงการเปลี่ยนแปลงอันดับรายเดือน" className="text-[var(--muted-foreground)] text-sm">-</span> : <ChangeIndicator change={item.rank_change} isNew={item.rank_change === 'NEW'} />}</td>}
          </tr>
        ))}</tbody>
      </table>
      </div>
    </div>
  );
}
