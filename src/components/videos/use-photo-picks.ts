"use client";

import { useEffect, useRef, useState } from "react";
import { fitsImageLimits, type ImageLimits } from "@/lib/image-limits";
import { shrinkPhoto } from "@/lib/shrink-photo";

// 图1 stands on the left, 图2 on the right.
export type Side = "left" | "right";

// Why a pick was dropped: over the pick limit, still over the upload limit
// after shrinking, or outside the pixel limits.
export type PickError = "invalid" | "tooLarge" | "imageSize";

type Options = {
  // The largest file a visitor may pick.
  maxPickBytes: number;
  // The largest file the server takes, which the photo is shrunk to fit.
  maxUploadBytes: number;
  imageLimits: ImageLimits;
  // Why a pick was dropped, or null when a new pick clears it.
  onError: (error: PickError | null) => void;
};

const empty = { left: null, right: null };

// The photo per side of a video form, with a preview URL each. A file over
// the pick limit is dropped at once. Otherwise the browser shrinks it
// (shrinkPhoto), and the shrunk file is the one previewed, saved and sent:
// it is dropped if it is still over the upload limit or outside the pixel
// limits. The side stays empty until then.
export function usePhotoPicks({ maxPickBytes, maxUploadBytes, imageLimits, onError }: Options) {
  const [photos, setPhotos] = useState<Record<Side, File | null>>(empty);
  const [previews, setPreviews] = useState<Record<Side, string | null>>(empty);
  // The latest pick per side, so slow work on an earlier file changes nothing.
  const picked = useRef<Record<Side, File | null>>({ ...empty });

  useEffect(
    () => () => {
      for (const url of Object.values(previews)) if (url) URL.revokeObjectURL(url);
    },
    [previews],
  );

  async function prepare(file: File): Promise<File | PickError> {
    const sent = await shrinkPhoto(file, maxUploadBytes);
    if (sent.size > maxUploadBytes) return "tooLarge";
    if ((await fitsImageLimits(sent, imageLimits)) === false) return "imageSize";
    return sent;
  }

  function pick(side: Side, file: File | null) {
    onError(null);
    const tooBig = file !== null && file.size > maxPickBytes;
    if (tooBig) onError("invalid");
    picked.current[side] = tooBig ? null : file;
    setPhotos((current) => ({ ...current, [side]: null }));
    setPreviews((current) => ({ ...current, [side]: null }));
    if (!file || tooBig) return;
    void prepare(file).then((result) => {
      if (picked.current[side] !== file) return;
      if (typeof result === "string") {
        picked.current[side] = null;
        onError(result);
        return;
      }
      setPhotos((current) => ({ ...current, [side]: result }));
      setPreviews((current) => ({ ...current, [side]: URL.createObjectURL(result) }));
    });
  }

  return { photos, previews, pick };
}
