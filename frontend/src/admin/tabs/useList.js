import { useEffect, useState } from "react";
import { adminApi } from "../api";

export function useList(path) {
  const [rows, setRows] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const load = () => {
    setLoading(true);
    adminApi(path)
      .then((d) => setRows(d.results || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, [path]);
  return { rows, loading, error, load };
}

