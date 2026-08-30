import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchCatalogCenters,
  fetchCatalogContractPurposes,
  fetchCatalogProjects,
  fetchCatalogUserNames,
  type CatalogCenter,
  type CatalogProject,
} from "./system-data";

interface CatalogContextValue {
  projects: CatalogProject[];
  centers: CatalogCenter[];
  userNames: string[];
  contractPurposes: string[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const CatalogContext = createContext<CatalogContextValue | null>(null);

export const IncentiveCatalogProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [projects, setProjects] = useState<CatalogProject[]>([]);
  const [centers, setCenters] = useState<CatalogCenter[]>([]);
  const [userNames, setUserNames] = useState<string[]>([]);
  const [contractPurposes, setContractPurposes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [nextProjects, nextCenters, nextUserNames, nextPurposes] = await Promise.all([
          fetchCatalogProjects(),
          fetchCatalogCenters(),
          fetchCatalogUserNames().catch(() => [] as string[]),
          fetchCatalogContractPurposes().catch(() => [] as string[]),
        ]);
        if (cancelled) return;
        setProjects(nextProjects);
        setCenters(nextCenters);
        setUserNames(nextUserNames);
        setContractPurposes(nextPurposes);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("تعذر جلب المدن والمراكز من قاعدة البيانات");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const value = useMemo(
    () => ({
      projects,
      centers,
      userNames,
      contractPurposes,
      loading,
      error,
      reload: () => setTick((current) => current + 1),
    }),
    [projects, centers, userNames, contractPurposes, loading, error],
  );

  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  );
};

export const useIncentiveCatalog = () => {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error("useIncentiveCatalog must be used inside IncentiveCatalogProvider");
  }
  return context;
};
