# Jira dashboard for Paseo

A [Paseo](https://paseo.sh) plugin that shows your Jira tickets.

- **Board** in the sidebar. Issues are grouped into To Do, In Progress, and Done columns. On a phone or a narrow window, the columns stack.
- **Saved queries** show as tabs: Assigned to me, Reported by me, Watching, and Recently updated. You can add your own JQL queries.
- **Filter and search.** Type to filter the current list. Press Enter to search Jira with free text, an issue key (`ABC-123`), or raw JQL.
- **Jira images.** Cards and the issue detail show avatars and the issue type and priority icons from Jira. When an image cannot be loaded, the plugin shows initials or the priority name. iOS and Android cannot draw SVG icons, so they show the priority name.
- **Issue detail** with fields, labels, the description, and the latest comments. Buttons open the issue in Jira or copy its key.
- **Composer attachment.** Attach a Jira issue to an agent prompt. The agent gets a Markdown snapshot of the issue and its comments.
- **Command Center** items: "Open Jira board" and "Jira settings".

It works with Jira Cloud (REST API v3) and Jira Server / Data Center (REST API v2).

## Install

```bash
paseo plugin install https://github.com/tensorcopy/paseo-jira-dashboard.git
```

For local development:

```bash
git clone https://github.com/tensorcopy/paseo-jira-dashboard.git
cd paseo-jira-dashboard
npm install
npm run typecheck
paseo plugin install "$PWD"
# after changes
paseo plugin reload jira-dashboard
```

Requires Paseo 0.9.1 or later.

## Configure

Open **Settings → Jira**, or the gear button on the board.

| Setting        | Use                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Site URL       | Browser address of your site, for example `https://acme.atlassian.net`. Issue links open here.                        |
| API base URL   | Optional. Set it only when the REST API has a different address, for example a proxy. |
| API version    | Automatic uses 3 for Atlassian Cloud hosts and 2 for other hosts. Set it when the API base is a proxy. |
| Account email  | Set it for Jira Cloud API tokens (basic auth). Leave it empty for bearer tokens (Server/DC personal access tokens). |
| Token command  | Optional. A shell command on the daemon host that prints a token on stdout, for example `op read op://Private/Jira/token`. |

### The API token

Settings are plain JSON on the daemon, so the token is **not** kept in settings. The plugin looks for a token in this order:

1. **Token command.** The output is cached for 5 minutes. On a 401 response the command runs again one time, so short-lived tokens work.
2. **Stored token.** Paste it in the settings screen. The daemon writes it to `~/.config/paseo-jira-dashboard/token` (or `$XDG_CONFIG_HOME/paseo-jira-dashboard/token`) with mode `0600`.
3. **`JIRA_API_TOKEN`** in the daemon environment.

Create a Jira Cloud API token at <https://id.atlassian.com/manage-profile/security/api-tokens>.

Use **Test connection** in the settings screen to check the setup.

## Security

Paseo plugins are trusted code that runs without a sandbox. All Jira requests run in the plugin's daemon subprocess. The app never sees the token. The plugin does not log tokens or command output.

The daemon also loads the images. It loads only from the site URL, the API base URL, and the public Atlassian avatar hosts (`*.atl-paas.net`, `gravatar.com`). It sends the login only to the API base URL. It accepts only PNG, JPEG, GIF, WebP, and SVG files of 512 KB or less, and keeps them in memory for one hour.

## Layout

```text
index.client.tsx     app entry: surface, sidebar item, settings screen, commands, attachment source
index.server.ts      daemon entry: settings and RPC handlers
client/              React Native UI (board, issue detail, settings)
server/              Jira REST client, ADF-to-text, token lookup, handlers
shared/              Zod RPC contracts and settings schemas
```

## License

MIT
