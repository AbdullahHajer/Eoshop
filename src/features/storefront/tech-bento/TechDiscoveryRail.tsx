import React from "react";
import { ArrowLeft } from "lucide-react";
import { marketingDisclosureLabel, type TechMarketingTileViewModel } from "./model";
import TechBentoMedia from "./TechBentoMedia";

interface Props {
  items: TechMarketingTileViewModel[];
  onOpen: (item: TechMarketingTileViewModel) => void;
  onOpenAll: () => void;
}

export default function TechDiscoveryRail({ items, onOpen, onOpenAll }: Props) {
  const visibleItems = items.slice(0, 10);

  return (
    <section className="tech-discovery" data-tech-discovery aria-labelledby="tech-discovery-title">
      <div className="tech-discovery__heading">
        <div>
          <span>استكشف بسرعة</span>
          <h2 id="tech-discovery-title">دوائر الاكتشاف</h2>
        </div>
        <button type="button" onClick={onOpenAll}>كل المنتجات <ArrowLeft aria-hidden="true" /></button>
      </div>

      {visibleItems.length > 0 ? (
        <div className="tech-discovery__rail" role="list" aria-label="دوائر الاكتشاف">
          {visibleItems.map((item) => {
            const disclosure = marketingDisclosureLabel(item.disclosure, item.sponsorName);
            return (
              <article key={item.id} role="listitem" className="tech-discovery-item" data-tech-discovery-id={item.id}>
                <button type="button" onClick={() => onOpen(item)} aria-label={`فتح ${item.title}`}>
                  <span className="tech-discovery-item__image">
                    <TechBentoMedia
                      imageUrl={item.imageUrl}
                      mobileImageUrl={item.mobileImageUrl}
                      altText={item.altText}
                      sizes="(max-width: 767px) 28vw, (max-width: 1199px) 15vw, 9vw"
                      focalPointX={item.focalPointX}
                      focalPointY={item.focalPointY}
                    />
                  </span>
                  <strong>{item.title}</strong>
                  {disclosure || item.badge?.trim() ? <small>{disclosure || item.badge}</small> : null}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="tech-bento-empty tech-bento-empty--discovery" data-tech-discovery-empty>
          <p>ستظهر عناصر الاكتشاف هنا عند نشرها.</p>
          <button type="button" onClick={onOpenAll}>تصفح المنتجات المتاحة</button>
        </div>
      )}
    </section>
  );
}
