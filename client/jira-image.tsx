import type { PluginTheme } from "@getpaseo/plugin";
import { useRpc } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";

import { loadImage, type Person } from "../shared/contracts";

const IMAGE_STALE_MS = 60 * 60 * 1000;

/**
 * Shows a Jira image (avatar or icon) that the daemon loads with the Jira login.
 * Shows `fallback` while it loads, when it fails, and for SVG on iOS and Android,
 * because React Native cannot draw SVG there.
 */
export function JiraImage({
  url,
  size,
  round = false,
  label,
  fallback = null,
}: {
  url: string | null | undefined;
  size: number;
  round?: boolean;
  label: string;
  fallback?: ReactNode;
}) {
  const load = useRpc(loadImage);
  const [broken, setBroken] = useState(false);
  const query = useQuery({
    queryKey: ["jira", "image", url],
    enabled: Boolean(url),
    staleTime: IMAGE_STALE_MS,
    gcTime: IMAGE_STALE_MS,
    retry: false,
    queryFn: function () {
      return load({ url: url! });
    },
  });
  const data = query.data;
  const drawable =
    data?.uri != null && !broken && (data.mimeType !== "image/svg+xml" || Platform.OS === "web");
  if (!drawable) return <>{fallback}</>;
  return (
    <Image
      source={{ uri: data.uri!, width: size, height: size }}
      accessibilityLabel={label}
      onError={() => setBroken(true)}
      style={{ width: size, height: size, borderRadius: round ? size / 2 : 2 }}
    />
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]![0], parts[parts.length - 1]![0]] : [parts[0]?.[0]];
  return letters.join("").toUpperCase() || "?";
}

/** A round avatar. It shows initials when the picture is not available. */
export function Avatar({ theme, person, size }: { theme: PluginTheme; person: Person | null; size: number }) {
  const name = person?.name ?? "Unassigned";
  const fallback = (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.colors.surface1,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.border,
      }}
    >
      <Text style={{ color: theme.colors.foregroundMuted, fontSize: Math.round(size * 0.42), fontWeight: "600" }}>
        {person ? initials(name) : "–"}
      </Text>
    </View>
  );
  return <JiraImage url={person?.avatarUrl} size={size} round label={name} fallback={fallback} />;
}
