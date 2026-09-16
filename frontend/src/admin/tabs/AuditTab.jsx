import { useList } from "./useList";
import { Card, Empty, Loading, Notice, fmtDate } from "../ui";

export function AuditTab() {
  const list = useList("/audit-logs");
  return (
    <Card title="ประวัติการทำงาน">
      <Notice>{list.error}</Notice>
      {list.loading ? (
        <Loading />
      ) : list.rows.length ? (
        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>เวลา</th>
                <th>ผู้ใช้</th>
                <th>การทำงาน</th>
                <th>รายการ</th>
                <th>รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.created_at)}</td>
                  <td>{r.display_name || r.username || r.user_id}</td>
                  <td>{r.action}</td>
                  <td>
                    {r.target_type} {r.target_id}
                  </td>
                  <td>
                    <small>
                      {typeof r.details === "string"
                        ? r.details
                        : JSON.stringify(r.details)}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty />
      )}
    </Card>
  );
}

