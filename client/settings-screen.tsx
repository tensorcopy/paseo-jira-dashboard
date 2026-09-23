import { type PluginSurfaceProps, useRpc, useSettings } from "@getpaseo/plugin/client";
import { ScrollView, useToast } from "@getpaseo/plugin/client/react-native";
import {
  SettingsAction,
  SettingsInput,
  type SettingsInputHandle,
  SettingsRow,
  SettingsSection,
  SettingsSelect,
} from "@getpaseo/plugin/client/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";

import { connectionStatus, saveToken, tokenState } from "../shared/contracts";
import { boardSettings, connectionSettings, DEFAULT_QUERIES } from "../shared/settings";
import { errorText } from "./format";
import { useStyles } from "./styles";

type ApiVersion = "auto" | "2" | "3";

const API_VERSIONS: readonly { label: string; value: ApiVersion }[] = [
  { label: "Automatic", value: "auto" },
  { label: "3 (Cloud)", value: "3" },
  { label: "2 (Server/Data Center)", value: "2" },
];

type ConnectionValues = {
  siteUrl: string;
  apiBaseUrl: string;
  apiVersion: ApiVersion;
  email: string;
  tokenCommand: string;
};

const EMPTY_CONNECTION: ConnectionValues = { siteUrl: "", apiBaseUrl: "", apiVersion: "auto", email: "", tokenCommand: "" };

