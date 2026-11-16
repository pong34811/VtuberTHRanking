import { useMemo, useState } from "react";
import { adminApi } from "./api";
import { useList } from "./tabs/useList";
import { useSubmit } from "./ui";
import { blank, platforms } from "./channels/options";
import { ChannelForm } from "./channels/ChannelForm";
import { YouTubeImport } from "./channels/YouTubeImport";
import { Snapshots } from "./channels/Snapshots";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Card, CardActions, CardContent } from "./components/ui/card";
import { Dialog } from "./components/ui/dialog";
import { Alert, FormActions, Input, Select } from "./components/ui/field";
import { TD, TH, THead, TR, Table, TableWrap } from "./components/ui/table";
import { Avatar, EmptyState, SkeletonRows } from "./components/ui/feedback";

export default function ChannelsTab({ csrfToken, isManager }) {
  const { rows, loading, error, load } = useList("/vtubers");
  const [editing, setEditing] = useState(null),
    [snapshots, setSnapshots] = useState(null),
    [ytOpen, setYtOpen] = useState(false),
    [deleting, setDeleting] = useState(null);
  const [saved, setSaved] = useState(null);
  const onSaved = result => {
    setEditing(null); setYtOpen(false); setSaved(result);
    if (!result.queued) load();
  };
  const remove = useSubmit(
    () => adminApi(`/vtubers/${deleting?.id}`, { method: "DELETE", csrfToken }),
    () => {
      const name = deleting?.name;
      setDeleting(null);
      setSaved({ message: `ลบช่อง “${name}” เรียบร้อยแล้ว` });
      load();
    },
    deleting?.id,
  );
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all");

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
      {saved && (
        <Alert tone="success">
          {saved.message || (saved.queued ? "ส่งช่องเข้าคิวรอผู้จัดการอนุมัติแล้ว ยังไม่แสดงบนเว็บไซต์" : "บันทึกข้อมูลช่องแล้ว")}
          {saved.queued && isManager && <> · <a href="/admin/channel-approvals">ไปที่ช่องรออนุมัติ</a></>}
        </Alert>
      )}
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
          ) : error ? <Alert>{error} <Button onClick={load}>ลองอีกครั้ง</Button></Alert> : filtered.length ? (
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
                        {row.affiliation === "indie" ? "อิสระ" : row.agency_name || "ยังไม่เลือกสังกัด"}
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
                        {isManager && (
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`ลบ ${row.name}`}
                            onClick={() => {
                              setSaved(null);
                              remove.setError("");
                              setDeleting(row);
                            }}
                          >
                            ลบ
                          </Button>
                        )}
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
              key={editing.id || "new"}
              value={editing}
              csrfToken={csrfToken}
              onClose={() => setEditing(null)}
              onSaved={onSaved}
            />
          )}
        </Dialog>
        <Dialog
          open={ytOpen}
          onClose={() => setYtOpen(false)}
          title="ดึงข้อมูลจาก YouTube"
          description="ช่องใหม่จะเข้าคิวรอผู้จัดการอนุมัติ ช่องที่มีอยู่แล้วจะอัปเดตข้อมูลและสถิติ"
        >
          <YouTubeImport
            csrfToken={csrfToken}
            onClose={() => setYtOpen(false)}
            onSaved={onSaved}
          />
        </Dialog>
        <Dialog
          open={!!snapshots}
          onClose={() => setSnapshots(null)}
          title={`สถิติ · ${snapshots?.name || ""}`}
          wide
        >
          {snapshots && <Snapshots key={snapshots.id} channel={snapshots} csrfToken={csrfToken} />}
        </Dialog>
        <Dialog
          open={!!deleting}
          onClose={() => {
            if (remove.busy) return;
            remove.setError("");
            setDeleting(null);
          }}
          title="ลบช่อง"
          description="การดำเนินการนี้จะลบข้อมูลสถิติและอันดับที่เกี่ยวข้องทั้งหมด"
        >
          {deleting && (
            <div className="grid gap-4">
              <p>
                ต้องการลบช่อง “{deleting.name}” หรือไม่? การดำเนินการนี้จะลบข้อมูลสถิติและอันดับที่เกี่ยวข้องทั้งหมด
              </p>
              <Alert>{remove.error}</Alert>
              <FormActions>
                <Button
                  variant="ghost"
                  disabled={remove.busy}
                  onClick={() => {
                    remove.setError("");
                    setDeleting(null);
                  }}
                >
                  ยกเลิก
                </Button>
                <Button
                  variant="destructive"
                  disabled={remove.busy}
                  onClick={remove.submit}
                >
                  {remove.busy ? "กำลังลบ…" : "ลบช่อง"}
                </Button>
              </FormActions>
            </div>
          )}
        </Dialog>
      </Card>
    </div>
  );
}
