const SPREADSHEET_ID = "COLE_AQUI_O_ID_DA_SUA_PLANILHA";
const ID_PREFIX = "Pr-";
const ID_PAD = 6;

const SHEETS = {
  vehicles: { name: "Vehicles", headers: ["id","status","frota","placa","chassi","marca","modelo","ano","tipo"] },
  compositions: { name: "Compositions", headers: ["id","status","tipoModulo","modulo","frota","marca","ano","tipoImplemento","placa","chassi"] }
};

function doGet(e){
  try{
    const p = (e && e.parameter) ? e.parameter : {};
    const action = String(p.action || "").toLowerCase();

    if (action === "ping") return jsonOut({ ok:true, message:"pong", ts:new Date().toISOString() });
    if (action === "init") return jsonOut({ ok:true, message:"Planilha inicializada", result: initSheets() });

    if (action === "list"){
      const entity = String(p.entity || "").toLowerCase();
      assertEntity(entity);
      return jsonOut({ ok:true, entity, data: listRows(entity) });
    }

    if (action === "nextid"){
      const entity = String(p.entity || "").toLowerCase();
      assertEntity(entity);
      return jsonOut({ ok:true, entity, id: nextId(entity) });
    }

    return jsonOut({ ok:false, error:"Ação inválida (GET). Use action=ping|init|list|nextId" });
  }catch(err){
    return jsonOut({ ok:false, error: toErr(err) });
  }
}

function doPost(e){
  try{
    const body = parseBody(e);
    const action = String(body.action || "").toLowerCase();
    const entity = String(body.entity || "").toLowerCase();
    assertEntity(entity);

    if (entity === "vehicles"){
      if (action === "create"){
        const payload = body.payload || {};
        if (!payload.id || String(payload.id).trim()==="") payload.id = nextId("vehicles");
        return jsonOut({ ok:true, entity, row: createVehicle(payload) });
      }
      if (action === "update"){
        const rowId = Number(body.rowId);
        if (!rowId || rowId < 2) throw new Error("rowId inválido (vehicles).");
        return jsonOut({ ok:true, entity, row: updateVehicle(rowId, body.payload || {}) });
      }
      if (action === "delete"){
        const rowId = Number(body.rowId);
        if (!rowId || rowId < 2) throw new Error("rowId inválido (vehicles).");
        return jsonOut({ ok:true, entity, result: deleteVehicle(rowId) });
      }
      return jsonOut({ ok:false, error:"Ação inválida (POST) para vehicles." });
    }

    // compositions: rowId = compId
    if (entity === "compositions"){
      if (action === "create"){
        const payload = body.payload || {};
        if (!payload.id || String(payload.id).trim()==="") payload.id = nextId("compositions");
        return jsonOut({ ok:true, entity, row: upsertComposition(payload.id, payload, true) });
      }
      if (action === "update"){
        const compId = String(body.rowId || "").trim();
        if (!compId) throw new Error("rowId inválido (compositions).");
        const payload = body.payload || {};
        payload.id = compId;
        return jsonOut({ ok:true, entity, row: upsertComposition(compId, payload, false) });
      }
      if (action === "delete"){
        const compId = String(body.rowId || "").trim();
        if (!compId) throw new Error("rowId inválido (compositions).");
        return jsonOut({ ok:true, entity, result: deleteComposition(compId) });
      }
      return jsonOut({ ok:false, error:"Ação inválida (POST) para compositions." });
    }

    return jsonOut({ ok:false, error:"Entity não suportada." });
  }catch(err){
    return jsonOut({ ok:false, error: toErr(err) });
  }
}

function initSheets(){
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const result = {};
  Object.keys(SHEETS).forEach(k=>{
    const cfg = SHEETS[k];
    let sh = ss.getSheetByName(cfg.name);
    const created = !sh;
    if (!sh) sh = ss.insertSheet(cfg.name);
    sh.getRange(1,1,1,cfg.headers.length).setValues([cfg.headers]);
    sh.setFrozenRows(1);
    result[cfg.name] = { created, headers: cfg.headers };
  });
  return result;
}

function assertEntity(entity){
  if (!SHEETS[entity]) throw new Error("Entity inválida. Use vehicles ou compositions.");
}

function getSheet(entity){
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const cfg = SHEETS[entity];
  const sh = ss.getSheetByName(cfg.name);
  if (!sh) throw new Error("Aba não encontrada: " + cfg.name + ". Execute action=init.");
  ensureHeaders(sh, cfg.headers);
  return sh;
}

