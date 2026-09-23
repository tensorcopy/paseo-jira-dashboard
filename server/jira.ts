/**
 * Minimal Jira REST client. Jira Cloud uses API v3 and the enhanced
 * `/search/jql` endpoint; Server and Data Center use API v2 and `/search`.
 */
import type {
  Comment,
  IssueDetail,
  IssueSummary,
  Person,
  StatusCategory,
} from "../shared/contracts";
import { richTextToString } from "./adf";
import { forgetCommandToken, resolveToken, type TokenSource } from "./credentials";

export interface ConnectionConfig {
  siteUrl: string;
  apiBaseUrl: string;
  apiVersion: "auto" | "2" | "3";
  email: string;
  tokenCommand: string;
}

export class JiraConfigError extends Error {}

const SUMMARY_FIELDS = [
  "summary",
  "status",
  "issuetype",
  "priority",
  "assignee",
  "project",
  "updated",
];

const DETAIL_FIELDS = [
  ...SUMMARY_FIELDS,
  "reporter",
  "created",
  "labels",
  "components",
  "parent",
  "description",
  "comment",
];

const REQUEST_TIMEOUT_MS = 30 * 1000;
const MAX_COMMENTS = 20;

function stripSlash(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export class JiraClient {
  readonly siteUrl: string;
  private readonly apiBase: string;
  private readonly cloud: boolean;

  constructor(private readonly config: ConnectionConfig) {
    this.siteUrl = stripSlash(config.siteUrl || config.apiBaseUrl);
    this.apiBase = stripSlash(config.apiBaseUrl || config.siteUrl);
    if (this.apiBase === "") {
      throw new JiraConfigError("Set the Jira site URL in Settings → Jira.");
    }
    let host: string;
    try {
      host = new URL(this.apiBase).hostname;
    } catch {
      throw new JiraConfigError(`"${this.apiBase}" is not a valid URL.`);
    }
    this.cloud =
      config.apiVersion === "auto" ? /\.atlassian\.(net|com)$/.test(host) : config.apiVersion === "3";
  }

  private get api(): string {
    return `${this.apiBase}/rest/api/${this.cloud ? 3 : 2}`;
  }

  browseUrl(key: string): string {
    return `${this.siteUrl}/browse/${encodeURIComponent(key)}`;
  }

  private async authorization(): Promise<{ header: string; source: TokenSource }> {
    const resolved = await resolveToken(this.config.tokenCommand);
    if (!resolved) {
      throw new JiraConfigError("No Jira API token. Save one in Settings → Jira.");
    }
    const email = this.config.email.trim();
    const header =
      email === ""
        ? `Bearer ${resolved.token}`
        : `Basic ${Buffer.from(`${email}:${resolved.token}`).toString("base64")}`;
    return { header, source: resolved.source };
  }

  async request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    return (await this.requestWithSource<T>(path, init)).data;
  }

  async requestWithSource<T>(
    path: string,
    init: { method?: string; body?: unknown } = {},
    retried = false,
  ): Promise<{ data: T; source: TokenSource }> {
    const auth = await this.authorization();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const response = await fetch(`${this.api}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Accept: "application/json",
        Authorization: auth.header,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: init.body === undefined ? null : JSON.stringify(init.body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (response.status === 401 && auth.source === "command" && !retried) {
      forgetCommandToken();
      return this.requestWithSource(path, init, true);
    }
    if (!response.ok) {
      let message = await describeFailure(response);
      if ((response.status === 401 || response.status === 403) && this.cloud && this.config.email.trim() === "") {
        message += " Jira Cloud API tokens need the account email. Set Account email in Settings → Jira.";
      }
      throw new Error(message);
    }
    return { data: (await response.json()) as T, source: auth.source };
  }

  async myself(): Promise<{ user: string; source: TokenSource }> {
    const { data, source } = await this.requestWithSource<RawUser>("/myself");
    return { user: data.displayName ?? data.emailAddress ?? data.name ?? "unknown", source };
  }

  async search(jql: string, maxResults: number): Promise<{ issues: IssueSummary[]; truncated: boolean }> {
    if (this.cloud) {
      const data = await this.request<{ issues?: RawIssue[]; nextPageToken?: string; isLast?: boolean }>(
        "/search/jql",
        { method: "POST", body: { jql, maxResults, fields: SUMMARY_FIELDS } },
      );
      const issues = (data.issues ?? []).map((issue) => this.toSummary(issue));
      return { issues, truncated: data.isLast === false || Boolean(data.nextPageToken) };
    }
    const data = await this.request<{ issues?: RawIssue[]; total?: number }>("/search", {
      method: "POST",
      body: { jql, maxResults, fields: SUMMARY_FIELDS },
    });
    const issues = (data.issues ?? []).map((issue) => this.toSummary(issue));
    return { issues, truncated: (data.total ?? 0) > issues.length };
  }

  async issue(key: string): Promise<IssueDetail> {
    const raw = await this.request<RawIssue>(
      `/issue/${encodeURIComponent(key)}?fields=${DETAIL_FIELDS.join(",")}`,
    );
    const fields = raw.fields ?? {};
    const rawComments = fields.comment?.comments ?? [];
    const comments: Comment[] = rawComments.slice(-MAX_COMMENTS).map((comment) => ({
      id: String(comment.id ?? ""),
      author: comment.author?.displayName ?? "Unknown",
      created: comment.created ?? "",
      body: richTextToString(comment.body),
    }));
    return {
      ...this.toSummary(raw),
      reporter: person(fields.reporter),
      created: fields.created ?? "",
      labels: fields.labels ?? [],
      components: (fields.components ?? []).map((component) => component.name ?? "").filter(Boolean),
      parent: fields.parent?.key
        ? { key: fields.parent.key, summary: fields.parent.fields?.summary ?? "" }
        : null,
      description: richTextToString(fields.description),
      comments,
      commentTotal: fields.comment?.total ?? rawComments.length,
    };
  }

  private toSummary(raw: RawIssue): IssueSummary {
    const fields = raw.fields ?? {};
    const key = raw.key ?? "";
    return {
      key,
      url: this.browseUrl(key),
      summary: fields.summary ?? "",
      status: fields.status?.name ?? "Unknown",
      statusCategory: statusCategory(fields.status?.statusCategory?.key),
      issueType: fields.issuetype?.name ?? "Issue",
      priority: fields.priority?.name ?? null,
      assignee: person(fields.assignee),
      project: fields.project?.key ?? key.split("-")[0] ?? "",
      updated: fields.updated ?? "",
    };
  }
}

function statusCategory(key: string | undefined): StatusCategory {
  return key === "new" || key === "indeterminate" || key === "done" ? key : "unknown";
}

function person(user: RawUser | null | undefined): Person | null {
  if (!user) return null;
  return {
    name: user.displayName ?? user.name ?? "Unknown",
    avatarUrl: user.avatarUrls?.["48x48"] ?? null,
  };
}

async function describeFailure(response: Response): Promise<string> {
  let detail = "";
  try {
    const body = (await response.json()) as { errorMessages?: string[]; errors?: Record<string, string>; message?: string };
    detail = [...(body.errorMessages ?? []), ...Object.values(body.errors ?? {}), body.message ?? ""]
      .filter(Boolean)
      .join(" ");
  } catch {
    // Non-JSON error page; the status line is enough.
  }
  if (response.status === 401) return `Jira rejected the credentials (401). ${detail}`.trim();
  if (response.status === 403) return `Jira denied access (403). ${detail}`.trim();
  if (response.status === 404) return `Not found in Jira (404). ${detail}`.trim();
  return `Jira request failed (${response.status}). ${detail}`.trim();
}

interface RawUser {
  displayName?: string;
  emailAddress?: string;
  name?: string;
  avatarUrls?: Record<string, string>;
}

interface RawIssue {
  key?: string;
  fields?: {
    summary?: string;
    status?: { name?: string; statusCategory?: { key?: string } };
    issuetype?: { name?: string };
    priority?: { name?: string } | null;
    assignee?: RawUser | null;
    reporter?: RawUser | null;
    project?: { key?: string };
    updated?: string;
    created?: string;
    labels?: string[];
    components?: { name?: string }[];
    parent?: { key?: string; fields?: { summary?: string } };
    description?: unknown;
    comment?: {
      total?: number;
      comments?: { id?: string | number; author?: RawUser; created?: string; body?: unknown }[];
    };
  };
}
