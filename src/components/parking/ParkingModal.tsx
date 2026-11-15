import { useEffect, useRef, type ReactNode } from "react";

type Props = { children: ReactNode; busy: boolean; onClose: () => void };

export default function ParkingModal({ children, busy, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const resize = () => {
      const viewport = window.visualViewport;
      dialog.style.setProperty(
        "--dialog-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`,
      );
      dialog.style.setProperty(
        "--keyboard-inset",
        `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`,
      );
    };
    resize();
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    dialog.showModal();
    return () => {
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (
        trigger instanceof HTMLElement &&
        trigger.isConnected &&
        !trigger.matches(":disabled")
      )
        trigger.focus({ preventScroll: true });
      else
        document
          .querySelector<HTMLInputElement>("#exit-search")
          ?.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    const dialog = ref.current;
    if (dialog?.open && (busy || !dialog.contains(document.activeElement)))
      dialog.focus();
  }, [busy]);

  return (
    <dialog
      ref={ref}
      className="charge-dialog parking-modal"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const dialog = ref.current!;
        const controls = [
          ...dialog.querySelectorAll<HTMLElement>(
            'button, input, select, textarea, a[href], [tabindex="0"]',
          ),
        ].filter(
          (element) =>
            !element.matches(":disabled") &&
            element.getClientRects().length > 0,
        );
        const first = controls[0],
          last = controls.at(-1);
        if (!first) {
          event.preventDefault();
          dialog.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            !dialog.contains(document.activeElement) ||
            document.activeElement === dialog)
        ) {
          event.preventDefault();
          last!.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !dialog.contains(document.activeElement) ||
            document.activeElement === dialog)
        ) {
          event.preventDefault();
          first.focus();
        }
      }}
      aria-labelledby="charge-title"
      aria-busy={busy}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
