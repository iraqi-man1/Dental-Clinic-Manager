import { createId } from "@/lib/ids";
import { createClient } from "@/lib/supabase/client";

export type PersonalProfile = {
  displayName: string;
  bio: string;
  badges: string[];
  photo: string;
  cover: string;
};

/**
 * Demo mode keeps the profile, including any photo as a data URL, in localStorage. Browsers allow
 * roughly 5 million characters per origin, shared with other demo data, so cap the profile well below that.
 */
const DEMO_PROFILE_MAX_CHARS = 1_000_000;

/**
 * Raised when a profile cannot be written to browser storage. `quota` means the photo is too large,
 * and `unavailable` means storage is blocked or missing. The profile control maps each to a message.
 */
export class ProfileStorageError extends Error {
  reason: "quota" | "unavailable";

  constructor(reason: "quota" | "unavailable") {
    super(reason === "quota" ? "Profile is too large for browser storage" : "Browser storage is unavailable");
    this.name = "ProfileStorageError";
    this.reason = reason;
  }
}

export const emptyProfile: PersonalProfile = { displayName: "", bio: "", badges: [], photo: "", cover: "" };

function demoStorageKey(userId: string) {
  return `nargis-profile:${userId}`;
}

function parseProfile(value: unknown): PersonalProfile {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    displayName: typeof data.displayName === "string" ? data.displayName.slice(0, 100) : "",
    bio: typeof data.bio === "string" ? data.bio.slice(0, 500) : "",
    badges: Array.isArray(data.badges) ? data.badges.filter((badge): badge is string => typeof badge === "string").slice(0, 8) : [],
    photo: typeof data.photo === "string" ? data.photo : "",
    cover: typeof data.cover === "string" ? data.cover : "",
  };
}

function isQuotaError(error: unknown) {
  return error instanceof Error
    && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");
}

export async function loadPersonalProfile(userId: string): Promise<PersonalProfile> {
  const client = createClient();
  if (!client) {
    // A corrupted or blocked demo entry should show an empty profile rather than break the dialog.
    try {
      return parseProfile(JSON.parse(localStorage.getItem(demoStorageKey(userId)) ?? "null"));
    } catch {
      return emptyProfile;
    }
  }
  const { data, error } = await client.auth.getUser();
  if (error || data.user?.id !== userId) throw new Error("Profile could not be loaded");
  return parseProfile(data.user.user_metadata.personal_profile);
}

export async function profileImageUrl(path: string): Promise<string> {
  if (!path) return "";
  const client = createClient();
  if (!client) return path.startsWith("data:image/") ? path : "";
  const { data, error } = await client.storage.from("clinical-files").createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function savePersonalProfile(userId: string, profile: PersonalProfile): Promise<PersonalProfile> {
  const client = createClient();
  if (!client) {
    const serialized = JSON.stringify(profile);
    if (serialized.length > DEMO_PROFILE_MAX_CHARS) throw new ProfileStorageError("quota");
    try {
      localStorage.setItem(demoStorageKey(userId), serialized);
    } catch (error) {
      throw new ProfileStorageError(isQuotaError(error) ? "quota" : "unavailable");
    }
    return profile;
  }
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || auth.user?.id !== userId) throw new Error("Profile could not be saved");
  const saved = { ...profile };
  const uploaded: string[] = [];
  try {
    if ([saved.photo, saved.cover].some((value) => value.startsWith("data:image/"))) {
      const { data: member, error } = await client.from("clinic_members").select("clinic_id").eq("user_id", userId).eq("status", "active").limit(1).single();
      if (error || !member) throw new Error("Profile could not be saved");
      for (const field of ["photo", "cover"] as const) {
        if (!saved[field].startsWith("data:image/")) continue;
        const blob = await (await fetch(saved[field])).blob();
        const path = `${member.clinic_id}/profiles/${userId}/${createId()}.jpg`;
        const { error: uploadError } = await client.storage.from("clinical-files").upload(path, blob, { contentType: "image/jpeg" });
        if (uploadError) throw uploadError;
        uploaded.push(path);
        saved[field] = path;
      }
    }
    // Personal badges are decorative; clinic roles remain controlled by clinic_members.
    const { error } = await client.auth.updateUser({ data: { personal_profile: saved } });
    if (error) throw error;
    return saved;
  } catch (error) {
    if (uploaded.length) await client.storage.from("clinical-files").remove(uploaded);
    throw error;
  }
}
