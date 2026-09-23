import type { PluginTheme } from "@getpaseo/plugin";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { SortDirection, SortField } from "../shared/settings";
import { SORT_FIELDS, sortFieldLabel } from "./format";
import type { Styles } from "./styles";

export function SortMenu({
  theme,
  styles,
  field,
  direction,
  onChange,
}: {
  theme: PluginTheme;
  styles: Styles;
  field: SortField;
  direction: SortDirection;
  onChange(field: SortField, direction: SortDirection): void;
}) {
  const [open, setOpen] = useState(false);
  // "Query order" uses the direction in the query's ORDER BY.
  const directionEnabled = field !== "query";
  const ascending = direction === "asc";

  return (
    <View style={styles.sortRow}>
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Sort by ${sortFieldLabel(field)}. Change sort field`}
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen((value) => !value)}
          style={styles.sortButton}
        >
          <Icon name="ArrowDownUp" size={14} color={theme.colors.foregroundMuted} />
          <Text style={styles.chipText}>Sort: {sortFieldLabel(field)}</Text>
          <Icon name={open ? "ChevronUp" : "ChevronDown"} size={14} color={theme.colors.foregroundMuted} />
        </Pressable>
        {open ? (
          <View style={styles.sortMenu} accessibilityRole="menu">
            {SORT_FIELDS.map((option) => {
              const active = option.id === field;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: active }}
                  onPress={function () {
                    setOpen(false);
                    if (!active) onChange(option.id, option.defaultDirection);
                  }}
                  style={({ pressed }) => [styles.sortMenuItem, (active || pressed) && styles.sortMenuItemActive]}
                >
                  <Icon name="Check" size={14} color={active ? theme.colors.accent : "transparent"} />
                  <Text style={styles.chipText}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={ascending ? "Ascending. Change to descending" : "Descending. Change to ascending"}
        disabled={!directionEnabled}
        onPress={() => onChange(field, ascending ? "desc" : "asc")}
        style={[styles.sortButton, !directionEnabled && styles.sortButtonDisabled]}
      >
        <Icon
          name={ascending ? "ArrowUpNarrowWide" : "ArrowDownWideNarrow"}
          size={14}
          color={theme.colors.foregroundMuted}
        />
        <Text style={styles.chipText}>{ascending ? "Ascending" : "Descending"}</Text>
      </Pressable>
    </View>
  );
}
