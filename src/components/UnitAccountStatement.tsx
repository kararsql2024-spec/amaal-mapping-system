"use client";

import React, { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, getCurrencyType, parsePrice, type CurrencyType } from "@/lib/format";
import { describeDue, FOLLOWUP_TABLE, type FollowupRecord } from "@/lib/payment-followup";
import { isMissingFollowupTable } from "@/lib/payment-followup-import";
import { cn } from "@/lib/utils";

interface UnitAccountStatementProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  unitId: string;
  unitLabel: string;
  customerName: string;
  phone: string;
  saleDate: string;
  price: string;
  currency: string;
  status: string;
}

interface StatementLine {
  id: string;
  dueDate: string;
  amount: number;
  received: number;
  remaining: number;
  whenLabel: string;
  whenKind: "overdue" | "today" | "upcoming" | "unknown";
}

interface Statement {
  projectName: string;
  customerName: string;
  phone: string;
  saleDate: string;
  currency: CurrencyType;
  salePrice: number;
  totalReceived: number;
  remaining: number;
  paidInFull: boolean;
  missingFile: boolean;
  lines: StatementLine[];
}

const UnitAccountStatement = ({
  open,
  onClose,
  projectId,
  unitId,
  unitLabel,
  customerName,
  phone,
  saleDate,
  price,
  currency,
  status,
}: UnitAccountStatementProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statement, setStatement] = useState<Statement | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      setStatement(null);
      try {
        const [unitResult, countResult, projectResult] = await Promise.all([
          supabase.from(FOLLOWUP_TABLE).select("*").eq("project_id", projectId).eq("unit_key", unitId),
          supabase.from(FOLLOWUP_TABLE).select("id", { count: "exact", head: true }).eq("project_id", projectId),
          supabase.from("projects").select("name").eq("id", projectId).maybeSingle(),
        ]);
        if (unitResult.error) throw unitResult.error;
        if (countResult.error) throw countResult.error;
        if (cancelled) return;
        const rows = (unitResult.data || []) as FollowupRecord[];
        const projectHasFile = (countResult.count || 0) > 0;
        const systemPrice = parsePrice(price);
        const first = rows[0];
        const salePrice = first ? Number(first.sale_price) || systemPrice : systemPrice;
        const money = getCurrencyType(first?.currency || currency);
        const lines = rows
          .map((row, index) => {
            const amount = Number(row.installment_amount) || 0;
            const received = Number(row.received_amount) || 0;
            const due = describeDue(row.due_date || "");
            return {
              id: row.id || `${unitId}-${index}`,
              dueDate: row.due_date || "",
              amount,
              received,
              remaining: amount - received,
              whenLabel: due.whenLabel,
              whenKind: due.whenKind,
            };
          })
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        const remaining = lines.reduce((sum, line) => sum + line.remaining, 0);
        setStatement({
          projectName: projectResult.data?.name || "",
          customerName: first?.customer_name || customerName || "",
          phone: first?.phone || phone || "",
          saleDate: first?.sale_date || saleDate || "",
          currency: money,
          salePrice,
          totalReceived: projectHasFile ? salePrice - remaining : 0,
          remaining: projectHasFile ? remaining : 0,
          paidInFull: projectHasFile && rows.length === 0,
          missingFile: !projectHasFile,
          lines,
        });
      } catch (loadError) {
        if (!cancelled) {
          setError(isMissingFollowupTable(loadError) ? "جدول المتابعة غير موجود. نفّذ ملف database_payment_followup.sql" : "تعذر تحميل كشف الحساب");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, unitId, customerName, phone, saleDate, price, currency]);

  const printSheet = () => {
    const sheet = document.getElementById("unit-account-statement");
    if (!sheet) return;
    const clone = sheet.cloneNode(true) as HTMLElement;
    const sources = [sheet, ...Array.from(sheet.querySelectorAll<HTMLElement>("*"))];
    const copies = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];
    sources.forEach((source, index) => {
      const target = copies[index];
      const computed = getComputedStyle(source);
      target.style.setProperty("-webkit-print-color-adjust", "exact");
      target.style.setProperty("print-color-adjust", "exact");
      const clipped = computed.backgroundClip === "text" || computed.getPropertyValue("-webkit-text-fill-color") === "rgba(0, 0, 0, 0)";
      if (!clipped) return;
      const solid = computed.backgroundImage.includes("90, 48") || computed.backgroundImage.includes("161, 79") ? "#0c5a30" : "#8d1c16";
      target.style.color = solid;
      target.style.webkitTextFillColor = solid;
      target.style.backgroundImage = "none";
    });
    const css = Array.from(document.styleSheets).map((styleSheet) => {
      try {
        return Array.from(styleSheet.cssRules).map((rule) => rule.cssText).join("\n");
      } catch {
        return "";
      }
    }).join("\n").split("</style").join("<\\/style");
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;left:0;top:0;width:210mm;height:297mm;border:0;transform:translateX(-120vw)";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    const view = frame.contentWindow;
    if (!doc || !view) {
      frame.remove();
      return;
    }
    doc.open();
    doc.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><base href="${location.origin}/"><title> </title><style>${css}
