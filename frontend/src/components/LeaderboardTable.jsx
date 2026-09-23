import { useState } from 'react';
import { Link } from 'react-router-dom';
import ChangeIndicator from './ChangeIndicator';
import { affiliationLabel, categoryLabel } from './channelLabels';

function ChannelAvatar({ vtuber }) {
  const [failed, setFailed] = useState(false);
  return vtuber.avatar && !failed
    ? <img className="avatar" src={vtuber.avatar} alt="" loading="lazy" onError={() => setFailed(true)} />
    : <span className="avatar" aria-hidden="true">{vtuber.name.charAt(0)}</span>;
}

export default function LeaderboardTable({ rankings, loading, metric = 'คะแนน' }) {
  if (loading) return null;
  if (!rankings?.length) return <div className="empty-state"><strong>ยังไม่มีอันดับในช่วงเวลานี้</strong><span>ลองเลือกช่วงเวลาหรือหมวดสถิติอื่น</span></div>;
  return (
    <div className="home-table-wrap">
      <table className="home-table">
        <caption className="sr-only">อันดับ VTuber ตาม{metric}</caption>
        <thead><tr><th scope="col">อันดับ</th><th scope="col">ช่อง VTuber</th><th scope="col" className="home-number">{metric}</th><th scope="col" className="home-change">เปลี่ยนแปลง</th></tr></thead>
        <tbody>{rankings.map(item => (
          <tr key={item.vtuber.id}>
            <td className="home-rank">{String(item.rank).padStart(2, '0')}</td>
            <th scope="row"><Link to={`/profile/${item.vtuber.slug}`} className="home-channel"><ChannelAvatar vtuber={item.vtuber} /><span><span className="home-channel-name">{item.vtuber.name}</span><span className="home-channel-meta">{categoryLabel(item.vtuber.category)} · {affiliationLabel(item.vtuber.affiliation)}</span></span></Link></th>
            <td className="home-number">{item.score?.toLocaleString('th-TH') ?? '—'}</td>
            <td className="home-change"><ChangeIndicator change={item.rank_change} isNew={item.rank_change === 'NEW'} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
