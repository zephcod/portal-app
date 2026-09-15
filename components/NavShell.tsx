"use client";

/**
 * Responsive navigation shell shared by the team app and the client
 * portal: fixed sidebar on desktop (lg+), hamburger + slide-in drawer
 * on mobile. Ported from the Awaj ET reports app (components/SideNav)
 * so all Awaj tools feel identical on the phone.
 *
 * `extra` renders below the brand block in both the sidebar and the
 * drawer — the team app puts the PageSwitcher there, the client portal
 * its company name.
 */
import * as Dialog from "@radix-ui/react-dialog";
import {
  CalendarDays,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  TrendingUp,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/app/login/actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AwajMark } from "./icons/AwajMark";

// Icon components can't cross the Server → Client boundary as props (they're
// functions, not plain data — see the RSC "Only plain objects..." error),
// so nav items carry a plain string key instead and this client-only map
// resolves it. Same pattern as components/PlatformIcon.tsx's GLYPHS map.
const NAV_ICONS = {
  overview: LayoutDashboard,
  content: CalendarDays,
  advertising: Megaphone,
  insights: TrendingUp,
  support: LifeBuoy,
} as const;

export type NavIconKey = keyof typeof NAV_ICONS;

export interface NavItem {
  href: string;
  label: string;
  icon: NavIconKey;
}

/** Longest matching href wins, so "/client" isn't active on "/client/calendar". */
function activeHref(pathname: string, items: NavItem[]): string | undefined {
  return items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`) || i.href === "/")
    .filter((i) => i.href !== "/" || pathname === "/")
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

function Brand({
  subtitle,
  homeHref,
  collapsed = false,
}: {
  subtitle: string;
  homeHref?: string;
  collapsed?: boolean;
}) {
  const content = collapsed ? (
    <AwajMark className="h-7 w-7 shrink-0" aria-hidden />
  ) : (
    <>
      <div className="flex items-center gap-2">
        <AwajMark className="h-7 w-7 shrink-0" aria-hidden />
        <p className="font-display text-xl font-bold tracking-tight">
          Awaj<span className="text-amber dark:text-gold"> Portal</span>
        </p>
      </div>
      <p className="mt-1 font-mono text-[10px] tracking-[0.18em] text-muted uppercase">
        {subtitle}
      </p>
    </>
  );
  if (homeHref) {
    return (
      <Link
        href={homeHref}
        className="block rounded-md transition-opacity hover:opacity-80"
      >
        {content}
      </Link>
    );
  }
  return <div>{content}</div>;
}

function NavLinks({
  items,
  pathname,
  large = false,
  collapsed = false,
}: {
  items: NavItem[];
  pathname: string;
  large?: boolean;
  collapsed?: boolean;
}) {
  const active = activeHref(pathname, items);
  return (
    <nav className={`flex flex-col gap-1 ${large ? "mt-6" : "px-3"}`}>
      {items.map((item) => {
        const isActive = item.href === active;
        const Icon = NAV_ICONS[item.icon];
        return (
          <Link
            key={item.href}
            href={item.href}
            title={collapsed ? item.label : undefined}
            aria-label={collapsed ? item.label : undefined}
            className={`flex items-center gap-3 rounded-md px-3 transition-colors ${
              collapsed ? "justify-center px-0" : ""
            } ${large ? "py-3 text-[15px]" : "py-2.5 text-sm"} ${
              isActive
                ? "bg-app font-semibold text-fg"
                : "text-muted hover:bg-app hover:text-fg"
            }`}
          >
            <Icon
              className={`h-4 w-4 shrink-0 ${isActive ? "text-amber dark:text-gold" : ""}`}
              aria-hidden
            />
            {!collapsed && item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SignOut({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <form action={logout}>
      <button
        title={collapsed ? "Sign out" : undefined}
        aria-label={collapsed ? "Sign out" : undefined}
        className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] text-muted uppercase transition-colors hover:text-amber"
      >
        <LogOut className="h-3 w-3" aria-hidden />
        {!collapsed && "Sign out"}
      </button>
    </form>
  );
}

function Tagline() {
  return (
    <p className="font-mono text-[10px] leading-relaxed tracking-wider text-muted/70 uppercase">
      From post to profit
      <br />
      <span className="text-amber/70 dark:text-gold/60">Grow with AwajET.</span>
    </p>
  );
}

function CollapseToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="rounded-md p-1.5 text-muted transition hover:bg-app hover:text-fg"
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}

const COLLAPSE_STORAGE_KEY = "sidenav-collapsed";

export function DesktopSidebar({
  items,
  subtitle,
  homeHref,
  extra,
}: {
  items: NavItem[];
  subtitle: string;
  homeHref?: string;
  extra?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true") setCollapsed(true);
    } catch {
      // Private browsing / storage disabled — collapse state just won't persist.
    }
  }, []);

  function toggle() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      } catch {
        // Private browsing / storage disabled — collapse state just won't persist.
      }
      return next;
    });
  }

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-edge bg-card text-fg transition-[width] duration-200 lg:flex print:!hidden ${
        collapsed ? "w-16" : "w-56"
      }`}
    >
      <div className={`flex items-center px-3 pt-6 pb-2 ${collapsed ? "justify-center" : "justify-end"}`}>
        <CollapseToggle collapsed={collapsed} onToggle={toggle} />
      </div>
      <div className={collapsed ? "px-3 pb-4" : "px-6 pb-4"}>
        <Brand subtitle={subtitle} homeHref={homeHref} collapsed={collapsed} />
      </div>
      {extra && !collapsed && <div className="px-3 pb-4">{extra}</div>}
      <NavLinks items={items} pathname={pathname} collapsed={collapsed} />
      <div className={`mt-auto pb-8 ${collapsed ? "px-3" : "px-6"}`}>
        {!collapsed && <Tagline />}
        <div className={`mt-5 flex items-center ${collapsed ? "flex-col gap-3" : "justify-between"}`}>
          <SignOut collapsed={collapsed} />
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

