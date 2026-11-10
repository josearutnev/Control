"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useHousehold } from "./household-provider";
import { Field } from "./ui";
import { formatMoney, normalizeName, parseAmount, roundMoney, todayISO, UNITS } from "@/lib/format";
import { saveTrip, type TripLineInput } from "@/lib/save";
import type { Expense, TripItem } from "@/lib/types";

type Line = TripLineInput & { key: string };

function blankLine(categoryId: string): Line {
  return { key: crypto.randomUUID(), name: "", categoryId, quantity: "1", unit: "unidad", unitPrice: "", notes: "" };
}

export function TripForm({
  expense,
  items,
}: {
  expense?: Expense;
  items?: TripItem[];
}) {
  const router = useRouter();
  const { supabase, household, me, members, expenseCategories, productCategories, paymentMethods, products, refresh } =
    useHousehold();
  const supermarket = expenseCategories.find((category) => category.slug === "supermercado");
  const otros = productCategories.find((category) => category.name === "Otros") ?? productCategories[0];
  const activeMethods = paymentMethods.filter((method) => method.active);
  const activeProductCategories = productCategories.filter((category) => category.active);
  const [store, setStore] = useState(expense?.store_name ?? "");
  const [date, setDate] = useState(expense?.occurred_on ?? todayISO());
  const [paidBy, setPaidBy] = useState(expense?.paid_by ?? me.id);
  const [paymentMethodId, setPaymentMethodId] = useState(expense?.payment_method_id ?? activeMethods[0]?.id ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [lines, setLines] = useState<Line[]>(
    items && items.length > 0
      ? items.map((item) => ({
          key: item.id,
          name: item.product_name,
          categoryId: otros?.id ?? "",
          quantity: String(item.quantity),
          unit: item.unit,
          unitPrice: String(item.unit_price),
          notes: item.notes ?? "",
        }))
      : [blankLine(otros?.id ?? "")],
  );
  const [total, setTotal] = useState(expense ? String(expense.amount) : "");
  const [totalTouched, setTotalTouched] = useState(Boolean(expense));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const sum = useMemo(
    () =>
      roundMoney(
        lines.reduce((totalAmount, line) => {
          const quantity = parseAmount(line.quantity) ?? 0;
          const price = parseAmount(line.unitPrice) ?? 0;
          if (!line.name.trim() || quantity <= 0) return totalAmount;
          return totalAmount + quantity * price;
        }, 0),
      ),
    [lines],
  );
  const totalAmount = parseAmount(total);
  const shownTotal = totalTouched ? total : sum ? sum.toFixed(2) : "";

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!supermarket || !otros) {
      setError("Faltan las categorías iniciales del hogar.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await saveTrip(
      supabase,
      {
        householdId: household.id,
        supermarketCategoryId: supermarket.id,
        fallbackCategoryId: otros.id,
        products,
      },
      {
        expenseId: expense?.id,
        tripId: expense?.trip_id ?? undefined,
        store,
        date,
        total: totalTouched ? total : shownTotal,
        paidBy,
        paymentMethodId,
        notes,
        lines,
      },
    );
    setSaving(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    await refresh();
    router.push("/supermercado");
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <Field label="Supermercado">
        <input className="input" value={store} onChange={(event) => setStore(event.target.value)} placeholder="Nacional, Jumbo, Bravo…" required />
      </Field>
      <Field label="Fecha">
        <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </Field>
      <div className="stack">
        {lines.map((line, index) => {
          const normalized = normalizeName(line.name);
          const known = products.some((product) => product.normalized_name === normalized);
          const suggestions =
            line.name.trim().length < 1
              ? []
              : products
                  .filter((product) => product.active && product.normalized_name.includes(normalized) && product.normalized_name !== normalized)
                  .slice(0, 5);
          return (
            <div className="card stack" key={line.key}>
              <div className="row">
                <strong>Producto {index + 1}</strong>
                {lines.length > 1 ? (
                  <button type="button" className="btn btn-ghost" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>
                    Quitar
                  </button>
                ) : null}
              </div>
              <Field label="Nombre">
                <input
                  className="input"
                  value={line.name}
                  autoComplete="off"
                  placeholder="Arroz, leche, detergente…"
                  onChange={(event) => updateLine(line.key, { name: event.target.value })}
                />
              </Field>
              {suggestions.length > 0 ? (
                <div className="suggestions">
                  {suggestions.map((product) => (
                    <button
                      type="button"
                      key={product.id}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() =>
                        updateLine(line.key, {
                          name: product.name,
                          unit: product.default_unit,
                          categoryId: product.category_id ?? line.categoryId,
                        })
                      }
                    >
                      {product.name}
                    </button>
                  ))}
                </div>
              ) : null}
              {!known && line.name.trim().length > 1 ? (
                <Field label="Categoría del producto nuevo">
                  <select className="select" value={line.categoryId} onChange={(event) => updateLine(line.key, { categoryId: event.target.value })}>
                    {activeProductCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <div className="split">
                <Field label="Cantidad">
                  <input className="input" inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} />
                </Field>
                <Field label="Unidad">
                  <select className="select" value={line.unit} onChange={(event) => updateLine(line.key, { unit: event.target.value })}>
                    {UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Precio unitario">
                <input className="input" inputMode="decimal" value={line.unitPrice} placeholder="0.00" onChange={(event) => updateLine(line.key, { unitPrice: event.target.value })} />
              </Field>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn btn-secondary btn-block" onClick={() => setLines((current) => [...current, blankLine(otros?.id ?? "")])}>
        Agregar producto
      </button>
      <Field label="Total del ticket">
        <input
          className="input"
          inputMode="decimal"
          value={shownTotal}
          onChange={(event) => {
            setTotalTouched(true);
            setTotal(event.target.value);
          }}
          required
        />
      </Field>
      {totalAmount !== null && lines.some((line) => line.name.trim()) && Math.abs(totalAmount - sum) > 0.009 ? (
        <p className="hint">
          La suma de productos es {formatMoney(sum)}. Se guardará el total del ticket, {formatMoney(totalAmount)}.
        </p>
      ) : (
        <p className="hint">Puedes guardar solo el total si no quieres detallar los productos.</p>
      )}
      <div className="split">
        <Field label="Quién pagó">
          <select className="select" value={paidBy} onChange={(event) => setPaidBy(event.target.value)}>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Método">
          <select className="select" value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)}>
            {activeMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Nota, si hace falta">
        <textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn btn-primary btn-block" disabled={saving} type="submit">
        {saving ? "Guardando…" : "Guardar compra"}
      </button>
    </form>
  );
}
