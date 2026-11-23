import { signArticleUpload } from "@/app/actions";

// Uploads a story image straight to Cloudinary and returns its hosted URL.
export async function uploadArticleImage(file: File): Promise<string> {
  const signed = await signArticleUpload();
  if ("message" in signed) throw new Error(signed.message);
  const body = new FormData();
  body.append("file", file);
  body.append("api_key", signed.apiKey);
  body.append("folder", signed.folder);
  body.append("timestamp", String(signed.timestamp));
  body.append("signature", signed.signature);
  const res = await fetch(signed.url, { method: "POST", body });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.secure_url) throw new Error("The image couldn't be uploaded. Try again.");
  return json.secure_url as string;
}

const readFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// Reads an image file and downscales it so the embedded data URL stays small
// enough for localStorage drafts and the article document.
export async function fileToDataUrl(file: File, maxDim = 1600): Promise<string> {
  const original = await readFile(file);
  try {
    const img = await loadImage(original);
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    if (scale === 1 && original.length < 600_000) return original;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const type = file.type === "image/png" || file.type === "image/gif" ? "image/png" : "image/jpeg";
    const out = canvas.toDataURL(type, 0.85);
    return out.length < original.length ? out : original;
  } catch {
    return original;
  }
}