export function DrawerNav({
  items,
  subtitle,
  homeHref,
  extra,
  centerTitle,
}: {
  items: NavItem[];
  subtitle: string;
  homeHref?: string;
  extra?: React.ReactNode;
  /** Text centered in the mobile header (e.g. company name); truncates
   *  with an ellipsis instead of pushing into the menu button or brand. */
  centerTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer whenever navigation happens.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-edge bg-card px-4 py-3 text-fg lg:hidden print:!hidden">
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger
          aria-label="Open menu"
          className="rounded-md p-2 text-muted hover:bg-app hover:text-fg"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </Dialog.Trigger>

        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-navy/60 backdrop-blur-sm" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-card p-6 text-fg shadow-2xl outline-none">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <Dialog.Description className="sr-only">
              Main navigation menu
            </Dialog.Description>

            <div className="flex items-center justify-between">
              <Brand subtitle={subtitle} homeHref={homeHref} />
              <Dialog.Close
                aria-label="Close menu"
                className="rounded-md p-2 text-muted hover:bg-app hover:text-fg"
              >
                <X className="h-4 w-4" aria-hidden />
              </Dialog.Close>
            </div>

            {extra && <div className="mt-4">{extra}</div>}

            <NavLinks items={items} pathname={pathname} large />

            <div className="mt-auto">
              <Tagline />
              <div className="mt-5 flex items-center justify-between">
                <SignOut />
                <ThemeToggle />
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {centerTitle && (
        <div className="min-w-0 flex-1 px-1 text-center">
          <span className="block truncate font-mono text-[11px] font-semibold tracking-[0.08em] text-fg/70 uppercase">
            {centerTitle}
          </span>
        </div>
      )}

      {homeHref ? (
        <Link
          href={homeHref}
          className="flex shrink-0 items-center gap-1.5 font-display text-lg font-bold text-fg transition-opacity hover:opacity-80"
        >
          <AwajMark className="h-6 w-6" aria-hidden />
          Awaj<span className="text-amber dark:text-gold"> Portal</span>
        </Link>
      ) : (
        <span className="flex shrink-0 items-center gap-1.5 font-display text-lg font-bold text-fg">
          <AwajMark className="h-6 w-6" aria-hidden />
          Awaj<span className="text-amber dark:text-gold"> Portal</span>
        </span>
      )}
    </header>
  );
}

/** Full shell: mobile drawer header + desktop sidebar + content column. */
export function NavShell({
  items,
  subtitle,
  homeHref,
  extra,
  centerTitle,
  children,
}: {
  items: NavItem[];
  subtitle: string;
  homeHref?: string;
  extra?: React.ReactNode;
  /** Centered (truncating) text in the mobile header, e.g. company name. */
  centerTitle?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <DrawerNav
        items={items}
        subtitle={subtitle}
        homeHref={homeHref}
        extra={extra}
        centerTitle={centerTitle}
      />
      <div className="flex min-h-screen">
        <DesktopSidebar
          items={items}
          subtitle={subtitle}
          homeHref={homeHref}
          extra={extra}
        />
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 lg:px-12 lg:py-8 print:p-0">
          {children}
        </main>
      </div>
    </>
  );
}
