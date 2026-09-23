/**
 * Host settings. These are plain JSON on the daemon, so they hold no secrets:
 * the API token lives in a 0600 file written by `jira.save-token`, in
 * `JIRA_API_TOKEN`, or comes from `tokenCommand`.
 */
import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const SavedQuerySchema = z.object({
  name: z.string().min(1),
  jql: z.string().min(1),
});
export type SavedQuery = z.infer<typeof SavedQuerySchema>;

/** The field the board sorts on. "query" keeps the ORDER BY of the query. */
export const SortFieldSchema = z.enum(["query", "updated", "created", "priority", "key"]);
export type SortField = z.infer<typeof SortFieldSchema>;

export const SortDirectionSchema = z.enum(["asc", "desc"]);
export type SortDirection = z.infer<typeof SortDirectionSchema>;

export const DEFAULT_QUERIES: SavedQuery[] = [
  {
    name: "Assigned to me",
    jql: "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC",
  },
  {
    name: "Reported by me",
    jql: "reporter = currentUser() AND resolution = Unresolved ORDER BY updated DESC",
  },
  {
    name: "Watching",
    jql: "watcher = currentUser() AND resolution = Unresolved ORDER BY updated DESC",
  },
  {
    name: "Recently updated",
    jql: "(assignee = currentUser() OR reporter = currentUser()) AND updated >= -14d ORDER BY updated DESC",
  },
];

export const connectionSettings = defineSettings({
  id: "connection",
  scope: "host",
  version: 1,
  schema: z.object({
    /** Browser URL of the site, for example https://acme.atlassian.net. */
    siteUrl: z.string().default(""),
    /** REST base when it differs from `siteUrl`, for example a proxy. Empty means `siteUrl`. */
    apiBaseUrl: z.string().default(""),
    /**
     * REST API version. "auto" uses 3 for Atlassian Cloud hosts and 2 for
     * other hosts. Set it explicitly when the API base is a proxy.
     */
    apiVersion: z.enum(["auto", "2", "3"]).default("auto"),
    /** Account email. Set it for Jira Cloud API tokens (basic auth); leave it empty for bearer tokens. */
    email: z.string().default(""),
    /** Optional shell command that prints a token on stdout. Runs on the daemon. */
    tokenCommand: z.string().default(""),
  }),
});

export const boardSettings = defineSettings({
  id: "board",
  scope: "host",
  version: 1,
  schema: z.object({
    queries: z.array(SavedQuerySchema).default(DEFAULT_QUERIES),
    /** Index into `queries` that the board opens on. */
    selectedQuery: z.number().int().min(0).default(0),
    sortField: SortFieldSchema.default("query"),
    sortDirection: SortDirectionSchema.default("desc"),
  }),
});
