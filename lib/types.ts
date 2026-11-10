export type ExpenseType = "fijo" | "variable" | "extraordinario";
export type IncomeKind = "aporte" | "hogar" | "extraordinario";

export type Household = {
  id: string;
  name: string;
  currency_code: string;
  timezone: string;
  locale: string;
  invite_code: string;
};

export type Member = {
  id: string;
  household_id: string;
  user_id: string;
  display_name: string;
  role: "owner" | "member";
  status: string;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  slug: string | null;
  kind: string;
  is_system: boolean;
  active: boolean;
  sort_order: number;
};

export type ProductCategory = {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
};

export type PaymentMethod = {
  id: string;
  name: string;
  active: boolean;
  sort_order: number;
};

export type Product = {
  id: string;
  name: string;
  normalized_name: string;
  category_id: string | null;
  default_unit: string;
  active: boolean;
};

export type Expense = {
  id: string;
  occurred_on: string;
  description: string;
  category_id: string | null;
  amount: number;
  paid_by: string | null;
  payment_method_id: string | null;
  expense_type: ExpenseType;
  notes: string | null;
  receipt_path: string | null;
  source: "manual" | "shopping";
  recurring_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  payer_name: string | null;
  method_name: string | null;
  trip_id: string | null;
  store_name: string | null;
};

export type Income = {
  id: string;
  occurred_on: string;
  description: string;
  amount: number;
  member_id: string | null;
  kind: IncomeKind;
  notes: string | null;
  member_name: string | null;
};

export type Budget = {
  id: string;
  year: number;
  month: number;
  category_id: string | null;
  amount: number;
};

export type RecurringExpense = {
  id: string;
  description: string;
  category_id: string | null;
  amount: number;
  paid_by: string | null;
  payment_method_id: string | null;
  expense_type: ExpenseType;
  day_of_month: number;
  active: boolean;
  notes: string | null;
};

export type TripItem = {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
  notes: string | null;
};
