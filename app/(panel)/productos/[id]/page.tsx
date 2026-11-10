"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useHousehold } from "@/components/household-provider";
import { confidenceLabel, durationLabel } from "@/lib/duration";
import { formatDate, formatMoney, todayISO } from "@/lib/format";
import { loadProductStats, type ProductStat } from "@/lib/product-stats";

export default function ProductoPage() {
  const params = useParams<{ id: string }>();
  const { supabase, household, refresh } = useHousehold();
  const [product, setProduct] = useState<ProductStat | null>(null);
  const [date, setDate] = useState(todayISO());
  const [message, setMessage] = useState("");
  const [missing, setMissing] = useState(false);

  async function reload() {
    const rows = await loadProductStats(supabase, household.id);
    const found = rows.find((row) => row.productId === params.id) ?? null;
    setProduct(found);
    setMissing(!found);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload().catch(() => setMissing(true));
    }, 0);
    return () => window.clearTimeout(timer);
    // reload depende del id de la ruta y del hogar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household.id, params.id]);

  if (missing) return <p>No encontré ese producto.</p>;
  if (!product) return <p>Cargando el producto…</p>;

  const insight = product.insight;
  const firstPrice = product.prices[0];
  const lastPrice = product.prices.at(-1);
  const priceDelta = firstPrice && lastPrice && product.prices.length > 1 ? lastPrice.unitPrice - firstPrice.unitPrice : null;

  return (
    <div className="stack">
      <Link href="/productos" className="hint">
        Volver a productos
      </Link>
      <article className="card stack">
        <h2>{product.name}</h2>
        <p className="hint">{product.categoryName}</p>
        {insight.status === "agotado" ? (
          <p className="banner">
            Marcado como agotado{insight.lastDepletion ? ` el ${formatDate(insight.lastDepletion)}` : ""}. Conviene comprarlo de nuevo.
          </p>
        ) : null}
        <div className="stat-grid">
          <div>
            <span className="stat-label">Última compra</span>
            <p>{insight.lastPurchase ? formatDate(insight.lastPurchase) : "—"}</p>
          </div>
          <div>
            <span className="stat-label">Duración promedio</span>
            <p>{durationLabel(insight.averageDurationDays)}</p>
          </div>
          <div>
            <span className="stat-label">Entre compras</span>
            <p>{insight.averageRepurchaseDays ? durationLabel(insight.averageRepurchaseDays) : "—"}</p>
          </div>
          <div>
            <span className="stat-label">Precio promedio</span>
            <p>{insight.averageUnitPrice === null ? "—" : formatMoney(insight.averageUnitPrice)}</p>
          </div>
        </div>
        {insight.status === "en_uso" && insight.estimatedNextDate ? (
          <p className="hint">
            Podría hacer falta alrededor del {formatDate(insight.estimatedNextDate)}. Es una estimación{" "}
            {insight.estimateBasis === "recompra" ? "por el ritmo de compra, no porque se haya agotado" : "por los agotados que marcaron"},{" "}
            {confidenceLabel(insight.confidence)}.
          </p>
        ) : null}
        {insight.averageDurationDays === null ? (
          <p className="hint">Todavía no hay un agotado marcado, así que no calculo cuánto dura.</p>
        ) : null}
      </article>
      <form
        className="card stack"
        onSubmit={async (event) => {
          event.preventDefault();
          setMessage("");
          const { error } = await supabase.from("product_events").insert({
            household_id: household.id,
            product_id: product.productId,
            event_type: "depleted",
            occurred_on: date,
          });
          if (error) {
            setMessage("No se pudo marcar como agotado.");
            return;
          }
          setMessage("Quedó marcado como agotado.");
          await reload();
          await refresh();
        }}
      >
        <h2>Se agotó</h2>
        <label className="field">
          <span className="field-label">Fecha en que se terminó</span>
          <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
        <button className="btn btn-primary" type="submit">
          Marcar agotado
        </button>
        {message ? <p className="hint">{message}</p> : null}
      </form>
      {priceDelta !== null && firstPrice && lastPrice ? (
        <p className="hint">
          {priceDelta === 0
            ? "El precio unitario se ha mantenido."
            : priceDelta > 0
              ? `El precio unitario subió ${formatMoney(priceDelta)} desde la primera compra.`
              : `El precio unitario bajó ${formatMoney(Math.abs(priceDelta))} desde la primera compra.`}
        </p>
      ) : null}
      <section className="stack">
        <h2 className="section-title">Precios</h2>
        {product.prices.length === 0 ? <p className="empty">Sin compras registradas.</p> : null}
        <ul className="list">
          {[...product.prices].reverse().map((price, index) => (
            <li key={`${price.date}-${index}`}>
              <div className="list-button">
                <div className="row">
                  <span>{formatDate(price.date)}</span>
                  <strong className="amount">{formatMoney(price.unitPrice)}</strong>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
