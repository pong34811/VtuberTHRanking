import { useEffect, useState } from "react";
import { adminApi } from "../api";
import { Button, Card, Field, Loading, Notice, useSubmit } from "../ui";

export function SettingsTab({ csrfToken }) {
  const [form, setForm] = useState({
      site_name: "",
      site_status: "active",
      current_ranking_period: "",
      ranking_update_frequency: "manual",
      directory_sync_enabled: "false",
    }),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [success, setSuccess] = useState(""),
    [retry, setRetry] = useState(0);
  const [runs, setRuns] = useState([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState("");
  const [runsRetry, setRunsRetry] = useState(0);
  const [directory, setDirectory] = useState(null);
  const [directoryError, setDirectoryError] = useState("");
  const [directoryRetry, setDirectoryRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setDirectory(null); setDirectoryError("");
    adminApi("/directory-sync").then(data => {
      if (!Array.isArray(data.runs) || !Array.isArray(data.candidates)) throw new Error("โหลดสถานะโปรไฟล์ไม่สำเร็จ");
      if (active) setDirectory(data);
    }).catch(error => { if (active) setDirectoryError(error.message); });
    return () => { active = false; };
  }, [directoryRetry]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    adminApi("/settings")
      .then((d) => {
        if (!active) return;
        const obj = {};
        for (const r of d.results || []) obj[r.setting_key] = r.setting_value;
        setForm((f) => ({ ...f, ...obj }));

      })
      .catch((error) => { if (active) setLoadError(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    let active = true;
    setRunsLoading(true);
    setRunsError("");
    adminApi("/pipeline-runs")
      .then((response) => { if (active) setRuns(response.results || []); })
      .catch((error) => { if (active) setRunsError(error.message); })
      .finally(() => { if (active) setRunsLoading(false); });
    return () => { active = false; };
  }, [runsRetry]);
  const save = useSubmit(() => {
    setSuccess("");
    return adminApi("/settings", { method: "PUT", csrfToken, body: form });
  }, () => setSuccess("บันทึกการตั้งค่าแล้ว"));
  const runStatus = (run) => {
    if (run.status === "running") {
      const age = Date.now() - Date.parse(run.started_at);
      return Number.isFinite(age) && age > 15 * 60 * 1000 ? "หยุดก่อนเสร็จ" : "กำลังทำงาน";
    }
    return ({ succeeded: "สำเร็จ", partial: "สำเร็จบางส่วน", failed: "ล้มเหลว" })[run.status] || run.status;
  };
  const runTime = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "ไม่ทราบเวลา" : date.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
  };
  const frequencyLabel = (value) => ({ manual: "ด้วยตนเอง", hourly: "ทุกชั่วโมง", daily: "ทุก 24 ชั่วโมง", weekly: "ทุก 7 วัน", monthly: "ทุก 30 วัน" })[value] || value;
  return (
    <Card title="ตั้งค่าเว็บไซต์">
      <section className="pipeline-runs" aria-labelledby="pipeline-runs-title">
        <header>
          <div>
            <h3 id="pipeline-runs-title">สถานะรอบอัปเดตอันดับ</h3>
            <small>สำเร็จเมื่อเก็บสถิติและเผยแพร่ครบตามจำนวนที่กำหนด</small>
          </div>
          {!runsLoading && <Button type="button" onClick={() => setRunsRetry((value) => value + 1)}>รีเฟรช</Button>}
        </header>
        {runsLoading ? <Loading /> : runsError ? (
          <div><Notice>{runsError}</Notice><Button type="button" onClick={() => setRunsRetry((value) => value + 1)}>ลองโหลดสถานะอีกครั้ง</Button></div>
        ) : runs.length ? (
          runs.map((run) => (
            <article className="pipeline-run" key={run.id} data-status={run.status}>
              <header>
                <h3>{runStatus(run)}</h3>
                <time dateTime={run.completed_at || run.started_at}>{runTime(run.completed_at || run.started_at)}</time>
              </header>
              <small>{run.trigger_source === "manual" ? "สั่งด้วยตนเอง" : "ตั้งเวลาทำงาน"} · {frequencyLabel(run.frequency)}</small>
              <dl>
                <div><dt>ช่องที่พบ</dt><dd>{run.channels_total ?? 0}</dd></div>
                <div><dt>บันทึกสถิติ</dt><dd>{run.snapshots_written ?? 0}</dd></div>
                <div><dt>ชุดอันดับที่เผยแพร่</dt><dd>{run.rankings_published ?? 0}/{run.rankings_expected ?? 6}</dd></div>
              </dl>
              {run.error_summary && <p className="pipeline-error">{run.error_summary}</p>}
            </article>
          ))
        ) : <p className="admin-state">ยังไม่มีรอบอัปเดต</p>}
      </section>
      <section className="pipeline-runs" aria-labelledby="directory-sync-title">
        <header>
          <div><h3 id="directory-sync-title">ค้นหาและอัปเดตโปรไฟล์รายวัน</h3><small>ช่องใหม่รอผู้จัดการอนุมัติ รีเฟรชเฉพาะฟิลด์ที่ต้นทางเป็นเจ้าของ</small></div>
          <Button type="button" onClick={() => setDirectoryRetry(value => value + 1)}>รีเฟรชโปรไฟล์</Button>
        </header>
        {directoryError ? <Notice>{directoryError}</Notice> : !directory ? <Loading /> : <>
          {directory.runs.length ? directory.runs.map(run => <article className="pipeline-run" key={run.id}>
            <header><h3>{runStatus(run)}</h3><time dateTime={run.completed_at || run.started_at}>{runTime(run.completed_at || run.started_at)}</time></header>
            <p>ตรวจโปรไฟล์เดิม {run.profiles_checked} · เข้าคิวใหม่ {run.candidates_new ?? "—"} · รออนุมัติทั้งหมด {run.candidates_pending}</p>
            {run.error_summary && <Notice>{run.error_summary}</Notice>}
          </article>) : <p className="admin-state">ยังไม่มีรอบอัปเดตโปรไฟล์</p>}
          <a href="/admin/channel-approvals">ตรวจช่องรออนุมัติ</a>
        </>}
      </section>
      {loading ? (
        <Loading />
      ) : loadError ? (
        <><Notice>{loadError}</Notice><Button type="button" onClick={() => setRetry(value => value + 1)}>ลองอีกครั้ง</Button></>
      ) : (
        <form onSubmit={save.submit} onChange={() => setSuccess("")}>
          <Notice type={save.error ? "error" : "success"}>
            {save.error || success}
          </Notice>
          <div className="admin-grid">
            <Field label="ชื่อเว็บไซต์">
              <input
                required
                value={form.site_name || ""}
                onChange={(e) =>
                  setForm({ ...form, site_name: e.target.value })
                }
              />
            </Field>
            <Field label="สถานะเว็บไซต์" hint="API สาธารณะจะแสดงสถานะเว็บไซต์นี้">
              <select
                value={form.site_status}
                onChange={(e) =>
                  setForm({ ...form, site_status: e.target.value })
                }
              >
                <option value="active">เปิดใช้งาน</option>
                <option value="maintenance">ปิดปรับปรุง</option>
              </select>
            </Field>
            <Field label="เดือนอันดับปัจจุบัน" hint="เดือนเริ่มต้นสำหรับอันดับรายเดือน">
              <input
                type="month"
                required
                value={form.current_ranking_period || ""}
                onChange={(e) =>
                  setForm({ ...form, current_ranking_period: e.target.value })
                }
              />
            </Field>
            <Field label="ความถี่การอัปเดต" hint="เก็บสถิติตามรอบที่เลือก รอบ 30 วันใช้เดือนปฏิทิน">
              <select
                value={form.ranking_update_frequency}
                onChange={(e) =>
                  setForm({ ...form, ranking_update_frequency: e.target.value })
                }
              >
                <option value="manual">ด้วยตนเอง</option>
                <option value="hourly">ทุกชั่วโมง</option>
                <option value="daily">ทุก 24 ชั่วโมง</option>
                <option value="weekly">ทุก 7 วัน</option>
                <option value="monthly">ทุก 30 วัน</option>
              </select>
            </Field>
            <Field label="ค้นหาและอัปเดตโปรไฟล์" hint="ค้นหาช่องใหม่และรีเฟรชโปรไฟล์วันละครั้งตามวันในประเทศไทย แยกจากรอบสถิติ">
              <select value={form.directory_sync_enabled} onChange={event => setForm({ ...form, directory_sync_enabled: event.target.value })}>
                <option value="false">ปิด</option>
                <option value="true">อัตโนมัติรายวัน</option>
              </select>
            </Field>
          </div>
          <Button className="primary" busy={save.busy}>
            บันทึกการตั้งค่า
          </Button>
        </form>
      )}
    </Card>
  );
}
