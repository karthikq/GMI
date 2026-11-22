"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signAvatarUpload, updateProfile } from "@/app/actions";
import Modal from "@/components/Modal";
import { NO_PHOTO, defaultAvatar } from "@/lib/avatar";
import { fileToDataUrl } from "@/lib/image";

const RING_RADIUS = 60;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

type Signed = { url: string; apiKey: string; folder: string; timestamp: number; signature: string };

// Posts straight to Cloudinary with XHR, since fetch has no upload progress.
function uploadWithProgress(
  file: File,
  signed: Signed,
  onProgress: (percent: number) => void,
  xhr: XMLHttpRequest,
) {
  return new Promise<string>((resolve, reject) => {
    const body = new FormData();
    body.append("file", file);
    body.append("api_key", signed.apiKey);
    body.append("folder", signed.folder);
    body.append("timestamp", String(signed.timestamp));
    body.append("signature", signed.signature);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      try {
        const url = JSON.parse(xhr.responseText)?.secure_url;
        if (xhr.status < 300 && typeof url === "string") return resolve(url);
      } catch {}
      reject(new Error("upload failed"));
    };
    xhr.onerror = () => reject(new Error("upload failed"));
    xhr.onabort = () => reject(new Error("aborted"));
    xhr.open("POST", signed.url);
    xhr.send(body);
  });
}

