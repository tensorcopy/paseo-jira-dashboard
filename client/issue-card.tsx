import type { PluginTheme } from "@getpaseo/plugin";
import { Pressable, Text, View } from "react-native";

import type { IssueSummary } from "../shared/contracts";
import { priorityColor, relativeTime, statusColor } from "./format";
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
        <Text style={styles.key}>{issue.key}</Text>
        {issue.priority ? (
          <Text style={[styles.small, { color: priorityColor(theme, issue.priority) }]}>
            {issue.priority}
          </Text>
        ) : null}
      </View>
      <Text style={styles.summary} numberOfLines={3}>
        {issue.summary}
      </Text>
      <View style={styles.cardRow}>
        <StatusPill theme={theme} styles={styles} issue={issue} />
        <Text style={styles.small} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}
