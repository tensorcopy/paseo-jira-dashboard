import type { PluginClientContext } from "@getpaseo/plugin/client";

import { JiraBoard } from "./client/board";
import { JiraSettingsScreen } from "./client/settings-screen";
import { jiraAttachments } from "./shared/contracts";

export default function contribute(client: PluginClientContext) {
  client.addSurface("board", JiraBoard);
  client.addSidebarItem({ id: "board", title: "Jira", icon: "Ticket", surface: "board" });
  client.addSettingsScreen({ id: "jira", title: "Jira", icon: "Ticket", Component: JiraSettingsScreen });
  client.addAttachmentSource(jiraAttachments);

  client.addCommandCenterItem({
    id: "open-board",
    title: "Open Jira board",
    icon: "Ticket",
    keywords: ["jira", "tickets", "issues"],
    context: "global",
    onSelect({ openSurface }) {
      openSurface("board");
    },
  });
  client.addCommandCenterItem({
    id: "open-settings",
    title: "Jira settings",
    icon: "Settings",
    keywords: ["jira", "token", "connection"],
    context: "global",
    onSelect({ openSettings }) {
      openSettings("jira");
    },
  });

  return () => {};
}
