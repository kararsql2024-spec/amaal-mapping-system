import React from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { Layout, LogOut } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IncentiveAuthGate, signOutIncentive } from "./AuthGate";
import { IncentiveCatalogProvider } from "./catalog-context";
import { IncentiveSettingsProvider, useIncentiveSettings } from "./settings-context";
import CalculatePage from "./pages/CalculatePage";
import PrintPage from "./pages/PrintPage";
import SettingsPage from "./pages/SettingsPage";

const NavItem = ({ to, children }: { to: string; children: React.ReactNode }) => (
  <NavLink
    to={to}
    end
    className={({ isActive }) =>
      cn(
        "px-2.5 py-1 text-[13px] transition-colors",
        isActive ? "text-fg" : "text-fg-muted hover:text-fg",
      )
    }
  >
    {children}
  </NavLink>
);

const SyncBadge = () => {
  const { syncState } = useIncentiveSettings();
  const label =
    syncState === "loading"
      ? "جاري مزامنة الإعدادات"
      : syncState === "saving"
        ? "جاري الحفظ في السحابة"
        : syncState === "error"
          ? "تعذر الحفظ السحابي — الإعدادات ما زالت محفوظة هنا"
          : "محفوظة في السحابة";
  return <span className="hidden text-[11px] text-fg-muted sm:inline">{label}</span>;
};

const IncentiveShell = ({ children }: { children: React.ReactNode }) => (
  <AppShell
    brandSubtitle="نظام الحوافز"
    nav={
      <>
        <NavItem to="/incentives">احتساب الحافز</NavItem>
        <NavItem to="/incentives/settings">لوحة التحكم</NavItem>
      </>
    }
    actions={
      <div className="flex items-center gap-3">
        <SyncBadge />
        <Link to="/admin">
          <Button type="button" variant="ghost" size="sm" className="gap-1.5">
            <Layout className="h-3.5 w-3.5" />
            لوحة الإدارة
          </Button>
        </Link>
        <Button type="button" variant="outline" size="sm" onClick={() => void signOutIncentive()}>
          <LogOut className="h-3.5 w-3.5" />
          خروج
        </Button>
      </div>
    }
  >
    {children}
  </AppShell>
);

const IncentiveApp = () => (
  <IncentiveAuthGate>
    <IncentiveSettingsProvider>
      <IncentiveCatalogProvider>
        <Routes>
          <Route path="/incentives/print" element={<PrintPage />} />
          <Route
            path="/incentives"
            element={
              <IncentiveShell>
                <CalculatePage />
              </IncentiveShell>
            }
          />
          <Route
            path="/incentives/settings"
            element={
              <IncentiveShell>
                <SettingsPage />
              </IncentiveShell>
            }
          />
        </Routes>
      </IncentiveCatalogProvider>
    </IncentiveSettingsProvider>
  </IncentiveAuthGate>
);

export default IncentiveApp;
