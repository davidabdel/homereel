/**
 * Shrink a photo in the browser so it can survive the upload.
 *
 * Vercel rejects any request body over 4.5MB at the edge, *before* the
 * function runs. The caller gets a plain-text `FUNCTION_PAYLOAD_TOO_LARGE`
 * with no JSON in it, so `/api/kie/upload`'s own size check never fires and
 * the wizard has nothing to read but the status number — which is how a 6MB
 * iPhone photo became "Could not upload IMG_7885.jpeg (413)". A modern phone
 * shoots 5-9MB, so this was every real listing folder, not an odd file.
 *
 * Resizing here rather than raising a limit is deliberate: the limit is the
 * platform's and can't be raised, and a phone on cellular uploading twelve
 * full-size photos is slow enough to look broken even when it works.
 */

/** Under Vercel's 4.5MB body cap with room for the multipart envelope. */
const SAFE_BYTES = 3.5 * 1024 * 1024;

/** Seedance reads a single frame; past this, pixels cost upload time and buy nothing. */
const MAX_LONG_EDGE = 2560;

/** Mirrors the wizard's HD threshold. Shrinking must never demote a photo to Standard. */
const HD_MIN_EDGE = 1000;

/**
 * Size and quality steps, tried in order until one comes in under budget.
 * Dimensions go first and quality second: a slightly smaller photo looks
 * better than a same-size photo with JPEG artefacts in the grout lines.
 */
const LADDER = [
  { longEdge: MAX_LONG_EDGE, quality: 0.86 },
  { longEdge: MAX_LONG_EDGE, quality: 0.75 },
  { longEdge: 2048, quality: 0.8 },
  { longEdge: 2048, quality: 0.68 },
  { longEdge: 1600, quality: 0.75 },
] as const;

export type PreparedPhoto = {
  file: File;
  width: number;
  height: number;
  /** True when the photo was re-encoded rather than sent as it came off the disk. */
  shrunk: boolean;
};

/** Thrown when a file can't be turned into something uploadable, with a reason a human can act on. */
export class PhotoPrepError extends Error {}

function decode(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new PhotoPrepError("this browser could not read the image"));
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

function jpegName(name: string): string {
  return name.replace(/\.[^.]+$/, "") + ".jpg";
}

/**
 * Return a version of `file` small enough to upload.
 *
 * A photo already under budget is passed straight through — re-encoding one
 * that doesn't need it only adds a generation of JPEG loss.
 *
 * @param width  natural width, if the caller already measured it
 * @param height natural height, if the caller already measured it
 */
export async function prepareForUpload(
  file: File,
  width?: number,
  height?: number
): Promise<PreparedPhoto> {
  if (file.size <= SAFE_BYTES) {
    return { file, width: width ?? 0, height: height ?? 0, shrunk: false };
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await decode(url);
    const w = img.naturalWidth || width || 0;
    const h = img.naturalHeight || height || 0;
    if (!w || !h) throw new PhotoPrepError("this browser could not read the image");

    const longEdge = Math.max(w, h);
    const shortEdge = Math.min(w, h);

    // Never shrink the short edge below what HD needs. A photo that arrived
    // HD-capable must stay HD-capable, or the reel would silently drop to
    // Standard because of an upload limit — which has nothing to do with how
    // good the photo is.
    const floor = Math.min(shortEdge, HD_MIN_EDGE) / shortEdge;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new PhotoPrepError("this browser could not resize the image");

    let smallest: { blob: Blob; w: number; h: number } | null = null;

    for (const step of LADDER) {
      const scale = Math.max(Math.min(1, step.longEdge / longEdge), floor);
      const tw = Math.round(w * scale);
      const th = Math.round(h * scale);

      if (canvas.width !== tw || canvas.height !== th) {
        canvas.width = tw;
        canvas.height = th;
      }
      ctx.clearRect(0, 0, tw, th);
      ctx.drawImage(img, 0, 0, tw, th);

      const blob = await toBlob(canvas, step.quality);
      if (!blob) continue;
      if (!smallest || blob.size < smallest.blob.size) smallest = { blob, w: tw, h: th };
      if (blob.size <= SAFE_BYTES) break;
    }

    if (!smallest) throw new PhotoPrepError("this browser could not resize the image");

    return {
      file: new File([smallest.blob], jpegName(file.name), { type: "image/jpeg" }),
      width: smallest.w,
      height: smallest.h,
      shrunk: true,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Megabytes, for messages people read. */
export function mb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
