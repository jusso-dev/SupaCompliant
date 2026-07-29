"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type AuthActionState = {
  error?: string;
  success?: string;
};

export async function signInWithPassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Live Auth is not configured. Use Continue to demo workspace, or set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Valid email and password (min 8 chars) required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/app");
}

export async function signUpWithPassword(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Live Auth is not configured. Set Supabase public env vars to enable sign-up.",
    };
  }

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Valid email and password (min 8 chars) required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { error: error.message };
  }

  return {
    success:
      "Account created. Check your email if confirmation is required, then sign in.",
  };
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured()) {
    redirect("/");
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

const orgSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});

export async function createOrganisation(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Live Auth required to create organisations." };
  }

  const parsed = orgSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid organisation" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const { data, error } = await supabase.rpc("create_organisation", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/app");
  redirect(`/app?org=${data as string}`);
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum([
    "administrator",
    "assessment_lead",
    "assessor",
    "engineer",
    "reviewer",
    "viewer",
  ]),
  organisationId: z.string().uuid(),
});

export async function inviteTeammate(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  if (!isSupabaseConfigured()) {
    return { error: "Live Auth required to invite teammates." };
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    organisationId: formData.get("organisationId"),
  });
  if (!parsed.success) {
    return { error: "Invalid invitation fields." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  // token_hash is a random opaque value — email delivery is out of band for now
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const tokenHash = await sha256Hex(token);
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("invitations").insert({
    organisation_id: parsed.data.organisationId,
    email: parsed.data.email.toLowerCase(),
    role: parsed.data.role,
    token_hash: tokenHash,
    invited_by: user.id,
    expires_at: expires,
  });

  if (error) {
    return { error: error.message };
  }

  await supabase.from("audit_events").insert({
    organisation_id: parsed.data.organisationId,
    actor_id: user.id,
    action: "invitation.created",
    resource_type: "invitation",
    resource_id: parsed.data.email,
    metadata: { role: parsed.data.role },
  });

  revalidatePath("/app/team");
  return {
    success: `Invitation recorded for ${parsed.data.email}. Share onboarding link out of band (email delivery not configured).`,
  };
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
