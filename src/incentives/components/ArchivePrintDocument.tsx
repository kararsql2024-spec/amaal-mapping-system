import React from "react";
import { formatAmount } from "../format";
import type { ArchivePrintGroup, ArchivePrintModel, ArchivePrintMonth } from "../archive-report";
import type { ArchivePrintPayload } from "../print-payload";
import { PRINT_THEMES } from "../types";

const PageHeader = ({
  logoUrl,
  title,
  centerName,
}: {
  logoUrl?: string;
  title: string;
  centerName: string;
}) => (
  <header className="inc-print-header">
    {logoUrl ? <img src={logoUrl} alt="" className="inc-print-logo" /> : null}
    <div className="inc-print-header-text">
      <div className="inc-print-kicker">تقرير أرشيف الحوافز</div>
      <div className="inc-print-title">{title}</div>
      <div className="inc-print-center-name">{centerName}</div>
    </div>
  </header>
);

const MonthTable = ({ months }: { months: ArchivePrintMonth[] }) => (
  <div className="inc-print-city" data-tint="0">
    <div className="inc-print-city-head">
      <strong>الأشهر</strong>
      <span>{months.filter((item) => item.saved).length} شهر محفوظ</span>
    </div>
    <table className="inc-print-table">
      <thead>
        <tr>
          <th>الشهر</th>
          <th>الحالة</th>
          <th>الوحدات</th>
          <th>المبلغ</th>
        </tr>
      </thead>
      <tbody>
        {months.map((item) => (
          <tr key={item.label} className={item.saved ? undefined : "inc-print-missing"}>
            <td>{item.label}</td>
            <td>{item.saved ? "محفوظ" : "غير محفوظ"}</td>
            <td>{item.saved ? item.count : "—"}</td>
            <td>{item.saved ? `${formatAmount(item.amount)} د.ع` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const CompanyMiniCard = ({ company }: { company: ArchivePrintGroup }) => (
  <article className="inc-mini-card">
    <h3>{company.name}</h3>
    <table className="inc-mini-table">
      <thead>
        <tr>
          <th>النوع</th>
          <th>العدد</th>
          <th>المبلغ</th>
        </tr>
      </thead>
      <tbody>
        {company.types.map((line) => (
          <tr key={line.name}>
            <td>{line.name}</td>
            <td>{line.count}</td>
            <td>{formatAmount(line.amount)} د.ع</td>
          </tr>
        ))}
        {company.types.length === 0 ? (
          <tr>
            <td colSpan={3}>لا وحدات مضمّنة</td>
          </tr>
        ) : null}
        <tr>
          <td>الإجمالي</td>
          <td>{company.count}</td>
          <td>{formatAmount(company.amount)} د.ع</td>
        </tr>
      </tbody>
    </table>
  </article>
);

const Signatures = ({ note }: { note: string }) => (
  <div className="inc-print-footer">
    <div className="inc-print-sign">توقيع مدير المركز</div>
    <div className="inc-print-sign">{note}</div>
    <div className="inc-print-sign">توقيع الحسابات</div>
  </div>
);

export const ArchivePrintDocument = ({
  payload,
  logos,
}: {
  payload: ArchivePrintPayload;
  logos: Record<string, string>;
}) => {
  const { model, style } = payload;
  const pageBackground =
    PRINT_THEMES.find((item) => item.id === style.theme)?.pageBackground || "#ffffff";
  const showSummary = model.centers.length > 1;

  return (
    <div
      className={`inc-print-root inc-theme-${style.theme}`}
      dir="rtl"
      style={{
        ["--inc-accent" as string]: style.accentColor,
        ["--inc-page-bg" as string]: pageBackground,
      }}
    >
      {model.centers.map((center) => (
        <section key={center.id} className="inc-print-page">
          {style.showWatermark && logos[center.id] ? (
            <div className="inc-print-watermark" aria-hidden="true">
              <img src={logos[center.id]} alt="" style={{ opacity: 0.07 }} />
            </div>
          ) : null}
          <PageHeader
            logoUrl={logos[center.id]}
            title={style.documentTitle}
            centerName={center.name}
          />
          <div className="inc-print-inner">
            <div className="inc-print-meta">
              <span>الفترة: {model.periodLabel}</span>
              <span>التاريخ: {new Date().toLocaleDateString("ar-IQ")}</span>
            </div>
            <div className="inc-print-stats">
              <div className="inc-print-stat">
                <div className="inc-print-stat-value">{center.count}</div>
                <div className="inc-print-stat-label">وحدات مضمّنة</div>
              </div>
              <div className="inc-print-stat">
                <div className="inc-print-stat-value">{formatAmount(center.amount)}</div>
                <div className="inc-print-stat-label">إجمالي الحافز د.ع</div>
              </div>
            </div>
            <div className="inc-print-overview">
              <h2>ملخص الشركات</h2>
              <div className="inc-mini-grid">
                {center.companies.map((company) => (
                  <CompanyMiniCard key={company.name} company={company} />
                ))}
              </div>
              {center.companies.length === 0 ? (
                <p>لا وحدات مضمّنة لهذا المركز في الفترة المحفوظة.</p>
              ) : null}
            </div>
            <div className="inc-print-details">
              <h2>الأشهر والمدن</h2>
              <MonthTable months={center.months} />
              {center.cities.map((city, cityIndex) => (
                <div key={city.name} className="inc-print-city" data-tint={cityIndex % 6}>
                  <div className="inc-print-city-head">
                    <strong>{city.name}</strong>
                    <span>
                      {city.count} وحدة · {formatAmount(city.amount)} د.ع
                    </span>
                  </div>
                  <table className="inc-print-table">
                    <thead>
                      <tr>
                        <th>النوع</th>
                        <th>العدد</th>
                        <th>المبلغ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {city.types.map((line) => (
                        <tr key={line.name}>
                          <td>{line.name}</td>
                          <td>{line.count}</td>
                          <td>{formatAmount(line.amount)} د.ع</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
            <Signatures note={style.footerNote || "نظام الحوافز"} />
          </div>
        </section>
      ))}

      {showSummary ? (
        <section className="inc-print-page">
          <PageHeader title={style.documentTitle} centerName="ملخص كل المراكز" />
          <div className="inc-print-inner">
            <div className="inc-print-meta">
              <span>الفترة: {model.periodLabel}</span>
              <span>
                {model.savedCount} شهر محفوظ
                {model.missingCount ? ` · ${model.missingCount} غير محفوظ` : ""}
              </span>
            </div>
            <div className="inc-print-stats">
              <div className="inc-print-stat">
                <div className="inc-print-stat-value">{model.includedCount}</div>
                <div className="inc-print-stat-label">وحدات مضمّنة</div>
              </div>
              <div className="inc-print-stat">
                <div className="inc-print-stat-value">{formatAmount(model.totalAmount)}</div>
                <div className="inc-print-stat-label">إجمالي الحافز د.ع</div>
              </div>
            </div>
            <div className="inc-print-details">
              <h2>أشهر الفترة</h2>
              <MonthTable months={model.months} />
              <h2>المراكز</h2>
              <table className="inc-print-table">
                <thead>
                  <tr>
                    <th>المركز</th>
                    <th>الوحدات</th>
                    <th>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {model.centers.map((center) => (
                    <tr key={center.id}>
                      <td>{center.name}</td>
                      <td>{center.count}</td>
                      <td>{formatAmount(center.amount)}</td>
                    </tr>
                  ))}
                  <tr className="inc-print-total-row">
                    <td>الإجمالي العام</td>
                    <td>{model.includedCount}</td>
                    <td>{formatAmount(model.totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
              {model.truncated ? <p>الفترة أطول من ٣٦ شهراً، وعُرضت أول ٣٦ شهراً فقط.</p> : null}
            </div>
            <Signatures note={style.footerNote || "نظام الحوافز"} />
          </div>
        </section>
      ) : null}
    </div>
  );
};
