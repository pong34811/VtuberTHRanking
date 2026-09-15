import { Badge as ShadBadge } from "@/components/ui/badge";

const variants = {
  active: "secondary",
  inactive: "outline",
  accent: "default",
};

export function Badge({ variant = "outline", ...props }) {
  return <ShadBadge variant={variants[variant] || variant} {...props} />;
}
