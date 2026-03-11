import { supabase } from "@/lib/supabase";

export async function fetchMaterials() {
  return supabase
    .from("materials")
    .select("*")
    .order("date", { ascending: false });
}

export async function insertMaterial(payload: any) {
  return supabase.from("materials").insert([
    {
      ...payload,
      user_id: null,
    },
  ]);
}