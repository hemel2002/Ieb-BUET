"use client";

import { useEffect, useRef, useState } from "react";
import { PhotoPlaceholder } from "./PhotoPlaceholder";

type Props = {
  photoKey: string | null;
  name: string;
  /** CSS sizes attribute; the browser picks the 400w or 800w file. */
  sizes: string;
  priority?: boolean;
  className?: string;
};

/** 4:5 portrait. Falls back to the placeholder when there is no photo or it fails to load. */
export function CandidatePhoto({ photoKey, name, sizes, priority, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // An image can fail before React hydrates, in which case onError never fires.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [photoKey]);

  const showPhoto = photoKey && !failed;
  return (
    <div className={`relative aspect-[4/5] overflow-hidden bg-canvas ${className}`}>
      {showPhoto ? (
        <img
          ref={imgRef}
          src={`/media/candidates/${photoKey}-800.webp`}
          srcSet={`/media/candidates/${photoKey}-400.webp 400w, /media/candidates/${photoKey}-800.webp 800w`}
          sizes={sizes}
          width={800}
          height={1000}
          alt={`Photograph of ${name}`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <PhotoPlaceholder label={`No photograph available for ${name}`} />
      )}
    </div>
  );
}
