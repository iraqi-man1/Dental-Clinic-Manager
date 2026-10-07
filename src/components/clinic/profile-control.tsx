"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, ImagePlus, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  emptyProfile,
  loadPersonalProfile,
  profileImageUrl,
  ProfileStorageError,
  savePersonalProfile,
  type PersonalProfile,
} from "@/lib/personal-profile";
import { useClinicPreferences } from "@/lib/clinic-preferences";

type CameraFailure = "insecure" | "unavailable";

function CameraCapture({ onCapture, onClose }: { onCapture: (image: string) => void; onClose: () => void }) {
  const { t } = useClinicPreferences();
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<CameraFailure | null>(null);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | undefined;
    // Browsers expose cameras only in secure contexts (HTTPS or localhost), so plain-HTTP LAN origins need their own message.
    if (!window.isSecureContext) {
      queueMicrotask(() => setFailure("insecure"));
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setFailure("unavailable"));
      return;
    }
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false }).then((result) => {
      if (stopped) {
        result.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = result;
      if (video.current) video.current.srcObject = stream;
    }).catch(() => {
      if (!stopped) setFailure("unavailable");
    });
    return () => {
      stopped = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const capture = () => {
    const element = video.current;
    // Wait until the first frame has a size; an empty canvas would produce a blank photo.
    if (!element || !ready || !element.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext("2d")?.drawImage(element, 0, 0);
    onCapture(canvas.toDataURL("image/jpeg", 0.9));
  };

  return (
    <div className="space-y-3">
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        aria-label={t("Camera preview")}
        onLoadedData={() => setReady(true)}
        className="aspect-video w-full rounded-lg bg-slate-950 object-cover"
      />
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure === "insecure"
            ? t("Camera needs a secure connection (HTTPS). Upload a photo instead.")
            : t("Camera unavailable. Allow camera access or upload a photo.")}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>{t("Cancel")}</Button>
        <Button type="button" disabled={!ready} onClick={capture}><Camera />{t("Take photo")}</Button>
      </div>
    </div>
  );
}

function ImageEditor({ source, field, onApply, onCancel }: {
  source: string;
  field: "photo" | "cover";
  onApply: (image: string) => void;
  onCancel: () => void;
}) {
  const { t } = useClinicPreferences();
  const [zoom, setZoom] = useState(1);
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [position, setPosition] = useState(50);
  const image = useRef<HTMLImageElement>(null);

  const apply = () => {
    const element = image.current;
    if (!element?.naturalWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = field === "photo" ? 400 : 1200;
    canvas.height = 400;
    const scale = Math.max(canvas.width / element.naturalWidth, canvas.height / element.naturalHeight) * zoom;
    const width = canvas.width / scale;
    const height = canvas.height / scale;
    canvas.getContext("2d")?.drawImage(
      element,
      (element.naturalWidth - width) / 2,
      (element.naturalHeight - height) * position / 100,
      width,
      height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    onApply(canvas.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className={`mx-auto overflow-hidden bg-muted ${field === "photo" ? "aspect-square w-48 rounded-full" : "aspect-[3/1] w-full rounded-lg"}`}>
        {/* User-selected local media; optimization is performed when applying the crop. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={image}
          onLoad={() => setImageReady(true)}
          onError={() => { setImageReady(false); setImageFailed(true); }}
          src={source}
          alt={t("Image preview")}
          className="size-full object-cover"
          style={{ objectPosition: `50% ${position}%`, transform: `scale(${zoom})`, transformOrigin: `50% ${position}%` }}
        />
      </div>
      {imageFailed && <p role="alert" className="text-sm text-destructive">{t("Image could not be loaded")}</p>}
      <label className="block text-sm">
        {t("Zoom")}
        <input className="mt-2 block h-11 w-full" type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
      </label>
      <label className="block text-sm">
        {t("Vertical position")}
        <input className="mt-2 block h-11 w-full" type="range" min="0" max="100" value={position} onChange={(event) => setPosition(Number(event.target.value))} />
      </label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>{t("Cancel")}</Button>
        <Button type="button" disabled={!imageReady} onClick={apply}>{t("Use image")}</Button>
      </div>
    </div>
  );
}

export function ProfileControl({ userId, fullName }: { userId: string; fullName: string }) {
  const { t } = useClinicPreferences();
  const [profile, setProfile] = useState<PersonalProfile>(emptyProfile);
  const [draft, setDraft] = useState<PersonalProfile>(emptyProfile);
  const [urls, setUrls] = useState({ photo: "", cover: "" });
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [camera, setCamera] = useState(false);
  const [editor, setEditor] = useState<{ source: string; field: "photo" | "cover" } | null>(null);
  const [badge, setBadge] = useState("");
  const [revision, setRevision] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const selectedField = useRef<"photo" | "cover">("photo");
  // Set once a load succeeds, so a failed background refresh never replaces a profile the user is editing.
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      try {
        const value = await loadPersonalProfile(userId);
        const [photo, cover] = await Promise.all([
          profileImageUrl(value.photo).catch(() => ""),
          profileImageUrl(value.cover).catch(() => ""),
        ]);
        if (cancelled) return;
        hasLoaded.current = true;
        setProfile(value);
        setUrls({ photo, cover });
        setLoaded(true);
        setFailed(false);
      } catch {
        if (!cancelled && !hasLoaded.current) {
          setFailed(true);
          setLoaded(false);
        }
      }
    }
    void load();
    // Renew private media URLs before they expire.
    const timer = window.setInterval(() => void load(), 50 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [userId, revision]);

  const close = (value: boolean) => {
    if (saving) return;
    setOpen(value);
    setCamera(false);
    setEditor(null);
  };

  const openDialog = () => {
    setDraft({ ...profile, displayName: profile.displayName || fullName });
    setBadge("");
    setOpen(true);
  };

  const choose = (field: "photo" | "cover") => {
    selectedField.current = field;
    fileInput.current?.click();
  };

  const readFile = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      toast.error(t("Choose a JPG, PNG or WebP image under 10 MB"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditor({ source: String(reader.result), field: selectedField.current });
    reader.onerror = () => toast.error(t("Image could not be loaded"));
    reader.readAsDataURL(file);
  };

  const saveErrorMessage = (error: unknown) => {
    if (error instanceof ProfileStorageError) {
      return error.reason === "quota"
        ? t("This photo is too large to store in this browser. Choose a smaller image.")
        : t("Browser storage is unavailable. Allow site data, then try again.");
    }
    return t("Profile could not be saved");
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.displayName.trim() || saving) return;
    setSaving(true);
    try {
      const value = await savePersonalProfile(userId, { ...draft, displayName: draft.displayName.trim() });
      setProfile(value);
      setUrls({
        photo: draft.photo.startsWith("data:") ? draft.photo : urls.photo,
        cover: draft.cover.startsWith("data:") ? draft.cover : draft.cover ? urls.cover : "",
      });
      setOpen(false);
      setRevision((current) => current + 1);
      toast.success(t("Profile saved"));
    } catch (error) {
      toast.error(saveErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const addBadge = () => {
    const value = badge.trim();
    if (!value) return;
    setDraft({ ...draft, badges: [...draft.badges, value] });
    setBadge("");
  };

  const imageSource = (field: "photo" | "cover") =>
    draft[field].startsWith("data:") ? draft[field] : draft[field] ? urls[field] : "";

  return (
    <>
      <Button
        variant="ghost"
        aria-label={t("Edit profile")}
        disabled={!userId}
        onClick={openDialog}
        className="h-auto gap-2 p-1.5"
      >
        <Avatar className="size-8">
          <AvatarImage src={profile.photo && urls.photo ? urls.photo : undefined} alt="" />
          <AvatarFallback data-no-translate>{(profile.displayName || fullName).slice(0, 2)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-28 truncate text-xs sm:block" data-no-translate>
          {profile.displayName || fullName}
        </span>
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("My profile")}</DialogTitle>
            <DialogDescription className="sr-only">{t("Edit your photo, cover, bio and personal badges")}</DialogDescription>
          </DialogHeader>
          {!loaded ? (
            <div className="py-8 text-center" role={failed ? "alert" : "status"}>
              <p className="text-sm text-muted-foreground">{t(failed ? "Profile could not be loaded" : "Loading…")}</p>
              {failed && <Button className="mt-3" onClick={() => setRevision((value) => value + 1)}>{t("Retry")}</Button>}
            </div>
          ) : (
            <form onSubmit={save} className="space-y-5">
              <fieldset disabled={saving} className="min-w-0 space-y-5">
                <div className="relative h-36 overflow-hidden rounded-xl bg-gradient-to-br from-teal-100 to-emerald-50">
                  {imageSource("cover") && (
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${imageSource("cover")}")` }} />
                  )}
                  <div className="absolute end-3 top-3 flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => choose("cover")}>
                      <ImagePlus />{t("Cover image")}
                    </Button>
                    {draft.cover && (
                      <Button type="button" size="icon" variant="outline" aria-label={t("Remove cover")} onClick={() => setDraft({ ...draft, cover: "" })}>
                        <X />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar className="size-20">
                    <AvatarImage src={imageSource("photo") || undefined} alt={t("Profile photo")} />
                    <AvatarFallback data-no-translate>{draft.displayName.slice(0, 2)}</AvatarFallback>
                  </Avatar>
                  <Button type="button" variant="outline" size="sm" onClick={() => choose("photo")}>
                    <ImagePlus />{t("Upload photo")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setEditor(null); setCamera(true); }}>
                    <Camera />{t("Take photo")}
                  </Button>
                  {draft.photo && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ ...draft, photo: "" })}>
                      {t("Remove photo")}
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    readFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                {camera && (
                  <CameraCapture
                    onClose={() => setCamera(false)}
                    onCapture={(source) => { setCamera(false); setEditor({ source, field: "photo" }); }}
                  />
                )}
                {editor && (
                  <ImageEditor
                    key={editor.source}
                    {...editor}
                    onCancel={() => setEditor(null)}
                    onApply={(source) => { setDraft({ ...draft, [editor.field]: source }); setEditor(null); }}
                  />
                )}
                <label className="block text-sm font-medium">
                  {t("Display name")}
                  <Input className="mt-2" value={draft.displayName} required maxLength={100} onChange={(event) => setDraft({ ...draft, displayName: event.target.value })} />
                </label>
                <label className="block text-sm font-medium">
                  {t("Bio")}
                  <Textarea className="mt-2" rows={3} maxLength={500} value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} />
                </label>
                <div className="space-y-2">
                  <label htmlFor="personal-badge" className="text-sm font-medium">{t("Personal badges")}</label>
                  <div className="flex gap-2">
                    <Input
                      id="personal-badge"
                      maxLength={30}
                      value={badge}
                      onChange={(event) => setBadge(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        addBadge();
                      }}
                      placeholder={t("Add a personal badge")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={t("Add badge")}
                      disabled={!badge.trim() || draft.badges.length >= 8 || draft.badges.includes(badge.trim())}
                      onClick={addBadge}
                    >
                      <Plus />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {draft.badges.map((value) => (
                      <span key={value} className="inline-flex items-center gap-2 rounded-full bg-accent py-1 ps-3 pe-1 text-xs text-primary">
                        <span data-no-translate>{value}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-6 rounded-full"
                          aria-label={t("Remove badge {badge}", { badge: value })}
                          onClick={() => setDraft({ ...draft, badges: draft.badges.filter((item) => item !== value) })}
                        >
                          <X />
                        </Button>
                      </span>
                    ))}
                  </div>
                </div>
              </fieldset>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={saving} onClick={() => close(false)}>{t("Cancel")}</Button>
                <Button type="submit" disabled={saving || Boolean(editor) || camera}>
                  <Save />{t(saving ? "Saving…" : "Save changes")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
