import { supabase } from "@/lib/supabase";

export async function fetchDailyExtraIncome(userId: string) {
  return supabase
    .from("daily_extra_income")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("id", { ascending: false });
}

export async function upsertDailyExtraIncome(payload: {
  user_id: string;
  date: string;
  amount: number;
  note?: string | null;
}) {
const { data: existingRows, error: existingError } = await supabase
  .from("daily_extra_income")
  .select("*")
  .eq("user_id", payload.user_id)
  .eq("date", payload.date)
  .order("id", { ascending: false });

if (existingError) return { error: existingError };

const existing = existingRows?.[0];



  if (existing) {
    return supabase
      .from("daily_extra_income")
      .update({
        amount: payload.amount,
        note: payload.note ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  }

  return supabase.from("daily_extra_income").insert([
    {
      ...payload,
      note: payload.note ?? null,
    },
  ]);
}

const PAST_PROFIT_DATE = "1900-01-01";