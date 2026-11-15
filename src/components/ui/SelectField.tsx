import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type Option = { value: string; label: string };
type Props = {
  id?: string;
  label: string;
  value: string;
  options: Option[];
  disabled?: boolean;
  onChange: (value: string) => void;
};

export default function SelectField({
  id,
  label,
  value,
  options,
  disabled = false,
  onChange,
}: Props) {
  const generatedId = useId();
  const triggerId = id ?? `select-${generatedId}`;
  const listId = `${triggerId}-options`;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({
    above: false,
    height: 280,
    triggerHeight: 44,
  });
  const selected = options.findIndex((option) => option.value === value);
  const search = useRef({ text: "", time: 0 });

  const show = (index = Math.max(0, selected)) => {
    if (disabled) return;
    const rect = trigger.current!.getBoundingClientRect();
    const viewport = window.visualViewport;
    const bottom =
      (viewport?.height ?? innerHeight) + (viewport?.offsetTop ?? 0);
    const scrollArea = trigger
      .current!.closest(".dialog-scroll-content")
      ?.getBoundingClientRect();
    const below =
        Math.min(bottom, scrollArea?.bottom ?? bottom) - rect.bottom - 12,
      above =
        rect.top -
        Math.max(viewport?.offsetTop ?? 0, scrollArea?.top ?? 0) -
        12;
    const upwards = below < 200 && above > below;
    setPosition({
      above: upwards,
      triggerHeight: rect.height,
      height: Math.max(44, Math.min(280, upwards ? above : below)),
    });
    setActive(index);
    setOpen(true);
  };
  const choose = (index: number) => {
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnResize = () => setOpen(false);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", closeOnResize);
    window.visualViewport?.addEventListener("resize", closeOnResize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", closeOnResize);
      window.visualViewport?.removeEventListener("resize", closeOnResize);
    };
  }, [open]);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${listId}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, listId]);

  return (
    <div
      ref={root}
      className="select-field"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <label htmlFor={triggerId}>{label}</label>
      <button
        ref={trigger}
        id={triggerId}
        className="select-trigger"
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            if (open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }
            return;
          }
          if (event.key === "Tab") {
            setOpen(false);
            return;
          }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const delta = event.key === "ArrowDown" ? 1 : -1;
            if (!open) show();
            else
              setActive(
                (index) => (index + delta + options.length) % options.length,
              );
          } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault();
            const index = event.key === "Home" ? 0 : options.length - 1;
            if (!open) show(index);
            else setActive(index);
          } else if ((event.key === "Enter" || event.key === " ") && open) {
            event.preventDefault();
            choose(active);
          } else if (
            event.key.length === 1 &&
            event.key !== " " &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            event.preventDefault();
            const now = Date.now();
            search.current = {
              text:
                (now - search.current.time > 700 ? "" : search.current.text) +
                event.key.toLocaleLowerCase(),
              time: now,
            };
            const index = options.findIndex((option) =>
              option.label.toLocaleLowerCase().startsWith(search.current.text),
            );
            if (index >= 0) {
              if (!open) show(index);
              else setActive(index);
            }
          }
        }}
      >
        <span>{options[selected]?.label ?? "Seleccionar"}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={listId}
          className={`select-options ${position.above ? "select-options--above" : ""}`}
          role="listbox"
          aria-label={label}
          style={{
            maxHeight: position.height,
            ...(position.above ? { bottom: position.triggerHeight + 6 } : {}),
          }}
        >
          {options.map((option, index) => (
            <div
              id={`${listId}-${index}`}
              key={option.value}
              role="option"
              aria-selected={value === option.value}
              className={`select-option ${active === index ? "is-highlighted" : ""}`}
              onPointerMove={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {value === option.value && <Check size={18} aria-hidden="true" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
