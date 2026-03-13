import { supabase } from "@/lib/supabase";

export async function fetchContracts(userId: string) {
  return supabase
    .from("contracts")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("id", { ascending: false });
}
export async function insertContract(payload: any) {
  return supabase.from("contracts").insert([payload]);
}
export async function deleteContractsByIds(ids: number[]) {
  return supabase.from("contracts").delete().in("id", ids);
}
export async function updateContractById(id: number, payload: any) {
  return supabase.from("contracts").update(payload).eq("id", id);
}