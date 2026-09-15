import { useEffect, useState } from "react";
export default function ThemeSelector() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("theme") || "system";
    } catch {
      return "system";
    }
  });
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    try {
      localStorage.setItem("theme", theme);
    } catch {}
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  return (
    <select
      aria-label="ธีมหน้าจอ"
      className="theme-select"
      value={theme}
      onChange={(e) => setTheme(e.target.value)}
    >
      <option value="system">ตามระบบ</option>
      <option value="light">สว่าง</option>
      <option value="dark">มืด</option>
    </select>
  );
}
