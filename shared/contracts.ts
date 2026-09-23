/**
 * RPC contracts shared by the app and the daemon. Every Jira call runs on the
 * daemon, so credentials never reach the client bundle.
 */
import { defineAttachmentSource, defineRpc, PluginAttachmentSearchPayloadSchema } from "@getpaseo/plugin";
import { z } from "zod";

export const StatusCategorySchema = z.enum(["new", "indeterminate", "done", "unknown"]);
export type StatusCategory = z.infer<typeof StatusCategorySchema>;

export const PersonSchema = z.object({
  name: z.string(),
  avatarUrl: z.string().nullable(),
});
export type Person = z.infer<typeof PersonSchema>;

export const IssueSummarySchema = z.object({
  key: z.string(),
  url: z.string(),
  summary: z.string(),
  status: z.string(),
  statusCategory: StatusCategorySchema,
  issueType: z.string(),
  issueTypeIconUrl: z.string().nullable(),
  priority: z.string().nullable(),
  priorityIconUrl: z.string().nullable(),
  assignee: PersonSchema.nullable(),
  project: z.string(),
  updated: z.string(),
});
export type IssueSummary = z.infer<typeof IssueSummarySchema>;

export const CommentSchema = z.object({
  id: z.string(),
  author: z.string(),
  authorAvatarUrl: z.string().nullable(),
  created: z.string(),
  body: z.string(),
});
export type Comment = z.infer<typeof CommentSchema>;

export const IssueDetailSchema = IssueSummarySchema.extend({
  reporter: PersonSchema.nullable(),
  created: z.string(),
  labels: z.array(z.string()),
  components: z.array(z.string()),
  parent: z.object({ key: z.string(), summary: z.string() }).nullable(),
  description: z.string(),
  comments: z.array(CommentSchema),
  commentTotal: z.number(),
});
export type IssueDetail = z.infer<typeof IssueDetailSchema>;

export const ConnectionStatusSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("unconfigured"), reason: z.string() }),
  z.object({ state: z.literal("error"), reason: z.string() }),
  z.object({
    state: z.literal("connected"),
    user: z.string(),
    siteUrl: z.string(),
    tokenSource: z.enum(["command", "file", "env"]),
  }),
]);
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

export const connectionStatus = defineRpc({
  name: "jira.status",
  input: z.object({}),
  output: ConnectionStatusSchema,
});

export const searchIssues = defineRpc({
  name: "jira.search",
  input: z.object({
    jql: z.string().min(1),
    maxResults: z.number().int().min(1).max(100).default(50),
  }),
  output: z.object({
    issues: z.array(IssueSummarySchema),
    /** True when Jira has more matches than `maxResults`. */
    truncated: z.boolean(),
  }),
});

export const loadIssue = defineRpc({
  name: "jira.issue",
  input: z.object({ key: z.string().min(1) }),
  output: IssueDetailSchema,
});

export const tokenState = defineRpc({
  name: "jira.token-state",
  input: z.object({}),
  output: z.object({ stored: z.boolean(), env: z.boolean() }),
});

export const saveToken = defineRpc({
  name: "jira.save-token",
  input: z.object({ token: z.string() }),
  output: z.object({ stored: z.boolean() }),
});

/** Loads one Jira image (avatar or icon) on the daemon, with the Jira login when needed. */
export const loadImage = defineRpc({
  name: "jira.image",
  input: z.object({ url: z.string().url().max(2048) }),
  output: z.object({
    /** A `data:` URI, or null when the image cannot be loaded. */
    uri: z.string().nullable(),
    mimeType: z.string().nullable(),
  }),
});

export const searchAttachments = defineRpc({
  name: "jira.attachment-search",
  input: z.object({ query: z.string() }),
  output: PluginAttachmentSearchPayloadSchema,
});

export const jiraAttachments = defineAttachmentSource({
  id: "jira-issue",
  title: "Jira issue",
  icon: "Ticket",
  pickerTitle: "Attach Jira issue",
  searchPlaceholder: "Search by key (ABC-123) or text",
  search: searchAttachments,
});
