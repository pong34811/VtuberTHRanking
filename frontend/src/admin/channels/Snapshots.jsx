import { useEffect, useState } from "react";
import { adminApi } from "../api";
import { fmtDate, fmtNumber, useSubmit } from "../ui";
import { Button } from "../components/ui/button";
import { Alert, Field, FormActions, Input } from "../components/ui/field";
import { TD, TH, THead, TR, Table, TableWrap } from "../components/ui/table";
import { Avatar, EmptyState, SkeletonRows } from "../components/ui/feedback";

export function localDateTime(date = new Date()) {
  const pad = value => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function Snapshots({ channel, csrfToken }) {
  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({
    followers: "",
    total_views: "",
    video_count: "",
    recorded_at: localDateTime(),
  });
  const load = () => {
    setLoading(true);
    setLoadError("");
    return adminApi(`/vtubers/${channel.id}/snapshots`)
      .then((d) => setRows(d.results || []))
      .catch((error) => setLoadError(error.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const { busy, error, submit } = useSubmit(
    () =>
      adminApi(`/vtubers/${channel.id}/snapshots`, {
        method: "POST",
        csrfToken,
        body: {
          ...form,
          followers: Number(form.followers),
          total_views: Number(form.total_views),
          video_count: Number(form.video_count),
          recorded_at: new Date(form.recorded_at).toISOString(),
        },
      }),
    () => {
      setForm({ ...form, followers: "", total_views: "", video_count: "" });
      load();
    },
  );
  const latest = rows[0];
  return (
    <div className="grid gap-5">
      {latest && (
        <div className="grid grid-cols-3 gap-2">
          {[
            ["ผู้ติดตาม", latest.followers],
            ["ยอดดูรวม", latest.total_views],
            ["วิดีโอ", latest.video_count],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-border bg-card-hover/40 px-3 py-2.5 text-center"
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-base font-semibold">{fmtNumber(value)}</p>
            </div>
          ))}
        </div>
      )}
      <form
        onSubmit={submit}
        className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2"
      >
        <p className="text-sm font-medium sm:col-span-2">บันทึกสถิติใหม่</p>
        <Alert>{error}</Alert>
        <Field label="ผู้ติดตาม">
          <Input
            type="number"
            min="0"
            required
            value={form.followers}
            onChange={set("followers")}
          />
        </Field>
        <Field label="ยอดดูรวม">
          <Input
            type="number"
            min="0"
            required
            value={form.total_views}
            onChange={set("total_views")}
          />
        </Field>
        <Field label="จำนวนวิดีโอ">
          <Input
            type="number"
            min="0"
            required
            value={form.video_count}
            onChange={set("video_count")}
          />
        </Field>
        <Field label="เวลาที่บันทึก">
          <Input
            type="datetime-local"
            required
            value={form.recorded_at}
            onChange={set("recorded_at")}
          />
        </Field>
        <FormActions>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "กำลังบันทึก…" : "เพิ่มสถิติ"}
          </Button>
        </FormActions>
      </form>
      <div>
        <p className="mb-2 text-sm font-medium">ประวัติสถิติ</p>
        {loading ? (
          <SkeletonRows rows={3} />
        ) : loadError ? (
          <Alert>{loadError} <Button onClick={load}>ลองอีกครั้ง</Button></Alert>
        ) : rows.length ? (
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>วันที่</TH>
                  <TH className="text-right">ผู้ติดตาม</TH>
                  <TH className="text-right">ยอดดู</TH>
                  <TH className="text-right">วิดีโอ</TH>
                </TR>
              </THead>
              <tbody>
                {rows.map((r, i) => (
                  <TR key={r.id || i}>
                    <TD className="whitespace-nowrap">
                      {fmtDate(r.recorded_at)}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {fmtNumber(r.followers)}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {fmtNumber(r.total_views)}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {fmtNumber(r.video_count)}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState
            title="ยังไม่มีสถิติ"
            hint="ดึงจาก YouTube หรือบันทึกเองด้านบน"
          />
        )}
      </div>
    </div>
  );
}
