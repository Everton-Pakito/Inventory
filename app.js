
// Failsafe: mostra erro na tela em caso de falha de JS (evita "tela branca")
function showFatal(msg){
  try{
    const div = document.createElement("div");
    div.style.position="fixed";
    div.style.inset="12px";
    div.style.padding="12px 14px";
    div.style.border="1px solid rgba(255,79,109,.45)";
    div.style.background="rgba(255,79,109,.12)";
    div.style.color="rgba(20,20,20,.92)";
    div.style.borderRadius="14px";
    div.style.zIndex="9999";
    div.style.fontFamily="ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial";
    div.style.maxWidth="720px";
    div.innerHTML = "<b>Erro ao carregar o app</b><br/>" + String(msg || "Abra o console do navegador.");
    document.body.appendChild(div);
  }catch(_){}
}
window.addEventListener("error", (e)=>showFatal(e.message));
window.addEventListener("unhandledrejection", (e)=>showFatal(e.reason?.message || e.reason));

import * as api from "./api.js";

const el = (id) => document.getElementById(id);

const entitySelect = el("entitySelect");
const formArea = el("formArea");
const saveBtn = el("saveBtn");
const newBtn = el("newBtn");
const refreshBtn = el("refreshBtn");
const syncBtn = el("syncBtn");
const netBadge = el("netBadge");
const searchInput = el("searchInput");
const limitSelect = el("limitSelect");
const tableHead = el("tableHead");
const tableBody = el("tableBody");
const formMsg = el("formMsg");
const queueInfo = el("queueInfo");

let currentEntity = "vehicles";
let editingKey = null; // vehicles: rowId | compositions: id (Pr-000001)
let currentData = [];

const TIPO_MODULO_TO_COUNT = {
  "1 Módulo (Solteiro)": 1,
  "2 Módulo (Duplado)": 2,
  "3 Módulo (Tremiado)": 3,
  "4 Módulo (Tremiado + Dolly)": 4
};

const tipoImplementoOptions = ["Semi-Reboque","Reboque","Dolly-Reboque"];
const marcaComposicaoOptions = ["Fachinni","Randon","Usicamp"];

const schema = {
  vehicles: {
    fields: [
      { key:"tipo", label:"Tipo", type:"select", options:["Leve","Semi-Leve","Cavalo Mecânico"], required:true },
      { key:"id", label:"Id (automático)", type:"text", required:true, readonly:true },
      { key:"status", label:"Status", type:"select", options:["Ativo","Inativo","Manutenção"], required:true },
      { key:"frota", label:"Frota", type:"text" },
      { key:"placa", label:"Placa", type:"text" },
      { key:"chassi", label:"Chassi", type:"text" },
      { key:"marca", label:"Marca", type:"text" },
      { key:"modelo", label:"Modelo", type:"text" },
      { key:"ano", label:"Ano", type:"number" }
    ],
    table: ["id","status","frota","placa","marca","modelo","ano","tipo"]
  },
  compositions: {
    baseFields: [
      { key:"tipoModulo", label:"Tipo (Módulos)", type:"select", options:Object.keys(TIPO_MODULO_TO_COUNT), required:true },
      { key:"id", label:"Id (automático)", type:"text", required:true, readonly:true },
      { key:"status", label:"Status", type:"select", options:["Ativo","Inativo","Manutenção"], required:true }
    ],
    table: ["id","status","tipoModulo","placas"]
  }
};

function setMsg(text, ok=true){
  formMsg.textContent = text || "";
  formMsg.style.color = ok ? "rgba(46,229,157,.95)" : "rgba(255,79,109,.95)";
  if (text) setTimeout(()=>{ formMsg.textContent=""; }, 3500);
}

