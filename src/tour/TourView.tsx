import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildTourScene } from "./buildScene";
import { TourDenied, TourLoading, useCenterAllowed } from "./gate";
import { ensureTours } from "./storage";
import { FLOOR_STEP, type TourItem, type TourTemplate } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { canAccessTour, fetchSessionDeptPermissions } from "@/lib/dept-permissions";

const lookOf = (rot: number) => {
  const angle = -((rot || 0) * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
};

const TourStage = ({ tour }: { tour: TourTemplate }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{
    goHotspot: (item: TourItem) => void;
    goHome: () => void;
    setFloor: (floor: number | "all") => void;
  } | null>(null);
  const [floor, setFloor] = useState<number | "all">(tour.floors > 1 ? "all" : 1);
  const [active, setActive] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe7e7e5);
    scene.add(new THREE.AmbientLight(0xfffdfb, 0.5));
    scene.add(new THREE.HemisphereLight(0xfffdfb, 0xe8e6e2, 0.1));
    const sun = new THREE.DirectionalLight(0xfffaf6, 0.32);
    sun.position.set(-8, 18, 6);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xfffdfb, 0.14);
    fill.position.set(10, 9, -8);
    scene.add(fill);

    const camera = new THREE.PerspectiveCamera(74, 1, 0.08, 140);
    const homePos = new THREE.Vector3(11, 30, 8.35);
    const homeTarget = new THREE.Vector3(11, 0, 8);
    camera.position.copy(homePos);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(homeTarget);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4;
    controls.maxDistance = 70;
    controls.minPolarAngle = 0.08;
    controls.maxPolarAngle = 1.15;
    controls.update();

    let built = buildTourScene(tour, tour.floors > 1 ? "all" : 1);
    scene.add(built.root);
    const disposeRoot = (root: THREE.Object3D) => {
      const seen = new Set<THREE.Material | THREE.Texture>();
      root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = mesh.material as THREE.Material | THREE.Material[] | undefined;
        const list = Array.isArray(materials) ? materials : materials ? [materials] : [];
        list.forEach((entry) => {
          if (seen.has(entry)) return;
          seen.add(entry);
          const mapped = entry as THREE.Material & { map?: THREE.Texture | null };
          if (mapped.map && !seen.has(mapped.map)) {
            seen.add(mapped.map);
            mapped.map.dispose();
          }
          entry.dispose();
        });
      });
    };
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let frame = 0;
    let flight: {
      start: number;
      fromPos: THREE.Vector3;
      toPos: THREE.Vector3;
      fromTarget: THREE.Vector3;
      toTarget: THREE.Vector3;
    } | null = null;

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (width < 2 || height < 2) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      const edge = built.root.userData.wallEdge as { resolution?: { set: (x: number, y: number) => void } } | undefined;
      edge?.resolution?.set(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let pinned = false;
    const eye = new THREE.Vector3();
    let yaw = 0;
    let pitch = 0;
    let lookDrag = false;
    let lookMoved = false;
    let orbitDrag = false;
    let lastX = 0;
    let lastY = 0;
    const applyFov = (value: number) => {
      camera.fov = value;
      camera.updateProjectionMatrix();
    };
    const applyLook = () => {
      const span = Math.cos(pitch);
      camera.position.copy(eye);
      camera.lookAt(eye.x + Math.sin(yaw) * span, eye.y + Math.sin(pitch), eye.z + Math.cos(yaw) * span);
    };

    const tick = () => {
      if (flight) {
        const k = Math.min(1, (performance.now() - flight.start) / 680);
        const eased = k < 0.5 ? 4 * k * k * k : 1 - ((-2 * k + 2) ** 3) / 2;
        camera.position.lerpVectors(flight.fromPos, flight.toPos, eased);
        controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased);
        if (k >= 1) {
          flight = null;
          if (pinned) applyLook();
          else controls.enabled = true;
        }
      } else if (pinned) {
        applyLook();
      } else {
        controls.update();
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };
    tick();

    const standAt = (item: TourItem) => {
      eye.set(item.x, (item.floor - 1) * FLOOR_STEP + 1.55, item.y);
      const look = lookOf(item.rot);
      yaw = Math.atan2(look.x, look.z);
      pitch = 0;
      pinned = true;
      controls.enabled = false;
      applyFov(90);
      flight = {
        start: performance.now(),
        fromPos: camera.position.clone(),
        toPos: eye.clone(),
        fromTarget: controls.target.clone(),
        toTarget: eye.clone().add(look),
      };
    };

    apiRef.current = {
      goHotspot: standAt,
      goHome: () => {
        pinned = false;
        lookDrag = false;
        controls.enabled = false;
        controls.enablePan = true;
        controls.enableRotate = true;
        controls.minDistance = 4;
        controls.maxDistance = 70;
        controls.minPolarAngle = 0.08;
        controls.maxPolarAngle = 1.15;
        applyFov(74);
        flight = {
          start: performance.now(),
          fromPos: camera.position.clone(),
          toPos: homePos.clone(),
          fromTarget: controls.target.clone(),
          toTarget: homeTarget.clone(),
        };
      },
      setFloor: (next) => {
        scene.remove(built.root);
        disposeRoot(built.root);
        built = buildTourScene(tour, next);
        scene.add(built.root);
      },
    };

    const hotspotIdOf = (object?: THREE.Object3D | null) => {
      let current = object || null;
      while (current) {
        const id = current.userData?.hotspotId as string | undefined;
        if (id) return id;
        current = current.parent;
      }
      return null;
    };
    const pickHotspot = (event: { clientX: number; clientY: number }) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(built.hotspots.map((spot) => spot.mesh), true)[0];
      return hotspotIdOf(hit?.object);
    };
    const enterHotspot = (event: MouseEvent) => {
      if (lookMoved || orbitDrag) return;
      const hotspotId = pickHotspot(event);
      const item = hotspotId ? tour.items.find((entry) => entry.id === hotspotId) : null;
      if (!item) return;
      setActive(item.id);
      standAt(item);
    };
    const onPointerDown = (event: PointerEvent) => {
      lastX = event.clientX;
      lastY = event.clientY;
      if (!pinned) {
        orbitDrag = false;
        return;
      }
      lookDrag = true;
      lookMoved = false;
    };
    const onPointerMove = (event: PointerEvent) => {
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      if (!pinned && (event.buttons & 1) === 1 && Math.abs(dx) + Math.abs(dy) > 4) orbitDrag = true;
      if (lookDrag && pinned) {
        if (Math.abs(dx) + Math.abs(dy) > 3) lookMoved = true;
        yaw -= dx * 0.0045;
        pitch = Math.max(-1.05, Math.min(1.05, pitch - dy * 0.0035));
        lastX = event.clientX;
        lastY = event.clientY;
        return;
      }
      const hotspotId = pickHotspot(event);
      const hostBox = host.getBoundingClientRect();
      const x = event.clientX - hostBox.left + 16;
      const y = event.clientY - hostBox.top + 16;
      setHovered((current) => (current === hotspotId ? current : hotspotId));
      setTip((current) => {
        if (!hotspotId) return current ? null : current;
        if (current && current.id === hotspotId && Math.abs(current.x - x) < 6 && Math.abs(current.y - y) < 6) return current;
        return { id: hotspotId, x, y };
      });
    };
    const onPointerUp = () => {
      lookDrag = false;
    };
    const onPointerLeave = () => setTip(null);
    renderer.domElement.addEventListener("dblclick", enterHotspot);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("pointerup", onPointerUp);

    return () => {
      cancelAnimationFrame(frame);
      disposeRoot(built.root);
      observer.disconnect();
      renderer.domElement.removeEventListener("dblclick", enterHotspot);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
      apiRef.current = null;
    };
  }, [tour]);

  const spots = tour.items.filter(
    (item) => item.kind === "hotspot" && (floor === "all" || item.floor === floor),
  );

  return (
    <div className="flex h-screen flex-col bg-[#f6f4ef] text-[#1c1917]" dir="rtl">
      <header className="flex items-center gap-3 border-b border-black/10 bg-white/80 px-4 py-2">
        <Link to="/toureditor" className="text-[13px] text-[#6b645c]">
          المحرر
        </Link>
        <p className="text-[14px]">{tour.name}</p>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {tour.floors > 1 && (
            <>
              <button
                type="button"
                className={`border px-2 py-1 text-[12px] ${floor === "all" ? "border-[#1c1917]" : "border-black/15"}`}
                onClick={() => {
                  setFloor("all");
                  apiRef.current?.setFloor("all");
                }}
              >
                كل الطوابق
              </button>
              {Array.from({ length: tour.floors }, (_, index) => index + 1).map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`border px-2 py-1 text-[12px] ${floor === level ? "border-[#1c1917]" : "border-black/15"}`}
                  onClick={() => {
                    setFloor(level);
                    apiRef.current?.setFloor(level);
                  }}
                >
                  طابق {level}
                </button>
              ))}
            </>
          )}
          <button
            type="button"
            className="border border-black/15 px-2 py-1 text-[12px]"
            onClick={() => {
              setActive(null);
              apiRef.current?.goHome();
            }}
          >
            نظرة علوية
          </button>
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        <div ref={hostRef} className="h-full w-full" />
        {tip && (() => {
          const item = tour.items.find((entry) => entry.id === tip.id);
          if (!item) return null;
          return (
            <div className="pointer-events-none absolute z-20 max-w-56 border border-black/10 bg-white px-2.5 py-2 shadow-sm" style={{ left: tip.x, top: tip.y }}>
              <p className="text-[13px]">{item.label || "نقطة"}</p>
              {item.note ? <p className="mt-1 text-[11px] leading-5 text-[#5c5c5a]">{item.note}</p> : null}
            </div>
          );
        })()}
        <aside className="absolute bottom-4 start-4 max-h-[60%] w-64 overflow-auto border border-black/10 bg-white/90 p-2">
          <p className="px-1 pb-2 text-[11px] text-[#6b645c]">نقاط الجولة · نقرتان للدخول</p>
          {spots.length === 0 && <p className="px-1 text-[12px] text-[#6b645c]">لا توجد نقاط في هذا الطابق.</p>}
          {spots.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`mb-1 block w-full px-2 py-1.5 text-start text-[13px] ${active === item.id ? "bg-[#1c1917] text-white" : hovered === item.id ? "bg-black/5" : "hover:bg-black/5"}`}
              onMouseEnter={() => setHovered(item.id)}
              onMouseLeave={() => setHovered((current) => (current === item.id ? null : current))}
              onDoubleClick={() => {
                setActive(item.id);
                apiRef.current?.goHotspot(item);
              }}
            >
              <span className="block">{item.label || "نقطة"}</span>
              {item.note && (hovered === item.id || active === item.id) && (
                <span className={`mt-1 block text-[11px] leading-5 ${active === item.id ? "text-white/80" : "text-[#5c5c5a]"}`}>{item.note}</span>
              )}
            </button>
          ))}
        </aside>
      </div>
    </div>
  );
};

