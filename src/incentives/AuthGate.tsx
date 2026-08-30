import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, Mail } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { BrandMark } from "@/components/layout/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingBlock } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";

export const IncentiveAuthGate = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      showError("يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      showSuccess("تم تسجيل الدخول إلى نظام الحوافز");
    } catch (error) {
      showError(error instanceof Error ? error.message : "فشل تسجيل الدخول");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1440px] px-5 py-24">
        <LoadingBlock label="جاري التحقق من الهوية" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="w-full max-w-sm">
          <div className="mb-10 space-y-3">
            <BrandMark className="size-7" />
            <div className="space-y-1.5">
              <h1 className="text-[22px] font-normal leading-tight text-fg">نظام الحوافز</h1>
              <p className="text-[12px] text-fg-muted">
                هذه الصفحة محمية. سجّل دخول الإدارة للمتابعة.
              </p>
            </div>
          </div>
          <form onSubmit={(event) => void handleLogin(event)} className="space-y-5">
            <label className="block space-y-1.5 text-[12px] text-fg-muted">
              البريد الإلكتروني
              <div className="relative">
                <Mail className="pointer-events-none absolute inset-y-0 start-3 my-auto size-3.5 text-fg-faint" />
                <Input
                  type="email"
                  className="ps-9"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </label>
            <label className="block space-y-1.5 text-[12px] text-fg-muted">
              كلمة المرور
              <div className="relative">
                <Lock className="pointer-events-none absolute inset-y-0 start-3 my-auto size-3.5 text-fg-faint" />
                <Input
                  type="password"
                  className="ps-9"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </label>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "جاري التحقق" : "تسجيل الدخول"}
            </Button>
          </form>
          <div className="mt-8 border-t border-line pt-5 text-center">
            <Link to="/" className="text-[12px] text-fg-muted transition-colors hover:text-fg">
              العودة للرئيسية
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export const signOutIncentive = () => supabase.auth.signOut();
