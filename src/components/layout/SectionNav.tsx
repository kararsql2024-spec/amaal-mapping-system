import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  canAccessExplore,
  canAccessMap2d,
  canAccessPaymentArchive,
  canAccessPaymentFollowup,
  fetchSessionDeptPermissions,
  type DeptPermissionMap,
} from "@/lib/dept-permissions";
import { cn } from "@/lib/utils";

export type SectionItem = {
  to: string;
  label: string;
  detail: string;
};

/** الأقسام التي يفتحها هذا الحساب، بالترتيب الذي تظهر به البطاقات. */
export function listSections(perms?: DeptPermissionMap | null): SectionItem[] {
  const items: SectionItem[] = [];
  if (canAccessMap2d(perms)) {
    items.push({
      to: "/map",
      label: "المخطط ثنائي الأبعاد",
      detail: "يفتح المخطط العام للمدينة، ثم المشاريع والبحث والحجوزات.",
    });
  }
  if (canAccessExplore(perms)) {
    items.push({
      to: "/explore",
      label: "المخطط 3D",
      detail: "عرض المشروع مجسّماً والتنقل بين الوحدات.",
    });
  }
  if (canAccessPaymentFollowup(perms)) {
    items.push({
      to: "/followup",
      label: "متابعة الدفعات",
      detail: "الواصل والمتبقي والمتلكئ على الوحدات السكنية.",
    });
  }
  if (!perms || perms.canAccessReports !== false) {
    items.push({
      to: "/reports",
      label: "التقارير",
      detail: "ملخص المبيعات والتسديد للمشاريع.",
    });
  }
  if (canAccessPaymentArchive(perms)) {
    items.push({
      to: "/sales/archive",
      label: "أرشيف الدفعات",
      detail: "استمارات تنظيم آلية الدفعات المحفوظة.",
    });
  }
  return items;
}

const markStroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.25,
  strokeLinejoin: "miter" as const,
  strokeLinecap: "square" as const,
};

/** علامة صغيرة لكل قسم، بخط واحد ومن غير لون زائد. */
export const SectionMark = ({ to }: { to: string }) => (
  <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-line text-fg-secondary">
    <svg viewBox="0 0 32 32" className="h-6 w-6" aria-hidden="true">
      {to === "/map" ? (
        <>
          <rect x="5" y="5" width="22" height="22" {...markStroke} />
          <path d="M5 13.5h22M5 21h22M13.5 5v22M21 13.5V27" {...markStroke} />
        </>
      ) : to === "/explore" ? (
        <>
          <path d="M16 5.5 26 11 16 16.5 6 11Z" {...markStroke} />
          <path d="M6 11v8.5L16 25V16.5M26 11v8.5L16 25" {...markStroke} />
        </>
      ) : to === "/followup" ? (
        <>
          <rect x="8" y="4.5" width="16" height="23" {...markStroke} />
          <path d="M12 11h8M12 15.5h8M12 20h5" {...markStroke} />
        </>
      ) : to === "/reports" ? (
        <>
          <path d="M5 26h22" {...markStroke} />
          <path d="M8 26V17h4v9M14 26V11h4v15M20 26V15h4v11" {...markStroke} />
        </>
      ) : (
        <>
          <path d="M5 13h8l2 2h12v12H5Z" {...markStroke} />
          <path d="M5 18h22" {...markStroke} />
        </>
      )}
    </svg>
  </span>
);

const NavLink = ({ to, label, active }: { to: string; label: string; active: boolean }) => (
  <Link to={to} className="shrink-0">
    <Button
      variant="ghost"
      size="sm"
      className={cn("px-2", active ? "text-fg" : "text-fg-secondary")}
    >
      {label}
    </Button>
  </Link>
);

/** انتقال سريع بين الأقسام المسموحة، مع الرجوع إلى البطاقات. */
export const SectionNav = ({
  permissions,
  className,
}: {
  permissions?: DeptPermissionMap | null;
  className?: string;
}) => {
  const { pathname } = useLocation();
  const [resolved, setResolved] = useState<DeptPermissionMap | null | undefined>(permissions);

  useEffect(() => {
    if (permissions !== undefined) {
      setResolved(permissions);
      return;
    }
    let cancelled = false;
    fetchSessionDeptPermissions(supabase).then(({ permissions: next }) => {
      if (!cancelled) setResolved(next);
    });
    return () => {
      cancelled = true;
    };
  }, [permissions]);

  const sections = resolved === undefined ? [] : listSections(resolved);

  return (
    <div className={cn("flex min-w-0 items-center gap-0.5 overflow-x-auto", className)}>
      <NavLink to="/" label="الأقسام" active={pathname === "/"} />
      {sections.map((item) => (
        <NavLink key={item.to} to={item.to} label={item.label} active={pathname === item.to} />
      ))}
    </div>
  );
};
