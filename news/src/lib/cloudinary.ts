import { v2 as cloudinary } from "cloudinary";

// CLOUNDINARY_ENV_VARIABLE holds a full `CLOUDINARY_URL=cloudinary://key:secret@cloud_name`
// string (prefix included); the individual key/secret vars are a fallback.
function parseCredentials() {
  const raw = process.env.CLOUNDINARY_ENV_VARIABLE ?? "";
  const url = raw.includes("cloudinary://")
    ? raw.slice(raw.indexOf("cloudinary://"))
    : null;
  if (url) {
    try {
      const parsed = new URL(url);
      return {
        cloud_name: parsed.hostname,
        api_key: decodeURIComponent(parsed.username),
        api_secret: decodeURIComponent(parsed.password),
      };
    } catch {
      // fall through to individual vars
    }
  }
  const { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME } =
    process.env;
  if (CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET && CLOUDINARY_CLOUD_NAME) {
    return {
      cloud_name: CLOUDINARY_CLOUD_NAME,
      api_key: CLOUDINARY_API_KEY,
      api_secret: CLOUDINARY_API_SECRET,
    };
  }
  return null;
}

let credentials: ReturnType<typeof parseCredentials> | undefined;

function ensureConfigured() {
  if (credentials === undefined) {
    credentials = parseCredentials();
    if (credentials) cloudinary.config({ ...credentials, secure: true });
  }
  return Boolean(credentials);
}

// Signs a direct browser upload so the client can report upload progress.
export function signUpload(folder: string) {
  if (!ensureConfigured() || !credentials) return null;
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { folder, timestamp },
    credentials.api_secret,
  );
  return {
    url: `https://api.cloudinary.com/v1_1/${credentials.cloud_name}/image/upload`,
    apiKey: credentials.api_key,
    folder,
    timestamp,
    signature,
  };
}

// True for an image this account hosts in `folder`, e.g. a signed upload result.
export function isHostedImage(url: string, folder: string) {
  if (!ensureConfigured() || !credentials) return false;
  return url.startsWith(
    `https://res.cloudinary.com/${credentials.cloud_name}/image/upload/`,
  ) && url.includes(`/${folder}/`);
}

// Accepts a data URL and returns the hosted https URL, or null when the
// service is not configured / the upload fails.
export async function uploadImage(
  dataUrl: string,
  folder = "gmi",
): Promise<string | null> {
  if (!/^data:image\//.test(dataUrl) || !ensureConfigured()) return null;
  try {
    const result = await cloudinary.uploader.upload(dataUrl, { folder });
    return result.secure_url;
  } catch (error) {
    console.error("[news] cloudinary upload failed:", error);
    return null;
  }
}
