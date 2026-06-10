"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions — all mutations go through here
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MinisterRole, AssignmentStatus } from "@/types";

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

/**
 * Mark a minister as CHECKED_IN for a given assignment.
 * Creates a check_in record and updates the assignment status.
 * Idempotent — calling it twice is safe.
 */
export async function checkInMinister(
  assignmentId: string,
  checkedInBy: string = "coordinator"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  // Upsert the check_in record (unique on assignment_id)
  const { error: ciError } = await supabase
    .from("check_in")
    .upsert(
      { assignment_id: assignmentId, checked_in_by: checkedInBy },
      { onConflict: "assignment_id" }
    );

  if (ciError) return { success: false, error: ciError.message };

  // Update the assignment status to CHECKED_IN
  const { error: aError } = await supabase
    .from("assignment")
    .update({ status: "CHECKED_IN" as AssignmentStatus })
    .eq("id", assignmentId);

  if (aError) return { success: false, error: aError.message };

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Undo a check-in — reverts the assignment to CONFIRMED/SCHEDULED
 * and deletes the check_in record.
 */
export async function uncheckInMinister(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error: ciError } = await supabase
    .from("check_in")
    .delete()
    .eq("assignment_id", assignmentId);

  if (ciError) return { success: false, error: ciError.message };

  const { error: aError } = await supabase
    .from("assignment")
    .update({ status: "CONFIRMED" as AssignmentStatus })
    .eq("id", assignmentId);

  if (aError) return { success: false, error: aError.message };

  revalidatePath("/", "layout");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

/** Assign a minister to a role at a Mass */
export async function createAssignment(
  massTimeId: string,
  ministerId: string,
  role: MinisterRole,
  readingLabel?: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  const supabase = await createClient();

  // The DB enum uses LECTOR_1/LECTOR_2. Map LECTOR → whichever slot is open.
  let dbRole: string = role;
  if (role === "LECTOR") {
    const { data: existing } = await supabase
      .from("assignment")
      .select("role")
      .eq("mass_time_id", massTimeId)
      .in("role", ["LECTOR_1", "LECTOR_2"]);
    const usedRoles = new Set((existing ?? []).map((a: { role: string }) => a.role));
    dbRole = usedRoles.has("LECTOR_1") ? "LECTOR_2" : "LECTOR_1";
  }

  const { data, error } = await supabase
    .from("assignment")
    .insert({
      mass_time_id: massTimeId,
      minister_id: ministerId,
      role: dbRole,
      reading_label: readingLabel ?? null,
      status: "SCHEDULED",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/", "layout");
  return { success: true, id: data.id };
}

/** Remove an assignment */
export async function deleteAssignment(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("assignment")
    .delete()
    .eq("id", assignmentId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}

/** Update the reading label on a lector assignment */
export async function updateReadingLabel(
  assignmentId: string,
  readingLabel: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("assignment")
    .update({ reading_label: readingLabel })
    .eq("id", assignmentId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Ministers
// ---------------------------------------------------------------------------

export async function createMinister(formData: {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  notification_preference: "email" | "sms" | "both" | "none";
  roles: MinisterRole[];
  notes?: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const supabase = await createClient();

  // Get the parish id (single-parish app)
  const { data: parish, error: pError } = await supabase
    .from("parish")
    .select("id")
    .single();
  if (pError) return { success: false, error: pError.message };

  const { data, error } = await supabase
    .from("minister")
    .insert({ ...formData, parish_id: parish.id })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/ministers");
  return { success: true, id: data.id };
}

export async function updateMinister(
  id: string,
  updates: Partial<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    notification_preference: "email" | "sms" | "both" | "none";
    roles: MinisterRole[];
    is_active: boolean;
    notes: string;
  }>
): Promise<{ success: boolean; error?: string }> {
  // Use the admin (service_role) client so RLS doesn't block coordinator edits.
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("minister")
    .update(updates)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/ministers");
  revalidatePath("/", "layout");
  return { success: true };
}
