import { useId } from "react";
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
import { useDialogFocus } from "../../useDialogFocus";

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}) {
  const restoreFocus = useDialogFocus(open);
  const descriptionId = useId();
  if (wide)
    return (
      <Sheet open={open} onOpenChange={(next) => !next && onClose?.()}>
        <SheetContent
          onCloseAutoFocus={restoreFocus}
          aria-describedby={description ? descriptionId : undefined}
          className="admin-wide-sheet gap-0 p-0"
          side="right"
        >
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription id={descriptionId}>{description}</SheetDescription>}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {children}
          </div>
        </SheetContent>
      </Sheet>
    );
  return (
    <ShadDialog open={open} onOpenChange={(next) => !next && onClose?.()}>
      <DialogContent className="admin-dialog max-h-[90vh] overflow-y-auto sm:max-w-lg" onCloseAutoFocus={restoreFocus} aria-describedby={description ? descriptionId : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription id={descriptionId}>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </ShadDialog>
  );
}
