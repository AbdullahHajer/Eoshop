import React from "react";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { readableAccent } from "../../../utils/readableForeground";
import { marketingDisclosureLabel, type TechMarketingTileViewModel } from "./model";
import TechBentoMedia from "./TechBentoMedia";

interface Props {
  key?: React.Key;
  item: TechMarketingTileViewModel;
  variant: "bento" | "ad";
  index: number;
  onOpen: (item: TechMarketingTileViewModel) => void;
}

const bentoSurfaces = ["#1473E6", "#16856B", "#EC665E", "#6575DD", "#92B526"];
const adSurfaces = ["#071B35", "#80654F"];

export default function TechMarketingCard({ item, variant, index, onOpen }: Props) {
  const fallbackSurface = variant === "ad" ? adSurfaces[index % adSurfaces.length] : bentoSurfaces[index % bentoSurfaces.length];
  const surface = item.backgroundColor || fallbackSurface;
  const foreground = readableAccent(item.foregroundColor || "#FFFFFF", surface);
  const disclosure = marketingDisclosureLabel(item.disclosure, item.sponsorName);
  const descriptionId = item.subtitle?.trim() ? `tech-card-description-${item.id}` : undefined;

  return (
    <article
      className={`tech-marketing-card tech-marketing-card--${variant}`}
      data-tech-marketing-id={item.id}
      data-tech-marketing-placement={variant === "ad" ? "side_ad" : "hero_bento"}
      style={{ backgroundColor: surface, color: foreground }}
    >
      {item.derivedFromCategory ? (
        <span className="tech-marketing-card__category-art" role="img" aria-label={item.altText} data-tech-category-fallback>
          <LayoutGrid aria-hidden="true" />
        </span>
      ) : (
        <TechBentoMedia
          imageUrl={item.imageUrl}
          mobileImageUrl={item.mobileImageUrl}
          altText={item.altText}
          priority={variant === "bento" && index === 0}
          sizes={variant === "ad" ? "(max-width: 767px) 82vw, 17vw" : "(max-width: 767px) 76vw, (max-width: 1199px) 35vw, 17vw"}
          focalPointX={item.focalPointX}
          focalPointY={item.focalPointY}
        />
      )}
      <span className="tech-marketing-card__shade" aria-hidden="true" style={{ background: `linear-gradient(180deg, rgba(0,0,0,${Math.min(0.28, item.overlayOpacity / 300)}) 0%, ${surface} 100%)` }} />
      <div className="tech-marketing-card__content">
        <div className="tech-marketing-card__meta">
          {disclosure ? <span>{disclosure}</span> : null}
          {!disclosure && item.badge?.trim() ? <span>{item.badge}</span> : null}
        </div>
        <div className="tech-marketing-card__copy">
          <h2>{item.title}</h2>
          {item.subtitle?.trim() ? <p id={descriptionId}>{item.subtitle}</p> : null}
        </div>
        <button type="button" aria-describedby={descriptionId} onClick={() => onOpen(item)} aria-label={`${item.ctaLabel}: ${item.title}`}>
          <span>{item.ctaLabel}</span>
          <ArrowLeft aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}
