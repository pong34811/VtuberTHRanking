import { Button as ShadButton } from "@/components/ui/button";

const variants = {
  primary: "default",
  secondary: "outline",
  ghost: "ghost",
  danger: "destructive",
};

export function Button({ variant = "secondary", size = "default", ...props }) {
  return (
    <ShadButton variant={variants[variant] || variant} size={size} {...props} />
  );
}
