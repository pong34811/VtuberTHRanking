const AUTH = "/api/v1/auth";
const ADMIN = "/api/v1/admin";

export async function request(
  path,
  { method = "GET", body, csrfToken, raw = false, signal, timeoutMs = 15000 } = {},
) {
  const controller = new AbortController();
  let rejectAbort;
  const aborted = new Promise((_, reject) => { rejectAbort = reject; });
  const cancel = () => {
    const error = new Error("ยกเลิกคำขอแล้ว");
    error.name = "AbortError";
    controller.abort();
    rejectAbort(error);
  };
  signal?.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => {
    controller.abort();
    rejectAbort(new Error("เซิร์ฟเวอร์ตอบกลับนานเกินไป กรุณาลองใหม่"));
  }, timeoutMs);
  const operation = async () => {
    if (signal?.aborted) { cancel(); throw new DOMException("Aborted", "AbortError"); }
    const response = await fetch(path, {
      method,
      credentials: "same-origin",
      signal: controller.signal,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (response.status === 401 &&
        (path.startsWith(`${ADMIN}/`) || [`${AUTH}/password`, `${AUTH}/logout`].includes(path)) &&
        typeof window !== "undefined") {
      window.dispatchEvent(new Event("admin:unauthorized"));
    }
    const contentType = response.headers?.get("Content-Type") || "";
    const protocolError = () => Object.assign(
      new Error("เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง กรุณาลองใหม่"), { status: response.status },
    );
    if (raw && response.ok) {
      if (!/^text\/csv(?:\s*;|$)/i.test(contentType)) throw protocolError();
      // Consume the download under the same deadline as JSON, not after cleanup.
      return new Response(await response.arrayBuffer(), { status: response.status, headers: response.headers });
    }
    let data;
    try {
      if (!/^application\/(?:[\w.-]+\+)?json(?:\s*;|$)/i.test(contentType)) throw new Error();
      data = await response.json();
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    } catch {
      if (response.ok) throw protocolError();
      data = {};
    }
    if (!response.ok) {
      const error = new Error(data.message || "เกิดข้อผิดพลาด กรุณาลองใหม่");
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  };
  try {
    return await Promise.race([operation(), aborted]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
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
