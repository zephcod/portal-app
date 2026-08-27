import {
  FacebookGlyph,
  InstagramGlyph,
  LinkedInGlyph,
  TikTokGlyph,
  WebGlyph,
  YouTubeGlyph,
} from "@/components/icons/BrandGlyphs";

const GLYPHS = {
  fb: FacebookGlyph,
  ig: InstagramGlyph,
  li: LinkedInGlyph,
  tt: TikTokGlyph,
  yt: YouTubeGlyph,
  web: WebGlyph,
} as const;

export type Platform = keyof typeof GLYPHS;

/**
 * Platform glyph, inline with surrounding text. Uses the full-color
 * brand marks ported from the marketing site (see
 * components/icons/BrandGlyphs.tsx) so the Content Hub, dashboard, and
 * post-detail pages match the Social Platform Manager app's icon set
 * instead of the generic react-icons/si outline glyphs.
 *
 * "li"/"tt"/"yt"/"web" are wired here ahead of any actual data for
 * those platforms reaching this app — portal-app's data layer
 * (lib/data.ts) doesn't source their posts or insights yet. This just
 * means the icon is ready once it does; see CalendarView.tsx's legend
 * for where they're previewed as upcoming platforms.
 */
export function PlatformIcon({
  platform,
  className = "h-3 w-3",
}: {
  platform: Platform;
  className?: string;
}) {
  const Icon = GLYPHS[platform];
  return <Icon className={`inline shrink-0 ${className}`} aria-hidden />;
}
