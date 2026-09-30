import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi } from "../api";

export function useList(path) {
  const [state, setState] = useState({ path, rows: [], loading: Boolean(path), error: "" });
  const requestId = useRef(0);
  const controller = useRef(null);
  const active = useRef(true);
  const load = useCallback(() => {
    if (!active.current) return Promise.resolve();
    controller.current?.abort();
    const id = ++requestId.current;
    controller.current = new AbortController();
    setState({ path, rows: [], loading: Boolean(path), error: "" });
    if (!path) return Promise.resolve();
    return adminApi(path, { signal: controller.current.signal })
      .then((data) => {
        if (!Array.isArray(data.results)) throw new Error("เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง กรุณาลองใหม่");
        if (id === requestId.current) setState({ path, rows: data.results, loading: false, error: "" });
      })
      .catch((error) => {
        if (id === requestId.current && error.name !== "AbortError") setState({ path, rows: [], loading: false, error: error.message });
      });
  }, [path]);
  useEffect(() => {
    active.current = true;
    load();
    return () => { active.current = false; requestId.current += 1; controller.current?.abort(); };
  }, [load]);
  return { ...(state.path === path ? state : { rows: [], loading: Boolean(path), error: "" }), load };
}
