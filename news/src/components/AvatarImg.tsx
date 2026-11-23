"use client";

import { useEffect, useRef, useState } from "react";
import { EMPTY_AVATAR } from "@/lib/avatar";

// Profile photo that degrades to a generic avatar when the URL fails to load.
export default function AvatarImg({
  src,
  className,
  alt = "",
}: {
  src?: string;
  className?: string;
  alt?: string;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [failedSrc, setFailedSrc] = useState<string>();
  const failed = failedSrc === src;
  useEffect(() => {
    const img = ref.current;
    if (src && img?.complete && img.naturalWidth === 0) setFailedSrc(src);
  }, [src]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={!src || failed ? EMPTY_AVATAR : src}
      alt={alt}
      className={className}
      onError={() => setFailedSrc(src)}
    />
  );
}
