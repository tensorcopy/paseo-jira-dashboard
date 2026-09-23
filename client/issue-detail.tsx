import type { PluginTheme } from "@getpaseo/plugin";
import { openExternalUrl, useRpc } from "@getpaseo/plugin/client";
import { copyText, Icon, ScrollView, useToast } from "@getpaseo/plugin/client/react-native";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { loadIssue } from "../shared/contracts";
import { errorText, relativeTime } from "./format";
import { StatusPill } from "./issue-card";
import { Avatar, JiraImage } from "./jira-image";
import type { Styles } from "./styles";

function Field({
  styles,
  label,
  value,
  leading,
}: {
  styles: Styles;
  label: string;
  value: string;
  leading?: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.small}>{label}</Text>
      <View style={styles.cardRow}>
        {leading}
        <Text style={styles.text}>{value}</Text>
      </View>
    </View>
  );
}

export function IssueDetailView({
  theme,
  styles,
  issueKey,
  compact,
  onClose,
}: {
  theme: PluginTheme;
  styles: Styles;
  issueKey: string;
  compact: boolean;
  onClose(): void;
}) {
  const fetchIssue = useRpc(loadIssue);
  const toast = useToast();
  const query = useQuery({
    queryKey: ["jira", "issue", issueKey],
    queryFn: function () {
      return fetchIssue({ key: issueKey });
    },
  });
  const issue = query.data;

  return (
    <View style={[styles.detail, compact ? { flex: 1 } : styles.detailWide]}>
      <View style={[styles.header, styles.headerRow]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={compact ? "Back to list" : "Close issue"}
          onPress={onClose}
          style={styles.iconButton}
        >
          <Icon name={compact ? "ArrowLeft" : "X"} size={16} color={theme.colors.foreground} />
        </Pressable>
        <Text style={[styles.key, { flex: 1 }]}>{issueKey}</Text>
        {issue ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Copy ${issue.key}`}
              onPress={function () {
                copyText(issue.key).then(
                  function () {
                    toast.show(`Copied ${issue.key}`, { variant: "success" });
                  },
                  function (error: unknown) {
                    toast.error(errorText(error));
                  },
                );
              }}
              style={styles.iconButton}
            >
              <Icon name="Copy" size={16} color={theme.colors.foreground} />
            </Pressable>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Open ${issue.key} in Jira`}
              onPress={function () {
                void openExternalUrl(issue.url);
              }}
              style={styles.button}
            >
              <Icon name="ExternalLink" size={14} color={theme.colors.accentForeground} />
              <Text style={styles.buttonText}>Open in Jira</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      {query.isPending ? (
        <View style={styles.centered}>
          <ActivityIndicator color={theme.colors.foregroundMuted} />
        </View>
      ) : query.isError ? (
        <View style={styles.centered}>
          <Text style={styles.danger}>{errorText(query.error)}</Text>
          <Pressable accessibilityRole="button" onPress={() => void query.refetch()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : issue ? (
        <ScrollView contentContainerStyle={styles.detailBody}>
          <Text style={styles.detailTitle}>{issue.summary}</Text>
          <View style={styles.cardRow}>
            <StatusPill theme={theme} styles={styles} issue={issue} />
            <JiraImage url={issue.issueTypeIconUrl} size={16} label={issue.issueType} />
            <Text style={styles.small}>
              {issue.issueType} · updated {relativeTime(issue.updated)}
            </Text>
          </View>
          <View style={styles.fieldGrid}>
            <Field
              styles={styles}
              label="Assignee"
              value={issue.assignee?.name ?? "Unassigned"}
              leading={<Avatar theme={theme} person={issue.assignee} size={24} />}
            />
            <Field
              styles={styles}
              label="Reporter"
              value={issue.reporter?.name ?? "Unknown"}
              leading={<Avatar theme={theme} person={issue.reporter} size={24} />}
            />
            <Field
              styles={styles}
              label="Priority"
              value={issue.priority ?? "None"}
              leading={
                issue.priority ? (
                  <JiraImage url={issue.priorityIconUrl} size={16} label={`Priority: ${issue.priority}`} />
                ) : null
              }
            />
            <Field styles={styles} label="Created" value={issue.created.slice(0, 10)} />
            {issue.parent ? (
              <Field styles={styles} label="Parent" value={`${issue.parent.key} ${issue.parent.summary}`} />
            ) : null}
            {issue.labels.length > 0 ? (
              <Field styles={styles} label="Labels" value={issue.labels.join(", ")} />
            ) : null}
            {issue.components.length > 0 ? (
              <Field styles={styles} label="Components" value={issue.components.join(", ")} />
            ) : null}
          </View>

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={issue.description ? styles.text : styles.muted} selectable>
            {issue.description || "No description."}
          </Text>

          <Text style={styles.sectionTitle}>
            Comments{issue.commentTotal > 0 ? ` (${issue.commentTotal})` : ""}
          </Text>
          {issue.comments.length === 0 ? <Text style={styles.muted}>No comments.</Text> : null}
          {issue.commentTotal > issue.comments.length ? (
            <Text style={styles.small}>Showing the latest {issue.comments.length}.</Text>
          ) : null}
          {issue.comments.map((comment) => (
            <View key={comment.id} style={styles.comment}>
              <View style={styles.cardRow}>
                <Avatar
                  theme={theme}
                  person={{ name: comment.author, avatarUrl: comment.authorAvatarUrl }}
                  size={20}
                />
                <Text style={styles.small}>
                  {comment.author} · {relativeTime(comment.created)}
                </Text>
              </View>
              <Text style={styles.text} selectable>
                {comment.body}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
