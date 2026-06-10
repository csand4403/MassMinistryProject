"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MinisterRole, AssignmentStatus, MassDayType, MassLanguage, PriestType } from "@/types";

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

export async function checkInMinister(
  assignmentId: string,
  checkedInBy: string = "coordinator"
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error: ciError } = await supabase
    .from("check_in")
    .upsert(
      { assignment_id: assignmentId, checked_in_by: checkedInBy },
      { onConflict: "assignment_id" }
    );
  if (ciError) return { success: false, error: ciError.message };

  const { error: aError } = await supabase
    .from("assignment")
    .update({ status: "CHECKED_IN" as AssignmentStatus })
    .eq("id", assignmentId);
  if (aError) return { success: false, error: aError.message };

  revalidatePath("/", "layout");
  return { success: true };
}

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

export async function createAssignment(
  massTimeId: string,
  ministerId: string,
  role: MinisterRole,
  readingLabel?: string
): Promise<{ success: boolean; error?: string; id?: string }> {
  const supabase = await createClient();

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
  priest_type?: PriestType;
  minister_diocese?: string;
  letter_of_suitability?: boolean;
  letter_expiration_date?: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const supabase = await createClient();

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
    priest_type: PriestType | null;
    minister_diocese: string;
    letter_of_suitability: boolean;
    letter_expiration_date: string | null;
  }>
): Promise<{ success: boolean; error?: string }> {
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

// ---------------------------------------------------------------------------
// Mass Templates
// ---------------------------------------------------------------------------

export async function createTemplate(formData: {
  name: string;
  day_type: MassDayType;
  start_time: string;
  language: MassLanguage;
  notes?: string;
  role_configs: { role: string; min_count: number; max_count: number }[];
}): Promise<{ success: boolean; error?: string; id?: string }> {
  const supabase = await createClient();

  const { data: parish, error: pError } = await supabase
    .from("parish")
    .select("id")
    .single();
  if (pError) return { success: false, error: pError.message };

  const { data: template, error: tError } = await supabase
    .from("mass_template")
    .insert({
      parish_id: parish.id,
      name: formData.name,
      day_type: formData.day_type,
      start_time: formData.start_time,
      language: formData.language,
      notes: formData.notes ?? null,
    })
    .select("id")
    .single();

  if (tError) return { success: false, error: tError.message };

  // Insert role configs (skip roles with both min and max = 0)
  const roleRows = formData.role_configs
    .filter((rc) => rc.min_count > 0 || rc.max_count > 0)
    .map((rc) => ({
      template_id: template.id,
      role: rc.role,
      min_count: rc.min_count,
      max_count: rc.max_count,
    }));

  if (roleRows.length > 0) {
    const { error: rcError } = await supabase
      .from("mass_template_role")
      .insert(roleRows);
    if (rcError) return { success: false, error: rcError.message };
  }

  revalidatePath("/settings");
  return { success: true, id: template.id };
}

export async function updateTemplate(
  id: string,
  formData: {
    name: string;
    day_type: MassDayType;
    start_time: string;
    language: MassLanguage;
    notes?: string;
    role_configs: { role: string; min_count: number; max_count: number }[];
  }
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error: tError } = await supabase
    .from("mass_template")
    .update({
      name: formData.name,
      day_type: formData.day_type,
      start_time: formData.start_time,
      language: formData.language,
      notes: formData.notes ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (tError) return { success: false, error: tError.message };

  // Replace all role configs
  await supabase.from("mass_template_role").delete().eq("template_id", id);

  const roleRows = formData.role_configs
    .filter((rc) => rc.min_count > 0 || rc.max_count > 0)
    .map((rc) => ({
      template_id: id,
      role: rc.role,
      min_count: rc.min_count,
      max_count: rc.max_count,
    }));

  if (roleRows.length > 0) {
    const { error: rcError } = await supabase
      .from("mass_template_role")
      .insert(roleRows);
    if (rcError) return { success: false, error: rcError.message };
  }

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteTemplate(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("mass_template")
    .delete()
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}