function statusPill(status){
  const s = String(status||"").toLowerCase();
  if (s.includes("ativo")) return `<span class="pill ok">Ativo</span>`;
  if (s.includes("man")) return `<span class="pill warn">Manutenção</span>`;
  return `<span class="pill bad">Inativo</span>`;
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function fieldHtml(f, value){
  const val = value ?? "";
  const req = f.required ? "required" : "";
  const ro = f.readonly ? "readonly" : "";
  if (f.type === "select"){
    const opts = (f.options || []).map(o => `<option ${String(o)===String(val)?"selected":""}>${o}</option>`).join("");
    return `<label class="field"><span>${f.label}</span><select data-key="${f.key}" ${req}>
      <option value="" ${val===""?"selected":""} disabled>Selecione…</option>${opts}</select></label>`;
  }
  const type = f.type || "text";
  return `<label class="field"><span>${f.label}</span><input data-key="${f.key}" type="${type}" value="${escapeHtml(val)}" ${req} ${ro} /></label>`;
}

function moduleBlockHtml(i, data){
  const frotaKey = `frota${i}`, marcaKey = `marca${i}`, anoKey = `ano${i}`;
  const tipoKey = `tipoImplemento${i}`, placaKey = `placa${i}`, chassiKey = `chassi${i}`;
  return (
    fieldHtml({ key: frotaKey, label: `Módulo ${i} • Frota`, type:"text", required:true }, data[frotaKey] ?? "") +
    fieldHtml({ key: marcaKey, label: `Módulo ${i} • Marca`, type:"select", options: marcaComposicaoOptions, required:true }, data[marcaKey] ?? "") +
    fieldHtml({ key: anoKey, label: `Módulo ${i} • Ano`, type:"number", required:true }, data[anoKey] ?? "") +
    fieldHtml({ key: tipoKey, label: `Módulo ${i} • Tipo`, type:"select", options: tipoImplementoOptions, required:true }, data[tipoKey] ?? "") +
    fieldHtml({ key: placaKey, label: `Módulo ${i} • Placa`, type:"text", required:true }, data[placaKey] ?? "") +
    fieldHtml({ key: chassiKey, label: `Módulo ${i} • Chassi`, type:"text", required:true }, data[chassiKey] ?? "")
  );
}

function renderVehiclesForm(data={}){
  const html = schema.vehicles.fields.map(f => fieldHtml(f, data[f.key])).join("");
  formArea.innerHTML = `<div class="grid">${html}</div>`;
}

function renderCompositionsForm(data={}){
  const baseFieldsHtml = schema.compositions.baseFields.map(f => fieldHtml(f, data[f.key])).join("");
  const tipoModulo = data.tipoModulo ?? "1 Módulo (Solteiro)";
  const count = TIPO_MODULO_TO_COUNT[tipoModulo] || 1;

  let modulesHtml = "";
  for (let i=1;i<=count;i++) modulesHtml += moduleBlockHtml(i, data);

  formArea.innerHTML = `
    <div class="grid">${baseFieldsHtml}</div>
    <div style="height:12px"></div>
    <h2 style="margin:0 0 10px 0; font-size:14px; color: rgba(233,240,255,.9);">Módulos</h2>
    <div class="grid">${modulesHtml}</div>
    <div class="hint" style="margin-top:10px">Na planilha, cada módulo é gravado em uma linha (mesmo ID da composição).</div>
  `;

  const sel = formArea.querySelector('[data-key="tipoModulo"]');
  if (sel){
    sel.value = tipoModulo;
    sel.addEventListener("change", () => {
      const snapshot = getFormPayload();
      snapshot.tipoModulo = sel.value;
      renderCompositionsForm(snapshot);
      ensureAutoId().catch(()=>{});
    });
  }
}

function renderForm(entity, data={}){
  if (entity === "compositions") return renderCompositionsForm(data);
  return renderVehiclesForm(data);
}

function getFormPayload(){
  const payload = {};
  formArea.querySelectorAll("[data-key]").forEach(inp => {
    const key = inp.getAttribute("data-key");
    let v = inp.value ?? "";
    if (inp.type === "number" && v !== "") v = Number(v);
    payload[key] = v;
  });
  return payload;
}

function setFormField(key, value){
  const input = formArea.querySelector(`[data-key="${key}"]`);
  if (input) input.value = value ?? "";
}

function validate(entity, payload){
  if (entity === "vehicles"){
    return schema.vehicles.fields.filter(f => f.required).filter(f => String(payload[f.key] ?? "").trim()==="").map(f => f.label);
  }
  const missing = schema.compositions.baseFields.filter(f => f.required).filter(f => String(payload[f.key] ?? "").trim()==="").map(f => f.label);
  const count = TIPO_MODULO_TO_COUNT[payload.tipoModulo] || 1;
  for (let i=1;i<=count;i++){
    const reqs = [
      [`frota${i}`,`Módulo ${i} • Frota`],[`marca${i}`,`Módulo ${i} • Marca`],[`ano${i}`,`Módulo ${i} • Ano`],
      [`tipoImplemento${i}`,`Módulo ${i} • Tipo`],[`placa${i}`,`Módulo ${i} • Placa`],[`chassi${i}`,`Módulo ${i} • Chassi`],
    ];
    for (const [k,l] of reqs) if (!String(payload[k] ?? "").trim()) missing.push(l);
  }
  return missing;
}

function groupCompositions(rows){
  const map = new Map();
  for (const r of rows){
    const id = String(r.id ?? "").trim();
    if (!id) continue;
    if (!map.has(id)) map.set(id, { id, status:r.status ?? "", tipoModulo:r.tipoModulo ?? "", modules:[] });
    const g = map.get(id);
    g.status = r.status ?? g.status;
    g.tipoModulo = r.tipoModulo ?? g.tipoModulo;
    g.modules.push({ modulo:r.modulo, frota:r.frota, marca:r.marca, ano:r.ano, tipoImplemento:r.tipoImplemento, placa:r.placa, chassi:r.chassi });
  }
  const out = [];
  for (const g of map.values()){
    g.modules.sort((a,b)=>(Number(a.modulo)||0)-(Number(b.modulo)||0));
    g.placas = g.modules.map(m=>m.placa).filter(Boolean).join(" • ");
    g._key = g.id;
    out.push(g);
  }
  out.sort((a,b)=>String(b.id).localeCompare(String(a.id)));
  return out;
}

function renderTable(entity, data){
  const cols = schema[entity].table;
  tableHead.innerHTML = `<tr>${cols.map(c=>`<th>${c}</th>`).join("")}<th>Ações</th></tr>`;

  const q = (searchInput.value || "").toLowerCase().trim();
  const limit = Number(limitSelect.value || 50);

  const filtered = data.filter(row => !q || JSON.stringify(row).toLowerCase().includes(q)).slice(0, limit);

  tableBody.innerHTML = filtered.map(row => `
    <tr>
      ${cols.map(c => c==="status" ? `<td>${statusPill(row[c])}</td>` : `<td>${escapeHtml(row[c] ?? "")}</td>`).join("")}
      <td><div class="tactions">
        <button class="btn" data-act="edit" data-key="${escapeHtml(row._key ?? row._rowId)}">Editar</button>
        <button class="btn danger" data-act="del" data-key="${escapeHtml(row._key ?? row._rowId)}">Excluir</button>
      </div></td>
    </tr>`).join("");

  tableBody.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const act = btn.dataset.act;
      const key = btn.dataset.key;

      if (currentEntity === "vehicles"){
        const rowId = Number(key);
        const row = currentData.find(r => Number(r._rowId) === rowId);
        if (!row) return;
        if (act === "edit"){
          editingKey = rowId; renderForm(currentEntity, row); setMsg(`Editando linha ${rowId}`, true);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          if (!confirm(`Excluir o registro da linha ${rowId}?`)) return;
          await api.remove("vehicles", rowId);
          setMsg(navigator.onLine ? "Excluído com sucesso." : "Exclusão enfileirada (offline).");
          await loadAndRender();
        }
        return;
      }

      const comp = currentData.find(r => String(r.id) === String(key));
      if (!comp) return;

      if (act === "edit"){
        editingKey = comp.id;
        const data = { id: comp.id, status: comp.status, tipoModulo: comp.tipoModulo };
        comp.modules.forEach((m, idx)=>{
          const i = idx+1;
          data[`frota${i}`]=m.frota??""; data[`marca${i}`]=m.marca??""; data[`ano${i}`]=m.ano??"";
          data[`tipoImplemento${i}`]=m.tipoImplemento??""; data[`placa${i}`]=m.placa??""; data[`chassi${i}`]=m.chassi??"";
        });
        renderForm(currentEntity, data);
        setMsg(`Editando composição ${comp.id}`, true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        if (!confirm(`Excluir a composição ${comp.id} (todos os módulos)?`)) return;
        await api.remove("compositions", comp.id);
        setMsg(navigator.onLine ? "Excluído com sucesso." : "Exclusão enfileirada (offline).");
        await loadAndRender();
      }
    });
  });
}

