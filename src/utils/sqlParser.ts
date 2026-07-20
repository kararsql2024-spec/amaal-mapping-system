/**
 * أداة ذكية لتحليل ملفات الـ SQL القديمة لمشاريع إدارة العقارات
 * تبحث عن جمل INSERT INTO أو COPY لجدول houses_data وتستخرج السجلات بدقة
 */

export interface ParsedHouseData {
  unit_key: string;
  project_id: string;
  data: any;
}

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
          // معالجة نصوص الـ JSON واستبدال الهروب المزدوج لـ PostgreSQL
          let rawJson = rowData.data;
          // إلغاء هروب علامات الاقتباس الثنائية إن وجدت
          if (rawJson.startsWith('"') && rawJson.endsWith('"') && rawJson.includes('\\"')) {
            rawJson = JSON.parse(rawJson);
          }
          const parsedJson = typeof rawJson === 'string' ? JSON.parse(rawJson.replace(/\\"/g, '"').replace(/\\\\/g, '\\')) : rawJson;
          results.push({
            unit_key: rowData.unit_key,
            project_id: rowData.project_id,
            data: parsedJson
          });
        } catch (e) {
          // تخطي المشاكل الفردية للـ JSON ومتابعة البقية
          console.warn("فشل تحليل حقل الـ JSON في سطر COPY:", e);
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
      
      // دالة ذكية لتفكيك القيم مع مراعاة علامات الاقتباس والنصوص المحتوية على فواصل
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
        // إزالة علامات الاقتباس المحيطة بالقيم
        return val.replace(/^'|'$/g, '').replace(/^"|"$/g, '');
      };

      // نفترض أن الترتيب الافتراضي للأعمدة هو: unit_key, project_id, data
      // أو نبحث في الجملة عن الترتيب المكتوب
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
          // استبدال علامات الهروب الخاصة بـ SQL ثنائية الاقتباس بـ JSON صالح
          const cleanJsonStr = rowMap.data.replace(/''/g, "'").replace(/\\'/g, "'");
          const parsedJson = JSON.parse(cleanJsonStr);
          results.push({
            unit_key: rowMap.unit_key,
            project_id: rowMap.project_id,
            data: parsedJson
          });
        } catch (err) {
          // محاولة ثانية للتنظيف
          try {
            const parsedJson = JSON.parse(rowMap.data);
            results.push({
              unit_key: rowMap.unit_key,
              project_id: rowMap.project_id,
              data: parsedJson
            });
          } catch (e2) {
            console.warn("فشل في تفكيك الـ JSON الخاص بالوحدة:", rowMap.unit_key, e2);
          }
        }
      }
    }
  }

  return results;
};