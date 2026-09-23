import type { PluginTheme } from "@getpaseo/plugin";

import type { IssueSummary, StatusCategory } from "../shared/contracts";

export const COLUMNS: { category: StatusCategory; title: string }[] = [
  { category: "new", title: "To Do" },
  { category: "indeterminate", title: "In Progress" },
  { category: "done", title: "Done" },
  { category: "unknown", title: "Other" },
];

export function groupByCategory(issues: IssueSummary[]) {
  return COLUMNS.map((column) => ({
    ...column,
    issues: issues.filter((issue) => issue.statusCategory === column.category),
  })).filter((column) => column.issues.length > 0 || column.category !== "unknown");
}

export function statusColor(theme: PluginTheme, category: StatusCategory): string {
  if (category === "done") return theme.colors.statusSuccess;
  if (category === "indeterminate") return theme.colors.accent;
  return theme.colors.foregroundMuted;
}

export function priorityColor(theme: PluginTheme, priority: string | null): string {
  const name = (priority ?? "").toLowerCase();
  if (/(highest|blocker|critical|p0)/.test(name)) return theme.colors.statusDanger;
  if (/(high|major|p1)/.test(name)) return theme.colors.statusWarning;
  return theme.colors.foregroundMuted;
}

export function relativeTime(iso: string, now = Date.now()): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return "";
  const seconds = Math.round((now - time) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(time).toISOString().slice(0, 10);
}

const ISSUE_KEY = /^[A-Z][A-Z0-9_]*-\d+$/i;
const JQL_HINT = /(\s(=|!=|~|!~|in|not in|is|was)\s|order\s+by|currentUser\(\))/i;

/** Turns what the user typed in the search box into JQL. */
export function searchTextToJql(text: string): string {
  const trimmed = text.trim();
  if (ISSUE_KEY.test(trimmed)) return `key = ${trimmed.toUpperCase()}`;
  if (JQL_HINT.test(trimmed)) return trimmed;
  return `text ~ "${trimmed.replace(/["\\]/g, "\\$&")}" ORDER BY updated DESC`;
}

export function matchesFilter(issue: IssueSummary, filter: string): boolean {
  const needle = filter.trim().toLowerCase();
  if (needle === "") return true;
  return (
    issue.key.toLowerCase().includes(needle) ||
    issue.summary.toLowerCase().includes(needle) ||
    (issue.assignee?.name.toLowerCase().includes(needle) ?? false) ||
    issue.status.toLowerCase().includes(needle)
  );
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
