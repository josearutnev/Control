import type { SupabaseClient } from "@supabase/supabase-js";
import { num } from "./format";
import type { Budget, Expense, ExpenseType, Income, IncomeKind, RecurringExpense, TripItem } from "./types";

type Relation<T> = T | T[] | null;

function one<T>(value: Relation<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

const expenseSelect = `
  id, occurred_on, description, category_id, amount, paid_by, payment_method_id,
  expense_type, notes, receipt_path, source, recurring_id,
  category:expense_categories!category_id(name, slug),
  payer:household_members!paid_by(display_name),
  method:payment_methods!payment_method_id(name),
  trip:shopping_trips!expense_id(id, store_name)
`;

type RawExpense = {
  id: string;
  occurred_on: string;
  description: string;
  category_id: string | null;
  amount: number | string;
  paid_by: string | null;
  payment_method_id: string | null;
  expense_type: ExpenseType;
  notes: string | null;
  receipt_path: string | null;
  source: "manual" | "shopping";
  recurring_id: string | null;
  category: Relation<{ name: string; slug: string | null }>;
  payer: Relation<{ display_name: string }>;
  method: Relation<{ name: string }>;
  trip: Relation<{ id: string; store_name: string }>;
};

export function mapExpense(row: RawExpense): Expense {
  const category = one(row.category);
  const payer = one(row.payer);
  const method = one(row.method);
  const trip = one(row.trip);
  return {
    id: row.id,
    occurred_on: row.occurred_on,
    description: row.description,
    category_id: row.category_id,
    amount: num(row.amount),
    paid_by: row.paid_by,
    payment_method_id: row.payment_method_id,
    expense_type: row.expense_type,
    notes: row.notes,
    receipt_path: row.receipt_path,
    source: row.source,
    recurring_id: row.recurring_id,
    category_name: category?.name ?? null,
    category_slug: category?.slug ?? null,
    payer_name: payer?.display_name ?? null,
    method_name: method?.name ?? null,
    trip_id: trip?.id ?? null,
    store_name: trip?.store_name ?? null,
  };
}

export async function fetchExpenses(
  supabase: SupabaseClient,
  householdId: string,
  from?: string,
  to?: string,
) {
  let query = supabase
    .from("expenses")
    .select(expenseSelect)
    .eq("household_id", householdId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (from) query = query.gte("occurred_on", from);
  if (to) query = query.lte("occurred_on", to);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as RawExpense[]).map(mapExpense);
}

export async function fetchExpense(supabase: SupabaseClient, id: string) {
  const { data, error } = await supabase.from("expenses").select(expenseSelect).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapExpense(data as RawExpense) : null;
}

type RawIncome = {
  id: string;
  occurred_on: string;
  description: string;
  amount: number | string;
  member_id: string | null;
  kind: IncomeKind;
  notes: string | null;
  member: Relation<{ display_name: string }>;
};

export async function fetchIncomes(
  supabase: SupabaseClient,
  householdId: string,
  from?: string,
  to?: string,
) {
  let query = supabase
    .from("incomes")
    .select("id, occurred_on, description, amount, member_id, kind, notes, member:household_members!member_id(display_name)")
    .eq("household_id", householdId)
    .order("occurred_on", { ascending: false });
  if (from) query = query.gte("occurred_on", from);
  if (to) query = query.lte("occurred_on", to);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as RawIncome[]).map((row) => ({
    id: row.id,
    occurred_on: row.occurred_on,
    description: row.description,
    amount: num(row.amount),
    member_id: row.member_id,
    kind: row.kind,
    notes: row.notes,
    member_name: one(row.member)?.display_name ?? null,
  })) satisfies Income[];
}

export async function fetchBudgets(
  supabase: SupabaseClient,
  householdId: string,
  year: number,
  month: number,
) {
  const { data, error } = await supabase
    .from("budgets")
    .select("id, year, month, category_id, amount")
    .eq("household_id", householdId)
    .eq("year", year)
    .eq("month", month);
  if (error) throw error;
  return ((data ?? []) as { id: string; year: number; month: number; category_id: string | null; amount: number | string }[]).map(
    (row) =>
      ({
        id: row.id,
        year: row.year,
        month: row.month,
        category_id: row.category_id,
        amount: num(row.amount),
      }) satisfies Budget,
  );
}

export async function fetchRecurring(supabase: SupabaseClient, householdId: string) {
  const { data, error } = await supabase
    .from("recurring_expenses")
    .select("id, description, category_id, amount, paid_by, payment_method_id, expense_type, day_of_month, active, notes")
    .eq("household_id", householdId)
    .order("description");
  if (error) throw error;
  return ((data ?? []) as (Omit<RecurringExpense, "amount"> & { amount: number | string })[]).map((row) => ({
    ...row,
    amount: num(row.amount),
    expense_type: row.expense_type as ExpenseType,
  }));
}

type RawItem = {
  id: string;
  product_id: string;
  quantity: number | string;
  unit: string;
  unit_price: number | string;
  subtotal: number | string;
  notes: string | null;
  product: Relation<{ name: string }>;
};

export async function fetchTripItems(supabase: SupabaseClient, tripId: string) {
  const { data, error } = await supabase
    .from("shopping_trip_items")
    .select("id, product_id, quantity, unit, unit_price, subtotal, notes, product:products!product_id(name)")
    .eq("trip_id", tripId)
    .order("id");
  if (error) throw error;
  return ((data ?? []) as RawItem[]).map(
    (row) =>
      ({
        id: row.id,
        product_id: row.product_id,
        product_name: one(row.product)?.name ?? "Producto",
        quantity: num(row.quantity),
        unit: row.unit,
        unit_price: num(row.unit_price),
        subtotal: num(row.subtotal),
        notes: row.notes,
      }) satisfies TripItem,
  );
}
