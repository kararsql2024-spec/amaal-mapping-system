import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchRemoteSettings,
  loadSettings,
  resolveSettingsSources,
  saveRemoteSettings,
  saveSettings,
  stampSettings,
} from "./storage";
import type { IncentiveSettings } from "./types";

export type IncentiveSyncState = "local" | "loading" | "saving" | "saved" | "error";

interface IncentiveSettingsContextValue {
  settings: IncentiveSettings;
  setSettings: React.Dispatch<React.SetStateAction<IncentiveSettings>>;
  syncState: IncentiveSyncState;
}

const IncentiveSettingsContext = createContext<IncentiveSettingsContextValue | null>(null);

export const IncentiveSettingsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [settings, setSettings] = useState<IncentiveSettings>(() => loadSettings());
  const [syncState, setSyncState] = useState<IncentiveSyncState>("loading");
  const readyRef = useRef(false);
  const dirtyRef = useRef(false);
  const skipNextRemoteRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const local = loadSettings();
      try {
        const remote = await fetchRemoteSettings(supabase);
        if (cancelled) return;
        if (dirtyRef.current) {
          readyRef.current = true;
          setSyncState("local");
          return;
        }
        const resolved = resolveSettingsSources(local, remote);
        const next = resolved.shouldUpload
          ? stampSettings(resolved.settings)
          : resolved.settings;
        skipNextRemoteRef.current = true;
        setSettings(next);
        saveSettings(next);
        if (resolved.shouldUpload) {
          setSyncState("saving");
          await saveRemoteSettings(supabase, next);
          if (!cancelled) setSyncState("saved");
        } else {
          setSyncState("saved");
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) setSyncState("error");
      } finally {
        readyRef.current = true;
      }
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!readyRef.current) return;
    if (skipNextRemoteRef.current) {
      skipNextRemoteRef.current = false;
      return;
    }
    dirtyRef.current = true;
    setSyncState("saving");
    const timer = window.setTimeout(() => {
      const stamped = stampSettings(settings);
      saveSettings(stamped);
      void saveRemoteSettings(supabase, stamped)
        .then(() => setSyncState("saved"))
        .catch((error) => {
          console.error(error);
          setSyncState("error");
        });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [settings]);

  const value = useMemo(
    () => ({ settings, setSettings, syncState }),
    [settings, syncState],
  );

  return (
    <IncentiveSettingsContext.Provider value={value}>
      {children}
    </IncentiveSettingsContext.Provider>
  );
};

export const useIncentiveSettings = () => {
  const context = useContext(IncentiveSettingsContext);
  if (!context) {
    throw new Error("useIncentiveSettings must be used inside IncentiveSettingsProvider");
  }
  return context;
};

export const usePatchSettings = () => {
  const { setSettings } = useIncentiveSettings();
  return useCallback(
    (patch: Partial<IncentiveSettings>) => {
      setSettings((prev) => ({ ...prev, ...patch }));
    },
    [setSettings],
  );
};
