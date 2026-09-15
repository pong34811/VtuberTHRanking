import {
  Dialog as ShadDialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}) {
  if (wide)
    return (
      <Sheet open={open} onOpenChange={(next) => !next && onClose?.()}>
        <SheetContent
          className="w-full gap-0 p-0 sm:max-w-[min(920px,92vw)]"
          side="right"
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    );
  return (
    <ShadDialog open={open} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </ShadDialog>
  );
}
