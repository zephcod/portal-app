import { SiFacebook, SiInstagram } from "react-icons/si";

/**
 * Facebook/Instagram glyph, inline with surrounding text. Renders in
 * `currentColor` (no hardcoded brand color) so it fits whatever context
 * it's dropped into — muted list labels, amber headings, white nav chips.
 */
export function PlatformIcon({
  platform,
  className = "h-3 w-3",
}: {
  platform: "fb" | "ig";
  className?: string;
}) {
  const Icon = platform === "fb" ? SiFacebook : SiInstagram;
  return <Icon className={`inline shrink-0 ${className}`} aria-hidden />;
}
