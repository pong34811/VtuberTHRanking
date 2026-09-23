import { useState } from "react";
import { useList } from "./useList";
import { Button, Card, Empty, Loading, Notice, fmtDate } from "../ui";

const actionLabels = {
  create: "สร้าง",
  update: "แก้ไข",
  delete: "ลบ",
  calculate: "คำนวณอันดับ",
  "snapshot.create": "เพิ่มสถิติ",
  "youtube.import": "นำเข้าจาก YouTube",
  LOGIN: "เข้าสู่ระบบ",
  SETUP: "ตั้งค่าเริ่มต้น",
  PASSWORD_CHANGE: "เปลี่ยนรหัสผ่าน",
};
const targetLabels = {
  vtuber: "ช่อง VTuber",
  agency: "สังกัด",
  category: "หมวดหมู่",
  ranking: "อันดับ",
  report: "รายงาน",
  settings: "การตั้งค่า",
  user: "ผู้ใช้",
};
const detailLabels = {
  count: "จำนวนรายการ",
  fields: "ฟิลด์ที่แก้ไข",
  slug: "ชื่อช่องใน URL",
  name: "ชื่อ",
  followers: "ผู้ติดตาม",
  recorded_at: "เวลาบันทึก",
  role: "บทบาท",
  status: "สถานะ",
  password_changed: "เปลี่ยนรหัสผ่าน",
  sessions_revoked: "ยกเลิกเซสชัน",
  youtube_channel_id: "YouTube Channel ID",
  period: "ช่วงอันดับ",
  category: "ตัวชี้วัด",
  month: "เดือน",
};

function parseDetails(value) {
  if (value && typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" ? parsed : { value: parsed };
  } catch {
    return { raw: String(value || "") };
  }
}

function printable(value) {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (typeof value === "boolean") return value ? "ใช่" : "ไม่ใช่";
  if (value == null || value === "") return "—";
  return String(value);
}

function detailSummary(details) {
  const entries = Object.entries(details || {}).filter(([key]) => key !== "raw");
  if (!entries.length) return details?.raw ? "มีรายละเอียดเพิ่มเติม" : "ไม่มีรายละเอียดเพิ่มเติม";
  return entries.slice(0, 3).map(([key, value]) => `${detailLabels[key] || key}: ${printable(value)}`).join(" · ");
}

function rawDetails(details) {
  return details?.raw ?? JSON.stringify(details ?? {}, null, 2);
}

export function AuditTab() {
  const list = useList("/audit-logs");
  const [copyState, setCopyState] = useState({});

  const copyDetails = async (id, details) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(rawDetails(details));
      setCopyState((state) => ({ ...state, [id]: "คัดลอกแล้ว" }));
    } catch {
      setCopyState((state) => ({ ...state, [id]: "คัดลอกไม่ได้ในเบราว์เซอร์นี้" }));
    }
  };

  return (
    <Card title="ประวัติการทำงาน">
      <Notice>{list.error}</Notice>
      {list.loading ? (
        <Loading />
      ) : list.rows.length ? (
        <div className="admin-table-wrap">
          <table className="audit-table">
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
              {list.rows.map((row) => {
                const details = parseDetails(row.details);
                return (
                  <tr key={row.id}>
                    <td>{fmtDate(row.created_at)}</td>
                    <td>{row.display_name || row.username || row.user_id}</td>
                    <td>{actionLabels[row.action] || row.action || "ไม่ระบุ"}</td>
                    <td className="audit-target">
                      <span>{targetLabels[row.target_type] || row.target_type || "รายการ"}</span>
                      {row.target_id && <code>{row.target_id}</code>}
                    </td>
                    <td className="audit-detail">
                      <p>{detailSummary(details)}</p>
                      <details>
                        <summary>ดูรายละเอียด</summary>
                        <pre>{rawDetails(details)}</pre>
                        <Button type="button" onClick={() => copyDetails(row.id, details)}>
                          คัดลอกรายละเอียด
                        </Button>
                        <span className="audit-copy-status" role="status" aria-live="polite">
                          {copyState[row.id] || ""}
                        </span>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty />
      )}
    </Card>
  );
}
