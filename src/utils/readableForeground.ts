const FALLBACK_BACKGROUND = "#0f172a";
const MINIMUM_TEXT_CONTRAST = 4.5;

function normalizeHex(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed.slice(1).split("").map((part) => `${part}${part}`).join("")}`;
  }
  return FALLBACK_BACKGROUND;
}

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function rgb(value: string): [number, number, number] {
  const hex = normalizeHex(value);
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function luminance(value: string): number {
  const [red, green, blue] = rgb(value).map(channel);
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function hexFromRgb(values: number[]): string {
  return `#${values.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function readableForeground(background: string): "#000000" | "#FFFFFF" {
  const hex = normalizeHex(background);
  return contrastRatio("#000000", hex) >= contrastRatio("#FFFFFF", hex) ? "#000000" : "#FFFFFF";
}

export function readableAccent(accent: string, surface = "#FFFFFF"): string {
  const normalizedAccent = normalizeHex(accent);
  const normalizedSurface = normalizeHex(surface);
  if (contrastRatio(normalizedAccent, normalizedSurface) >= MINIMUM_TEXT_CONTRAST) {
    return normalizedAccent.toUpperCase();
  }

  const target = readableForeground(normalizedSurface);
  const sourceChannels = rgb(normalizedAccent);
  const targetChannels = rgb(target);
  for (let step = 1; step <= 50; step += 1) {
    const ratio = step / 50;
    const candidate = hexFromRgb(sourceChannels.map((value, index) => value + ((targetChannels[index] - value) * ratio)));
    if (contrastRatio(candidate, normalizedSurface) >= MINIMUM_TEXT_CONTRAST) return candidate;
  }

  return target;
}
