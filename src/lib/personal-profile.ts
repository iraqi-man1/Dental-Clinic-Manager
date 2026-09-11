import { createClient } from "@/lib/supabase/client";

export type PersonalProfile = {
  displayName: string;
  bio: string;
  badges: string[];
  photo: string;
  cover: string;
};

export const emptyProfile: PersonalProfile = { displayName: "", bio: "", badges: [], photo: "", cover: "" };

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

export async function loadPersonalProfile(userId: string): Promise<PersonalProfile> {
  const client = createClient();
  if (!client) return parseProfile(JSON.parse(localStorage.getItem(`nargis-profile:${userId}`) ?? "null"));
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
    localStorage.setItem(`nargis-profile:${userId}`, JSON.stringify(profile));
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
        const path = `${member.clinic_id}/profiles/${userId}/${crypto.randomUUID()}.jpg`;
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
