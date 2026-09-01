import React from "react";
import { Zap } from "lucide-react";
import { DEFAULT_TECH_BENTO_TOKENS, type TechBentoThemeTokens } from "./model";

export interface TechTrustTickerItem {
  key: string;
  label: string;
}

interface Props {
  items: TechTrustTickerItem[];
  tokens?: Partial<TechBentoThemeTokens>;
}

type TechTrustCssProperties = React.CSSProperties & {
  "--tech-surface": string;
  "--tech-ink": string;
  "--tech-muted-ink": string;
  "--tech-border": string;
  "--tech-accent": string;
};

export default function TechTrustTicker({ items, tokens }: Props) {
  const resolvedTokens = { ...DEFAULT_TECH_BENTO_TOKENS, ...tokens };
  const style: TechTrustCssProperties = {
    "--tech-surface": resolvedTokens.surface,
    "--tech-ink": resolvedTokens.ink,
    "--tech-muted-ink": resolvedTokens.mutedInk,
    "--tech-border": resolvedTokens.border,
    "--tech-accent": resolvedTokens.accent,
  };
  return (
    <section className="tech-trust-ticker" data-tech-trust-ticker aria-labelledby="tech-trust-ticker-title" style={style}>
      <header className="tech-trust-ticker__heading">
        <Zap aria-hidden="true" />
        <h2 id="tech-trust-ticker-title">معلومات الطلب</h2>
      </header>
      {items.length > 0 ? (
        <ul className="tech-trust-ticker__items">
          {items.map((item) => (
            <li key={item.key}>
              <Zap aria-hidden="true" />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      ) : <p className="tech-trust-ticker__empty">لم ينشر المتجر معلومات خدمة بعد.</p>}
    </section>
  );
}
