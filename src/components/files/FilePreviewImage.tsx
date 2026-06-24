"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FilePreviewImageProps = {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  onFailed?: () => void;
};

/** Превью с учётом кэша браузера: onLoad не всегда срабатывает после F5. */
export function FilePreviewImage({
  src,
  alt = "",
  className,
  imgClassName,
  onFailed,
}: FilePreviewImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
  }, [src]);

  useLayoutEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setLoading(false);
    }
  }, [src]);

  return (
    <div className={cn("relative", className)}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        key={src}
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={cn(imgClassName, loading && "opacity-0")}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          onFailed?.();
        }}
        draggable={false}
      />
    </div>
  );
}
