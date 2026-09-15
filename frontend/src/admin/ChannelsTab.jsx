import { useEffect, useMemo, useState } from "react";
import { adminApi } from "./api";
import { fmtDate, fmtNumber, useSubmit } from "./ui";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Card, CardActions, CardContent } from "./components/ui/card";
import { Dialog } from "./components/ui/dialog";
import {
  Alert,
  Check,
  Field,
  FormActions,
  Input,
  Select,
  Textarea,
} from "./components/ui/field";
import { TD, TH, THead, TR, Table, TableWrap } from "./components/ui/table";
import { Avatar, EmptyState, SkeletonRows } from "./components/ui/feedback";

const blank = {
  name: "",
  slug: "",
  bio: "",
  avatar: "",
  agency_name: "",
  country: "Thailand",
  debut_date: "",
  banner_url: "",
  youtube_url: "",
  twitch_url: "",
  x_url: "",
  category: "other",
  affiliation: "indie",
  channel_url: "",
  platform: "youtube",
  is_active: true,
};
const platforms = [
  ["youtube", "YouTube"],
  ["twitch", "Twitch"],
  ["bilibili", "Bilibili"],
  ["other", "อื่นๆ"],
];
const categories = [
  ["gaming", "เกม"],
  ["singing", "ร้องเพลง"],
  ["chatting", "พูดคุย"],
  ["art", "วาดรูป"],
  ["asmr", "ASMR"],
  ["education", "ความรู้"],
  ["other", "อื่นๆ"],
];
const affiliations = [
  ["indie", "Indie"],
  ["agency", "Agency"],
];

