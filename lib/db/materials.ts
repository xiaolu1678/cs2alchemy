import { supabase } from "@/lib/supabase";

export async function fetchMaterials(userId: string) {
  return supabase
    .from("materials")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false });
}

export async function insertMaterial(payload: any) {
  return supabase.from("materials").insert([payload]);
}
export async function deleteMaterialsByIds(ids: number[]) {
  return supabase.from("materials").delete().in("id", ids);
}