import { FacebookGlyph, InstagramGlyph, LinkedInGlyph } from "@/components/icons/BrandGlyphs";

/**
 * Facebook/Instagram/LinkedIn glyph, inline with surrounding text. Uses
 * the full-color brand marks ported from the marketing site (see
 * components/icons/BrandGlyphs.tsx) so the Content Hub, dashboard, and
 * post-detail pages match the Social Platform Manager app's icon set
 * instead of the generic react-icons/si outline glyphs.
 *
 * "li" is wired here ahead of any actual LinkedIn data reaching this
 * app — Social Platform Manager owns posting/queueing (see its lib/linkedin.ts),
 * and portal-app's data layer (lib/data.ts) doesn't source LinkedIn
 * posts or insights yet. This just means the icon is ready once it does.
 */
export function PlatformIcon({
  platform,
  className = "h-3 w-3",
}: {
  platform: "fb" | "ig" | "li";
  className?: string;
}) {
  const Icon =
    platform === "fb" ? FacebookGlyph : platform === "ig" ? InstagramGlyph : LinkedInGlyph;
  return <Icon className={`inline shrink-0 ${className}`} aria-hidden />;
}
