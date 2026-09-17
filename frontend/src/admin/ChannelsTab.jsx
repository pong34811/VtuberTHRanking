import { useEffect, useMemo, useState } from "react";
import { adminApi } from "./api";
import { blank, platforms } from "./channels/options";
import { ChannelForm } from "./channels/ChannelForm";
import { YouTubeImport } from "./channels/YouTubeImport";
import { Snapshots } from "./channels/Snapshots";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";
import { Card, CardActions, CardContent } from "./components/ui/card";
import { Dialog } from "./components/ui/dialog";
import { Alert, Input, Select } from "./components/ui/field";
import { TD, TH, THead, TR, Table, TableWrap } from "./components/ui/table";
import { Avatar, EmptyState, SkeletonRows } from "./components/ui/feedback";

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
    setError("");
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
          {error && <Alert>{error} <Button onClick={load}>ลองอีกครั้ง</Button></Alert>}
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
