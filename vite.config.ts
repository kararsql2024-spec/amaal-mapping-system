import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    dyadComponentTagger(), 
    react(),
    {
      name: 'compare-backups-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/api/compare-backups') {
            try {
              const jsonPath = path.resolve(__dirname, '.dyad/media/ea7e275efaca72247b3b3c9eaebd4ee87fe76c9ca99f9772e7116d6e9241ae2e.json');
              const sqlPath = path.resolve(__dirname, '.dyad/media/15fac8e1d53ae3141061ea7796c60096cd136911ba54bc15a37803dc888ede81.sql');

              if (!fs.existsSync(jsonPath) || !fs.existsSync(sqlPath)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'أحد ملفات النسخ الاحتياطية المرفقة غير موجود على الخادم.' }));
                return;
              }

              // 1. قراءة وتحليل النسخة الجديدة JSON
              const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
              const projects = jsonData.projects || [];
              const newHouses = jsonData.houses || [];

              // 2. قراءة وتحليل النسخة القديمة SQL
              const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
              const extractedUnits = [];
              const lines = sqlContent.split('\n');
              
              let inCopyBlock = false;
              let copyColumns = [];
              
              for (let line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                if (trimmed.toLowerCase().startsWith('copy ') && trimmed.toLowerCase().includes('houses_data')) {
                  inCopyBlock = true;
                  const colMatch = trimmed.match(/\((.*?)\)/);
                  if (colMatch) {
                    copyColumns = colMatch[1].split(',').map(c => c.trim().replace(/['"‘“]/g, ''));
                  } else {
                    copyColumns = ['unit_key', 'project_id', 'data'];
                  }
                  continue;
                }

                if (inCopyBlock) {
                  if (trimmed === '\\.') {
                    inCopyBlock = false;
                    continue;
                  }

                  const parts = line.split('\t');
                  if (parts.length >= 2) {
                    const unitKeyIdx = copyColumns.indexOf('unit_key') !== -1 ? copyColumns.indexOf('unit_key') : 0;
                    const projIdIdx = copyColumns.indexOf('project_id') !== -1 ? copyColumns.indexOf('project_id') : 1;
                    const dataIdx = copyColumns.indexOf('data') !== -1 ? copyColumns.indexOf('data') : 2;

                    const unit_key = parts[unitKeyIdx]?.trim();
                    const project_id = parts[projIdIdx]?.trim();
                    let rawData = parts[dataIdx];

                    if (unit_key && project_id && rawData) {
                      rawData = rawData.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                      try {
                        const dataObj = JSON.parse(rawData);
                        extractedUnits.push({ unit_key, project_id, data: dataObj });
                      } catch (e) {}
                    }
                  }
                  continue;
                }

                if (trimmed.toLowerCase().startsWith('insert into') && trimmed.toLowerCase().includes('houses_data')) {
                  const valuesMatch = trimmed.match(/values\s*\((.*)\)/i);
                  if (valuesMatch) {
                    const valuesStr = valuesMatch[1];
                    const jsonMatch = valuesStr.match(/\{"status".*?\}/);
                    const parts = valuesStr.split("'");
                    
                    const unit_key = parts[1];
                    const project_id = parts[3];

                    if (jsonMatch && unit_key && project_id) {
                      try {
                        const dataObj = JSON.parse(jsonMatch[0]);
                        extractedUnits.push({ unit_key, project_id, data: dataObj });
                      } catch (e) {}
                    }
                  }
                }
              }

              // 3. مطابقة الحجوزات القديمة ومقارنتها بالجديدة وتوليد التقرير
              const oldBookings = extractedUnits.filter(u => u.data && u.data.status !== 'available' && u.data.name);
              const result = oldBookings.map(oldUnit => {
                const matchedProj = projects.find(p => p.id === oldUnit.project_id);
                const currentUnit = newHouses.find(h => h.unit_key === oldUnit.unit_key);
                return {
                  projectName: matchedProj ? matchedProj.name : `معرف غير معروف (${oldUnit.project_id})`,
                  unitKey: oldUnit.unit_key,
                  customerName: oldUnit.data.name || '',
                  phone: oldUnit.data.phone || '',
                  oldStatus: oldUnit.data.status || '',
                  currentStatusInNewBackup: currentUnit ? (currentUnit.data?.status || 'available') : 'available',
                  currentCustomerInNewBackup: currentUnit ? (currentUnit.data?.name || 'لا يوجد') : 'لا يوجد',
                  saleDate: oldUnit.data.saleDate || '',
                  price: oldUnit.data.price || '',
                  currency: oldUnit.data.currency || 'IQD',
                  taboNum: oldUnit.data.taboNum || '',
                  taboStatus: oldUnit.data.taboStatus || '',
                  handoverDate: oldUnit.data.handoverDate || '',
                };
              });

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(result));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'حدث خطأ داخلي في الخادم: ' + err.message }));
            }
            return;
          }
          next();
        });
      }
    }
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react": path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    },
  },
}));