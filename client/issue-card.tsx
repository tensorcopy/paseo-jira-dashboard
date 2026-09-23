import type { PluginTheme } from "@getpaseo/plugin";
import { Pressable, Text, View } from "react-native";

import type { IssueSummary } from "../shared/contracts";
import { priorityColor, relativeTime, statusColor } from "./format";
import { Avatar, JiraImage } from "./jira-image";
import type { Styles } from "./styles";

export function StatusPill({
  theme,
  styles,
  issue,
}: {
  theme: PluginTheme;
  styles: Styles;
  issue: Pick<IssueSummary, "status" | "statusCategory">;
}) {
  const color = statusColor(theme, issue.statusCategory);
  return (
    <View style={[styles.pill, { borderColor: color }]}>
      <Text style={[styles.pillText, { color }]} numberOfLines={1}>
        {issue.status.toUpperCase()}
      </Text>
    </View>
  );
}

/** The Jira priority icon, or the priority name in its color when the icon cannot be drawn. */
export function PriorityBadge({
  theme,
  styles,
  issue,
}: {
  theme: PluginTheme;
  styles: Styles;
  issue: Pick<IssueSummary, "priority" | "priorityIconUrl">;
}) {
  if (!issue.priority) return null;
  const text = (
    <Text style={[styles.small, { color: priorityColor(theme, issue.priority) }]}>{issue.priority}</Text>
  );
  return <JiraImage url={issue.priorityIconUrl} size={16} label={`Priority: ${issue.priority}`} fallback={text} />;
}

export function IssueCard({
  theme,
  styles,
  issue,
  selected,
  onPress,
}: {
  theme: PluginTheme;
  styles: Styles;
  issue: IssueSummary;
  selected: boolean;
  onPress(): void;
}) {
  const meta = [issue.issueType, issue.assignee?.name ?? "Unassigned", relativeTime(issue.updated)]
    .filter(Boolean)
    .join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${issue.key}: ${issue.summary}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <View style={styles.cardRow}>
        <JiraImage url={issue.issueTypeIconUrl} size={16} label={issue.issueType} />
        <Text style={[styles.key, { flex: 1 }]}>{issue.key}</Text>
        <PriorityBadge theme={theme} styles={styles} issue={issue} />
      </View>
      <Text style={styles.summary} numberOfLines={3}>
        {issue.summary}
      </Text>
      <View style={styles.cardRow}>
        <StatusPill theme={theme} styles={styles} issue={issue} />
        <Avatar theme={theme} person={issue.assignee} size={20} />
        <Text style={[styles.small, { flexShrink: 1 }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}
