/**
 * Token resolution. Order: `tokenCommand`, then the stored token file, then
 * `JIRA_API_TOKEN`. Tokens are never logged or returned to the client.
 */
import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type TokenSource = "command" | "file" | "env";

export interface ResolvedToken {
  token: string;
  source: TokenSource;
}

const COMMAND_TTL_MS = 5 * 60 * 1000;
const COMMAND_TIMEOUT_MS = 60 * 1000;

let commandCache: { command: string; token: string; expiresAt: number } | null = null;

export function tokenFilePath(): string {
  const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(configHome, "paseo-jira-dashboard", "token");
}

export async function readStoredToken(): Promise<string | null> {
  try {
    const token = (await readFile(tokenFilePath(), "utf8")).trim();
    return token === "" ? null : token;
  } catch {
    return null;
  }
}

export async function writeStoredToken(token: string): Promise<void> {
  const path = tokenFilePath();
  const trimmed = token.trim();
  if (trimmed === "") {
    await rm(path, { force: true });
    return;
  }
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${trimmed}\n`, { mode: 0o600 });
  await chmod(path, 0o600);
}

export function envToken(): string | null {
  const token = process.env.JIRA_API_TOKEN?.trim();
  return token ? token : null;
}

function runTokenCommand(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "/bin/sh",
      ["-c", command],
      { timeout: COMMAND_TIMEOUT_MS, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          // stderr can echo secrets, so report only the exit reason.
          reject(new Error(`Token command failed: ${error.message.split("\n")[0]}`));
          return;
        }
        const token = stdout.trim().split("\n").pop()?.trim() ?? "";
        if (token === "") reject(new Error("Token command printed no token."));
        else resolve(token);
      },
    );
  });
}

export function forgetCommandToken(): void {
  commandCache = null;
}

export async function resolveToken(tokenCommand: string): Promise<ResolvedToken | null> {
  const command = tokenCommand.trim();
  if (command !== "") {
    const now = Date.now();
    if (commandCache && commandCache.command === command && commandCache.expiresAt > now) {
      return { token: commandCache.token, source: "command" };
    }
    const token = await runTokenCommand(command);
    commandCache = { command, token, expiresAt: now + COMMAND_TTL_MS };
    return { token, source: "command" };
  }
  const stored = await readStoredToken();
  if (stored) return { token: stored, source: "file" };
  const env = envToken();
  if (env) return { token: env, source: "env" };
  return null;
}
