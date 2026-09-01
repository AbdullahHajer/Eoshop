import React from "react";
import { LayoutGrid } from "lucide-react";
import TechCategoryRail from "./TechCategoryRail";
import TechDiscoveryRail from "./TechDiscoveryRail";
import TechHeroLead from "./TechHeroLead";
import TechMarketingCard from "./TechMarketingCard";
import {
  DEFAULT_TECH_BENTO_TOKENS,
  type TechBentoHomeViewModel,
  type TechBentoThemeTokens,
  type TechHeroViewModel,
  type TechMarketingTileViewModel,
} from "./model";
import "./techBento.css";

interface Props {
  model: TechBentoHomeViewModel;
  tokens?: Partial<TechBentoThemeTokens>;
  loading?: boolean;
  onOpenHero: (hero: TechHeroViewModel) => void;
  onOpenMarketingItem: (item: TechMarketingTileViewModel) => void;
  onOpenProducts: () => void;
  onSelectCategory: (category: string) => void;
}

type TechCssProperties = React.CSSProperties & {
  "--tech-background": string;
  "--tech-surface": string;
  "--tech-ink": string;
  "--tech-muted-ink": string;
  "--tech-border": string;
  "--tech-accent": string;
  "--tech-accent-foreground": string;
};

function LoadingState() {
  return (
    <div className="tech-bento-loading" data-tech-bento-loading aria-busy="true" aria-label="جارٍ تحميل مساحات المتجر">
      <span /><span /><span /><span /><span /><span />
    </div>
  );
}

export default function TechBentoHome({
  model,
  tokens,
  loading = false,
  onOpenHero,
  onOpenMarketingItem,
  onOpenProducts,
  onSelectCategory,
}: Props) {
  const resolvedTokens = { ...DEFAULT_TECH_BENTO_TOKENS, ...tokens };
  const style: TechCssProperties = {
    "--tech-background": resolvedTokens.background,
    "--tech-surface": resolvedTokens.surface,
    "--tech-ink": resolvedTokens.ink,
    "--tech-muted-ink": resolvedTokens.mutedInk,
    "--tech-border": resolvedTokens.border,
    "--tech-accent": resolvedTokens.accent,
    "--tech-accent-foreground": resolvedTokens.accentForeground,
  };

  return (
    <div className="tech-bento-home" data-tech-bento-home dir="rtl" style={style}>
      {loading ? <LoadingState /> : (
        <>
          <div className={`tech-bento-stage ${model.sideAds.length === 0 ? "tech-bento-stage--no-ads" : ""}`}>
            <TechCategoryRail categories={model.categories} onSelectCategory={onSelectCategory} />

            <div className="tech-bento-stage__showcase">
              <TechHeroLead hero={model.hero} onOpen={onOpenHero} />
              {model.bentoItems.length > 0 ? (
                <div className="tech-bento-grid" role="list" aria-label="مساحات بنتو الرئيسية" data-tech-bento-count={model.bentoItems.length}>
                  {model.bentoItems.slice(0, 5).map((item, index) => (
                    <div role="listitem" key={item.id}>
                      <TechMarketingCard item={item} variant="bento" index={index} onOpen={onOpenMarketingItem} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tech-bento-empty tech-bento-empty--tiles" data-tech-bento-empty>
                  <LayoutGrid aria-hidden="true" />
                  <p>لم تُنشر مربعات Bento بعد.</p>
                  <button type="button" onClick={onOpenProducts}>استكشف المنتجات</button>
                </div>
              )}
            </div>

            {model.sideAds.length > 0 ? (
              <aside className="tech-ad-rail" aria-label="إعلانات المتجر" data-tech-ad-count={model.sideAds.length}>
                {model.sideAds.slice(0, 2).map((item, index) => (
                  <TechMarketingCard key={item.id} item={item} variant="ad" index={index} onOpen={onOpenMarketingItem} />
                ))}
              </aside>
            ) : null}
          </div>

          <TechDiscoveryRail items={model.discoveryItems} onOpen={onOpenMarketingItem} onOpenAll={onOpenProducts} />
        </>
      )}
    </div>
  );
}
