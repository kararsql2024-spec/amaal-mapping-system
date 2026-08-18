import type { PaymentPrintSettings } from "@/lib/payment-types";

export interface ProjectConfigEntry {
  backgroundColor?: string;
  showGrid?: boolean;
  houseTypeAreas?: Record<string, number>;
  projectLogo?: string;
}

export type ProjectConfigsMap = Record<string, ProjectConfigEntry>;

/** لوغو المشروع للطباعة: إعدادات الدفعات أولاً ثم project_configs */
export function resolveProjectPaymentLogo(
  projectId: string | undefined,
  printSettings: PaymentPrintSettings = {},
  projectConfigs: ProjectConfigsMap = {},
): string {
  if (printSettings.logo_url?.trim()) return printSettings.logo_url.trim();
  if (!projectId) return "";
  return projectConfigs[projectId]?.projectLogo?.trim() || "";
}