// Lets a signed-in reader change their display name and photo. `avatar` is a
// custom upload (Cloudinary), `picture` the Google photo fallback.
export default function EditProfile({
  name,
  dob,
  gender,
  avatar,
  picture,
}: {
  name: string;
  dob?: string;
  gender?: string;
  avatar?: string;
  picture?: string;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [nextName, setNextName] = useState(name);
  const [nextDob, setNextDob] = useState(dob ?? "");
  const [nextGender, setNextGender] = useState(gender ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [nextFile, setNextFile] = useState<File | null>(null);
  const [nextPhoto, setNextPhoto] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [photoChoice, setPhotoChoice] = useState<"google" | "none" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const upload = useRef<XMLHttpRequest | null>(null);

  const uploading = progress !== null;
  const photoSource = preview
    ? "custom"
    : (photoChoice ??
      (avatar === NO_PHOTO ? "none" : avatar ? "custom" : picture ? "google" : "none"));
  const shownPhoto =
    preview ??
    (photoSource === "custom" ? avatar : photoSource === "google" ? picture : undefined) ??
    defaultAvatar(nextGender);

  const cancelUpload = () => {
    upload.current?.abort();
    upload.current = null;
    setProgress(null);
  };

  useEffect(() => () => upload.current?.abort(), []);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      setPhotoError("Choose an image under 2 MB.");
      return;
    }
    setPhotoError(null);
    setPhotoChoice(null);
    setNextPhoto(null);
    setNextFile(file);
    // Canvas downscaling would freeze a GIF on its first frame.
    setPreview(
      file.type === "image/gif" ? URL.createObjectURL(file) : await fileToDataUrl(file, 480),
    );
  };

  // Uploads the picked photo straight to Cloudinary so progress can be shown.
  // Returns the hosted URL, or null if it failed or was cancelled.
  const uploadPhoto = async (file: File) => {
    const xhr = new XMLHttpRequest();
    upload.current = xhr;
    setProgress(0);
    try {
      const signed = await signAvatarUpload();
      if ("message" in signed) throw new Error(signed.message);
      if (upload.current !== xhr) return null;
      const url = await uploadWithProgress(file, signed, setProgress, xhr);
      if (upload.current !== xhr) return null;
      setNextPhoto(url);
      setNextFile(null);
      return url;
    } catch (err) {
      if (upload.current === xhr) {
        setPhotoError(
          err instanceof Error && err.message !== "upload failed"
            ? err.message
            : "The photo couldn't be uploaded. Try again.",
        );
      }
      return null;
    } finally {
      if (upload.current === xhr) {
        upload.current = null;
        setProgress(null);
      }
    }
  };

  const closeEditor = () => {
    cancelUpload();
    setOpen(false);
  };

  const openEditor = () => {
    setNextName(name);
    setNextDob(dob ?? "");
    setNextGender(gender ?? "");
    setPreview(null);
    setNextFile(null);
    setNextPhoto(null);
    setPhotoChoice(null);
    setError(null);
    setPhotoError(null);
    setOpen(true);
  };

  const save = () => {
    if (uploading) return;
    setError(null);
    setPhotoError(null);
    startTransition(async () => {
      const photo = nextFile ? await uploadPhoto(nextFile) : nextPhoto;
      if (nextFile && !photo) return;
      const result = await updateProfile({
        name: nextName,
        dob: nextDob,
        gender: nextGender,
        ...(photo
          ? { avatar: photo }
          : photoChoice === "google"
            ? { avatar: "" }
            : photoChoice === "none"
              ? { avatar: NO_PHOTO }
              : {}),
      });
      if (result?.message) {
        setError(result.message);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <button type="button" className="button outline" onClick={openEditor}>
        Edit profile
      </button>
      {open && (
        <Modal label="Edit profile" onClose={closeEditor}>
          <form
            className="modal-confirm edit-profile-modal"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <h2>Edit profile</h2>
            <div className="edit-profile-body">
              <div className="edit-photo">
                <div className={`avatar-upload${uploading ? " is-uploading" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={shownPhoto} alt="" className="avatar profile-avatar" />
                  {uploading && (
                    <>
                      <svg className="avatar-ring" viewBox="0 0 128 128" aria-hidden="true">
                        <circle className="avatar-ring-track" cx="64" cy="64" r={RING_RADIUS} />
                        <circle
                          className="avatar-ring-bar"
                          cx="64"
                          cy="64"
                          r={RING_RADIUS}
                          strokeDasharray={RING_LENGTH}
                          strokeDashoffset={RING_LENGTH * (1 - Math.max(progress ?? 0, 2) / 100)}
                        />
                      </svg>
                      <span
                        className="avatar-progress"
                        role="progressbar"
                        aria-label="Uploading photo"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progress ?? 0}
                      >
                        {progress ?? 0}%
                      </span>
                    </>
                  )}
                </div>
                {photoError && (
                  <p className="form-note error edit-photo-error" role="alert">
                    {photoError}
                  </p>
                )}
                <button
                  type="button"
                  className="button outline"
                  onClick={() => fileInput.current?.click()}
                  disabled={pending}
                >
                  Change photo
                </button>
                {!pending && (
                  <div className="edit-photo-links">
                    {picture && photoSource !== "google" && (
                      <button
                        type="button"
                        className="edit-photo-remove"
                        onClick={() => {
                          setPreview(null);
                          setNextFile(null);
                          setNextPhoto(null);
                          setPhotoChoice("google");
                        }}
                      >
                        Use Google photo
                      </button>
                    )}
                    {photoSource !== "none" && (
                      <button
                        type="button"
                        className="edit-photo-remove"
                        onClick={() => {
                          setPreview(null);
                          setNextFile(null);
                          setNextPhoto(null);
                          setPhotoChoice("none");
                        }}
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                )}
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    void pickPhoto(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <p className="edit-photo-note">JPG, PNG or GIF, up to 2 MB.</p>
              </div>

              <div className="edit-profile-grid">
                <label className="cms-field">
                  <span className="cms-label">Date of birth</span>
                  <input
                    type="date"
                    value={nextDob}
                    min="1900-01-01"
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setNextDob(e.target.value)}
                  />
                </label>
                <label className="cms-field">
                  <span className="cms-label">Gender</span>
                  <select value={nextGender} onChange={(e) => setNextGender(e.target.value)}>
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </label>
                <label className="cms-field wide">
                  <span className="cms-label">Display name</span>
                  <input
                    value={nextName}
                    maxLength={80}
                    autoComplete="nickname"
                    onChange={(e) => setNextName(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="modal-confirm-actions edit-profile-actions">
              {error && (
                <p className="form-note error" role="alert">
                  {error}
                </p>
              )}
              <button
                type="button"
                className="button outline"
                onClick={closeEditor}
                disabled={pending}
              >
                Cancel
              </button>
              <button type="submit" className="button" disabled={pending || uploading}>
                {uploading ? "Uploading…" : pending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
