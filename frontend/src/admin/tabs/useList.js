import { useCallback, useEffect, useRef, useState } from "react";
import { adminApi } from "../api";

export function useList(path) {
  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const requestId = useRef(0);
  const load = useCallback(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError("");
    return adminApi(path)
      .then((d) => { if (id === requestId.current) setRows(d.results || []); })
      .catch((e) => { if (id === requestId.current) setError(e.message); })
      .finally(() => { if (id === requestId.current) setLoading(false); });
  }, [path]);
  useEffect(() => {
    load();
    return () => { requestId.current += 1; };
  }, [load]);
  return { rows, loading, error, load };
}