function ensureHeaders(sheet, headers){
  const first = sheet.getRange(1,1,1,headers.length).getValues()[0];
  const ok = headers.every((h,i)=>String(first[i]||"").trim()===h);
  if (!ok) sheet.getRange(1,1,1,headers.length).setValues([headers]);
}

function listRows(entity){
  const sh = getSheet(entity);
  const headers = SHEETS[entity].headers;
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const values = sh.getRange(2,1,lastRow-1,headers.length).getValues();
  const out = [];
  for (let i=0;i<values.length;i++){
    const obj = {};
    for (let c=0;c<headers.length;c++) obj[headers[c]] = values[i][c];
    obj._rowId = i+2;
    out.push(obj);
  }
  return out;
}

function nextId(entity){
  const sh = getSheet(entity);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return ID_PREFIX + pad(1);

  const ids = sh.getRange(2,1,lastRow-1,1).getValues().flat();
  let maxNum = 0;
  ids.forEach(v=>{
    const s = String(v||"").trim();
    if (!s.startsWith(ID_PREFIX)) return;
    const m = s.slice(ID_PREFIX.length).match(/^(\d+)/);
    if (!m) return;
    const n = Number(m[1]);
    if (!Number.isNaN(n) && n > maxNum) maxNum = n;
  });
  return ID_PREFIX + pad(maxNum+1);
}

function pad(n){ return String(n).padStart(ID_PAD, "0"); }

/* VEHICLES */
function normalizeVehicles(p){
  const headers = SHEETS.vehicles.headers;
  const out = {};
  headers.forEach(h=>out[h]=(p && p[h]!==undefined && p[h]!==null)?p[h]:"");
  return out;
}
function createVehicle(p){
  const sh = getSheet("vehicles");
  const headers = SHEETS.vehicles.headers;
  const row = normalizeVehicles(p);
  sh.appendRow(headers.map(h=>row[h]));
  return Object.assign({}, row, { _rowId: sh.getLastRow() });
}
function updateVehicle(rowId, p){
  const sh = getSheet("vehicles");
  const headers = SHEETS.vehicles.headers;
  const row = normalizeVehicles(p);
  sh.getRange(rowId,1,1,headers.length).setValues([headers.map(h=>row[h])]);
  return Object.assign({}, row, { _rowId: rowId });
}
function deleteVehicle(rowId){
  const sh = getSheet("vehicles");
  sh.deleteRow(rowId);
  return { deletedRowId: rowId };
}

/* COMPOSITIONS (POR LINHAS) */
function upsertComposition(compId, payload, isCreate){
  const sh = getSheet("compositions");
  const headers = SHEETS.compositions.headers;

  const status = payload.status ?? "";
  const tipoModulo = payload.tipoModulo ?? "";
  const modules = Array.isArray(payload.modules) ? payload.modules : [];
  if (!modules.length) throw new Error("modules[] é obrigatório.");

  if (!isCreate) deleteComposition(compId);

  modules.forEach(m=>{
    const rowObj = {
      id: compId,
      status,
      tipoModulo,
      modulo: m.modulo ?? "",
      frota: m.frota ?? "",
      marca: m.marca ?? "",
      ano: m.ano ?? "",
      tipoImplemento: m.tipoImplemento ?? "",
      placa: m.placa ?? "",
      chassi: m.chassi ?? ""
    };
    sh.appendRow(headers.map(h=>rowObj[h] ?? ""));
  });

  return { id: compId, status, tipoModulo, modulesSaved: modules.length };
}

function deleteComposition(compId){
  const sh = getSheet("compositions");
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return { deleted: 0, id: compId };

  const ids = sh.getRange(2,1,lastRow-1,1).getValues().flat();
  const rows = [];
  for (let i=0;i<ids.length;i++){
    if (String(ids[i]||"").trim() === compId) rows.push(i+2);
  }
  for (let i=rows.length-1;i>=0;i--) sh.deleteRow(rows[i]);
  return { deleted: rows.length, id: compId };
}

/* UTIL */
function parseBody(e){
  const text = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
  try { return JSON.parse(text); } catch(_) { return {}; }
}
function jsonOut(data){
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function toErr(err){
  if (!err) return "Erro desconhecido";
  if (typeof err === "string") return err;
  return err.message ? String(err.message) : JSON.stringify(err);
}
