import { useCallback, useEffect, useRef, useState } from "react";

export type ToastVariant = "success" | "warning" | "error";

export type ToastState = {
  id: number;
  message: string;
  variant: ToastVariant;
  persistent: boolean;
  duration: number;
};

type ToastOptions = {
  persistent?: boolean;
  duration?: number;
};

const toastMeta: Record<
  ToastVariant,
  { icon: string; label: string }
> = {
  success: { icon: "✓", label: "Listo" },
  warning: { icon: "!", label: "Atención" },
  error: { icon: "×", label: "No se pudo completar" },
};

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const nextId = useRef(0);

  const dismissToast = useCallback(() => setToast(null), []);

  const showToast = useCallback(
    (
      message: string,
      variant: ToastVariant,
      options: ToastOptions = {},
    ) => {
      nextId.current += 1;
      setToast({
        id: nextId.current,
        message,
        variant,
        persistent: options.persistent ?? variant === "error",
        duration:
          options.duration ?? (variant === "success" ? 3000 : 6000),
      });
    },
    [],
  );

  useEffect(() => {
    if (!toast || toast.persistent) return;

    const timeoutId = window.setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, toast.duration);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  return { toast, showToast, dismissToast };
}

export default function Toast({
  toast,
  onClose,
}: {
  toast: ToastState | null;
  onClose: () => void;
}) {
  if (!toast) return null;

  const meta = toastMeta[toast.variant];
  const isUrgent = toast.variant !== "success";

  return (
    <div className="toast-viewport">
      <section
        className={`app-toast app-toast--${toast.variant}`}
        role={isUrgent ? "alert" : "status"}
        aria-live={isUrgent ? "assertive" : "polite"}
        aria-atomic="true"
      >
        <span className="app-toast__icon" aria-hidden="true">
          {meta.icon}
        </span>
        <div className="app-toast__content">
          <strong>{meta.label}</strong>
          <p>{toast.message}</p>
        </div>
        <button
          className="app-toast__close"
          type="button"
          onClick={onClose}
          aria-label="Cerrar mensaje"
        >
          ×
        </button>
      </section>
    </div>
  );
}
