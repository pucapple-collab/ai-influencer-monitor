import { supabase } from "./supabase";

export async function testSupabaseConnection() {
  const { data, error } = await supabase
    .from("services")
    .select("service_id,name,status,progress")
    .order("service_id");

  if (error) {
    throw error;
  }

  return data;
}
