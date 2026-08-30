import { supabase } from "@/integrations/supabase/client";
import type { MapElement } from "@/types/project";
import {
  forEachSellableUnit,
  getApartmentLabel,
  getApartmentSize,
  getHouseArea,
  getHouseType,
  isApartmentKey,
} from "@/lib/units";
import type { SaleRow } from "./types";

export interface CatalogProject {
  id: string;
  name: string;
}

export interface CatalogCenter {
  id: string;
  name: string;
}

export interface CatalogUnit {
  key: string;
  label: string;
  kind: "house" | "apartment";
  area: string;
  houseType: string;
}

const PAGE = 1000;

export const fetchCatalogProjects = async (): Promise<CatalogProject[]> => {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: String(row.id),
    name: String(row.name || "").trim(),
  }));
};

export const fetchCatalogCenters = async (): Promise<CatalogCenter[]> => {
  const { data, error } = await supabase
    .from("marketing_centers")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: String(row.id),
    name: String(row.name || "").trim(),
  }));
};

const fetchProjectRecord = async (projectId: string) => {
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, elements")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const fetchProjectHousesMap = async (
  projectId: string,
): Promise<Record<string, any>> => {
  const map: Record<string, any> = {};
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("houses_data")
      .select("unit_key, status:data->>status")
      .eq("project_id", projectId)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data || [];
    rows.forEach((row) => {
      map[row.unit_key] = { status: row.status || "available" };
    });
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return map;
};

const buildUnits = (
  elements: MapElement[],
  housesData: Record<string, any>,
): CatalogUnit[] => {
  const units: CatalogUnit[] = [];
  forEachSellableUnit(elements, (key, element, floor, apt) => {
    if (element.type === "house") {
      units.push({
        key,
        label: element.label || key,
        kind: "house",
        area: String(getHouseArea(element) || ""),
        houseType: getHouseType(element.label || ""),
      });
      return;
    }
    if (element.type === "tower" && floor != null && apt != null) {
      units.push({
        key,
        label: getApartmentLabel(element, floor, apt, housesData) || key,
        kind: "apartment",
        area: String(getApartmentSize(element, floor, apt) || ""),
        houseType: element.label || "",
      });
    }
  }, 1);
  return units.sort((a, b) =>
    a.label.localeCompare(b.label, "ar", { numeric: true }),
  );
};

export const fetchProjectUnits = async (
  projectId: string,
): Promise<CatalogUnit[]> => {
  const project = await fetchProjectRecord(projectId);
  if (!project) return [];
  const elements = Array.isArray(project.elements)
    ? (project.elements as MapElement[])
    : [];
  const housesData = await fetchProjectHousesMap(projectId);
  return buildUnits(elements, housesData);
};

const pad = (value: number) => String(value).padStart(2, "0");

export const saleDateInMonth = (
  saleDate: string,
  year: number,
  month: number,
): boolean => {
  const raw = String(saleDate || "").trim();
  if (!raw) return false;
  const prefix = `${year}-${pad(month)}`;
  if (raw.startsWith(prefix)) return true;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getFullYear() === year && parsed.getMonth() + 1 === month;
};

const fetchDistinctJsonText = async (field: "userName" | "contractPurpose"): Promise<string[]> => {
  const names = new Set<string>();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("houses_data")
      .select(`value:data->>${field}`)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const rows = data || [];
    rows.forEach((row) => {
      const value = String(row.value || "").trim();
      if (value) names.add(value);
    });
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b, "ar"));
};

export const fetchCatalogUserNames = (): Promise<string[]> =>
  fetchDistinctJsonText("userName");

export const fetchCatalogContractPurposes = (): Promise<string[]> =>
  fetchDistinctJsonText("contractPurpose");

interface SoldRow {
  unit_key: string;
  project_id: string;
  status: string | null;
  saleDate: string | null;
  name: string | null;
  userName: string | null;
  contractPurpose: string | null;
}

const fetchSoldRows = async (): Promise<SoldRow[]> => {
  const all: SoldRow[] = [];
  let from = 0;
  let useStatusFilter = true;
  while (true) {
    let query = supabase
      .from("houses_data")
      .select(
        "unit_key, project_id, status:data->>status, saleDate:data->>saleDate, name:data->>name, userName:data->>userName, contractPurpose:data->>contractPurpose",
      )
      .range(from, from + PAGE - 1);
    if (useStatusFilter) {
      query = query.eq("data->>status", "sold");
    }
    const { data, error } = await query;
    if (error && useStatusFilter) {
      useStatusFilter = false;
      from = 0;
      all.length = 0;
      continue;
    }
    if (error) throw error;
    const rows = ((data || []) as SoldRow[]).filter((row) => row.status === "sold");
    all.push(...rows);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all;
};

const fetchProjectsByIds = async (
  ids: string[],
): Promise<Array<{ id: string; name: string; elements: MapElement[] }>> => {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, elements")
    .in("id", ids);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: String(row.id),
    name: String(row.name || "").trim(),
    elements: Array.isArray(row.elements) ? (row.elements as MapElement[]) : [],
  }));
};

const resolveLabel = (
  unitKey: string,
  elements: MapElement[],
  housesData: Record<string, any>,
): { label: string; area: string; houseType: string } => {
  if (isApartmentKey(unitKey)) {
    const match = unitKey.match(/_F(\d+)_A(\d+)/i);
    const towerId = unitKey.split("_F")[0];
    const tower = elements.find((el) => el.id === towerId && el.type === "tower");
    if (tower && match) {
      const floor = Number(match[1]);
      const apt = Number(match[2]);
      return {
        label: getApartmentLabel(tower, floor, apt, housesData) || unitKey,
        area: String(getApartmentSize(tower, floor, apt) || ""),
        houseType: tower.label || "",
      };
    }
  }
  const house = elements.find((el) => el.id === unitKey && el.type === "house");
  if (house) {
    return {
      label: house.label || unitKey,
      area: String(getHouseArea(house) || ""),
      houseType: getHouseType(house.label || ""),
    };
  }
  return { label: unitKey, area: "", houseType: "" };
};

export const fetchSoldSaleRowsForMonth = async (
  year: number,
  month: number,
): Promise<SaleRow[]> => {
  const sold = (await fetchSoldRows()).filter(
    (row) =>
      row.status === "sold" && saleDateInMonth(row.saleDate || "", year, month),
  );

  const projectIds = Array.from(new Set(sold.map((row) => row.project_id)));
  const projects = await fetchProjectsByIds(projectIds);
  const projectById = new Map(projects.map((project) => [project.id, project]));

  const housesByProject = new Map<string, Record<string, any>>();
  await Promise.all(
    projectIds.map(async (projectId) => {
      housesByProject.set(projectId, await fetchProjectHousesMap(projectId));
    }),
  );

  return sold.map((row, index) => {
    const project = projectById.get(row.project_id);
    const elements = project?.elements || [];
    const housesData = housesByProject.get(row.project_id) || {};
    const resolved = resolveLabel(row.unit_key, elements, housesData);
    return {
      rowNumber: index + 1,
      cells: {},
      projectId: row.project_id,
      city: project?.name || "",
      zone: "",
      unitNumber: resolved.label,
      unitKey: row.unit_key,
      userName: row.userName || "",
      contractPurpose: row.contractPurpose || "",
      houseType: resolved.houseType,
      area: resolved.area,
      contractNumber: "",
      buyerName: row.name || "",
      saleDate: row.saleDate || "",
    };
  });
};