async function loadAndRender(){
  if (currentEntity === "compositions"){
    const rows = await api.list("compositions");
    currentData = groupCompositions(rows);
  } else {
    currentData = await api.list("vehicles");
  }
  renderTable(currentEntity, currentData);
  await updateQueueInfo();
}

async function updateQueueInfo(){
  const count = await api.getQueueCount();
  queueInfo.textContent = count ? `Fila offline pendente: ${count} ação(ões). Clique em “Sync” quando estiver online.` : `Fila offline: vazia.`;
}

function updateNetBadge(){
  const on = navigator.onLine;
  netBadge.textContent = on ? "Online" : "Offline";
  netBadge.style.color = on ? "rgba(46,229,157,.95)" : "rgba(255,176,32,.95)";
}

async function ensureAutoId(){
  if (editingKey) return;
  try{ setFormField("id", await api.nextId(currentEntity)); }catch(_){}
}

async function onSave(){
  const payload = getFormPayload();
  if (!payload.id || String(payload.id).trim()===""){ await ensureAutoId(); payload.id = getFormPayload().id; }

  const missing = validate(currentEntity, payload);
  if (missing.length){ setMsg(`Campos obrigatórios: ${missing.join(", ")}`, false); return; }

  try{
    if (currentEntity === "vehicles"){
      if (editingKey) await api.update("vehicles", editingKey, payload);
      else await api.create("vehicles", payload);
      setMsg(navigator.onLine ? "Salvo com sucesso." : "Ação enfileirada (offline).");
    } else {
      const count = TIPO_MODULO_TO_COUNT[payload.tipoModulo] || 1;
      const modules = [];
      for (let i=1;i<=count;i++){
        modules.push({
          modulo:i,
          frota: payload[`frota${i}`],
          marca: payload[`marca${i}`],
          ano: payload[`ano${i}`],
          tipoImplemento: payload[`tipoImplemento${i}`],
          placa: payload[`placa${i}`],
          chassi: payload[`chassi${i}`]
        });
      }
      const compPayload = { id: payload.id, status: payload.status, tipoModulo: payload.tipoModulo, modules };
      if (editingKey) await api.update("compositions", payload.id, compPayload);
      else await api.create("compositions", compPayload);
      setMsg(navigator.onLine ? "Salvo com sucesso." : "Ação enfileirada (offline).");
    }
    await onNew();
    await loadAndRender();
  }catch(err){
    setMsg(String(err.message || err), false);
  }
}

