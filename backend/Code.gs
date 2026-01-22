// Code.gs (Google Apps Script)
// Inventário PWA + Google Sheets CRUD + nextId (Pr-000001)

const SPREADSHEET_ID = "COLE_AQUI_O_ID_DA_SUA_PLANILHA";
const ID_PREFIX = "Pr-";
const ID_PAD = 6;

const SHEETS = {
  vehicles: { name: "Vehicles", headers: ["id","status","frota","placa","chassi","marca","modelo","ano","tipo"] },
  // Composições com até 4 módulos (cada módulo: tipo + placa + chassi)
  compositions: { name: "Compositions", headers: ["id","status","tipoModulo","frota","marca","ano",
    "tipoImplemento1","placa1","chassi1",
    "tipoImplemento2","placa2","chassi2",
    "tipoImplemento3","placa3","chassi3",
    "tipoImplemento4","placa4","chassi4"
  ] }
};

function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = (params.action || "").toLowerCase();

    if (action === "ping") {
      return jsonOut({ ok: true, message: "pong", ts: new Date().toISOString() });
    }

    if (action === "list") {
      const entity = (params.entity || "").toLowerCase();
      assertEntity(entity);
      const data = listRows(entity);
      return jsonOut({ ok: true, entity, data });
    }

    if (action === "nextid") {
      const entity = (params.entity || "").toLowerCase();
      assertEntity(entity);
      const id = nextId(entity);
      return jsonOut({ ok: true, entity, id });
    }

    return jsonOut({ ok: false, error: "Invalid action (GET). Use action=list|nextId|ping" });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  try {
    const body = parseBody(e);
    const action = (body.action || "").toLowerCase();
    const entity = (body.entity || "").toLowerCase();
    assertEntity(entity);

    if (action === "create") {
      const payload = body.payload || {};
      if (!payload.id || String(payload.id).trim() === "") payload.id = nextId(entity);
      const row = createRow(entity, payload);
      return jsonOut({ ok: true, entity, row });
    }

    if (action === "update") {
      const row = updateRow(entity, body.rowId, body.payload || {});
      return jsonOut({ ok: true, entity, row });
    }

    if (action === "delete") {
      const result = deleteRow(entity, body.rowId);
      return jsonOut({ ok: true, entity, result });
    }

    return jsonOut({ ok: false, error: "Invalid action (POST). Use action=create|update|delete" });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function assertEntity(entity) {
  if (!SHEETS[entity]) throw new Error("Invalid entity. Use vehicles or compositions.");
}

function getSheet(entity) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SHEETS[entity].name);
  if (!sh) throw new Error("Sheet not found: " + SHEETS[entity].name);
  ensureHeaders(sh, SHEETS[entity].headers);
  return sh;
}

function ensureHeaders(sheet, headers) {
  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const ok = headers.every((h, i) => String(firstRow[i] || "").trim() === h);
  if (!ok) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function listRows(entity) {
  const sh = getSheet(entity);
  const headers = SHEETS[entity].headers;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const values = sh.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const out = [];

  for (let i = 0; i < values.length; i++) {
    const obj = {};
    for (let c = 0; c < headers.length; c++) obj[headers[c]] = values[i][c];
    obj._rowId = i + 2; // linha real no Sheet
    out.push(obj);
  }
  return out;
}

function createRow(entity, payload) {
  const sh = getSheet(entity);
  const headers = SHEETS[entity].headers;
  const row = headers.map(h => payload[h] ?? "");
  sh.appendRow(row);

  const rowId = sh.getLastRow();
  const obj = Object.assign({}, payload, { _rowId: rowId });
  return sanitize(entity, obj);
}

function updateRow(entity, rowId, payload) {
  const sh = getSheet(entity);
  const headers = SHEETS[entity].headers;
  rowId = Number(rowId);
  if (!rowId || rowId < 2) throw new Error("Invalid rowId for update.");

  const row = headers.map(h => payload[h] ?? "");
  sh.getRange(rowId, 1, 1, headers.length).setValues([row]);

  const obj = Object.assign({}, payload, { _rowId: rowId });
  return sanitize(entity, obj);
}

function deleteRow(entity, rowId) {
  const sh = getSheet(entity);
  rowId = Number(rowId);
  if (!rowId || rowId < 2) throw new Error("Invalid rowId for delete.");
  sh.deleteRow(rowId);
  return { deletedRowId: rowId };
}

function sanitize(entity, obj) {
  const allowed = new Set([...SHEETS[entity].headers, "_rowId"]);
  const out = {};
  Object.keys(obj).forEach(k => { if (allowed.has(k)) out[k] = obj[k]; });
  return out;
}

function nextId(entity){
  const sh = getSheet(entity);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return ID_PREFIX + pad(1);

  const ids = sh.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  let maxNum = 0;

  for (const v of ids){
    const s = String(v || "").trim();
    if (!s.startsWith(ID_PREFIX)) continue;
    const m = s.slice(ID_PREFIX.length).match(/^\d+/);
    if (!m) continue;
    const n = Number(m[0]);
    if (!Number.isNaN(n) && n > maxNum) maxNum = n;
  }

  return ID_PREFIX + pad(maxNum + 1);
}

function pad(n){
  return String(n).padStart(ID_PAD, "0");
}

function parseBody(e) {
  const text = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
  let obj = {};
  try { obj = JSON.parse(text); } catch (_) { obj = {}; }
  return obj;
}

function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
