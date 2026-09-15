import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function TableWrap({ className = "", ...props }) {
  return (
    <div
      className={`overflow-hidden rounded-lg border ${className}`}
      {...props}
    />
  );
}

export { Table };
export const THead = TableHeader;
export const TH = TableHead;
export const TR = TableRow;
export const TD = TableCell;
