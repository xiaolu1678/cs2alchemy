import { supabase } from "@/lib/supabase";

export async function fetchMaterials(userId: string) {
  const pageSize = 1000;
  let from = 0;
  let allRows: any[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("materials")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      return { data: null, error };
    }

    const rows = data || [];
    allRows = allRows.concat(rows);

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return { data: allRows, error: null };
}

export async function insertMaterial(payload: any) {
  return supabase.from("materials").insert([payload]);
}

export async function deleteMaterialsByIds(ids: number[]) {
  return supabase.from("materials").delete().in("id", ids);
}

export async function updateMaterialById(id: number, payload: any) {
  return supabase.from("materials").update(payload).eq("id", id);
}