import { supabase } from "@/lib/supabase";

export async function fetchContracts(userId: string) {
  const pageSize = 1000;
  let from = 0;
  let allRows: any[] = [];

  while (true) {
    const { data, error } = await supabase
      .from("contracts")
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

export async function insertContract(payload: any) {
  return supabase
    .from("contracts")
    .insert([payload])
    .select()
    .single();
}

export async function deleteContractsByIds(ids: number[]) {
  return supabase.from("contracts").delete().in("id", ids);
}

export async function updateContractById(id: number, payload: any) {
  return supabase.from("contracts").update(payload).eq("id", id);
}