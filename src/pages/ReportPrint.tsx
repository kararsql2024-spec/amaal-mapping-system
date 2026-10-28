import React, { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import { REPORT_SECTIONS, type ReportSectionId } from "@/lib/report-narrative";
import { loadReportPack, type PerformancePoint, type ReportPack, type ReportTable } from "@/lib/report-pack";
import { Cell, Pie, PieChart } from "recharts";
import "@/styles/report-print.css";

const isNumber = (value: string | number) => typeof value === "number";

const monthLabel = (key: string, fallback: string) => {
  const match = /^(\d{4})-(\d{2})/.exec(key || "");
  if (!match) return fallback;
  return new Date(Number(match[1]), Number(match[2]) - 1, 1).toLocaleString("ar-EG", { month: "long" });
};

const groupByYear = <T extends { key?: string }>(rows: T[]) => {
  const years = new Map<string, T[]>();
  rows.forEach((row) => {
    const year = /^(\d{4})/.exec(row.key || "")?.[1] || "—";
    const list = years.get(year) || [];
    list.push(row);
    years.set(year, list);
  });
  return Array.from(years.entries());
};

const moneyText = (value: number, currency: "IQD" | "USD") =>
  currency === "USD" ? `$${formatNumber(value)}` : formatNumber(value);

const Metric = ({ label, value, max, color, currency = "IQD" }: { label: string; value: number; max: number; color: string; currency?: "IQD" | "USD" }) => (
  <div className="rpt-metric">
    <span>{label}</span>
    <i><b style={{ width: `${max > 0 ? Math.max(value > 0 ? 4 : 0, Math.round((value / max) * 100)) : 0}%`, background: color }} /></i>
    <span className="num">{currency === "USD" || label.includes("$") ? moneyText(value, "USD") : formatNumber(value)}</span>
  </div>
);

const PerformanceBlock = ({ title, rows, total }: { title: string; rows: PerformancePoint[]; total?: PerformancePoint | null }) => {
  if (rows.length === 0) return null;
  const ranked = total ? [...rows, total] : rows;
  const maxOf = (key: string) => Math.max(0, ...ranked.map((row) => row.bars.find((bar) => bar.key === key)?.value || 0));
  const line = (row: PerformancePoint, totalLine = false) => (
    <div key={`${row.name}-${totalLine ? "total" : "row"}`} className={totalLine ? "rpt-month rpt-total" : "rpt-month"}>
      <b>{totalLine ? "المجموع" : row.name}</b>
      <div>
        {row.bars.map((bar) => (
          <Metric key={bar.key} label={bar.key} value={bar.value} max={maxOf(bar.key)} color={bar.color} />
        ))}
      </div>
    </div>
  );
  return (
    <div className={rows.length <= 6 ? "rpt-year rpt-keep" : "rpt-year rpt-flow"}>
      <h3>{title}</h3>
      {rows.map((row) => line(row))}
      {total ? line(total, true) : null}
    </div>
  );
};

const YearTotal = ({ count, iqd, usd, showIQD, showUSD, label = "مجموع السنة" }: { count?: number; iqd: number; usd: number; showIQD: boolean; showUSD: boolean; label?: string }) => (
  <div className="rpt-sum">
    <b>{label}</b>
    {count != null && <span>العدد <span className="num">{formatNumber(count)}</span></span>}
    {showIQD && <span>دينار <span className="num">{formatNumber(iqd)}</span></span>}
    {showUSD && <span>دولار <span className="num">${formatNumber(usd)}</span></span>}
  </div>
);

const DataTable = ({ table }: { table: ReportTable }) => (
  <div className={table.rows.length <= 12 ? "rpt-keep" : "rpt-flow"}>
    {table.title ? <div className="rpt-subtitle">{table.title}</div> : null}
    <table className="rpt-table">
      {table.headers.length > 0 && (
        <thead>
          <tr>{table.headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
      )}
      <tbody>
        {table.rows.length === 0 ? (
          <tr><td colSpan={Math.max(1, table.headers.length)}>لا توجد صفوف</td></tr>
        ) : table.rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className={isNumber(cell) ? "num" : undefined}>
                {isNumber(cell) ? formatNumber(cell) : cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {table.footer && table.rows.length > 0 && (
        <tfoot>
          <tr>
            {table.footer.map((cell, cellIndex) => (
              <td key={cellIndex} className={isNumber(cell) ? "num" : undefined}>
                {isNumber(cell) ? formatNumber(cell) : cell}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  </div>
);

const Section = ({ id, pack }: { id: ReportSectionId; pack: ReportPack }) => {
  const title = REPORT_SECTIONS.find((section) => section.id === id)?.label || "";
  return (
    <section className="rpt-section">
      <div className="rpt-head">
        <h2>{title}</h2>
        {pack.briefs[id] ? <p className="rpt-brief">{pack.briefs[id]}</p> : null}
      </div>
      {id === "cards" && (
        <div className="rpt-cards rpt-keep">
          {pack.cards.map((card) => (
            <div key={card.label} className="rpt-card">
              <div>{card.label}</div>
              <b>{card.value}</b>
              {card.hint ? <span>{card.hint}</span> : null}
            </div>
          ))}
        </div>
      )}
      {id === "status" && pack.status.length > 0 && (
        <div className="rpt-pie rpt-keep">
          <PieChart width={220} height={180}>
            <Pie data={pack.status} dataKey="value" nameKey="name" cx={100} cy={90} outerRadius={70} label={false}>
              {pack.status.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
            </Pie>
          </PieChart>
          <div>
            {pack.status.map((entry) => (
              <div key={entry.name} className="rpt-metric">
                <span><i className="rpt-dot" style={{ background: entry.color }} />{entry.name}</span>
                <i><b style={{ width: `${pack.status.reduce((sum, item) => sum + item.value, 0) > 0 ? Math.round((entry.value / pack.status.reduce((sum, item) => sum + item.value, 0)) * 100) : 0}%`, background: entry.color }} /></i>
                <span className="num">{formatNumber(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {id === "dues" && (
        <div>
          <div className="rpt-keep">
            {pack.duesMeters.map((meter) => {
              const pct = meter.total > 0 ? Math.round((meter.value / meter.total) * 100) : 0;
              return (
                <div key={`${meter.group}-${meter.label}`} className="rpt-meter">
                  <span>{meter.group} · {meter.label}</span>
                  <i><b style={{ width: `${pct}%` }} /></i>
                  <span className="num">{formatNumber(meter.value)} · {pct}%</span>
                </div>
              );
            })}
          </div>
          {groupByYear(pack.dueMonths).map(([year, months]) => {
            const maxIqd = Math.max(0, ...months.map((month) => month.iqd));
            const maxUsd = Math.max(0, ...months.map((month) => month.usd));
            return (
              <div key={year} className={months.length <= 8 ? "rpt-year rpt-keep" : "rpt-year rpt-flow"}>
                <h3>{year}</h3>
                {months.map((month) => (
                  <div key={month.key || month.name} className="rpt-month">
                    <b>{monthLabel(month.key, month.name)}</b>
                    <div>
                      {pack.showIQD && <Metric label="دينار" value={month.iqd} max={maxIqd} color="#8d1c16" />}
                      {pack.showUSD && <Metric label="دولار" value={month.usd} max={maxUsd} color="#8a6a2f" currency="USD" />}
                    </div>
                  </div>
                ))}
                <YearTotal
                  iqd={months.reduce((sum, month) => sum + month.iqd, 0)}
                  usd={months.reduce((sum, month) => sum + month.usd, 0)}
                  showIQD={pack.showIQD}
                  showUSD={pack.showUSD}
                />
              </div>
            );
          })}
          {pack.dueMonths.length > 0 && (
            <YearTotal
              label="المجموع"
              iqd={pack.dueMonths.reduce((sum, month) => sum + month.iqd, 0)}
              usd={pack.dueMonths.reduce((sum, month) => sum + month.usd, 0)}
              showIQD={pack.showIQD}
              showUSD={pack.showUSD}
            />
          )}
        </div>
      )}
      {id === "performance" && (
        <div>
          {(pack.performanceViews
            ? ([["count", "العدد"], ["contract", "قيمة العقود"], ["remaining", "المتبقي"]] as const)
            : [[pack.performanceMeasure || "count", pack.performanceMeasure === "contract" ? "قيمة العقود" : pack.performanceMeasure === "remaining" ? "المتبقي" : "العدد"] as const]
          ).map(([mode, label]) => {
            const view = pack.performanceViews?.[mode] || {
              houses: mode === (pack.performanceMeasure || "count") ? pack.performanceHouses || [] : [],
              apartments: mode === (pack.performanceMeasure || "count") ? pack.performanceApartments || [] : [],
              houseTotal: null,
              apartmentTotal: null,
            };
            return (
              <div key={mode}>
                <PerformanceBlock title={`المنازل حسب الزون — ${label}`} rows={view.houses} total={view.houseTotal} />
                <PerformanceBlock title={`الشقق حسب العمارة — ${label}`} rows={view.apartments} total={view.apartmentTotal} />
              </div>
            );
          })}
        </div>
      )}
      {id === "trend" && groupByYear(pack.trend).length > 0 && (
        <div>
          {groupByYear(pack.trend).map(([year, months]) => {
            const maxCount = Math.max(0, ...months.map((month) => month.count));
            const maxIqd = Math.max(0, ...months.map((month) => month.iqd));
            const maxUsd = Math.max(0, ...months.map((month) => month.usd));
            return (
              <div key={year} className={months.length <= 8 ? "rpt-year rpt-keep" : "rpt-year rpt-flow"}>
                <h3>{year}</h3>
                {months.map((month) => (
                  <div key={month.key || month.name} className="rpt-month">
                    <b>{monthLabel(month.key, month.name)}</b>
                    <div>
                      <Metric label="العدد" value={month.count} max={maxCount} color="#1c1c1c" />
                      {pack.showIQD && <Metric label="دينار" value={month.iqd} max={maxIqd} color="#0c5a30" />}
                      {pack.showUSD && <Metric label="دولار" value={month.usd} max={maxUsd} color="#8a6a2f" currency="USD" />}
                    </div>
                  </div>
                ))}
                <YearTotal
                  count={months.reduce((sum, month) => sum + month.count, 0)}
                  iqd={months.reduce((sum, month) => sum + month.iqd, 0)}
                  usd={months.reduce((sum, month) => sum + month.usd, 0)}
                  showIQD={pack.showIQD}
                  showUSD={pack.showUSD}
                />
              </div>
            );
          })}
        </div>
      )}
      {id === "legal" && (
        <div className="rpt-keep">
          {pack.legal.map((meter) => {
            const pct = meter.total > 0 ? Math.round((meter.value / meter.total) * 100) : 0;
            return (
              <div key={meter.label} className="rpt-meter">
                <span>{meter.label}</span>
                <i><b style={{ width: `${pct}%` }} /></i>
                <span>{formatNumber(meter.value)} · {pct}%</span>
              </div>
            );
          })}
        </div>
      )}
      {id !== "cards" && id !== "dues" && id !== "status" && id !== "performance" && id !== "trend" && id !== "legal" && (pack.tables[id] || []).map((table) => (
        <DataTable key={table.title || table.headers.join("-")} table={table} />
      ))}
    </section>
  );
};

const ReportPrint = () => {
  const [pack, setPack] = useState<ReportPack | null>(null);

  useEffect(() => {
    setPack(loadReportPack());
  }, []);

  useEffect(() => {
    const previous = document.title;
    const hide = () => { document.title = " "; };
    document.title = " ";
    window.addEventListener("beforeprint", hide);
    return () => {
      document.title = previous;
      window.removeEventListener("beforeprint", hide);
    };
  }, []);

  if (!pack) {
    return <div className="rpt-root rpt-page">لا توجد بيانات للتقرير. ارجع إلى التقارير ثم اضغط تقرير الإدارة.</div>;
  }

  return (
    <div className="rpt-root">
      <div className="rpt-toolbar">
        <Button type="button" onClick={() => { document.title = " "; window.print(); }} className="gap-2">
          <Printer size={14} />
          طباعة أو حفظ PDF
        </Button>
        <Button type="button" variant="outline" onClick={() => window.close()}>إغلاق</Button>
      </div>
      <article className="rpt-page">
        <table className="rpt-frame">
          <thead>
            <tr><td><div className="rpt-page-gap" /></td></tr>
          </thead>
          <tfoot>
            <tr><td><div className="rpt-page-gap" /></td></tr>
          </tfoot>
          <tbody>
            <tr>
              <td>
                <header className="rpt-hero">
                  <div className="rpt-kicker">تقرير مفصل</div>
                  <h1 className="rpt-title">{pack.projectName}</h1>
                  {pack.salePeriod ? <p className="rpt-period">{pack.salePeriod}</p> : null}
                  <div className="rpt-date">{pack.exportedAt}</div>
                  {(pack.projectNames || []).length > 0 && (
                    <div className="rpt-projects">
                      {pack.projectNames.map((name) => <span key={name}>{name}</span>)}
                    </div>
                  )}
                </header>
                {pack.sections.map((id) => <Section key={id} id={id} pack={pack} />)}
              </td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>
  );
};

export default ReportPrint;
