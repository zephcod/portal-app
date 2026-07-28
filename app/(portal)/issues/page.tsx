import { notFound } from "next/navigation";
import { IssueStatusChip } from "@/components/IssueStatusChip";
import SubmitButton from "@/components/SubmitButton";
import { getCompany, getIssues } from "@/lib/data";
import { getSession } from "@/lib/server-session";
import { submitIssue } from "./actions";

export const dynamic = "force-dynamic";

const inputCls =
  "w-full rounded-md border border-edge bg-input px-3 py-2 text-sm text-fg focus:border-gold focus:outline-none";

export default async function IssuesPage() {
  const session = await getSession();
  if (!session) notFound();
  const company = await getCompany(session.cid);
  if (!company) notFound();

  const issues = await getIssues(company.$id);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="font-display text-sm font-semibold text-amber">
          Awaj ET · {company.name}
        </p>
        <h1 className="font-display mt-1 text-3xl font-bold">Issues</h1>
        <p className="mt-1 text-sm text-muted">
          Spotted something off in your report, or have a campaign request?
          Raise it here and the Awaj ET team will follow up.
        </p>
      </header>

      <section className="rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-6">
        <h2 className="font-display mb-4 text-lg font-semibold">Raise an issue</h2>
        <form action={submitIssue} className="space-y-3">
          <input type="hidden" name="companyId" value={company.$id} />
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Subject</span>
            <input
              name="title"
              required
              maxLength={256}
              placeholder="e.g. Lead count looks low for last week"
              className={inputCls}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Details</span>
            <textarea
              name="body"
              required
              rows={4}
              maxLength={4096}
              placeholder="What did you notice, and when?"
              className={inputCls}
            />
          </label>
          <SubmitButton>Submit issue</SubmitButton>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="font-display mb-3 text-lg font-semibold">Your issues</h2>
        {issues.length === 0 && (
          <div className="rounded-xl border border-edge bg-card px-6 py-8 text-center text-sm text-muted shadow-sm">
            Nothing raised yet.
          </div>
        )}
        <ul className="space-y-3">
          {issues.map((issue) => (
            <li
              key={issue.$id}
              className="rounded-xl border border-edge bg-card p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{issue.title}</p>
                <IssueStatusChip status={issue.status} />
              </div>
              <p className="mt-1 text-xs text-muted">
                {new Date(issue.$createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-fg/90">
                {issue.body}
              </p>
              {issue.response && (
                <div className="mt-3 rounded-lg bg-app p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber">
                    Awaj ET replied
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">
                    {issue.response}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
