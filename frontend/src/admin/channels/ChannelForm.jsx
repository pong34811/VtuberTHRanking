import { useState } from "react";
import { adminApi } from "../api";
import { platforms, categories, affiliations, channelFields } from "./options";
import { useSubmit } from "../ui";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Alert, Check, Field, FormActions, Input, Select, Textarea } from "../components/ui/field";
import { Avatar } from "../components/ui/feedback";

export function ChannelForm({ value, csrfToken, onClose, onSaved }) {
  const [form, setForm] = useState(value),
    isEdit = Boolean(value.id);
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  // API ปฏิเสธ key นอก channel contract (เช่น id, created_at) ส่งเฉพาะฟิลด์ที่แก้ไขได้
  const payload = Object.fromEntries(
    channelFields.map(key => [key, form[key]]),
  );
  const { busy, error, submit } = useSubmit(
    () =>
      adminApi(`/vtubers${isEdit ? `/${value.id}` : ""}`, {
        method: isEdit ? "PUT" : "POST",
        body: payload,
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
