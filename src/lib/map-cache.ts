/** مفاتيح localStorage للمخطط العام */
export const MAIN_MAP_CONFIG_KEY = "cached_main_map_config";
export const MAIN_MAP_TIME_KEY = "cached_main_map_time";
export const MAIN_MAP_VERSION_KEY = "cached_main_map_version";

/** TTL للعرض الفوري بدون انتظار — لكن نُحدّث دائماً في الخلفية */
export const MAIN_MAP_STALE_MS = 5 * 60 * 1000;

export const PROJECT_CACHE_PREFIX = "cached_project_";
export const PROJECT_CACHE_TTL_MS = 10 * 60 * 1000;

export interface MainMapConfig {
  elements?: unknown[];
  width?: number;
  height?: number;
  backgroundColor?: string;
  showGrid?: boolean;
}

export interface ProjectCacheEntry {
  elements: unknown[];
  units: Record<string, unknown>;
  cachedAt: number;
}

export const fingerprintMainMap = (config: MainMapConfig): string => {
  const elCount = config.elements?.length ?? 0;
  return `${elCount}:${config.width ?? 0}:${config.height ?? 0}`;
};

export const readMainMapCache = (): {
  config: MainMapConfig | null;
  cachedAt: number;
  version: string | null;
  isFresh: boolean;
} => {
  try {
    const raw = localStorage.getItem(MAIN_MAP_CONFIG_KEY);
    const timeStr = localStorage.getItem(MAIN_MAP_TIME_KEY);
    const version = localStorage.getItem(MAIN_MAP_VERSION_KEY);
    const cachedAt = timeStr ? parseInt(timeStr, 10) : 0;
    if (!raw) {
      return { config: null, cachedAt: 0, version: null, isFresh: false };
    }
    const config = JSON.parse(raw) as MainMapConfig;
    const isFresh = cachedAt > 0 && Date.now() - cachedAt < MAIN_MAP_STALE_MS;
    return { config, cachedAt, version, isFresh };
  } catch {
    clearMainMapCache();
    return { config: null, cachedAt: 0, version: null, isFresh: false };
  }
};

export const writeMainMapCache = (
  config: MainMapConfig,
  serverVersion: string | number | null,
): boolean => {
  try {
    localStorage.setItem(MAIN_MAP_CONFIG_KEY, JSON.stringify(config));
    localStorage.setItem(MAIN_MAP_TIME_KEY, Date.now().toString());
    if (serverVersion != null) {
      localStorage.setItem(MAIN_MAP_VERSION_KEY, String(serverVersion));
    }
    return true;
  } catch (e) {
    console.warn("Main map cache write failed (quota?):", e);
    clearMainMapCache();
    return false;
  }
};

export const clearMainMapCache = () => {
  localStorage.removeItem(MAIN_MAP_CONFIG_KEY);
  localStorage.removeItem(MAIN_MAP_TIME_KEY);
  localStorage.removeItem(MAIN_MAP_VERSION_KEY);
};

export const readProjectCache = (
  projectId: string,
): ProjectCacheEntry | null => {
  try {
    const raw = sessionStorage.getItem(`${PROJECT_CACHE_PREFIX}${projectId}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as ProjectCacheEntry;
    if (Date.now() - entry.cachedAt > PROJECT_CACHE_TTL_MS) {
      sessionStorage.removeItem(`${PROJECT_CACHE_PREFIX}${projectId}`);
      return null;
    }
    return entry;
  } catch {
    sessionStorage.removeItem(`${PROJECT_CACHE_PREFIX}${projectId}`);
    return null;
  }
};

export const writeProjectCache = (
  projectId: string,
  elements: unknown[],
  units: Record<string, unknown>,
): boolean => {
  try {
    const entry: ProjectCacheEntry = {
      elements,
      units,
      cachedAt: Date.now(),
    };
    sessionStorage.setItem(
      `${PROJECT_CACHE_PREFIX}${projectId}`,
      JSON.stringify(entry),
    );
    return true;
  } catch (e) {
    console.warn(`Project cache write failed for ${projectId}:`, e);
    return false;
  }
};

export const clearProjectCache = (projectId?: string) => {
  if (projectId) {
    sessionStorage.removeItem(`${PROJECT_CACHE_PREFIX}${projectId}`);
    return;
  }
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(PROJECT_CACHE_PREFIX)) keysToRemove.push(key);
  }
  keysToRemove.forEach((k) => sessionStorage.removeItem(k));
};
