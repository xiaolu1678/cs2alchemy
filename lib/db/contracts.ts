import { supabase } from "@/lib/supabase";

export async function fetchContracts() {
  return supabase
    .from("contracts")
    .select("*")
    .order("date", { ascending: false });
}

export async function insertContract(payload: any) {
  return supabase.from("contracts").insert([
    {
      ...payload,
      user_id: null,
    },
  ]);
}