export default function ChannelsTab({ csrfToken }) {
  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [editing, setEditing] = useState(null),
    [snapshots, setSnapshots] = useState(null),
    [ytOpen, setYtOpen] = useState(false);
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all");
  const load = () => {
    setLoading(true);
    adminApi("/vtubers")
      .then((d) => setRows(d.results || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (status === "all" ||
          (status === "active" ? r.is_active : !r.is_active)) &&
        (!q ||
          `${r.name} ${r.slug} ${r.agency_name || ""}`
            .toLowerCase()
            .includes(q)),
    );
  }, [rows, query, status]);
  const activeCount = rows.filter((row) => row.is_active).length;
  const inactiveCount = rows.length - activeCount;
  return (
    <div className="channel-console">
      <div className="channel-page-lead">
        <div>
          <h2>คลังช่อง VTuber</h2>
          <p>ดูแลข้อมูลช่องและสถานะที่แสดงบนเว็บไซต์</p>
        </div>
        <CardActions>
          <Button onClick={() => setYtOpen(true)}>ดึงข้อมูล YouTube</Button>
          <Button variant="primary" onClick={() => setEditing({ ...blank })}>
            เพิ่มช่องใหม่
          </Button>
        </CardActions>
      </div>
      <div className="channel-metrics" aria-label="ภาพรวมช่อง">
        <button
          onClick={() => setStatus("all")}
          aria-pressed={status === "all"}
        >
          <span>ช่องทั้งหมด</span>
          <strong>{rows.length}</strong>
          <small>รายการในระบบ</small>
        </button>
        <button
          onClick={() => setStatus("active")}
          aria-pressed={status === "active"}
        >
          <span>เปิดใช้งาน</span>
          <strong>{activeCount}</strong>
          <small>แสดงบนเว็บไซต์</small>
        </button>
        <button
          onClick={() => setStatus("inactive")}
          aria-pressed={status === "inactive"}
        >
          <span>ปิดใช้งาน</span>
          <strong>{inactiveCount}</strong>
          <small>ซ่อนจากเว็บไซต์</small>
        </button>
      </div>
      <Card className="channel-table-card">
        <CardContent className="grid gap-4">
          {error && <Alert>{error}</Alert>}
          <div className="channel-toolbar">
            <label className="channel-search">
              <span>ค้นหาช่อง</span>
              <Input
                type="search"
                placeholder="ค้นหาชื่อช่อง, slug หรือสังกัด…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label>
              <span>สถานะ</span>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="all">ทุกสถานะ</option>
                <option value="active">ใช้งาน</option>
                <option value="inactive">ปิดใช้งาน</option>
              </Select>
            </label>
            <p className="channel-result-count" aria-live="polite">
              แสดง <strong>{filtered.length}</strong> จาก {rows.length} ช่อง
            </p>
            {(query || status !== "all") && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                }}
              >
                ล้างตัวกรอง
              </Button>
            )}
          </div>
          {loading ? (
            <SkeletonRows />
          ) : filtered.length ? (
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>ช่อง</TH>
                    <TH>สังกัด</TH>
                    <TH>แพลตฟอร์ม</TH>
                    <TH>สถานะ</TH>
                    <TH>
                      <span className="sr-only">จัดการ</span>
                    </TH>
                  </TR>
                </THead>
                <tbody>
                  {filtered.map((row) => (
                    <TR key={row.id}>
                      <TD>
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar src={row.avatar} name={row.name} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{row.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              /{row.slug}
                            </p>
                          </div>
                        </div>
                      </TD>
                      <TD className="whitespace-nowrap">
                        {row.agency_name || row.affiliation || "—"}
                      </TD>
                      <TD className="whitespace-nowrap text-muted-foreground">
                        {platforms.find(
                          ([v]) => v === (row.platform || "").toLowerCase(),
                        )?.[1] ||
                          row.platform ||
                          "—"}
                      </TD>
                      <TD>
                        <Badge variant={row.is_active ? "active" : "inactive"}>
                          {row.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                        </Badge>
                      </TD>
                      <TD className="whitespace-nowrap text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`ดูสถิติ ${row.name}`}
                          onClick={() => setSnapshots(row)}
                        >
                          ดูสถิติ
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          aria-label={`แก้ไข ${row.name}`}
                          onClick={() =>
                            setEditing({
                              ...blank,
                              ...row,
                              is_active: Boolean(row.is_active),
                            })
                          }
                        >
                          แก้ไข
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          ) : (
            <EmptyState
              title={rows.length ? "ไม่พบช่องที่ค้นหา" : "ยังไม่มีช่อง VTuber"}
              hint={
                rows.length
                  ? "ลองเปลี่ยนคำค้นหรือตัวกรอง"
                  : "ดึงข้อมูลจาก YouTube หรือเพิ่มช่องแรกได้เลย"
              }
              action={
                !rows.length && (
                  <Button
                    variant="primary"
                    onClick={() => setEditing({ ...blank })}
                  >
                    + เพิ่มช่องแรก
                  </Button>
                )
              }
            />
          )}
        </CardContent>
        <Dialog
          open={!!editing}
          onClose={() => setEditing(null)}
          title={editing?.id ? "แก้ไขช่อง" : "เพิ่มช่อง"}
          description={editing?.id ? `/${editing.slug}` : "กรอกข้อมูลช่องใหม่"}
          wide
        >
          {editing && (
            <ChannelForm
              value={editing}
              csrfToken={csrfToken}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                load();
              }}
            />
          )}
        </Dialog>
        <Dialog
          open={ytOpen}
          onClose={() => setYtOpen(false)}
          title="ดึงข้อมูลจาก YouTube"
          description="วาง Channel ID, @handle หรือลิงก์ แล้วระบบจะสร้างช่องพร้อมสถิติล่าสุดให้"
        >
          <YouTubeImport
            csrfToken={csrfToken}
            onClose={() => setYtOpen(false)}
            onSaved={() => {
              setYtOpen(false);
              load();
            }}
          />
        </Dialog>
        <Dialog
          open={!!snapshots}
          onClose={() => setSnapshots(null)}
          title={`สถิติ · ${snapshots?.name || ""}`}
          wide
        >
          {snapshots && <Snapshots channel={snapshots} csrfToken={csrfToken} />}
        </Dialog>
      </Card>
    </div>
  );
}

function ChannelForm({ value, csrfToken, onClose, onSaved }) {
  const [form, setForm] = useState(value),
    isEdit = Boolean(value.id);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const { busy, error, submit } = useSubmit(
    () =>
      adminApi(`/vtubers${isEdit ? `/${value.id}` : ""}`, {
        method: isEdit ? "PUT" : "POST",
        body: form,
        csrfToken,
      }),
    onSaved,
  );
  return (
    <form onSubmit={submit} className="channel-form">
      <Alert>{error}</Alert>
      <div className="channel-form-preview">
        <Avatar src={form.avatar} name={form.name} className="h-14 w-14" />
        <div>
          <strong>{form.name || "ช่องใหม่"}</strong>
          <span>/{form.slug || "channel-slug"}</span>
        </div>
        <Badge variant={form.is_active ? "active" : "inactive"}>
          {form.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
        </Badge>
      </div>
      <FormSection
        title="ข้อมูลพื้นฐาน"
        hint="ชื่อและข้อมูลที่ใช้แสดงบนหน้าเว็บไซต์"
      >
        <Field label="ชื่อช่อง">
          <Input required value={form.name ?? ""} onChange={set("name")} />
        </Field>
        <Field label="Slug" hint="ใช้ตัวอักษร a-z ตัวเลข และขีดกลาง">
          <Input required value={form.slug ?? ""} onChange={set("slug")} />
        </Field>
        <Field label="สังกัด">
          <Input
            value={form.agency_name ?? ""}
            onChange={set("agency_name")}
            placeholder="เช่น PIXELA หรือ Indie"
          />
        </Field>
        <Field label="ประเทศ">
          <Input value={form.country ?? ""} onChange={set("country")} />
        </Field>
        <Field label="ประเภทคอนเทนต์">
          <Select value={form.category ?? "other"} onChange={set("category")}>
            {categories.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="วันเดบิวต์">
          <Input
            type="date"
            value={form.debut_date ?? ""}
            onChange={set("debut_date")}
          />
        </Field>
        <Field label="รายละเอียด" wide>
          <Textarea
            rows={3}
            value={form.bio || ""}
            onChange={set("bio")}
            placeholder="แนะนำช่องและรูปแบบคอนเทนต์โดยย่อ"
          />
        </Field>
      </FormSection>
      <FormSection
        title="แพลตฟอร์มและลิงก์"
        hint="กำหนดช่องหลักและลิงก์โซเชียล"
      >
        <Field label="แพลตฟอร์ม">
          <Select value={form.platform ?? "youtube"} onChange={set("platform")}>
            {platforms.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="ประเภทสังกัด">
          <Select
            value={form.affiliation ?? "indie"}
            onChange={set("affiliation")}
          >
            {affiliations.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="YouTube URL">
          <Input
            type="url"
            inputMode="url"
            value={form.youtube_url ?? ""}
            onChange={set("youtube_url")}
            placeholder="https://youtube.com/@handle"
          />
        </Field>
        <Field label="Channel URL">
          <Input
            type="url"
            inputMode="url"
            value={form.channel_url ?? ""}
            onChange={set("channel_url")}
            placeholder="https://…"
          />
        </Field>
        <Field label="Twitch URL">
          <Input
            type="url"
            inputMode="url"
            value={form.twitch_url ?? ""}
            onChange={set("twitch_url")}
            placeholder="https://twitch.tv/…"
          />
        </Field>
        <Field label="X URL">
          <Input
            type="url"
            inputMode="url"
            value={form.x_url ?? ""}
            onChange={set("x_url")}
            placeholder="https://x.com/…"
          />
        </Field>
      </FormSection>
      <FormSection title="รูปภาพ" hint="ใช้ URL รูปภาพที่เปิดดูได้แบบสาธารณะ">
        <Field label="รูปโปรไฟล์ (URL)">
          <Input
            type="url"
            inputMode="url"
            value={form.avatar ?? ""}
            onChange={set("avatar")}
            placeholder="https://…"
          />
        </Field>
        <Field label="แบนเนอร์ (URL)">
          <Input
            type="url"
            inputMode="url"
            value={form.banner_url ?? ""}
            onChange={set("banner_url")}
            placeholder="https://…"
          />
        </Field>
      </FormSection>
      <Check
        className="channel-form-status"
        label="เปิดใช้งานช่องนี้"
        checked={!!form.is_active}
        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
      />
      <FormActions className="channel-form-actions">
        <Button type="button" variant="ghost" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </FormActions>
    </form>
  );
}

function FormSection({ title, hint, children }) {
  return (
    <fieldset className="channel-form-section">
      <legend>{title}</legend>
      <p>{hint}</p>
      <div>{children}</div>
    </fieldset>
  );
}

function YouTubeImport({ csrfToken, onClose, onSaved }) {
  const [input, setInput] = useState("");
  const { busy, error, submit } = useSubmit(
    () =>
      adminApi("/youtube/import", {
        method: "POST",
        csrfToken,
        body: { input },
      }),
    onSaved,
  );
  return (
    <form onSubmit={submit} className="grid gap-4">
      <Alert>{error}</Alert>
      <Field
        label="Channel ID / @handle / ลิงก์"
        hint="เช่น @muu_ch หรือ https://www.youtube.com/@muu_ch"
        wide
      >
        <Input
          required
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="@handle…"
        />
      </Field>
      <FormActions>
        <Button type="button" variant="ghost" onClick={onClose}>
          ยกเลิก
        </Button>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? "กำลังดึง…" : "ดึงข้อมูล"}
        </Button>
      </FormActions>
    </form>
  );
}

function Snapshots({ channel, csrfToken }) {
  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    followers: "",
    total_views: "",
    video_count: "",
    recorded_at: new Date().toISOString().slice(0, 16),
  });
  const load = () =>
    adminApi(`/vtubers/${channel.id}/snapshots`)
      .then((d) => setRows(d.results || []))
      .finally(() => setLoading(false));
  useEffect(load, []);
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
