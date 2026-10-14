import { Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_STORAGE_NOTE } from "@/lib/types";
import Confirmed from "./Confirmed";

// Same cadence as the home page: the kitchen's wording follows within a minute.
export const revalidate = 60;

export default async function Page() {
  // Only the storage note is needed here; a failed read must not break the
  // page a customer lands on right after paying, so fall back to the default.
  const { data } = await supabase.from("settings").select("storage_note, cook_day").eq("id", 1).maybeSingle();
  const storageNote = (data?.storage_note as string | undefined)?.trim() || DEFAULT_STORAGE_NOTE;
  // The email says the same thing from the order's frozen cook date; the page
  // reads the current cook day so the two never name different days.
  const cookDay = (data?.cook_day as string | undefined) || "Monday";
  return (
    <Suspense>
      <Confirmed storageNote={storageNote} cookDay={cookDay} />
    </Suspense>
  );
}
