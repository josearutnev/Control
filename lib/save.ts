import type { SupabaseClient } from "@supabase/supabase-js";
import { messageFromError, normalizeName, parseAmount, roundMoney } from "./format";
import type { ExpenseType, Product } from "./types";

export type TripLineInput = {
  name: string;
  categoryId: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  notes: string;
};

export type TripInput = {
  expenseId?: string;
  tripId?: string;
  store: string;
  date: string;
  total: string;
  paidBy: string;
  paymentMethodId: string;
  notes: string;
  lines: TripLineInput[];
};

type SaveContext = {
  householdId: string;
  supermarketCategoryId: string;
  fallbackCategoryId: string;
  products: Product[];
};

function fail(error: { message?: string; code?: string } | null) {
  return { error: messageFromError(error) };
}

export async function saveTrip(supabase: SupabaseClient, context: SaveContext, input: TripInput) {
  const store = input.store.trim();
  if (store.length < 2) return { error: "Escribe el supermercado." };
  const total = parseAmount(input.total);
  if (total === null) return { error: "Escribe el total del ticket." };

  const lines = input.lines
    .map((line) => ({ ...line, name: line.name.trim() }))
    .filter((line) => line.name.length > 0);

  const resolved: {
    productId: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    subtotal: number;
    notes: string | null;
  }[] = [];

  const catalog = [...context.products];

  for (const line of lines) {
    const quantity = parseAmount(line.quantity);
    const unitPrice = parseAmount(line.unitPrice);
    if (quantity === null || quantity <= 0) return { error: `Revisa la cantidad de ${line.name}.` };
    if (unitPrice === null) return { error: `Revisa el precio de ${line.name}.` };
    const normalized = normalizeName(line.name);
    let product = catalog.find((item) => item.normalized_name === normalized);
    if (product && !product.active) {
      await supabase.from("products").update({ active: true }).eq("id", product.id);
      product = { ...product, active: true };
    }
    if (!product) {
      const { data, error } = await supabase
        .from("products")
        .insert({
          household_id: context.householdId,
          category_id: line.categoryId || context.fallbackCategoryId,
          name: line.name,
          normalized_name: normalized,
          default_unit: line.unit || "unidad",
        })
        .select("id, name, normalized_name, category_id, default_unit, active")
        .single();
      if (error || !data) {
        const { data: existing, error: existingError } = await supabase
          .from("products")
          .select("id, name, normalized_name, category_id, default_unit, active")
          .eq("household_id", context.householdId)
          .eq("normalized_name", normalized)
          .maybeSingle();
        if (existingError || !existing) return fail(error);
        product = existing as Product;
      } else {
        product = data as Product;
      }
      catalog.push(product);
    }
    resolved.push({
      productId: product.id,
      quantity,
      unit: line.unit || product.default_unit || "unidad",
      unitPrice,
      subtotal: roundMoney(quantity * unitPrice),
      notes: line.notes.trim() || null,
    });
  }

  const expensePayload = {
    occurred_on: input.date,
    description: `Supermercado · ${store}`,
    category_id: context.supermarketCategoryId,
    amount: total,
    paid_by: input.paidBy || null,
    payment_method_id: input.paymentMethodId || null,
    expense_type: "variable" as const,
    notes: input.notes.trim() || null,
  };

  let expenseId = input.expenseId;
  let tripId = input.tripId;

  if (expenseId && tripId) {
    const { error } = await supabase.from("expenses").update(expensePayload).eq("id", expenseId);
    if (error) return fail(error);
    const { error: tripError } = await supabase
      .from("shopping_trips")
      .update({ store_name: store, notes: input.notes.trim() || null })
      .eq("id", tripId);
    if (tripError) return fail(tripError);
    const { error: deleteError } = await supabase.from("shopping_trip_items").delete().eq("trip_id", tripId);
    if (deleteError) return fail(deleteError);
  } else {
    const { data, error } = await supabase
      .from("expenses")
      .insert({ ...expensePayload, household_id: context.householdId, source: "shopping" })
      .select("id")
      .single();
    if (error || !data) return fail(error);
    expenseId = data.id;
    const { data: trip, error: tripError } = await supabase
      .from("shopping_trips")
      .insert({
        household_id: context.householdId,
        expense_id: expenseId,
        store_name: store,
        notes: input.notes.trim() || null,
      })
      .select("id")
      .single();
    if (tripError || !trip) {
      await supabase.from("expenses").delete().eq("id", expenseId);
      return fail(tripError);
    }
    tripId = trip.id;
  }

  if (resolved.length > 0 && tripId && expenseId) {
    const { data: items, error } = await supabase
      .from("shopping_trip_items")
      .insert(
        resolved.map((line) => ({
          household_id: context.householdId,
          trip_id: tripId,
          product_id: line.productId,
          quantity: line.quantity,
          unit: line.unit,
          unit_price: line.unitPrice,
          subtotal: line.subtotal,
          notes: line.notes,
        })),
      )
      .select("id, product_id, quantity, unit");
    if (error || !items) return fail(error);
    const { error: eventError } = await supabase.from("product_events").insert(
      items.map((item) => ({
        household_id: context.householdId,
        product_id: item.product_id,
        event_type: "purchased",
        occurred_on: input.date,
        shopping_trip_item_id: item.id,
        quantity: item.quantity,
        unit: item.unit,
      })),
    );
    if (eventError) return fail(eventError);
  }

  return { expenseId, tripId };
}

export type ExpenseInput = {
  id?: string;
  date: string;
  description: string;
  categoryId: string;
  amount: string;
  paidBy: string;
  paymentMethodId: string;
  expenseType: ExpenseType;
  notes: string;
  receipt?: File | null;
  existingReceiptPath?: string | null;
};

export async function saveExpense(
  supabase: SupabaseClient,
  householdId: string,
  input: ExpenseInput,
) {
  const description = input.description.trim();
  if (description.length < 2) return { error: "Escribe una descripción." };
  const amount = parseAmount(input.amount);
  if (amount === null) return { error: "Escribe el monto." };
  if (!input.categoryId) return { error: "Elige una categoría." };

  const payload = {
    occurred_on: input.date,
    description,
    category_id: input.categoryId,
    amount,
    paid_by: input.paidBy || null,
    payment_method_id: input.paymentMethodId || null,
    expense_type: input.expenseType,
    notes: input.notes.trim() || null,
  };

  let expenseId = input.id;
  if (expenseId) {
    const { error } = await supabase.from("expenses").update(payload).eq("id", expenseId);
    if (error) return fail(error);
  } else {
    const { data, error } = await supabase
      .from("expenses")
      .insert({ ...payload, household_id: householdId, source: "manual" })
      .select("id")
      .single();
    if (error || !data) return fail(error);
    expenseId = data.id;
  }

  let receiptWarning: string | null = null;
  if (input.receipt && expenseId) {
    if (input.receipt.size > 5 * 1024 * 1024) {
      receiptWarning = "El gasto se guardó. La foto pesa más de 5 MB y no se subió.";
    } else {
      const extension = input.receipt.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${householdId}/${expenseId}/${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from("receipts").upload(path, input.receipt, {
        upsert: true,
        contentType: input.receipt.type || undefined,
      });
      if (error) {
        receiptWarning = "El gasto se guardó, pero la foto no se pudo subir.";
      } else {
        await supabase.from("expenses").update({ receipt_path: path }).eq("id", expenseId);
      }
    }
  }

  if (!expenseId) return { error: "No se pudo guardar." };
  return { expenseId, receiptWarning };
}
