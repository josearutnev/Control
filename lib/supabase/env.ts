const fallbackUrl = "https://poaidcwtljycppnekvsr.supabase.co";
const fallbackKey = "sb_publishable_nuhf1g54hLrycMwU2nCEcA_wCbiY3Q1";

export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fallbackUrl;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || fallbackKey;
  return { url, key };
}

export function projectRef() {
  return new URL(supabaseEnv().url).hostname.split(".")[0] ?? "";
}
