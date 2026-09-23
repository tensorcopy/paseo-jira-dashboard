import type { PluginAttachmentItem, RpcInput, RpcOutput } from "@getpaseo/plugin";
import type { PluginSettings } from "@getpaseo/plugin/server";

import type {
  connectionStatus,
  IssueDetail,
  loadIssue,
  saveToken,
  searchAttachments,
  searchIssues,
  tokenState,
} from "../shared/contracts";
import type { connectionSettings } from "../shared/settings";
import { envToken, readStoredToken, writeStoredToken } from "./credentials";
import { JiraClient, JiraConfigError } from "./jira";

type ConnectionSettings = PluginSettings<(typeof connectionSettings)["schema"]>;

const ISSUE_KEY = /^[A-Z][A-Z0-9_]*-\d+$/i;
const ATTACHMENT_LIMIT = 10;
const DEFAULT_ATTACHMENT_JQL = "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC";

export function createHandlers(settings: ConnectionSettings) {
  async function client(): Promise<JiraClient> {
    const state = await settings.read();
    if (state.status !== "ready") throw new JiraConfigError(`Jira settings are invalid: ${state.error}`);
    return new JiraClient(state.values);
  }

  return {
    async status(_input: RpcInput<typeof connectionStatus>): Promise<RpcOutput<typeof connectionStatus>> {
      let jira: JiraClient;
      try {
        jira = await client();
      } catch (error) {
        return { state: "unconfigured", reason: message(error) };
      }
      try {
        const { user, source } = await jira.myself();
        return { state: "connected", user, siteUrl: jira.siteUrl, tokenSource: source };
      } catch (error) {
        return { state: error instanceof JiraConfigError ? "unconfigured" : "error", reason: message(error) };
      }
    },

    async search({ jql, maxResults }: RpcInput<typeof searchIssues>): Promise<RpcOutput<typeof searchIssues>> {
      return (await client()).search(jql, maxResults);
    },

    async issue({ key }: RpcInput<typeof loadIssue>): Promise<RpcOutput<typeof loadIssue>> {
      return (await client()).issue(key.trim().toUpperCase());
    },

    async tokenState(_input: RpcInput<typeof tokenState>): Promise<RpcOutput<typeof tokenState>> {
      return { stored: (await readStoredToken()) !== null, env: envToken() !== null };
    },

    async saveToken({ token }: RpcInput<typeof saveToken>): Promise<RpcOutput<typeof saveToken>> {
      await writeStoredToken(token);
      return { stored: token.trim() !== "" };
    },

    async attachmentSearch({ query }: RpcInput<typeof searchAttachments>): Promise<RpcOutput<typeof searchAttachments>> {
      const jira = await client();
      const trimmed = query.trim();
      if (ISSUE_KEY.test(trimmed)) {
        try {
          return { items: [toAttachment(await jira.issue(trimmed.toUpperCase()))] };
        } catch {
          // Not a real key after all; fall through to a text search.
        }
      }
      const jql =
        trimmed === ""
          ? DEFAULT_ATTACHMENT_JQL
          : `text ~ "${trimmed.replace(/["\\]/g, "\\$&")}" ORDER BY updated DESC`;
      const { issues } = await jira.search(jql, ATTACHMENT_LIMIT);
      const details = await Promise.all(issues.map((issue) => jira.issue(issue.key)));
      return { items: details.map(toAttachment) };
    },
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The full text snapshot an agent receives when the issue is attached to a prompt. */
export function issueToText(issue: IssueDetail): string {
  const lines = [
    `# ${issue.key}: ${issue.summary}`,
    "",
    `URL: ${issue.url}`,
    `Type: ${issue.issueType}`,
    `Status: ${issue.status}`,
    `Priority: ${issue.priority ?? "None"}`,
    `Assignee: ${issue.assignee?.name ?? "Unassigned"}`,
    `Reporter: ${issue.reporter?.name ?? "Unknown"}`,
    `Created: ${issue.created}`,
    `Updated: ${issue.updated}`,
  ];
  if (issue.parent) lines.push(`Parent: ${issue.parent.key} ${issue.parent.summary}`);
  if (issue.labels.length > 0) lines.push(`Labels: ${issue.labels.join(", ")}`);
  if (issue.components.length > 0) lines.push(`Components: ${issue.components.join(", ")}`);
  lines.push("", "## Description", "", issue.description || "(no description)");
  if (issue.comments.length > 0) {
    lines.push("", `## Comments (${issue.comments.length} of ${issue.commentTotal})`);
    for (const comment of issue.comments) {
      lines.push("", `### ${comment.author} — ${comment.created}`, "", comment.body);
    }
  }
  return lines.join("\n");
}

function toAttachment(issue: IssueDetail): PluginAttachmentItem {
  return {
    id: issue.key,
    identifier: issue.key,
    title: issue.summary,
    subtitle: `${issue.status} · ${issue.assignee?.name ?? "Unassigned"}`,
    url: issue.url,
    text: issueToText(issue),
    resourceType: "jira-issue",
  };
}