function ConnectionSection() {
  const settings = useSettings(connectionSettings);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<ConnectionValues | null>(null);
  const saved = settings.status === "ready" ? settings.values : null;
  const savedRevision = settings.status === "ready" ? settings.revision : null;

  // Load the draft once per stored revision so typing is not overwritten by re-renders.
  useEffect(() => {
    if (saved) setDraft(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedRevision]);

  if (settings.status === "loading" || (settings.status === "ready" && draft === null)) {
    return (
      <SettingsSection title="Connection">
        <SettingsRow label="Loading settings…" />
      </SettingsSection>
    );
  }
  if (settings.status === "error") {
    return (
      <SettingsSection title="Connection">
        <SettingsRow label="Settings could not be read" error={settings.error} />
      </SettingsSection>
    );
  }

  const revision = settings.status === "ready" || settings.status === "invalid" ? settings.revision : "";
  const values = draft ?? EMPTY_CONNECTION;
  const dirty =
    saved === null || (Object.keys(values) as (keyof ConnectionValues)[]).some((k) => values[k] !== saved[k]);

  function update(field: Exclude<keyof ConnectionValues, "apiVersion">) {
    return function (text: string) {
      setDraft((current) => ({ ...(current ?? EMPTY_CONNECTION), [field]: text.trim() }));
    };
  }

  return (
    <SettingsSection title="Connection">
      {settings.status === "invalid" ? (
        <SettingsRow label="Stored settings are invalid" error={settings.error} />
      ) : null}
      <SettingsInput
        label="Site URL"
        hint="Browser address of your Jira site. Links open here."
        placeholder="https://your-site.atlassian.net"
        initialValue={values.siteUrl}
        onChangeText={update("siteUrl")}
      />
      <SettingsInput
        label="API base URL"
        hint="Optional. Set only when the REST API has a different address, for example a proxy."
        placeholder="Same as site URL"
        initialValue={values.apiBaseUrl}
        onChangeText={update("apiBaseUrl")}
      />
      <SettingsSelect
        label="API version"
        hint="Automatic uses 3 for Atlassian Cloud hosts and 2 for other hosts. Set it when the API base is a proxy."
        value={values.apiVersion}
        options={API_VERSIONS}
        onValueChange={function (value: ApiVersion) {
          setDraft((current) => ({ ...(current ?? EMPTY_CONNECTION), apiVersion: value }));
        }}
      />
      <SettingsInput
        label="Account email"
        hint="Set for Jira Cloud API tokens (basic auth). Leave empty for bearer tokens (Server/DC personal access tokens)."
        placeholder="you@example.com"
        initialValue={values.email}
        onChangeText={update("email")}
      />
      <SettingsInput
        label="Token command"
        hint="Optional. Shell command on the daemon host that prints a token. It has priority over the stored token."
        placeholder="op read op://vault/jira/token"
        initialValue={values.tokenCommand}
        onChangeText={update("tokenCommand")}
      />
      <SettingsAction
        label={settings.saveError ?? (dirty ? "You have changes that are not saved" : "Settings are saved")}
        error={settings.saveError}
        actionLabel={settings.saving ? "Saving…" : "Save"}
        disabled={!dirty || settings.saving}
        onPress={async function () {
          const ok = await settings.save(values, revision);
          if (ok) {
            toast.show("Jira settings saved", { variant: "success" });
            await queryClient.invalidateQueries({ queryKey: ["jira"] });
          }
        }}
      />
    </SettingsSection>
  );
}

function TokenSection() {
  const readTokenState = useRpc(tokenState);
  const storeToken = useRpc(saveToken);
  const queryClient = useQueryClient();
  const toast = useToast();
  const input = useRef<SettingsInputHandle>(null);
  const [token, setToken] = useState("");
  const state = useQuery({
    queryKey: ["jira", "token-state"],
    queryFn: function () {
      return readTokenState({});
    },
  });
  const store = useMutation({
    mutationFn: function (value: string) {
      return storeToken({ token: value });
    },
    onSuccess: async function (result) {
      input.current?.replaceText("");
      setToken("");
      toast.show(result.stored ? "Token saved on the daemon host" : "Stored token removed", {
        variant: "success",
      });
      await queryClient.invalidateQueries({ queryKey: ["jira"] });
    },
    onError: function (error) {
      toast.error(errorText(error));
    },
  });

  const summary = state.data
    ? [
        state.data.stored ? "A token is stored on the daemon host." : "No token is stored.",
        state.data.env ? "JIRA_API_TOKEN is set." : null,
      ]
        .filter(Boolean)
        .join(" ")
    : state.isError
      ? errorText(state.error)
      : "Checking…";

  return (
    <SettingsSection title="API token">
      <SettingsRow
        label="Token source"
        hint={`${summary} Order: token command, stored token, JIRA_API_TOKEN.`}
      />
      <SettingsInput
        ref={input}
        label="New token"
        hint="The daemon keeps it in a file that only your user can read. It is not put in settings."
        placeholder="Paste API token"
        secureTextEntry
        onChangeText={setToken}
      />
      <SettingsAction
        label="Store the token"
        actionLabel={store.isPending ? "Saving…" : "Save token"}
        disabled={token.trim() === "" || store.isPending}
        onPress={function () {
          store.mutate(token.trim());
        }}
      />
      {state.data?.stored ? (
        <SettingsAction
          label="Remove the stored token"
          actionLabel="Remove"
          disabled={store.isPending}
          onPress={function () {
            store.mutate("");
          }}
        />
      ) : null}
    </SettingsSection>
  );
}

function TestSection() {
  const readStatus = useRpc(connectionStatus);
  const status = useQuery({
    queryKey: ["jira", "status"],
    queryFn: function () {
      return readStatus({});
    },
  });
  const data = status.data;
  const label = status.isFetching
    ? "Testing…"
    : status.isError
      ? "Test failed"
      : data?.state === "connected"
        ? `Connected as ${data.user} (token from ${data.tokenSource})`
        : data?.state === "unconfigured"
          ? "Not configured"
          : "Cannot connect";
  const error = status.isError
    ? errorText(status.error)
    : data && data.state !== "connected"
      ? data.reason
      : null;
  return (
    <SettingsSection title="Status">
      <SettingsAction
        label={label}
        error={error}
        actionLabel="Test connection"
        disabled={status.isFetching}
        onPress={function () {
          void status.refetch();
        }}
      />
    </SettingsSection>
  );
}

function QueriesSection() {
  const settings = useSettings(boardSettings);
  const toast = useToast();
  const nameInput = useRef<SettingsInputHandle>(null);
  const jqlInput = useRef<SettingsInputHandle>(null);
  const [name, setName] = useState("");
  const [jql, setJql] = useState("");

  if (settings.status !== "ready") {
    return (
      <SettingsSection title="Saved queries">
        <SettingsRow
          label={settings.status === "loading" ? "Loading…" : "Saved queries could not be read"}
          error={settings.status === "loading" ? null : settings.error}
        />
        {settings.status === "invalid" ? (
          <SettingsAction label="Restore the default queries" actionLabel="Reset" onPress={() => void settings.reset()} />
        ) : null}
      </SettingsSection>
    );
  }

  const { values, revision } = settings;

  async function write(queries: typeof values.queries) {
    const selectedQuery = Math.min(values.selectedQuery, Math.max(queries.length - 1, 0));
    return settings.save({ ...values, queries, selectedQuery }, revision);
  }

  return (
    <SettingsSection title="Saved queries" info="Queries show as tabs on the Jira board.">
      {values.queries.map((query, index) => (
        <SettingsAction
          key={`${index}:${query.name}`}
          label={query.name}
          hint={query.jql}
          actionLabel="Remove"
          disabled={settings.saving || values.queries.length <= 1}
          onPress={function () {
            void write(values.queries.filter((_, i) => i !== index));
          }}
        />
      ))}
      <SettingsInput ref={nameInput} label="Name" placeholder="My sprint" onChangeText={setName} />
      <SettingsInput
        ref={jqlInput}
        label="JQL"
        placeholder="project = ABC AND sprint in openSprints()"
        onChangeText={setJql}
      />
      <SettingsAction
        label="Add the query"
        error={settings.saveError}
        actionLabel="Add"
        disabled={name.trim() === "" || jql.trim() === "" || settings.saving}
        onPress={async function () {
          const ok = await write([...values.queries, { name: name.trim(), jql: jql.trim() }]);
          if (ok) {
            nameInput.current?.replaceText("");
            jqlInput.current?.replaceText("");
            setName("");
            setJql("");
            toast.show("Query added", { variant: "success" });
          }
        }}
      />
      <SettingsAction
        label="Restore the default queries"
        actionLabel="Reset"
        disabled={settings.saving}
        onPress={function () {
          void settings.save({ ...values, queries: DEFAULT_QUERIES, selectedQuery: 0 }, revision);
        }}
      />
    </SettingsSection>
  );
}

export function JiraSettingsContent() {
  return (
    <>
      <ConnectionSection />
      <TokenSection />
      <TestSection />
      <QueriesSection />
    </>
  );
}

export function JiraSettingsScreen({ theme, layout }: PluginSurfaceProps) {
  const styles = useStyles({ theme, layout });
  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: layout.compact ? 12 : 20, gap: 16 }}>
      <Text style={styles.muted}>
        Connect Paseo to Jira Cloud or Jira Server/Data Center. Requests run on the daemon host.
      </Text>
      <JiraSettingsContent />
    </ScrollView>
  );
}
