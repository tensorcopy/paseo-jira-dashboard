import type { PluginServerContext } from "@getpaseo/plugin/server";

import { createHandlers } from "./server/handlers";
import {
  connectionStatus,
  loadImage,
  loadIssue,
  saveToken,
  searchAttachments,
  searchIssues,
  tokenState,
} from "./shared/contracts";
import { boardSettings, connectionSettings } from "./shared/settings";

export default function contribute(server: PluginServerContext) {
  const connection = server.registerSettings(connectionSettings);
  server.registerSettings(boardSettings);

  const handlers = createHandlers(connection);
  server.handle(connectionStatus, handlers.status);
  server.handle(searchIssues, handlers.search);
  server.handle(loadIssue, handlers.issue);
  server.handle(loadImage, handlers.image);
  server.handle(tokenState, handlers.tokenState);
  server.handle(saveToken, handlers.saveToken);
  server.handle(searchAttachments, handlers.attachmentSearch);

  // Handlers hold no timers or sockets; each request finishes on its own.
  return () => {};
}
