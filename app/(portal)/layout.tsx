import { NavShell } from "@/components/NavShell";
import { getSession } from "@/lib/server-session";

const PORTAL_NAV = [
  { href: "/", label: "Overview", code: "01" },
  { href: "/calendar", label: "Content Hub", code: "02" },
  { href: "/advertising", label: "Advertising Insights", code: "03" },
  { href: "/insights", label: "Organic Insights", code: "04" },
  { href: "/issues", label: "Support Requests", code: "05" },
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
      subtitle="Client Portal"
      homeHref="/"
      centerTitle={companyName}
      extra={
        <div className="rounded-md bg-white/5 px-3 py-2">
          <span className="block truncate text-xs font-semibold text-white/80">
            {companyName}
          </span>
        </div>
      }
    >
      {children}
    </NavShell>
  );
}
