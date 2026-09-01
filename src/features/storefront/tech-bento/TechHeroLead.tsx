import React from "react";
import { ArrowLeft, Sparkles } from "lucide-react";
import type { TechHeroViewModel } from "./model";
import TechBentoMedia from "./TechBentoMedia";

interface Props {
  hero: TechHeroViewModel;
  onOpen: (hero: TechHeroViewModel) => void;
}

export default function TechHeroLead({ hero, onOpen }: Props) {
  const hasImage = Boolean(hero.imageUrl?.trim());
  const safeOverlayOpacity = Math.max(0.58, hero.overlayOpacity / 100);

  return (
    <section
      className={`tech-bento-hero tech-bento-hero--${hero.height}`}
      data-storefront-hero
      data-storefront-hero-height={hero.height}
      aria-labelledby="tech-bento-hero-title"
    >
      {hasImage ? (
        <TechBentoMedia
          imageUrl={hero.imageUrl}
          mobileImageUrl={hero.mobileImageUrl}
          altText=""
          priority
          sizes="(max-width: 767px) 100vw, (max-width: 1199px) 62vw, 48vw"
          focalPointX={hero.focalPointX}
          focalPointY={hero.focalPointY}
          className="tech-bento-hero__media"
        />
      ) : (
        <span className="tech-bento-hero__signal" aria-hidden="true"><Sparkles /></span>
      )}
      {hasImage ? <span className="tech-bento-hero__overlay" aria-hidden="true" style={{ opacity: safeOverlayOpacity }} /> : null}

      <div className="tech-bento-hero__content" data-tech-hero-has-image={hasImage ? "true" : "false"}>
        {hero.badge ? <span className="tech-bento-hero__badge">{hero.badge}</span> : null}
        <h1
          id="tech-bento-hero-title"
          style={{ color: hasImage ? "#FFFFFF" : "var(--tech-ink)", textShadow: hasImage ? "0 2px 18px rgba(0,0,0,0.78)" : undefined }}
        >
          {hero.title}
        </h1>
        {hero.subtitle ? <p>{hero.subtitle}</p> : null}
        <button type="button" onClick={() => onOpen(hero)}>
          <span>{hero.ctaLabel}</span>
          <ArrowLeft aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
