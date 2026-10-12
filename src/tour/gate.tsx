import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { validateCenterSession } from "@/lib/center-auth";

export const useCenterAllowed = () => {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    let cancel = false;
    validateCenterSession(supabase).then(({ session }) => {
      if (!cancel) setAllowed(!!session);
    });
    return () => {
      cancel = true;
    };
  }, []);
  return allowed;
};

export const TourDenied = () => (
  <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#f6f4ef] text-[#1c1917]" dir="rtl">
    <p className="text-[14px]">يلزم تسجيل الدخول لفتح الجولة.</p>
    <Link to="/" className="border border-black/15 px-3 py-1.5 text-[13px]">
      العودة للرئيسية
    </Link>
  </div>
);

export const TourLoading = () => (
  <div className="flex h-screen items-center justify-center bg-[#f6f4ef] text-[13px] text-[#6b645c]" dir="rtl">
    جاري التحقق من الجلسة
  </div>
);
