"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function Delta({
  current,
  previous,
  higherIsBetter = false,
  money = true,
}: {
  current: number;
  previous: number;
  higherIsBetter?: boolean;
  money?: boolean;
}) {
  const diff = current - previous;
  const flat = Math.abs(diff) < (money ? 0.5 : 0.1);
  const up = diff > 0;
  const good = flat || (higherIsBetter ? up : !up);
  const amount = money ? formatMoney(Math.abs(diff)) : String(Math.abs(Math.round(diff)));
  const text = flat ? "Igual que el mes pasado" : `${amount} ${up ? "más" : "menos"} que el mes pasado`;
  return <p className={flat ? "delta-flat" : good ? "delta-good" : "delta-bad"}>{text}</p>;
}

export function Bars({ items }: { items: { label: string; value: number; href?: string }[] }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  if (items.length === 0) return <p className="empty">Todavía no hay datos en este período.</p>;
  return (
    <div className="bars">
      {items.map((item) => (
        <div key={item.label}>
          <div className="row">
            <span>{item.label}</span>
            <strong className="amount">{formatMoney(item.value)}</strong>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConfirmButton({
  label,
  title,
  message,
  onConfirm,
  className = "btn btn-danger",
}: {
  label: string;
  title: string;
  message: string;
  onConfirm: () => Promise<void> | void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open ? (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="dialog stack">
            <h2 id="confirm-title">{title}</h2>
            <p className="hint">{message}</p>
            <div className="split">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onConfirm();
                  setBusy(false);
                  setOpen(false);
                }}
              >
                {busy ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function MonthSwitcher({
  label,
  onPrevious,
  onNext,
}: {
  label: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="month-switch">
      <button type="button" className="icon-button" onClick={onPrevious} aria-label="Mes anterior">
        ‹
      </button>
      <p>{label}</p>
      <button type="button" className="icon-button" onClick={onNext} aria-label="Mes siguiente">
        ›
      </button>
    </div>
  );
}
