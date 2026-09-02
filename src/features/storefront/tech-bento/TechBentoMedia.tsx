import React, { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

interface Props {
  imageUrl?: string;
  mobileImageUrl?: string;
  altText: string;
  priority?: boolean;
  sizes: string;
  focalPointX?: number;
  focalPointY?: number;
  className?: string;
}

export default function TechBentoMedia({
  imageUrl,
  mobileImageUrl,
  altText,
  priority = false,
  sizes,
  focalPointX = 50,
  focalPointY = 50,
  className,
}: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl, mobileImageUrl]);

  if (!imageUrl?.trim() || failed) {
    return (
      <span className={`tech-bento-media tech-bento-media--missing ${className ?? ""}`} data-tech-image-missing role="img" aria-label={`${altText} — الصورة غير متاحة`}>
        <ImageOff aria-hidden="true" />
        <span>الصورة غير متاحة</span>
      </span>
    );
  }

  return (
    <picture className={`tech-bento-media ${className ?? ""}`}>
      {mobileImageUrl?.trim() ? <source media="(max-width: 767px)" srcSet={mobileImageUrl} /> : null}
      <img
        src={imageUrl}
        alt={altText}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        sizes={sizes}
        style={{ objectPosition: `${focalPointX}% ${focalPointY}%` }}
        onError={() => setFailed(true)}
        referrerPolicy="no-referrer"
      />
    </picture>
  );
}
