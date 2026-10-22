// Phone photos run to several megabytes, but a serverless function takes a
// request body of at most 4.5 MB (Vercel), and the video provider needs far
// fewer pixels. So the browser shrinks a picked photo before it uploads.
// Browser only: it needs createImageBitmap or <img>, and a canvas.

// The long side a photo is shrunk to; plenty for a 720p video.
export const SHRINK_MAX_SIDE = 2048;
const JPEG_QUALITY = 0.9;

type Size = { width: number; height: number };
type Decoded = Size & { source: CanvasImageSource; close: () => void };

// The size that fits within maxSide on its long side, keeping the shape.
// Never larger than the photo.
export function fitWithin(width: number, height: number, maxSide: number): Size {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// Both ways turn the photo upright by its EXIF orientation. A browser that
// doesn't know imageOrientation: "from-image" throws, and <img> does it.
async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Try <img>.
    }
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
}

type Context = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

// White first, so a transparent PNG doesn't turn black as a JPEG.
function draw(context: Context, source: CanvasImageSource, { width, height }: Size) {
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
}

async function encode(source: CanvasImageSource, size: Size): Promise<Blob | null> {
  if (typeof OffscreenCanvas === "function") {
    const canvas = new OffscreenCanvas(size.width, size.height);
    const context = canvas.getContext("2d");
    if (context) {
      draw(context, source, size);
      return canvas.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  draw(context, source, size);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
}

// The photo as a JPEG with its long side at most SHRINK_MAX_SIDE, when it is
// longer than that or over maxBytes. Otherwise, or if the browser can't
// decode or encode it, or the JPEG isn't smaller, the photo as it was: the
// caller checks the size of what comes back.
export async function shrinkPhoto(file: File, maxBytes: number): Promise<File> {
  let decoded: Decoded;
  try {
    decoded = await decode(file);
  } catch {
    return file;
  }
  try {
    if (Math.max(decoded.width, decoded.height) <= SHRINK_MAX_SIDE && file.size <= maxBytes) return file;
    const blob = await encode(decoded.source, fitWithin(decoded.width, decoded.height, SHRINK_MAX_SIDE));
    if (!blob || blob.type !== "image/jpeg" || blob.size >= file.size) return file;
    const name = `${file.name.replace(/\.[^.]*$/, "")}.jpg`;
    return new File([blob], name, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    decoded.close();
  }
}
