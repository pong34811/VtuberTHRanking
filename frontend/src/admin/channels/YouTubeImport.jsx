import { useState } from "react";
import { adminApi } from "../api";
import { useSubmit } from "../ui";
import { Button } from "../components/ui/button";
import { Alert, Field, FormActions, Input } from "../components/ui/field";

export function YouTubeImport({ csrfToken, onClose, onSaved }) {
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

