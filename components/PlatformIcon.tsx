import { FacebookGlyph, InstagramGlyph } from "@/components/icons/BrandGlyphs";

/**
 * Facebook/Instagram glyph, inline with surrounding text. Uses the
 * full-color brand marks ported from the marketing site (see
 * components/icons/BrandGlyphs.tsx) so the Content Hub, dashboard, and
 * post-detail pages match fb-scheduler's icon set instead of the generic
 * react-icons/si outline glyphs.
 */
export function PlatformIcon({
  platform,
  className = "h-3 w-3",
}: {
  platform: "fb" | "ig";
  className?: string;
}) {
  const Icon = platform === "fb" ? FacebookGlyph : InstagramGlyph;
  return <Icon className={`inline shrink-0 ${className}`} aria-hidden />;
}
