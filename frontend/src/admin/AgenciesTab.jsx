import { useState } from "react";
import { adminApi } from "./api";
import { useList } from "./tabs/useList";
import { useSubmit } from "./ui";
import { Button } from "./components/ui/button";
import { Card, CardActions, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Dialog } from "./components/ui/dialog";
import { Alert, Field, FormActions, Input, Textarea } from "./components/ui/field";
import { Avatar, EmptyState, SkeletonRows } from "./components/ui/feedback";
import { TD, TH, THead, TR, Table, TableWrap } from "./components/ui/table";

const blank = { name: "", description: "", image_url: "", contact: "" };

export default function AgenciesTab({ csrfToken }) {
  const list = useList("/agencies");
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const remove = useSubmit(
    () => adminApi(`/agencies/${deleting.id}`, { method: "DELETE", csrfToken }),
    () => { setDeleting(null); list.load(); },
  );
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>สังกัด</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">จัดการข้อมูลสังกัดสำหรับเลือกในหน้าแก้ไขช่อง</p>
          </div>
          <CardActions>
            <Button onClick={() => setImporting(true)}>เพิ่มข้อมูลจาก YouTube</Button>
            <Button variant="primary" onClick={() => setEditing({ ...blank })}>เพิ่มสังกัด</Button>
          </CardActions>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Alert>{list.error}</Alert>
          {list.loading ? <SkeletonRows /> : list.rows.length ? (
            <TableWrap className="overflow-x-auto">
              <Table>
                <THead><TR><TH>สังกัด</TH><TH>คำอธิบาย</TH><TH>ช่องติดต่อ</TH><TH>จำนวนช่อง</TH><TH><span className="sr-only">จัดการ</span></TH></TR></THead>
                <tbody>
                  {list.rows.map((agency) => (
                    <TR key={agency.id}>
                      <TD><div className="flex items-center gap-3"><Avatar src={agency.image_url} name={agency.name} /><strong>{agency.name}</strong></div></TD>
                      <TD className="max-w-72 truncate">{agency.description || "—"}</TD>
                      <TD className="max-w-60 truncate">{agency.contact || "—"}</TD>
                      <TD>{agency.channel_count}</TD>
                      <TD className="whitespace-nowrap text-right">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(agency)}>แก้ไข</Button>{" "}
                        <Button size="sm" variant="ghost" onClick={() => { remove.setError(""); setDeleting(agency); }}>ลบ</Button>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          ) : <EmptyState title="ยังไม่มีสังกัด" hint="เพิ่มสังกัดเองหรือดึงข้อมูลจากช่อง YouTube ทางการ" />}
        </CardContent>
      </Card>
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "แก้ไขสังกัด" : "เพิ่มสังกัด"}>
        {editing && <AgencyForm value={editing} csrfToken={csrfToken} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); list.load(); }} />}
      </Dialog>
      <Dialog open={importing} onClose={() => setImporting(false)} title="เพิ่มข้อมูลสังกัดจาก YouTube" description="ใช้ช่อง YouTube ทางการของสังกัด">
        {importing && <AgencyImport csrfToken={csrfToken} onClose={() => setImporting(false)} onSaved={() => { setImporting(false); list.load(); }} />}
      </Dialog>
      <Dialog open={!!deleting} onClose={() => setDeleting(null)} title="ลบสังกัด">
        {deleting && <div className="grid gap-4">
          <p>ต้องการลบ “{deleting.name}” หรือไม่?</p>
          <Alert>{remove.error}</Alert>
          <FormActions><Button variant="ghost" onClick={() => setDeleting(null)}>ยกเลิก</Button><Button variant="destructive" disabled={remove.busy} onClick={remove.submit}>ลบสังกัด</Button></FormActions>
        </div>}
      </Dialog>
    </div>
  );
}

function AgencyForm({ value, csrfToken, onClose, onSaved }) {
  const [form, setForm] = useState(value);
  const save = useSubmit(
    () => adminApi(`/agencies${value.id ? `/${value.id}` : ""}`, {
      method: value.id ? "PUT" : "POST",
      csrfToken,
      body: Object.fromEntries(Object.keys(blank).map((key) => [key, form[key] ?? ""])),
    }),
    onSaved,
  );
  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  return <form onSubmit={save.submit} className="grid gap-4">
    <Alert>{save.error}</Alert>
    <Field label="ชื่อสังกัด"><Input required value={form.name} onChange={set("name")} /></Field>
    <Field label="คำอธิบาย"><Textarea rows={4} value={form.description ?? ""} onChange={set("description")} /></Field>
    <Field label="รูปภาพ (URL)"><Input type="url" value={form.image_url ?? ""} onChange={set("image_url")} placeholder="https://…" /></Field>
    <Field label="ช่องติดต่อ" hint="ลิงก์ YouTube, เว็บไซต์, อีเมล หรือช่องทางอื่น"><Textarea rows={2} value={form.contact ?? ""} onChange={set("contact")} /></Field>
    <FormActions><Button type="button" variant="ghost" onClick={onClose}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={save.busy}>บันทึก</Button></FormActions>
  </form>;
}

function AgencyImport({ csrfToken, onClose, onSaved }) {
  const [input, setInput] = useState("");
  const save = useSubmit(() => adminApi("/agencies/youtube/import", { method: "POST", csrfToken, body: { input } }), onSaved);
  return <form onSubmit={save.submit} className="grid gap-4">
    <Alert>{save.error}</Alert>
    <Field label="Channel ID / @handle / ลิงก์ YouTube" hint="เช่น @officialagency หรือ https://www.youtube.com/@officialagency">
      <Input required autoFocus value={input} onChange={(event) => setInput(event.target.value)} placeholder="@handle…" />
    </Field>
    <FormActions><Button type="button" variant="ghost" onClick={onClose}>ยกเลิก</Button><Button type="submit" variant="primary" disabled={save.busy}>ดึงข้อมูล</Button></FormActions>
  </form>;
}
