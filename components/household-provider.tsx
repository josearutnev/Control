"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { ExpenseCategory, Household, Member, PaymentMethod, Product, ProductCategory } from "@/lib/types";

type HouseholdState = {
  supabase: SupabaseClient;
  userId: string;
  household: Household;
  members: Member[];
  me: Member;
  expenseCategories: ExpenseCategory[];
  productCategories: ProductCategory[];
  paymentMethods: PaymentMethod[];
  products: Product[];
  refresh: () => Promise<void>;
};

const HouseholdContext = createContext<HouseholdState | null>(null);

export function useHousehold() {
  const value = useContext(HouseholdContext);
  if (!value) throw new Error("Fuera del hogar");
  return value;
}

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<Omit<HouseholdState, "supabase" | "refresh"> | null>(null);
  const [message, setMessage] = useState("Cargando el hogar…");

  const load = useCallback(async () => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      router.replace("/entrar");
      return;
    }

    const { data: membership, error: memberError } = await supabase
      .from("household_members")
      .select("id, household_id, user_id, display_name, role, status")
      .eq("user_id", auth.user.id)
      .eq("status", "active")
      .maybeSingle();

    if (memberError) {
      setMessage(memberError.message);
      return;
    }
    if (!membership) {
      router.replace("/bienvenida");
      return;
    }

    const householdId = membership.household_id;
    const [householdResult, membersResult, expenseResult, productCategoryResult, methodResult, productResult] =
      await Promise.all([
        supabase.from("households").select("id, name, currency_code, timezone, locale, invite_code").eq("id", householdId).single(),
        supabase
          .from("household_members")
          .select("id, household_id, user_id, display_name, role, status")
          .eq("household_id", householdId)
          .eq("status", "active")
          .order("created_at"),
        supabase
          .from("expense_categories")
          .select("id, name, slug, kind, is_system, active, sort_order")
          .eq("household_id", householdId)
          .order("sort_order"),
        supabase
          .from("product_categories")
          .select("id, name, active, sort_order")
          .eq("household_id", householdId)
          .order("sort_order"),
        supabase.from("payment_methods").select("id, name, active, sort_order").eq("household_id", householdId).order("sort_order"),
        supabase
          .from("products")
          .select("id, name, normalized_name, category_id, default_unit, active")
          .eq("household_id", householdId)
          .order("name"),
      ]);

    if (householdResult.error || !householdResult.data) {
      setMessage("No se pudo abrir el hogar.");
      return;
    }

    setState({
      userId: auth.user.id,
      household: householdResult.data as Household,
      members: (membersResult.data ?? []) as Member[],
      me: membership as Member,
      expenseCategories: (expenseResult.data ?? []) as ExpenseCategory[],
      productCategories: (productCategoryResult.data ?? []) as ProductCategory[],
      paymentMethods: (methodResult.data ?? []) as PaymentMethod[],
      products: (productResult.data ?? []) as Product[],
    });
  }, [router, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!state) return;
    const channel = supabase
      .channel(`hogar-${state.household.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses", filter: `household_id=eq.${state.household.id}` },
        () => {
          void load();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load, state, supabase]);

  if (!state) return <p className="screen">{message}</p>;

  return (
    <HouseholdContext.Provider value={{ ...state, supabase, refresh: load }}>{children}</HouseholdContext.Provider>
  );
}
