import { Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_STORAGE_NOTE } from "@/lib/types";
import Confirmed from "./Confirmed";

// Same cadence as the home page: the kitchen's wording follows within a minute.
export const revalidate = 60;

export default async function Page() {
  // Only the storage note is needed here; a failed read must not break the
  // page a customer lands on right after paying, so fall back to the default.
  const { data } = await supabase.from("settings").select("storage_note").eq("id", 1).maybeSingle();
  const storageNote = (data?.storage_note as string | undefined)?.trim() || DEFAULT_STORAGE_NOTE;
  return (
    <Suspense>
      <Confirmed storageNote={storageNote} />
    </Suspense>
  );
}