const TourView = () => {
  const { tourId } = useParams();
  const allowed = useCenterAllowed();
  const [tourAllowed, setTourAllowed] = useState<boolean | null>(null);
  const [tour, setTour] = useState<TourTemplate | null | undefined>(undefined);
  useEffect(() => {
    let cancel = false;
    fetchSessionDeptPermissions(supabase).then(({ permissions }) => {
      if (!cancel) setTourAllowed(canAccessTour(permissions));
    });
    return () => {
      cancel = true;
    };
  }, []);
  useEffect(() => {
    if (!tourId) {
      setTour(null);
      return;
    }
    let cancel = false;
    ensureTours().then((result) => {
      if (!cancel) setTour(result.tours.find((entry) => entry.id === tourId) || null);
    });
    return () => {
      cancel = true;
    };
  }, [tourId]);
  if (allowed === null || tour === undefined || tourAllowed === null) return <TourLoading />;
  if (!allowed) return <TourDenied />;
  if (!tourAllowed) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#f6f4ef]" dir="rtl">
        <p className="text-[14px]">لا تملك صلاحية نظام الجولة.</p>
        <Link to="/" className="text-[13px] underline">
          العودة للرئيسية
        </Link>
      </div>
    );
  }
  if (!tour) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#f6f4ef]" dir="rtl">
        <p className="text-[14px]">هذه الجولة غير موجودة.</p>
        <Link to="/toureditor" className="text-[13px] underline">
          فتح المحرر
        </Link>
      </div>
    );
  }
  return <TourStage key={tour.updatedAt} tour={tour} />;
};

export default TourView;
