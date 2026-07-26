import { Slot } from "@radix-ui/react-slot";

/**
 * Pulsing placeholder block. Pass `asChild` to inherit an existing
 * element's box (e.g. size/shape from a real card) instead of rendering
 * its own `div`, so loading states can mirror the loaded layout exactly.
 */
export function Skeleton({
  className = "",
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      className={`animate-pulse rounded-md bg-charcoal/10 ${className}`}
      {...props}
    />
  );
}
