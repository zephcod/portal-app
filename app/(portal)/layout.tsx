import { NavShell, type NavItem } from "@/components/NavShell";
import { getSession } from "@/lib/server-session";

const PORTAL_NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: "overview" },
  { href: "/calendar", label: "Content Hub", icon: "content" },
  { href: "/advertising", label: "Advertising Insights", icon: "advertising" },
  { href: "/insights", label: "Organic Insights", icon: "insights" },
  { href: "/issues", label: "Support Requests", icon: "support" },
];

/** Client portal shell: drawer nav on mobile, sidebar on desktop. */
export default async function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  const companyName = session?.name ?? "Client";

  return (
    <NavShell
      items={PORTAL_NAV}
      subtitle="Client Portal App"
      homeHref="/"
      centerTitle={companyName}
      extra={
        <div className="rounded-md bg-app px-3 py-2">
          <span className="block truncate text-xs font-semibold text-fg/80">
            {companyName}
          </span>
        </div>
      }
    >
      {children}
    </NavShell>
  );
}
