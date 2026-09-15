import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export { Card, CardContent, CardDescription, CardHeader, CardTitle };
export function CardActions({ className = "", ...props }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
      {...props}
    />
  );
}
