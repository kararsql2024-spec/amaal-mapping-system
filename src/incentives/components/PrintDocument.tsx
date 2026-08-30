import React, { useMemo } from "react";
import { formatAmount } from "../format";
import type { IncentivePrintPayload, IncentivePrintRow } from "../print-payload";
import { PRINT_THEMES } from "../types";

const byAr = (a: string, b: string) => a.localeCompare(b, "ar", { numeric: true });

interface CityBlock {
  name: string;
  rows: IncentivePrintRow[];
  count: number;
  amount: number;
}

interface TypeLine {
  name: string;
  count: number;
  amount: number;
}

interface CompanyBlock {
  name: string;
  cities: CityBlock[];
  count: number;
  types: TypeLine[];
  amount: number;
}

interface CenterBlock {
  id: string;
  name: string;
  logoUrl: string;
  companies: CompanyBlock[];
  count: number;
  amount: number;
}

const buildTypeLines = (
  included: IncentivePrintRow[],
  unitTypeNames: string[],
): TypeLine[] => {
  const map = new Map<string, TypeLine>();
  included.forEach((row) => {
    const name = row.unitType.trim() || "غير محدد";
    const current = map.get(name) || { name, count: 0, amount: 0 };
    current.count += 1;
    current.amount += row.amount;
    map.set(name, current);
  });
  const ordered: TypeLine[] = [];
  unitTypeNames.forEach((name) => {
    const line = map.get(name);
    ordered.push(line || { name, count: 0, amount: 0 });
    map.delete(name);
  });
  Array.from(map.values())
    .sort((a, b) => byAr(a.name, b.name))
    .forEach((line) => ordered.push(line));
  return ordered;
};

const groupRows = (
  rows: IncentivePrintRow[],
  logos: Record<string, string>,
  unitTypeNames: string[],
): CenterBlock[] => {
  const centers = new Map<string, { name: string; rows: IncentivePrintRow[] }>();
  rows.forEach((row) => {
    const id = row.centerId || "__none__";
    const current = centers.get(id) || { name: row.center || "بدون مركز", rows: [] };
    current.rows.push(row);
    centers.set(id, current);
  });

  return Array.from(centers.entries())
    .sort((a, b) => byAr(a[1].name, b[1].name))
    .map(([id, center]) => {
      const companyMap = new Map<string, IncentivePrintRow[]>();
      center.rows.forEach((row) => {
        const name = row.company || "بدون شركة";
        const list = companyMap.get(name) || [];
        list.push(row);
        companyMap.set(name, list);
      });
      const companies: CompanyBlock[] = Array.from(companyMap.entries())
        .sort((a, b) => byAr(a[0], b[0]))
        .map(([name, list]) => {
          const included = list.filter((row) => row.included);
          const cityMap = new Map<string, IncentivePrintRow[]>();
          list.forEach((row) => {
            const city = row.city || "مدينة غير معروفة";
            const cityRows = cityMap.get(city) || [];
            cityRows.push(row);
            cityMap.set(city, cityRows);
          });
          const cities: CityBlock[] = Array.from(cityMap.entries())
            .sort((a, b) => byAr(a[0], b[0]))
            .map(([cityName, cityRows]) => {
              const sorted = [...cityRows].sort((a, b) => byAr(a.unitNumber, b.unitNumber));
              return {
                name: cityName,
                rows: sorted,
                count: sorted.filter((item) => item.included).length,
                amount: sorted.reduce((sum, item) => sum + item.amount, 0),
              };
            });
          return {
            name,
            cities,
            count: included.length,
            types: buildTypeLines(included, unitTypeNames),
            amount: included.reduce((sum, item) => sum + item.amount, 0),
          };
        });
      return {
        id,
        name: center.name,
        logoUrl: logos[id] || "",
        companies,
        count: companies.reduce((sum, company) => sum + company.count, 0),
        amount: companies.reduce((sum, company) => sum + company.amount, 0),
      };
    });
};

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
      <div className="inc-print-kicker">نظام الحوافز</div>
      <div className="inc-print-title">{title}</div>
      <div className="inc-print-center-name">{centerName}</div>
    </div>
  </header>
);

