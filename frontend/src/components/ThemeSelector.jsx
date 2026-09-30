import { useTheme } from "./ThemeProvider";
export default function ThemeSelector() {
  const { theme, setTheme } = useTheme();
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
