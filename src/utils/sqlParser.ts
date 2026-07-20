/**
 * أداة ذكية ومطورة لتحليل ملفات الـ SQL القديمة لمشاريع إدارة العقارات
 * تمتلك مصلحاً ذاتياً لنصوص الـ JSON لضمان استرجاع البيانات المعطوبة بدقة متناهية
 */

export interface ParsedHouseData {
  unit_key: string;
  project_id: string;
  data: any;
}

export interface ParsedProject {
  id: string;
  name: string;
  elements: any[];
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

/**
 * تفكيك ذكي لقيم أسطر الـ SQL بمراعاة النصوص والاقتباسات والفواصل
 */
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

/**
 * استخراج المشاريع من ملف الـ SQL لبناء خريطة مطابقة المعرفات بالأسماء الهندسية
 */
export const parseProjectsFromSql = (sqlText: string): ParsedProject[] => {
  const projects: ParsedProject[] = [];
  const lines = sqlText.split('\n');
  let inCopyBlock = false;
  let copyColumns: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('--') || line.startsWith('/*')) continue;

    if (line.toUpperCase().startsWith('COPY ') && line.toLowerCase().includes('projects')) {
      inCopyBlock = true;
      const colMatch = line.match(/\(([^)]+)\)/);
      if (colMatch) {
        copyColumns = colMatch[1].split(',').map(c => c.trim().replace(/['"`]/g, ''));
      } else {
        copyColumns = ['id', 'name', 'description', 'elements'];
      }
      continue;
    }

    if (inCopyBlock) {
      if (line === '\\.') {
        inCopyBlock = false;
        continue;
      }
      const values = line.split('\t');
      const rowData: any = {};
      copyColumns.forEach((col, idx) => {
        rowData[col] = values[idx];
      });

      if (rowData.id && rowData.name) {
        try {
          const elements = rowData.elements ? robustJsonParse(rowData.elements) : [];
          projects.push({
            id: rowData.id,
            name: rowData.name.replace(/^'|'$/g, '').trim(),
            elements: Array.isArray(elements) ? elements : []
          });
        } catch (e) {
          console.warn("فشل تحليل عناصر المشروع في COPY:", rowData.name, e);
        }
      }
      continue;
    }

    if (line.toUpperCase().startsWith('INSERT INTO ') && line.toLowerCase().includes('projects')) {
      const valuesPartMatch = line.match(/VALUES\s*\((.*)\);?/i);
      if (!valuesPartMatch) continue;

      const extractedValues = parseSqlValues(valuesPartMatch[1]);
      const cleanValue = (val: string) => {
        if (val.toUpperCase() === 'NULL') return null;
        return val.replace(/^'|'$/g, '').replace(/^"|"$/g, '').trim();
      };

      let colOrder = ['id', 'name', 'description', 'elements'];
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

      if (rowMap.id && rowMap.name) {
        try {
          const elements = rowMap.elements ? robustJsonParse(rowMap.elements) : [];
          projects.push({
            id: rowMap.id,
            name: rowMap.name,
            elements: Array.isArray(elements) ? elements : []
          });
        } catch (err) {
          console.warn("فشل تفكيك عناصر المشروع INSERT:", rowMap.name, err);
        }
      }
    }
  }

  return projects;
};

export const parseHousesFromSql = (sqlText: string): ParsedHouseData[] => {
  const results: ParsedHouseData[] = [];
  const lines = sqlText.split('\n');
  let inCopyBlock = false;
  let copyColumns: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('--') || line.startsWith('/*')) continue;

    // 1. التعامل مع صيغة COPY
    if (line.toUpperCase().startsWith('COPY ') && line.toLowerCase().includes('houses_data')) {
      inCopyBlock = true;
      const colMatch = line.match(/\(([^)]+)\)/);
      if (colMatch) {
        copyColumns = colMatch[1].split(',').map(c => c.trim().replace(/['"`]/g, ''));
      } else {
        copyColumns = ['unit_key', 'project_id', 'data'];
      }
      continue;
    }

    if (inCopyBlock) {
      if (line === '\\.') {
        inCopyBlock = false;
        continue;
      }
      
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
      const valuesPartMatch = line.match(/VALUES\s*\((.*)\);?/i);
      if (!valuesPartMatch) continue;

      const valuesStr = valuesPartMatch[1];
      const extractedValues = parseSqlValues(valuesStr);

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