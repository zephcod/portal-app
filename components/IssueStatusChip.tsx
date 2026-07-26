import { ISSUE_STATUS_LABELS, type IssueStatus } from "@/lib/domain";

const STYLES: Record<IssueStatus, string> = {
  open: "bg-amber/15 text-amber",
  in_progress: "bg-gold/20 text-charcoal",
  resolved: "bg-charcoal/10 text-warmgray",
};

export function IssueStatusChip({ status }: { status: IssueStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${STYLES[status]}`}>
      {ISSUE_STATUS_LABELS[status]}
    </span>
  );
}
