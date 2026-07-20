/**
 * أداة ذكية ومطورة لتحليل ملفات الـ SQL القديمة لمشاريع إدارة العقارات
 * تمتلك مصلحاً ذاتياً لنصوص الـ JSON لضمان استرجاع البيانات المعطوبة بدقة متناهية
 */

export interface ParsedHouseData {
  unit_key: string;
  project_id: string;
  data: any;
}

/**
 * دالة ذكية لإصلاح وتفكيك نصوص الـ JSON من نصوص الـ SQL بمرونة عالية
 */
const robustJsonParse = (rawStr: string): any => {
  if (!rawStr) return {};
  let cleaned = rawStr.trim();
  
  // إزالة علامات الاقتباس الفردية المحيطة بالنص بأكمله إن وجدت
  if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.slice(1, -1);
  }
  
  // 1. استبدال الاقتباسات الفردية الثنائية (المستخدمة للهروب في SQL القياسي)
  cleaned = cleaned.replace(/''/g, "'");
  
  // 2. إصلاح هروب علامات الاقتباس المزدوجة لـ PostgreSQL
  cleaned = cleaned.replace(/\\"/g, '"');
  cleaned = cleaned.replace(/\\\\"/g, '"');

  // 3. إصلاح الهروب للعلامات الفردية الداخلية
  cleaned = cleaned.replace(/\\'/g, "'");

  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    try {
      // محاولة إصلاح إضافية في حال وجود محارف تحكم غير مرئية أو مشاكل ترميز
      const stripped = cleaned.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
      return JSON.parse(stripped);
    } catch (e2) {
      // محاولة أخيرة: إذا كانت المشكلة بسبب فواصل الأسطر داخل النصوص
      try {
        const sanitizedNewlines = cleaned.replace(/\r?\n|\r/g, " ");
        return JSON.parse(sanitizedNewlines);
      } catch (e3) {
        console.warn("Robust parser failed to parse JSON string:", cleaned);
        throw e3;
      }
    }
  }
};

export const parseHousesFromSql = (sqlText: string): ParsedHouseData[] => {
  const results: ParsedHouseData[] = [];
  const lines = sqlText.split('\n');
  
  // تتبع حالة الـ COPY إن وُجدت
  let inCopyBlock = false;
  let copyColumns: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('--') || line.startsWith('/*')) continue;

    // 1. التعامل مع صيغة COPY (أسرع وأكثر شيوعاً في نسخ postgres الاحتياطية)
    if (line.toUpperCase().startsWith('COPY ') && line.toLowerCase().includes('houses_data')) {
      inCopyBlock = true;
      // استخراج ترتيب الأعمدة من جملة الـ COPY
      const colMatch = line.match(/\(([^)]+)\)/);
      if (colMatch) {
        copyColumns = colMatch[1].split(',').map(c => c.trim().replace(/['"`]/g, ''));
      } else {
        copyColumns = ['unit_key', 'project_id', 'data']; // الافتراضي
      }
      continue;
    }

    if (inCopyBlock) {
      if (line === '\\.') {
        inCopyBlock = false;
        continue;
      }
      
      // تفكيك الأسطر المفصولة بـ Tab في نظام COPY
      const values = line.split('\t');
      const rowData: any = {};
      copyColumns.forEach((col, idx) => {
        rowData[col] = values[idx];
      });

      if (rowData.unit_key && rowData.project_id && rowData.data) {
        try {
          const parsedJson = robustJsonParse(rowData.data);
          results.push({
            unit_key: rowData.unit_key,
            project_id: rowData.project_id,
            data: parsedJson
          });
        } catch (e) {
          console.warn("فشل تحليل حقل الـ JSON في سطر COPY للوحدة:", rowData.unit_key, e);
        }
      }
      continue;
    }

    // 2. التعامل مع جمل الـ INSERT INTO التقليدية
    if (line.toUpperCase().startsWith('INSERT INTO ') && line.toLowerCase().includes('houses_data')) {
      // استخراج القيم المحصورة بين القوسين بعد VALUES
      const valuesPartMatch = line.match(/VALUES\s*\((.*)\);?/i);
      if (!valuesPartMatch) continue;

      const valuesStr = valuesPartMatch[1];
      
      // تفكيك ذكي للقيم بمراعاة الفواصل والاقتباسات
      const parseSqlValues = (str: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let isEscaped = false;

        for (let j = 0; j < str.length; j++) {
          const char = str[j];

          if (isEscaped) {
            current += char;
            isEscaped = false;
            continue;
          }

          if (char === '\\') {
            isEscaped = true;
            current += char;
            continue;
          }

          if (char === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
            continue;
          }

          if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
            continue;
          }

          if (char === ',' && !inSingleQuote && !inDoubleQuote) {
            result.push(current.trim());
            current = '';
            continue;
          }

          current += char;
        }
        result.push(current.trim());
        return result;
      };

      const extractedValues = parseSqlValues(valuesStr);

      // تنظيف القيم
      const cleanValue = (val: string) => {
        if (val.toUpperCase() === 'NULL') return null;
        return val.replace(/^'|'$/g, '').replace(/^"|"$/g, '');
      };

      let colOrder = ['unit_key', 'project_id', 'data'];
      const colHeaderMatch = line.match(/\(([^)]+)\)\s*VALUES/i);
      if (colHeaderMatch) {
        colOrder = colHeaderMatch[1].split(',').map(c => c.trim().replace(/['"`]/g, ''));
      }

      const rowMap: any = {};
      colOrder.forEach((col, idx) => {
        if (extractedValues[idx] !== undefined) {
          rowMap[col] = cleanValue(extractedValues[idx]);
        }
      });

      if (rowMap.unit_key && rowMap.project_id && rowMap.data) {
        try {
          const parsedJson = robustJsonParse(rowMap.data);
          results.push({
            unit_key: rowMap.unit_key,
            project_id: rowMap.project_id,
            data: parsedJson
          });
        } catch (err) {
          console.warn("فشل في تفكيك الـ JSON الخاص بالوحدة:", rowMap.unit_key, err);
        }
      }
    }
  }

  return results;
};