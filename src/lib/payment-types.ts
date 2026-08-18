export type PaymentUnitType = "apartment" | "house";

export interface PaymentInstallment {
  id: string;
  date: string;
  amount: string;
  label: string;
  isLocked: boolean;
}

export interface PaymentBookingRecord {
  id: string;
  project_id: string;
  unit_key: string;
  marketing_center_id: string;
  created_by_center_name?: string;
  client_name: string;
  phone1: string;
  phone2: string;
  address: string;
  education: string;
  unit_type: PaymentUnitType;
  zone?: string;
  block?: string;
  house_type?: string;
  house_num?: string;
  building?: string;
  floor?: string;
  apartment?: string;
  total_area?: string;
  net_area?: string;
  delivery_period?: string;
  total_price: number;
  discovery_method?: string;
  discovery_relation?: string;
  discovery_phone?: string;
  signing_amount: number;
  housing_condition_amount?: number;
  show_commission_note: boolean;
  installments: PaymentInstallment[];
  notes?: string;
  created_at: string;
  updated_at?: string;
  projects?: { id: string; name: string };
  marketing_centers?: { id: string; name: string };
}

export interface PaymentPrintSettings {
  frame_color?: string;
  logo_url?: string;
  static_text_color?: string;
  dynamic_text_color?: string;
  border_style?: string;
  watermark_opacity?: number;
}

export interface PaymentDefaults {
  installment_count: number;
  installment_interval_months: number;
  show_commission_note: boolean;
}

/** نوع منزل في إعدادات الدفعات — area ثابتة أو فارغة = من الخريطة */
export interface PaymentHouseTypeConfig {
  type: string;
  area?: number | null;
}

/** مساحة شقة محددة مسبقاً (كلية + صافية) */
export interface PaymentApartmentAreaConfig {
  total_area: number;
  net_area: number;
}

export interface PaymentProjectUnitSettings {
  house_types: PaymentHouseTypeConfig[];
  apartment_areas: PaymentApartmentAreaConfig[];
}

export type PaymentProjectUnitSettingsMap = Record<string, PaymentProjectUnitSettings>;

export const EMPTY_PAYMENT_UNIT_SETTINGS: PaymentProjectUnitSettings = {
  house_types: [],
  apartment_areas: [],
};

export const DEFAULT_PAYMENT_DEFAULTS: PaymentDefaults = {
  installment_count: 6,
  installment_interval_months: 6,
  show_commission_note: true,
};
