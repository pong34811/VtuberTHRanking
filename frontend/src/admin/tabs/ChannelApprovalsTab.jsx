import { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api";
import { Card, Notice, useSubmit } from "../ui";
import { Button } from "../components/ui/button";
import { Field, Input } from "../components/ui/field";
import { Dialog } from "../components/ui/dialog";
import { ChannelForm } from "../channels/ChannelForm";
import { YouTubeImport } from "../channels/YouTubeImport";
import { blank, channelFields } from "../channels/options";
import { useList } from "./useList";

const pageSize = 20;
function parse(value, fallback) {
  try { return JSON.parse(value); } catch { return fallback; }
}
function safeSource(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(url.hostname)
      ? url.href : null;
  } catch { return null; }
}
function Evidence({ row }) {
  const items = parse(row.evidence_json, []);
  const date = new Date(row.checked_at?.includes("T") ? row.checked_at : `${row.checked_at?.replace(" ", "T")}Z`);
  return (
    <div className="approval-evidence">
      <p>สถานะเดบิวต์หรือการยุติ: ยังไม่ยืนยัน โปรดตรวจข้อความจากเจ้าของช่อง</p>
      <p>ตรวจล่าสุด: {Number.isNaN(date.getTime()) ? "ไม่ทราบ" : date.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
      <a href={`https://www.youtube.com/channel/${encodeURIComponent(row.channel_id)}`} target="_blank" rel="noopener noreferrer">เปิดช่อง YouTube</a>
      {Array.isArray(items) && items.filter(item => item && typeof item === "object").map((item, index) => (
        <div key={index}>
          <strong>{item.kind === "youtube-profile" ? "ข้อความจากโปรไฟล์ YouTube" : "เบาะแสจากการค้นหา (ยังไม่ยืนยันว่าเป็น VTuber ไทย)"}</strong>
          {item.query && <p>คำค้น: {String(item.query)}</p>}
          {item.description && <p style={{ whiteSpace: "pre-wrap" }}>{String(item.description)}</p>}
          {safeSource(item.source) && <a href={safeSource(item.source)} target="_blank" rel="noopener noreferrer">ดูแหล่งข้อมูล</a>}
        </div>
      ))}
    </div>
  );
}
function reviewValue(row) {
  const profile = parse(row.profile_json, {}), draft = parse(row.review_json, {});
  const editable = Object.fromEntries(channelFields
    .filter(key => !["platform", "youtube_url", "channel_url", "affiliation"].includes(key))
    .filter(key => Object.hasOwn(draft || {}, key))
    .map(key => [key, draft[key]]));
  const canonical = `https://www.youtube.com/channel/${row.channel_id}`;
  const slugId = Array.from(row.channel_id, char => char.charCodeAt(0).toString(16).padStart(2, "0")).join("");
  return {
    ...blank, name: profile?.name || row.name || "", avatar: profile?.avatar || "", bio: profile?.bio || "",
    slug: `youtube-${slugId}`, ...editable,
    affiliation: "", platform: "youtube", youtube_url: canonical, channel_url: canonical,
  };
}
function Candidate({ row, csrfToken, onReview, onDone, onRefresh }) {
  const action = useSubmit(async () => {
    try {
      return await adminApi(`/directory-candidates/${encodeURIComponent(row.channel_id)}/ignore`, { method: "POST", csrfToken });
    } catch (error) {
      if (error.status === 409) throw new Error("รายการนี้เปลี่ยนไปแล้ว กรุณารีเฟรชคิว");
      throw error;
    }
  }, () => onDone("ข้ามรายการแล้ว"), row.channel_id);
  return (
    <article className="admin-card approval-candidate">
      <h3>{row.name || row.channel_id}</h3>
      <p>รอผู้จัดการตรวจและอนุมัติ</p>
      <Evidence row={row} />
      {action.error && <Notice>{action.error} <Button onClick={onRefresh}>รีเฟรชคิว</Button></Notice>}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onReview(row)}>ตรวจและอนุมัติ</Button>
        <Button disabled={action.busy} onClick={action.submit}>{action.busy ? "กำลังข้าม…" : "ข้ามรายการ"}</Button>
      </div>
    </article>
  );
}
export function ChannelApprovalsTab({ csrfToken }) {
  const [input, setInput] = useState(""), [query, setQuery] = useState(""), [offset, setOffset] = useState(0);
  const [review, setReview] = useState(null), [adding, setAdding] = useState(false), [success, setSuccess] = useState("");
  const [progress, setProgress] = useState(null), [progressError, setProgressError] = useState(""), [retry, setRetry] = useState(0);
  const list = useList(`/directory-candidates?q=${encodeURIComponent(query)}&limit=${pageSize}&offset=${offset}`);
  const value = useMemo(() => review ? reviewValue(review) : null, [review]);
  useEffect(() => {
    const controller = new AbortController();
    setProgress(null); setProgressError("");
    adminApi("/directory-sync", { signal: controller.signal }).then(data => {
      if (!Array.isArray(data.runs)) throw new Error("สถานะการค้นหาไม่ถูกต้อง");
      setProgress(data);
    }).catch(error => { if (error.name !== "AbortError") setProgressError(error.message); });
    return () => controller.abort();
  }, [retry]);
  const refresh = () => { list.load(); setRetry(value => value + 1); };
  const done = message => {
    setSuccess(message); setReview(null);
    if (list.rows.length === 1 && offset > 0) setOffset(offset - pageSize);
    else list.load();
    setRetry(value => value + 1);
  };
  const invalid = list.data && (!Number.isInteger(list.data.total) || list.data.total < 0 || list.data.limit !== pageSize || list.data.offset !== offset);
  const run = progress?.runs[0];
  return (
    <div className="grid gap-4">
      <Card title="ช่องรออนุมัติ" actions={<Button onClick={() => setAdding(true)}>เพิ่มช่องเข้าคิว</Button>}>
        <p>ช่องใหม่ยังไม่แสดงบนเว็บไซต์จนกว่าผู้จัดการจะตรวจหลักฐานและอนุมัติ</p>
        <Notice type="success">{success}</Notice>
        <form onSubmit={event => { event.preventDefault(); setQuery(input.trim()); setOffset(0); }} className="flex flex-wrap items-end gap-2">
          <Field label="ค้นหาชื่อช่อง"><Input value={input} onChange={event => setInput(event.target.value)} /></Field>
          <Button type="submit">ค้นหา</Button>
          <Button type="button" onClick={refresh}>รีเฟรชคิว</Button>
        </form>
      </Card>
      <Card title="ความคืบหน้าการค้นหา">
        <p>YouTube Search ให้ผลตามคำค้นและข้อจำกัดของบริการ จึงไม่รับประกันว่าพบทุกช่อง VTuber ไทย</p>
        {progressError ? <Notice>{progressError} <Button onClick={() => setRetry(value => value + 1)}>ลองโหลดสถานะอีกครั้ง</Button></Notice>
          : !progress ? <p role="status">กำลังโหลดสถานะการค้นหา…</p> : <>
            {progress.sweep ? <p>{progress.sweep.completed ? "จบรอบคำค้นแล้ว" : "กำลังค้นหาต่อ"} · คำค้นที่ผ่านแล้ว {progress.sweep.query_index} · รายการในหน้าค้นหาที่ยังรอตรวจ {progress.sweep.remaining_items}</p> : <p>ยังไม่มีรอบการค้นหา</p>}
            {run && <p>รอบล่าสุด: ตรวจเบาะแส {run.candidates_checked ?? 0} · เข้าคิวใหม่ {run.candidates_new ?? 0} · ซ้ำ {run.candidates_duplicate ?? 0} · ข้อมูลไม่พร้อม {run.candidates_unavailable ?? 0}</p>}
            <p>เข้าคิวใหม่เป็นยอดสะสมของรอบ จำนวนรออนุมัติด้านล่างเป็นคิวปัจจุบันตามตัวกรอง</p>
          </>}
      </Card>
      {list.loading ? <p role="status">กำลังโหลดคิว…</p>
        : list.error || invalid ? <Notice>{list.error || "ข้อมูลหน้าคิวไม่ถูกต้อง"} <Button onClick={list.load}>ลองอีกครั้ง</Button></Notice> : <>
          <p role="status">รออนุมัติ {list.data?.total ?? 0} ช่อง{query && ` ตามชื่อ “${query}”`}</p>
          {!list.rows.length && <p>ไม่พบช่องรออนุมัติ{query ? "ตามชื่อที่ค้นหา" : ""}</p>}
          {list.rows.map(row => <Candidate key={row.channel_id} row={row} csrfToken={csrfToken}
            onReview={row => { setSuccess(""); setReview(row); }} onDone={done} onRefresh={refresh} />)}
          <nav aria-label="หน้าคิวรออนุมัติ" className="flex flex-wrap items-center gap-2">
            <Button disabled={offset === 0} onClick={() => setOffset(offset - pageSize)}>หน้าก่อนหน้า</Button>
            <span>หน้า {offset / pageSize + 1}</span>
            <Button disabled={offset + pageSize >= (list.data?.total ?? 0)} onClick={() => setOffset(offset + pageSize)}>หน้าถัดไป</Button>
          </nav>
        </>}
      <Dialog wide open={Boolean(review)} onClose={() => setReview(null)} title="ตรวจช่องก่อนอนุมัติ" description="ตรวจข้อมูลและเลือกสังกัดด้วยตนเอง ตัวตน YouTube ถูกกำหนดจากช่องที่เข้าคิว">
        {review && <><Evidence row={review} /><ChannelForm value={value} csrfToken={csrfToken} onClose={() => setReview(null)}
          onSaved={result => done(result.snapshot ? "อนุมัติช่องแล้ว" : "อนุมัติข้อมูลช่องแล้ว ยังไม่มีสถิติ YouTube ที่พร้อมใช้งาน")}
          submitEndpoint={`/directory-candidates/${encodeURIComponent(review.channel_id)}/approve`} submitLabel="อนุมัติช่อง" requireAffiliation lockIdentity /></>}
      </Dialog>
      <Dialog open={adding} onClose={() => setAdding(false)} title="เพิ่มช่องเข้าคิว" description="ส่งช่องให้ผู้จัดการตรวจ ยังไม่เผยแพร่บนเว็บไซต์">
        {adding && <YouTubeImport csrfToken={csrfToken} endpoint="/directory-candidates" onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); setSuccess("ส่งช่องเข้าคิวรออนุมัติแล้ว ยังไม่แสดงบนเว็บไซต์"); refresh(); }} />}
      </Dialog>
    </div>
  );
}