async function onNew(){
  editingKey = null;
  if (currentEntity === "compositions") renderForm(currentEntity, { tipoModulo:"1 Módulo (Solteiro)" });
  else renderForm(currentEntity, {});
  await ensureAutoId();
}

async function onSync(){
  try{
    const r = await api.syncQueue();
    if (!navigator.onLine) setMsg("Você está offline. Não foi possível sincronizar.", false);
    else { setMsg(`Sync concluído: ${r.synced} enviado(s). Pendentes: ${r.pending}.`, true); await loadAndRender(); }
  }catch(err){ setMsg(String(err.message || err), false); }
}

function initPWA(){
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

function bindUI(){
  entitySelect.addEventListener("change", async () => { currentEntity = entitySelect.value; await onNew(); await loadAndRender(); });
  saveBtn.addEventListener("click", onSave);
  newBtn.addEventListener("click", onNew);
  refreshBtn.addEventListener("click", loadAndRender);
  syncBtn.addEventListener("click", onSync);
  searchInput.addEventListener("input", () => renderTable(currentEntity, currentData));
  limitSelect.addEventListener("change", () => renderTable(currentEntity, currentData));
  window.addEventListener("online", async () => { updateNetBadge(); await onSync(); });
  window.addEventListener("offline", () => updateNetBadge());
}

(async function main(){
  initPWA();
  bindUI();
  updateNetBadge();
  currentEntity = entitySelect.value;

  if (navigator.onLine){ try { await api.init(); } catch(_){} }

  await onNew();
  await loadAndRender();
  try { await api.ping(); } catch(_){}
})();
