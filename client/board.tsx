import type { PluginTheme } from "@getpaseo/plugin";
import { type PluginSurfaceProps, useRpc, useSettings } from "@getpaseo/plugin/client";
import { Icon, ScrollView, TextInput } from "@getpaseo/plugin/client/react-native";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { connectionStatus, type IssueSummary, searchIssues } from "../shared/contracts";
import { boardSettings, DEFAULT_QUERIES, type SortDirection, type SortField } from "../shared/settings";
import {
  applySortOrder,
  errorText,
  groupByCategory,
  matchesFilter,
  searchTextToJql,
  statusColor,
} from "./format";
import { IssueCard } from "./issue-card";
import { IssueDetailView } from "./issue-detail";
import { JiraSettingsContent } from "./settings-screen";
import { SortMenu } from "./sort-menu";
import { type Styles, useStyles } from "./styles";

type Column = ReturnType<typeof groupByCategory>[number];

function ColumnHeader({ theme, styles, column }: { theme: PluginTheme; styles: Styles; column: Column }) {
  return (
    <View style={styles.columnHeader}>
      <View style={[styles.dot, { backgroundColor: statusColor(theme, column.category) }]} />
      <Text style={styles.columnTitle}>{column.title}</Text>
      <Text style={styles.small}>{column.issues.length}</Text>
    </View>
  );
}

