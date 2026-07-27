import { ISSUE_STATUS_LABELS, type IssueStatus } from "@/lib/domain";

const STYLES: Record<IssueStatus, string> = {
  open: "bg-amber/15 text-amber",
  in_review: "bg-gold/20 text-fg",
  resolved: "bg-charcoal/10 text-muted",
  approved: "bg-green-100 text-green-700",
};

export function IssueStatusChip({ status }: { status: IssueStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${STYLES[status]}`}>
      {ISSUE_STATUS_LABELS[status]}
    </span>
  );
}
