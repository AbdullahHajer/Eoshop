import React from "react";
import ElegantDiscoveryRail from "./ElegantDiscoveryRail";
import ElegantEditorialHero from "./ElegantEditorialHero";
import { DEFAULT_ELEGANT_STORIES_TOKENS, type ElegantStoriesHomeViewModel, type ElegantStoriesThemeTokens, type ElegantStoryViewModel } from "./model";
import "./elegantStories.css";

interface Props {
  model: ElegantStoriesHomeViewModel;
  tokens?: Partial<ElegantStoriesThemeTokens>;
  boundary?: "all" | "hero" | "categories";
  onOpenStory: (story: ElegantStoryViewModel) => void;
  onOpenIntro: (intro: ElegantStoriesHomeViewModel["intro"]) => void;
  onOpenDiscovery: (item: ElegantStoriesHomeViewModel["discoveryItems"][number]) => void;
  onOpenDiscoveryAll: () => void;
}

type ElegantCssProperties = React.CSSProperties & {
  "--elegant-background": string;
  "--elegant-surface": string;
  "--elegant-ink": string;
  "--elegant-muted-ink": string;
  "--elegant-border": string;
  "--elegant-accent": string;
};

export default function ElegantStoriesHome({ model, tokens, boundary = "all", onOpenStory, onOpenIntro, onOpenDiscovery, onOpenDiscoveryAll }: Props) {
  const resolvedTokens = { ...DEFAULT_ELEGANT_STORIES_TOKENS, ...tokens };
  const style: ElegantCssProperties = {
    "--elegant-background": resolvedTokens.background,
    "--elegant-surface": resolvedTokens.surface,
    "--elegant-ink": resolvedTokens.ink,
    "--elegant-muted-ink": resolvedTokens.mutedInk,
    "--elegant-border": resolvedTokens.border,
    "--elegant-accent": resolvedTokens.accent,
  };

  return (
    <div className={`elegant-stories-home elegant-stories-home--${boundary}`} data-elegant-stories-home data-elegant-stories-boundary={boundary} dir="rtl" style={style}>
      {boundary !== "categories" ? <ElegantEditorialHero intro={model.intro} stories={model.stories} onOpenStory={onOpenStory} onOpenIntro={() => onOpenIntro(model.intro)} onOpenDiscovery={onOpenDiscoveryAll} /> : null}

      {boundary !== "hero" ? <ElegantDiscoveryRail items={model.discoveryItems} onOpen={onOpenDiscovery} onOpenAll={onOpenDiscoveryAll} /> : null}
    </div>
  );
}