export function JiraBoard({ theme, layout }: PluginSurfaceProps) {
  const styles = useStyles({ theme, layout });
  const compact = layout.compact;
  const board = useSettings(boardSettings);
  const readStatus = useRpc(connectionStatus);
  const runSearch = useRpc(searchIssues);

  const queries = board.status === "ready" ? board.values.queries : DEFAULT_QUERIES;
  const storedIndex = board.status === "ready" ? board.values.selectedQuery : 0;
  const storedSort =
    board.status === "ready"
      ? { field: board.values.sortField, direction: board.values.sortDirection }
      : { field: "query" as const, direction: "desc" as const };
  const [queryIndex, setQueryIndex] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<{ field: SortField; direction: SortDirection } | null>(null);
  const [customJql, setCustomJql] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const activeIndex = Math.min(queryIndex ?? storedIndex, queries.length - 1);
  const baseJql = customJql ?? queries[activeIndex]?.jql ?? "";
  const activeSort = sortOrder ?? storedSort;
  const activeJql = baseJql === "" ? "" : applySortOrder(baseJql, activeSort.field, activeSort.direction);

  const status = useQuery({
    queryKey: ["jira", "status"],
    queryFn: function () {
      return readStatus({});
    },
  });
  const connected = status.data?.state === "connected";

  const search = useQuery({
    queryKey: ["jira", "search", activeJql],
    enabled: connected && activeJql !== "",
    queryFn: function () {
      return runSearch({ jql: activeJql, maxResults: 50 });
    },
  });

  // A new query shows a new list, so close the open issue. A new sort order keeps it open.
  useEffect(() => {
    setSelectedKey(null);
  }, [baseJql]);

  const visible = useMemo(() => {
    const issues = search.data?.issues ?? [];
    // A custom query was already filtered by Jira; do not filter it again.
    return customJql === null ? issues.filter((issue) => matchesFilter(issue, searchText)) : issues;
  }, [search.data, searchText, customJql]);
  const columns = useMemo(() => groupByCategory(visible), [visible]);

  function selectQuery(index: number) {
    setCustomJql(null);
    setSearchText("");
    setQueryIndex(index);
    if (board.status === "ready" && board.values.selectedQuery !== index) {
      void board.save({ ...board.values, selectedQuery: index }, board.revision);
    }
  }

  function selectSort(field: SortField, direction: SortDirection) {
    setSortOrder({ field, direction });
    if (
      board.status === "ready" &&
      (board.values.sortField !== field || board.values.sortDirection !== direction)
    ) {
      void board.save({ ...board.values, sortField: field, sortDirection: direction }, board.revision);
    }
  }

  function submitSearch() {
    const text = searchText.trim();
    setCustomJql(text === "" ? null : searchTextToJql(text));
  }

  function refresh() {
    void status.refetch();
    if (connected) void search.refetch();
  }

  function renderCard(issue: IssueSummary) {
    return (
      <IssueCard
        key={issue.key}
        theme={theme}
        styles={styles}
        issue={issue}
        selected={issue.key === selectedKey}
        onPress={function () {
          setSelectedKey((current) => (current === issue.key && !compact ? null : issue.key));
        }}
      />
    );
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Icon name="Ticket" size={20} color={theme.colors.accent} />
        <Text style={styles.title} numberOfLines={1}>
          Jira
        </Text>
        {status.data?.state === "connected" && !compact ? (
          <Text style={styles.small} numberOfLines={1}>
            {status.data.user}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh"
          onPress={refresh}
          style={styles.iconButton}
        >
          <Icon name="RefreshCw" size={16} color={theme.colors.foreground} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showSettings ? "Close settings" : "Open settings"}
          accessibilityState={{ selected: showSettings }}
          onPress={() => setShowSettings((value) => !value)}
          style={[styles.iconButton, showSettings && styles.chipActive]}
        >
          <Icon
            name="Settings"
            size={16}
            color={showSettings ? theme.colors.accentForeground : theme.colors.foreground}
          />
        </Pressable>
      </View>
      {!showSettings && connected ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {queries.map((query, index) => {
              const active = customJql === null && index === activeIndex;
              return (
                <Pressable
                  key={`${index}:${query.name}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => selectQuery(index)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={active ? styles.chipTextActive : styles.chipText}>{query.name}</Text>
                </Pressable>
              );
            })}
            {customJql !== null ? (
              <View style={[styles.chip, styles.chipActive]}>
                <Text style={styles.chipTextActive}>Search</Text>
              </View>
            ) : null}
          </ScrollView>
          <SortMenu
            theme={theme}
            styles={styles}
            field={activeSort.field}
            direction={activeSort.direction}
            onChange={selectSort}
          />
          <TextInput
            accessibilityLabel="Filter or search issues"
            value={searchText}
            onChangeText={function (text: string) {
              setSearchText(text);
              if (text.trim() === "") setCustomJql(null);
            }}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Filter this list. Press Enter to search Jira (text, ABC-123, or JQL)."
            placeholderTextColor={theme.colors.foregroundMuted}
            style={styles.input}
          />
          {customJql !== null ? (
            <Text style={styles.small} numberOfLines={2} selectable>
              JQL: {activeJql}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );

  let content: ReactNode;
  if (showSettings) {
    content = (
      <ScrollView contentContainerStyle={[styles.stacked, { gap: 16 }]}>
        <JiraSettingsContent />
      </ScrollView>
    );
  } else if (status.isPending) {
    content = (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.foregroundMuted} />
      </View>
    );
  } else if (status.isError || (status.data && status.data.state !== "connected")) {
    const unconfigured = status.data?.state === "unconfigured";
    const reason = status.isError ? errorText(status.error) : status.data && "reason" in status.data ? status.data.reason : "";
    content = (
      <View style={styles.centered}>
        <Icon name={unconfigured ? "PlugZap" : "TriangleAlert"} size={28} color={theme.colors.foregroundMuted} />
        <Text style={[styles.text, { textAlign: "center" }]}>
          {unconfigured ? "Connect to Jira to see your tickets." : "Paseo cannot connect to Jira."}
        </Text>
        <Text style={[unconfigured ? styles.muted : styles.danger, { textAlign: "center" }]}>{reason}</Text>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" onPress={() => setShowSettings(true)} style={styles.button}>
            <Icon name="Settings" size={14} color={theme.colors.accentForeground} />
            <Text style={styles.buttonText}>Open settings</Text>
          </Pressable>
          {!unconfigured ? (
            <Pressable accessibilityRole="button" onPress={refresh} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Retry</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  } else if (search.isPending) {
    content = (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.colors.foregroundMuted} />
      </View>
    );
  } else if (search.isError) {
    content = (
      <View style={styles.centered}>
        <Text style={[styles.danger, { textAlign: "center" }]}>{errorText(search.error)}</Text>
        <Pressable accessibilityRole="button" onPress={() => void search.refetch()} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  } else if (compact && selectedKey !== null) {
    content = (
      <IssueDetailView
        theme={theme}
        styles={styles}
        issueKey={selectedKey}
        compact
        onClose={() => setSelectedKey(null)}
      />
    );
  } else {
    const footer = search.data?.truncated ? (
      <Text style={[styles.small, { paddingHorizontal: compact ? 12 : 20, paddingBottom: 12 }]}>
        Showing the first {search.data.issues.length} issues. Narrow the query to see more.
      </Text>
    ) : null;
    const empty = visible.length === 0;

    const list = empty ? (
      <View style={styles.centered}>
        <Icon name="Inbox" size={28} color={theme.colors.foregroundMuted} />
        <Text style={styles.muted}>No issues match.</Text>
      </View>
    ) : compact ? (
      <ScrollView contentContainerStyle={styles.stacked}>
        {columns
          .filter((column) => column.issues.length > 0)
          .map((column) => (
            <View key={column.category} style={styles.section}>
              <ColumnHeader theme={theme} styles={styles} column={column} />
              {column.issues.map(renderCard)}
            </View>
          ))}
        {footer}
      </ScrollView>
    ) : (
      <View style={styles.board}>
        <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.columns}>
            {columns.map((column) => (
              <View key={column.category} style={styles.column}>
                <ColumnHeader theme={theme} styles={styles} column={column} />
                <ScrollView contentContainerStyle={styles.columnBody}>
                  {column.issues.length === 0 ? <Text style={[styles.small, { padding: 4 }]}>Empty</Text> : null}
                  {column.issues.map(renderCard)}
                </ScrollView>
              </View>
            ))}
          </View>
        </ScrollView>
        {footer}
      </View>
    );

    content = (
      <View style={styles.body}>
        {list}
        {!compact && selectedKey !== null ? (
          <IssueDetailView
            theme={theme}
            styles={styles}
            issueKey={selectedKey}
            compact={false}
            onClose={() => setSelectedKey(null)}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {compact && selectedKey !== null && !showSettings ? null : header}
      {content}
    </View>
  );
}
