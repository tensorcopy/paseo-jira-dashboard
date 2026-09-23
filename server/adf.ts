/**
 * Converts Atlassian Document Format (Jira Cloud v3 rich text) to plain
 * Markdown-like text. Jira Server/Data Center v2 returns strings already.
 */

interface AdfNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: { type?: string; attrs?: Record<string, unknown> }[];
  content?: AdfNode[];
}

function inline(nodes: AdfNode[] | undefined): string {
  return (nodes ?? []).map(renderInline).join("");
}

function renderInline(node: AdfNode): string {
  switch (node.type) {
    case "text": {
      let text = node.text ?? "";
      for (const mark of node.marks ?? []) {
        if (mark.type === "code") text = `\`${text}\``;
        else if (mark.type === "strong") text = `**${text}**`;
        else if (mark.type === "em") text = `_${text}_`;
        else if (mark.type === "link" && typeof mark.attrs?.href === "string") {
          text = `[${text}](${mark.attrs.href})`;
        }
      }
      return text;
    }
    case "hardBreak":
      return "\n";
    case "mention":
      return String(node.attrs?.text ?? "@someone");
    case "emoji":
      return String(node.attrs?.text ?? node.attrs?.shortName ?? "");
    case "inlineCard":
      return String(node.attrs?.url ?? "");
    case "date": {
      const stamp = Number(node.attrs?.timestamp);
      return Number.isFinite(stamp) ? new Date(stamp).toISOString().slice(0, 10) : "";
    }
    case "status":
      return `[${String(node.attrs?.text ?? "")}]`;
    default:
      return inline(node.content);
  }
}

function indent(text: string, prefix: string): string {
  return text
    .split("\n")
    .map((line, index) => (index === 0 ? line : `${" ".repeat(prefix.length)}${line}`))
    .join("\n");
}

function renderBlock(node: AdfNode): string {
  switch (node.type) {
    case "paragraph":
      return inline(node.content);
    case "heading": {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
      return `${"#".repeat(level)} ${inline(node.content)}`;
    }
    case "bulletList":
      return (node.content ?? [])
        .map((item) => `- ${indent(blocks(item.content), "- ")}`)
        .join("\n");
    case "orderedList":
      return (node.content ?? [])
        .map((item, index) => {
          const prefix = `${index + 1}. `;
          return `${prefix}${indent(blocks(item.content), prefix)}`;
        })
        .join("\n");
    case "taskList":
      return (node.content ?? [])
        .map((item) => `- [${item.attrs?.state === "DONE" ? "x" : " "}] ${inline(item.content)}`)
        .join("\n");
    case "codeBlock":
      return `\`\`\`${String(node.attrs?.language ?? "")}\n${inline(node.content)}\n\`\`\``;
    case "blockquote":
      return blocks(node.content)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "rule":
      return "---";
    case "panel":
      return blocks(node.content);
    case "table":
      return (node.content ?? [])
        .map((row) => `| ${(row.content ?? []).map((cell) => blocks(cell.content).replace(/\n/g, " ")).join(" | ")} |`)
        .join("\n");
    case "mediaSingle":
    case "mediaGroup":
      return "[attachment]";
    default:
      return node.content ? blocks(node.content) : renderInline(node);
  }
}

function blocks(nodes: AdfNode[] | undefined): string {
  return (nodes ?? [])
    .map(renderBlock)
    .filter((text) => text !== "")
    .join("\n\n");
}

export function richTextToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object") return blocks((value as AdfNode).content).trim();
  return "";
}
