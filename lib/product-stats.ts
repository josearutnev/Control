import type { SupabaseClient } from "@supabase/supabase-js";
import { buildInsight, type ProductInsight, type PurchasePoint } from "./duration";
import { num } from "./format";
import type { Relation } from "./relations";

type ItemRow = {
  product_id: string;
  quantity: number | string;
  unit: string;
  unit_price: number | string;
  subtotal: number | string;
  product: Relation<{ name: string; category_id: string | null }>;
  trip: Relation<{ expense: Relation<{ occurred_on: string }> }>;
};

type EventRow = {
  product_id: string;
  occurred_on: string;
};

type ProductRow = {
  id: string;
  name: string;
  category_id: string | null;
  active: boolean;
  category: Relation<{ name: string }>;
};

export type ProductStat = {
  productId: string;
  name: string;
  categoryName: string | null;
  active: boolean;
  insight: ProductInsight;
  prices: { date: string; unitPrice: number }[];
};

function one<T>(value: Relation<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function loadProductStats(supabase: SupabaseClient, householdId: string) {
  const [productsResult, itemsResult, eventsResult] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, category_id, active, category:product_categories!category_id(name)")
      .eq("household_id", householdId)
      .order("name"),
    supabase
      .from("shopping_trip_items")
      .select(
        "product_id, quantity, unit, unit_price, subtotal, product:products!product_id(name, category_id), trip:shopping_trips!trip_id(expense:expenses!expense_id(occurred_on))",
      )
      .eq("household_id", householdId),
    supabase
      .from("product_events")
      .select("product_id, occurred_on")
      .eq("household_id", householdId)
      .eq("event_type", "depleted"),
  ]);

  if (productsResult.error) throw productsResult.error;
  if (itemsResult.error) throw itemsResult.error;
  if (eventsResult.error) throw eventsResult.error;

  const purchases = new Map<string, PurchasePoint[]>();
  for (const row of (itemsResult.data ?? []) as ItemRow[]) {
    const expense = one(one(row.trip)?.expense ?? null);
    if (!expense?.occurred_on) continue;
    const list = purchases.get(row.product_id) ?? [];
    list.push({
      date: expense.occurred_on,
      quantity: num(row.quantity),
      unit: row.unit,
      unitPrice: num(row.unit_price),
      spent: num(row.subtotal),
    });
    purchases.set(row.product_id, list);
  }

  const depletions = new Map<string, { date: string }[]>();
  for (const row of (eventsResult.data ?? []) as EventRow[]) {
    const list = depletions.get(row.product_id) ?? [];
    list.push({ date: row.occurred_on });
    depletions.set(row.product_id, list);
  }

  return ((productsResult.data ?? []) as ProductRow[]).map((product) => {
    const history = purchases.get(product.id) ?? [];
    return {
      productId: product.id,
      name: product.name,
      categoryName: one(product.category)?.name ?? null,
      active: product.active,
      insight: buildInsight(history, depletions.get(product.id) ?? []),
      prices: [...history]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((purchase) => ({ date: purchase.date.slice(0, 10), unitPrice: purchase.unitPrice })),
    } satisfies ProductStat;
  });
}