const CompanyMiniCard = ({ company }: { company: CompanyBlock }) => (
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

export const IncentivePrintDocument = ({
  payload,
  logos,
}: {
  payload: IncentivePrintPayload;
  logos: Record<string, string>;
}) => {
  const centers = useMemo(
    () => groupRows(payload.rows, logos, payload.unitTypeNames || []),
    [logos, payload.rows, payload.unitTypeNames],
  );
  const grandCount = centers.reduce((sum, center) => sum + center.count, 0);
  const grandAmount = centers.reduce((sum, center) => sum + center.amount, 0);
  const style = payload.style;
  const pageBackground =
    PRINT_THEMES.find((item) => item.id === style.theme)?.pageBackground || "#ffffff";

  return (
    <div
      className={`inc-print-root inc-theme-${style.theme}`}
      dir="rtl"
      style={{
        ["--inc-accent" as string]: style.accentColor,
        ["--inc-page-bg" as string]: pageBackground,
      }}
    >
      {centers.map((center) => (
        <section key={center.id} className="inc-print-page">
          {style.showWatermark && center.logoUrl ? (
            <div className="inc-print-watermark" aria-hidden="true">
              <img src={center.logoUrl} alt="" style={{ opacity: 0.07 }} />
            </div>
          ) : null}

          <PageHeader
            logoUrl={center.logoUrl}
            title={style.documentTitle}
            centerName={center.name}
          />

          <div className="inc-print-inner">
            <div className="inc-print-meta">
              <span>
                الشهر: {payload.monthLabel} {payload.year}
              </span>
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
            </div>

            <div className="inc-print-details">
              <h2>التفاصيل</h2>
              {center.companies.map((company) => (
                <article key={company.name} className="inc-print-company">
                  <header className="inc-print-company-head">
                    <span>{company.name}</span>
                    <span>
                      {company.cities.length === 1
                        ? "مدينة واحدة"
                        : `${company.cities.length} مدن`}
                      {" · "}
                      {company.count} وحدة
                    </span>
                  </header>
                  {company.cities.map((city, cityIndex) => (
                    <div
                      key={city.name}
                      className="inc-print-city"
                      data-tint={cityIndex % 6}
                    >
                      <div className="inc-print-city-head">
                        <strong>{city.name}</strong>
                        <span>
                          {city.count} وحدة · {formatAmount(city.amount)} د.ع
                        </span>
                      </div>
                      <table className="inc-print-table">
                        <thead>
                          <tr>
                            <th>رقم الدار</th>
                            <th>النوع</th>
                            <th>اسم المستخدم</th>
                            <th>الغاية</th>
                            <th>المبلغ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {city.rows.map((row) => (
                            <tr key={`${row.city}-${row.unitNumber}-${row.saleDate}`}>
                              <td>{row.unitNumber}</td>
                              <td>{row.unitType || row.kind}</td>
                              <td>{row.userName || "—"}</td>
                              <td>{row.contractPurpose || "—"}</td>
                              <td>{row.included ? formatAmount(row.amount) : "0"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                  <footer className="inc-print-company-total">
                    <span>إجمالي حافز {company.name}</span>
                    <strong>
                      {company.count} وحدة · {formatAmount(company.amount)} د.ع
                    </strong>
                  </footer>
                </article>
              ))}
            </div>

            <div className="inc-print-footer">
              <div className="inc-print-sign">توقيع مدير المركز</div>
              <div className="inc-print-sign">{style.footerNote || "نظام الحوافز"}</div>
              <div className="inc-print-sign">توقيع الحسابات</div>
            </div>
          </div>
        </section>
      ))}

      {centers.length > 1 ? (
        <section className="inc-print-page">
          <PageHeader title={style.documentTitle} centerName="ملخص كل المراكز" />
          <div className="inc-print-inner">
            <div className="inc-print-stats">
              <div className="inc-print-stat">
                <div className="inc-print-stat-value">{grandCount}</div>
                <div className="inc-print-stat-label">وحدات مضمّنة</div>
              </div>
              <div className="inc-print-stat">
                <div className="inc-print-stat-value">{formatAmount(grandAmount)}</div>
                <div className="inc-print-stat-label">إجمالي الحافز د.ع</div>
              </div>
            </div>
            <table className="inc-print-table">
              <thead>
                <tr>
                  <th>المركز</th>
                  <th>الوحدات</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {centers.map((center) => (
                  <tr key={center.id}>
                    <td>{center.name}</td>
                    <td>{center.count}</td>
                    <td>{formatAmount(center.amount)}</td>
                  </tr>
                ))}
                <tr className="inc-print-total-row">
                  <td>الإجمالي العام</td>
                  <td>{grandCount}</td>
                  <td>{formatAmount(grandAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
};
