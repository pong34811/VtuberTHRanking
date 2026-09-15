const AUTH = "/api/v1/auth";
const ADMIN = "/api/v1/admin";

export async function request(
  path,
  { method = "GET", body, csrfToken, raw = false } = {},
) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw && response.ok) return response;
  const data = await response
    .json()
    .catch(() => ({ message: "เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง" }));
  if (!response.ok) {
    const error = new Error(data.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const authApi = (path, options) => request(`${AUTH}${path}`, options);
export const adminApi = (path, options) => request(`${ADMIN}${path}`, options);

export function downloadReport(id, csrfToken) {
  return request(`${ADMIN}/reports/${id}/download`, {
    csrfToken,
    raw: true,
  }).then(async (response) => {
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ranking-report-${id}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

export const messageOf = (error) =>
  error?.message || "เกิดข้อผิดพลาด กรุณาลองใหม่";
