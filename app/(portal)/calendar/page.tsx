import CalendarView from "@/components/CalendarView";
import PostsList from "@/components/PostsList";
import { getClientPage } from "@/lib/clientpage";

export const dynamic = "force-dynamic";

export default async function ClientCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const ctx = await getClientPage();
  const error = ctx
    ? null
    : "Your account isn't linked to a page yet — contact your Awaj ET account manager.";

  return (
    <div>
      <h1 className="text-2xl font-bold">Content calendar</h1>
      <p className="mt-1 text-sm text-muted">
        {ctx?.page.name ?? "Your page"} · scheduled and published posts,
        ET time.
      </p>
      <div className="mt-4">
        <CalendarView
          page={ctx?.page ?? null}
          error={error}
          monthParam={m}
          basePath="/calendar"
          readOnly
        />
      </div>

      <hr className="mt-10 border-edge" />

      <div className="mt-8">
        <PostsList page={ctx?.page ?? null} error={error} />
      </div>
    </div>
  );
}
