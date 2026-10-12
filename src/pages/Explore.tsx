import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapElement, Project } from "@/types/project";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { validateCenterSession } from "@/lib/center-auth";
import { canAccessExplore } from "@/lib/dept-permissions";
import { getStatusLabel, getStatusMeta, PRIMARY_STATUSES } from "@/lib/unit-status";
import { getHouseArea } from "@/lib/units";
import {
  fetchNativeSupabase,
  fetchProjectUnitsParallel,
  fetchWithRetry,
  formatLightweightUnits,
} from "@/lib/supabase-rest";
import { showError, showSuccess } from "@/utils/toast";
import UnitDetailsModal from "@/components/UnitDetailsModal";
import TowerDetailsModal from "@/components/TowerDetailsModal";
import { buildWorld, statusHex } from "@/explore3d/buildWorld";
import { ExploreCanvas } from "@/explore3d/ExploreCanvas";
import type { ExplorePick, ExploreWorld, UnitLite } from "@/explore3d/types";

const DEFAULT_PERMISSIONS = {
  showPrice: true,
  showCustomerName: true,
  showCustomerPhone: true,
  showTaboInfo: true,
  showTaboNum: true,
  showTaboStatus: true,
  showHandoverInfo: true,
  showSaleDate: true,
  showStatusField: true,
  canEditUnitData: false,
  showBrochureButton: true,
  canAccessPaymentForm: true,
  canAccessExplore: true,
};

const slimCatalog = (elements: MapElement[] | undefined): MapElement[] => {
  if (!Array.isArray(elements)) return [];
  return elements
    .filter((el) => el?.type === "house" || el?.type === "tower")
    .map((el) => ({
      id: el.id,
      type: el.type,
      label: el.label || "",
      points: [],
      rotation: 0,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      floors: el.floors,
      apartmentsPerFloor: el.apartmentsPerFloor,
      groundFloorSizes: el.groundFloorSizes,
      typicalFloorSizes: el.typicalFloorSizes,
      customArea: el.customArea,
    }));
};