@page{size:A4;margin:0}
html,body{margin:0;padding:10mm;background:#fff}
*{ -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; color-adjust:exact !important; }
</style></head><body>${clone.outerHTML}</body></html>`);
    doc.close();
    doc.title = " ";
    view.onafterprint = () => frame.remove();
    view.focus();
    view.print();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-h-[92vh] max-w-3xl gap-0 overflow-hidden p-0" dir="rtl">
        <DialogHeader className="flex flex-row items-center justify-between gap-3 space-y-0 border-b border-line px-5 py-3 pe-12">
          <DialogTitle className="text-base font-semibold">كشف حساب</DialogTitle>
          <Button variant="outline" size="sm" onClick={printSheet} disabled={!statement} className="gap-1.5 font-semibold">
            <Printer size={13} /> طباعة
          </Button>
        </DialogHeader>
        <div className="max-h-[calc(92vh-58px)] overflow-y-auto bg-[#f3eee6] p-4 sm:p-6">
          {loading && <p className="py-16 text-center text-[15px] font-semibold text-[#6d5e50]">جاري إعداد الكشف</p>}
          {error && <p className="py-16 text-center text-[15px] font-semibold text-[#8d1c16]">{error}</p>}
          {statement && (
            <article
              id="unit-account-statement"
              className="overflow-hidden rounded-2xl text-[#241c16] shadow-[0_18px_36px_-26px_rgba(48,28,10,0.55)]"
              style={{ background: "linear-gradient(165deg, #fffdf8 0%, #f7f1e6 48%, #efe4d2 100%)" }}
            >
              <header
                className="relative px-6 py-5 text-[#fbf6ee]"
                style={{ background: "linear-gradient(118deg, #241c16 0%, #3d342b 52%, #2a231c 100%)" }}
              >
                <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(90% 120% at 100% 0%, rgba(214,176,112,0.28), transparent 58%)" }} />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[12px] font-semibold text-[#e4d0ae]">كشف حساب</p>
                    <h2 className="mt-1 text-[28px] font-bold leading-none">{unitLabel}</h2>
                    <p className="mt-2 text-[14px] font-semibold text-[#f0e2c8]">
                      {[statement.projectName, status === "investment" ? "استثمار" : "مباع"].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <p className="text-[13px] font-semibold text-[#e4d0ae]">
                    {new Date().toLocaleDateString("ar-IQ", { dateStyle: "long" })}
                  </p>
                </div>
                <div className="relative mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-[12px] font-semibold text-[#e4d0ae]">الزبون</p>
                    <p className="mt-1 text-[22px] font-bold leading-tight">{statement.customerName || "بدون اسم"}</p>
                  </div>
                  <div className="sm:ps-5 sm:relative sm:before:absolute sm:before:inset-y-1 sm:before:start-0 sm:before:w-px sm:before:bg-gradient-to-b sm:before:from-transparent sm:before:via-[#ead9b8] sm:before:to-transparent">
                    <p className="text-[12px] font-semibold text-[#e4d0ae]">الهاتف</p>
                    <p className="mt-1 text-[22px] font-bold leading-tight tabular">{statement.phone || "بدون هاتف"}</p>
                  </div>
                </div>
              </header>

              <div className="grid sm:grid-cols-3">
                <Total label="السعر الكلي" value={formatMoney(statement.salePrice, statement.currency)} />
                <Total
                  label="الواصل الكلي"
                  value={statement.missingFile ? "—" : formatMoney(statement.totalReceived, statement.currency)}
                  tone="in"
                />
                <Total
                  label="المتبقي"
                  value={statement.missingFile ? "—" : formatMoney(statement.remaining, statement.currency)}
                  tone="out"
                />
              </div>

              {statement.missingFile && (
                <p className="px-6 py-4 text-[15px] font-semibold text-[#6a4b16]" style={{ background: "linear-gradient(90deg, #fff8ea, #ffe8bf 50%, #fff6e4)" }}>
                  لم يُرفع ملف دفعات لهذا المشروع بعد، لذلك لا تظهر الدفعات المستحقة.
                </p>
              )}
              {statement.paidInFull && (
                <p className="px-6 py-4 text-[16px] font-bold text-[#146636]" style={{ background: "linear-gradient(90deg, #f3fbf6 0%, #d9f3e3 52%, #eef8f2 100%)" }}>
                  سدد كامل المبلغ
                </p>
              )}
              {statement.lines.length > 0 && (
                <div>
                  <div
                    className="grid grid-cols-[112px_1.1fr_repeat(3,minmax(0,1fr))] items-center gap-2 px-5 py-2 text-[12px] font-bold text-[#6d5e50]"
                    style={{ background: "linear-gradient(90deg, rgba(255,252,247,0.2), rgba(92,68,36,0.07), rgba(255,252,247,0.15))" }}
                  >
                    <span>الاستحقاق</span>
                    <span className="ps-4">الحالة</span>
                    <span className="ps-4">مبلغ الدفعة</span>
                    <span className="ps-4">الواصل</span>
                    <span className="ps-4">المتبقي</span>
                  </div>
                  {statement.lines.map((line) => (
                    <div
                      key={line.id}
                      className="grid grid-cols-[112px_1.1fr_repeat(3,minmax(0,1fr))] items-center gap-2 px-5 py-3 text-[14px] font-semibold"
                      style={{ background: lineWash(line.whenKind) }}
                    >
                      <span className="tabular font-bold">{line.dueDate || "—"}</span>
                      <Cell>{line.whenLabel}</Cell>
                      <Cell>{formatMoney(line.amount, statement.currency)}</Cell>
                      <Cell tone="in">{formatMoney(line.received, statement.currency)}</Cell>
                      <Cell tone="out">{formatMoney(line.remaining, statement.currency)}</Cell>
                    </div>
                  ))}
                </div>
              )}
              <p className="px-6 py-3 text-[12px] font-semibold text-[#6d5e50]">
                تاريخ البيع {statement.saleDate || "—"}
                {statement.lines.length > 0 ? ` · ${statement.lines.length} دفعة مستحقة` : ""}
              </p>
            </article>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const lineWash = (kind: StatementLine["whenKind"]) => {
  if (kind === "overdue") return "linear-gradient(90deg, #fff7f5 0%, #ffd5ce 50%, #fff1ee 100%)";
  if (kind === "today") return "linear-gradient(90deg, #fffaf1 0%, #ffe3b4 50%, #fff5e2 100%)";
  if (kind === "upcoming") return "linear-gradient(90deg, #f5fbf7 0%, #d5f0df 50%, #eef8f2 100%)";
  return "linear-gradient(90deg, #fbf8f3 0%, #f1e8db 100%)";
};

const Total = ({ label, value, tone }: { label: string; value: string; tone?: "in" | "out" }) => (
  <div
    className="relative px-5 py-4 first:before:hidden before:absolute before:inset-y-3 before:start-0 before:w-px before:bg-gradient-to-b before:from-transparent before:via-[#8a7358]/45 before:to-transparent"
    style={tone === "in"
      ? { background: "linear-gradient(180deg, rgba(220,244,228,0.95), rgba(245,252,247,0.2))" }
      : tone === "out"
        ? { background: "linear-gradient(180deg, rgba(255,228,224,0.95), rgba(255,248,246,0.2))" }
        : undefined}
  >
    <p className="text-[12px] font-semibold text-[#6d5e50]">{label}</p>
    <p className="mt-1 text-[20px] font-bold tabular">
      {tone ? <Money tone={tone}>{value}</Money> : value}
    </p>
  </div>
);

const Cell = ({ children, tone }: { children: string; tone?: "in" | "out" }) => (
  <span className="relative ps-4 before:absolute before:inset-y-0.5 before:start-0 before:w-px before:bg-gradient-to-b before:from-transparent before:via-[#6b5340]/35 before:to-transparent">
    {tone ? <Money tone={tone}>{children}</Money> : children}
  </span>
);

const Money = ({ tone, children }: { tone: "in" | "out"; children: string }) => (
  <span className={cn("inline-block bg-clip-text font-bold text-transparent", tone === "in" ? "bg-[linear-gradient(180deg,#1ea14f,#0c5a30)]" : "bg-[linear-gradient(180deg,#e24b40,#8d1c16)]")}>
    {children}
  </span>
);

export default UnitAccountStatement;
