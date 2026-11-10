"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useHousehold } from "@/components/household-provider";
import { durationLabel } from "@/lib/duration";
import { formatDate, formatMoney } from "@/lib/format";
import { loadProductStats, type ProductStat } from "@/lib/product-stats";

type SortKey = "duracion" | "rapido" | "frecuencia" | "gasto";

const sorts: { key: SortKey; label: string }[] = [
  { key: "duracion", label: "Más duran" },
  { key: "rapido", label: "Se agotan rápido" },
  { key: "frecuencia", label: "Más frecuentes" },
  { key: "gasto", label: "Mayor gasto" },
];

function sortProducts(products: ProductStat[], sort: SortKey) {
  const copy = [...products];
  if (sort === "duracion") {
    return copy.sort((a, b) => (b.insight.averageDurationDays ?? -1) - (a.insight.averageDurationDays ?? -1));
  }
  if (sort === "rapido") {
    return copy.sort((a, b) => {
      const left = a.insight.averageDurationDays ?? Number.POSITIVE_INFINITY;
      const right = b.insight.averageDurationDays ?? Number.POSITIVE_INFINITY;
      return left - right;
    });
  }
  if (sort === "frecuencia") {
    return copy.sort((a, b) => b.insight.purchaseCount - a.insight.purchaseCount);
  }
  return copy.sort((a, b) => b.insight.totalSpent - a.insight.totalSpent);
}

export default function ProductosPage() {
  const { supabase, household } = useHousehold();
  const [products, setProducts] = useState<ProductStat[]>([]);
  const [sort, setSort] = useState<SortKey>("frecuencia");
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    let cancelled = false;
    void loadProductStats(supabase, household.id)
      .then((rows) => {
        if (!cancelled) setProducts(rows);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [household.id, supabase]);

  const categories = [...new Set(products.map((product) => product.categoryName).filter(Boolean))] as string[];
  const visible = sortProducts(
    products.filter((product) => {
      if (!product.active && product.insight.purchaseCount === 0) return false;
      if (category && product.categoryName !== category) return false;
      if (text && !product.name.toLowerCase().includes(text.toLowerCase())) return false;
      return true;
    }),
    sort,
  );

  return (
    <div className="stack">
      <h2 className="section-title">Productos</h2>
      <input className="input" value={text} placeholder="Buscar producto" onChange={(event) => setText(event.target.value)} />
      <select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="">Todas las categorías</option>
        {categories.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <div className="sorts">
        {sorts.map((item) => (
          <button key={item.key} type="button" className={sort === item.key ? "active" : ""} onClick={() => setSort(item.key)}>
            {item.label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? <p className="empty">El catálogo crece cuando registras compras con productos.</p> : null}
      <div className="table">
        <div className="table-head">
          <span>Producto</span>
          <span>Última compra</span>
          <span>Duración</span>
        </div>
        {visible.map((product) => (
          <div className="table-row" key={product.productId}>
            <Link href={`/productos/${product.productId}`}>
              <strong>{product.name}</strong>
              <p className="hint">{formatMoney(product.insight.totalSpent)}</p>
            </Link>
            <span>{product.insight.lastPurchase ? formatDate(product.insight.lastPurchase) : "—"}</span>
            <span>{durationLabel(product.insight.averageDurationDays)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