const Explore = ({ projects }: { projects: Project[] }) => {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [permitted, setPermitted] = useState(true);
  const [permissions, setPermissions] = useState<any>(DEFAULT_PERMISSIONS);
  const [houseTypeAreas, setHouseTypeAreas] = useState<Record<string, Record<string, number>>>({});
  const [projectId, setProjectId] = useState("");
  const [world, setWorld] = useState<ExploreWorld | null>(null);
  const [catalog, setCatalog] = useState<MapElement[]>([]);
  const [units, setUnits] = useState<Record<string, UnitLite>>({});
  const [loading, setLoading] = useState(false);
  const [unitOpen, setUnitOpen] = useState(false);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [towerOpen, setTowerOpen] = useState(false);
  const [towerId, setTowerId] = useState<string | null>(null);
  const [apartmentKey, setApartmentKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const { session } = await validateCenterSession(supabase);
      if (cancelled) return;
      if (!session) {
        setAllowed(false);
        return;
      }
      setAllowed(true);
      const { data: settings } = await supabase
        .from("settings")
        .select("key, value")
        .in("key", ["dept_permissions", "project_configs"]);
      if (cancelled || !settings) return;
      const permsRow = settings.find((row) => row.key === "dept_permissions");
      const configRow = settings.find((row) => row.key === "project_configs");
      const deptPerms = (permsRow?.value as Record<string, Record<string, boolean>> | undefined)?.[session.type];
      const merged = { ...DEFAULT_PERMISSIONS, ...(deptPerms || {}) };
      setPermissions(merged);
      setPermitted(canAccessExplore(merged));
      const configs = (configRow?.value || {}) as Record<string, { houseTypeAreas?: Record<string, number> }>;
      const areas: Record<string, Record<string, number>> = {};
      Object.entries(configs).forEach(([id, config]) => {
        if (config?.houseTypeAreas) areas[id] = config.houseTypeAreas;
      });
      setHouseTypeAreas(areas);
    };
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!projectId) {
      setWorld(null);
      setCatalog([]);
      setUnits({});
      return;
    }

    const project = projects.find((item) => item.id === projectId);
    let cancelled = false;
    setLoading(true);
    setWorld(null);
    setUnitOpen(false);
    setTowerOpen(false);

    const load = async () => {
      try {
        const [rows, unitRows] = await Promise.all([
          fetchWithRetry(() =>
            fetchNativeSupabase(
              `projects?select=elements,map_width,map_height&id=eq.${encodeURIComponent(projectId)}`,
            ),
          ),
          fetchProjectUnitsParallel(projectId),
        ]);
        if (cancelled) return;
        const row = Array.isArray(rows) ? rows[0] : rows;
        const lightUnits = formatLightweightUnits(unitRows);
        setUnits(lightUnits);
        setCatalog(slimCatalog(row?.elements));
        setWorld(
          buildWorld(
            row?.elements,
            row?.map_width || project?.mapWidth || 0,
            row?.map_height || project?.mapHeight || 0,
            lightUnits,
          ),
        );
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        showError("تعذّر تحميل مشهد المشروع.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, projects]);

  const paintUnit = (key: string, status: string) => {
    const color = statusHex(status);
    setWorld((current) => {
      if (!current) return current;
      return {
        ...current,
        houses: current.houses.map((house) =>
          house.id === key ? { ...house, status, color } : house,
        ),
        apartments: current.apartments.map((apt) =>
          apt.unitKey === key ? { ...apt, status, color } : apt,
        ),
      };
    });
  };

  const saveUnit = async (key: string, data: any) => {
    if (!projectId) return;
    try {
      const { error } = await supabase
        .from("houses_data")
        .upsert({ unit_key: key, project_id: projectId, data }, { onConflict: "unit_key" });
      if (error) throw error;
      setUnits((prev) => ({ ...prev, [key]: data }));
      paintUnit(key, data?.status || "available");
      showSuccess("تم تحديث البيانات بنجاح");
    } catch (error) {
      console.error(error);
      showError("فشل في حفظ البيانات");
    }
  };

  const openPick = async (pick: ExplorePick | null) => {
    if (!pick || !projectId) return;
    if (pick.kind === "amenity" || pick.kind === "tree") return;

    if (pick.kind === "house") {
      try {
        const { data, error } = await supabase
          .from("houses_data")
          .select("unit_key, data")
          .eq("project_id", projectId)
          .eq("unit_key", pick.id)
          .maybeSingle();
        if (error) throw error;
        if (data?.data) setUnits((prev) => ({ ...prev, [pick.id]: data.data }));
      } catch (error) {
        console.error(error);
      }
      setUnitId(pick.id);
      setUnitOpen(true);
      return;
    }

    const towerKey = pick.id;
    try {
      const { data, error } = await supabase
        .from("houses_data")
        .select("unit_key, data")
        .eq("project_id", projectId)
        .like("unit_key", `${towerKey}_%`);
      if (error) throw error;
      if (data?.length) {
        setUnits((prev) => {
          const next = { ...prev };
          data.forEach((row) => {
            if (row.data) next[row.unit_key] = row.data;
          });
          return next;
        });
      }
    } catch (error) {
      console.error(error);
    }
    setTowerId(towerKey);
    setApartmentKey(pick.kind === "apartment" ? pick.unitKey || null : null);
    setTowerOpen(true);
  };

  const selectedHouse = catalog.find((el) => el.id === unitId && el.type === "house");
  const selectedTower = catalog.find((el) => el.id === towerId && el.type === "tower");

  if (allowed === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-[13px] text-fg-muted">
        جاري التحقق من الجلسة
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-fg">
        <p className="text-[14px]">يلزم تسجيل الدخول لفتح الاستكشاف الثلاثي.</p>
        <Link to="/">
          <Button variant="outline">العودة للرئيسية</Button>
        </Link>
      </div>
    );
  }

  if (!permitted) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-fg" dir="rtl">
        <p className="text-[14px]">لا تملك صلاحية نظام الاستكشاف.</p>
        <Link to="/">
          <Button variant="outline">العودة للرئيسية</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#dce8f0] text-fg" dir="rtl">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 border-b border-black/10 bg-white/80 px-4 py-2 backdrop-blur-md">
        <Link to="/" className="text-[13px] text-fg-secondary hover:text-fg">
          الرئيسية
        </Link>
        <Select value={projectId || undefined} onValueChange={setProjectId}>
          <SelectTrigger className="h-8 w-[240px] bg-white text-[12px]">
            <SelectValue placeholder="اختر المشروع" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {world && !loading && (
          <p className="hidden text-[11px] text-fg-muted sm:block">
            منازل {world.houses.length} · عمارات {world.towers.length} · شقق {new Set(world.apartments.map((apt) => apt.unitKey)).size}
          </p>
        )}
        <p className="ms-auto hidden text-[11px] text-fg-faint md:block">
          اسحب للتدوير · العجلة للتقريب · نقرتان للانتقال · انقر وحدة للحجز
        </p>
      </div>

      <div className="absolute inset-0 top-12">
        {!projectId ? (
          <div className="flex h-full items-center justify-center text-[14px] text-fg-secondary">
            اختر مشروعاً لفتحه مجسّماً
          </div>
        ) : loading ? (
          <div className="flex h-full items-center justify-center text-[14px] text-fg-secondary">
            جاري بناء المشهد
          </div>
        ) : world ? (
          <ExploreCanvas world={world} onPick={openPick} />
        ) : (
          <div className="flex h-full items-center justify-center text-[14px] text-fg-secondary">
            لا توجد بيانات لهذا المشروع
          </div>
        )}
      </div>

      {world && !loading && (
        <div className="absolute bottom-4 start-4 z-10 flex flex-wrap gap-2 bg-white/85 px-3 py-2 text-[11px] backdrop-blur-md">
          {PRIMARY_STATUSES.map((status) => (
            <span key={status} className="flex items-center gap-1.5">
              <span
                className="size-2.5"
                style={{ backgroundColor: getStatusMeta(status).fill }}
              />
              {getStatusLabel(status)}
            </span>
          ))}
        </div>
      )}

      <UnitDetailsModal
        isOpen={unitOpen}
        onClose={() => setUnitOpen(false)}
        onSave={saveUnit}
        unitId={unitId}
        unitLabel={selectedHouse?.label}
        initialData={unitId ? units[unitId] : undefined}
        permissions={permissions}
        unitSize={selectedHouse ? getHouseArea(selectedHouse, houseTypeAreas[projectId] || {}) : undefined}
        projectId={projectId || undefined}
      />
      <TowerDetailsModal
        isOpen={towerOpen}
        onClose={() => {
          setTowerOpen(false);
          setApartmentKey(null);
        }}
        tower={selectedTower}
        housesData={units}
        onSaveApartment={saveUnit}
        permissions={permissions}
        initialSelectedApartmentKey={apartmentKey}
        projectId={projectId || undefined}
      />
    </div>
  );
};

export default Explore;
