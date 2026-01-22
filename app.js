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
let editingRowId = null;
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
      { key:"tipoModulo", label:"Tipo (Módulos)", type:"select",
        options:Object.keys(TIPO_MODULO_TO_COUNT),
        required:true
      },
      { key:"id", label:"Id (automático)", type:"text", required:true, readonly:true },
      { key:"status", label:"Status", type:"select", options:["Ativo","Inativo","Manutenção"], required:true },
      { key:"frota", label:"Frota", type:"text" },
      { key:"marca", label:"Marca", type:"select", options:marcaComposicaoOptions, required:true },
      { key:"ano", label:"Ano", type:"number" }
    ],
    table: ["id","status","frota","marca","ano","tipoModulo","placa1","placa2","placa3","placa4"]
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

function fieldHtml(f, value){
  const val = value ?? "";
  const req = f.required ? "required" : "";
  const ro = f.readonly ? "readonly" : "";
  if (f.type === "select"){
    const opts = (f.options || []).map(o => `<option ${String(o)===String(val)?"selected":""}>${o}</option>`).join("");
    return `
      <label class="field">
        <span>${f.label}</span>
        <select data-key="${f.key}" ${req}>
          <option value="" ${val===""?"selected":""} disabled>Selecione…</option>
          ${opts}
        </select>
      </label>
    `;
  }
  const type = f.type || "text";
  return `
    <label class="field">
      <span>${f.label}</span>
      <input data-key="${f.key}" type="${type}" value="${escapeHtml(String(val))}" ${req} ${ro} />
    </label>
  `;
}

function moduleBlockHtml(i, data){
  const placaKey = `placa${i}`;
  const chassiKey = `chassi${i}`;
  const tipoKey = `tipoImplemento${i}`;

  return (
    fieldHtml({ key: tipoKey, label: `Módulo ${i} • Tipo`, type:"select", options: tipoImplementoOptions, required:true }, data[tipoKey] ?? "") +
    fieldHtml({ key: placaKey, label: `Módulo ${i} • Placa`, type:"text", required:true }, data[placaKey] ?? "") +
    fieldHtml({ key: chassiKey, label: `Módulo ${i} • Chassi`, type:"text", required:true }, data[chassiKey] ?? "")
  );
}

function renderCompositionsForm(data={}){
  const cfg = schema.compositions;
  const baseFieldsHtml = cfg.baseFields.map(f => fieldHtml(f, data[f.key])).join("");

  const tipoModulo = data.tipoModulo ?? "1 Módulo (Solteiro)";
  const count = TIPO_MODULO_TO_COUNT[tipoModulo] || 1;

  let modulesHtml = "";
  for (let i=1;i<=count;i++) modulesHtml += moduleBlockHtml(i, data);

  formArea.innerHTML = `
    <div class="grid">${baseFieldsHtml}</div>
    <div style="height:12px"></div>
    <h2 style="margin:0 0 10px 0; font-size:14px; color: rgba(233,240,255,.9);">Módulos</h2>
    <div class="grid">${modulesHtml}</div>
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

function renderVehiclesForm(data={}){
  const cfg = schema.vehicles;
  const html = cfg.fields.map(f => fieldHtml(f, data[f.key])).join("");
  formArea.innerHTML = `<div class="grid">${html}</div>`;
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
    const missing = schema.vehicles.fields
      .filter(f => f.required)
      .filter(f => String(payload[f.key] ?? "").trim() === "")
      .map(f => f.label);
    return missing;
  }

  const missing = schema.compositions.baseFields
    .filter(f => f.required)
    .filter(f => String(payload[f.key] ?? "").trim() === "")
    .map(f => f.label);

  const count = TIPO_MODULO_TO_COUNT[payload.tipoModulo] || 1;
  for (let i=1;i<=count;i++){
    const tipoKey = `tipoImplemento${i}`;
    const placaKey = `placa${i}`;
    const chassiKey = `chassi${i}`;
    if (!String(payload[tipoKey] ?? "").trim()) missing.push(`Módulo ${i} • Tipo`);
    if (!String(payload[placaKey] ?? "").trim()) missing.push(`Módulo ${i} • Placa`);
    if (!String(payload[chassiKey] ?? "").trim()) missing.push(`Módulo ${i} • Chassi`);
  }
  return missing;
}

function renderTable(entity, data){
  const cols = schema[entity].table;

  tableHead.innerHTML = `
    <tr>
      ${cols.map(c => `<th>${c}</th>`).join("")}
      <th>Ações</th>
    </tr>
  `;

  const q = (searchInput.value || "").toLowerCase().trim();
  const limit = Number(limitSelect.value || 50);

  const filtered = data.filter(row => {
    if (!q) return true;
    const bag = Object.values(row).join(" ").toLowerCase();
    return bag.includes(q);
  }).slice(0, limit);

  tableBody.innerHTML = filtered.map(row => `
    <tr>
      ${cols.map(c => {
        if (c === "status") return `<td>${statusPill(row[c])}</td>`;
        return `<td>${escapeHtml(String(row[c] ?? ""))}</td>`;
      }).join("")}
      <td>
        <div class="tactions">
          <button class="btn" data-act="edit" data-row="${row._rowId}">Editar</button>
          <button class="btn danger" data-act="del" data-row="${row._rowId}">Excluir</button>
        </div>
      </td>
    </tr>
  `).join("");

  tableBody.querySelectorAll("button[data-act]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const act = btn.dataset.act;
      const rowId = Number(btn.dataset.row);
      const row = currentData.find(r => Number(r._rowId) === rowId);
      if (!row) return;

      if (act === "edit"){
        editingRowId = rowId;
        renderForm(currentEntity, row);
        setMsg(`Editando linha ${rowId}`, true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

      if (act === "del"){
        const ok = confirm(`Excluir o registro da linha ${rowId}?`);
        if (!ok) return;
        try{
          await api.remove(currentEntity, rowId);
          setMsg(navigator.onLine ? "Excluído com sucesso." : "Exclusão enfileirada (offline).");
          await loadAndRender();
        }catch(err){
          setMsg(String(err.message || err), false);
        }
      }
    });
  });
}

async function loadAndRender(){
  currentData = await api.list(currentEntity);
  renderTable(currentEntity, currentData);
  await updateQueueInfo();
}

async function updateQueueInfo(){
  const count = await api.getQueueCount();
  queueInfo.textContent = count
    ? `Fila offline pendente: ${count} ação(ões). Clique em “Sync” quando estiver online.`
    : `Fila offline: vazia.`;
}

function updateNetBadge(){
  const on = navigator.onLine;
  netBadge.textContent = on ? "Online" : "Offline";
  netBadge.style.color = on ? "rgba(46,229,157,.95)" : "rgba(255,176,32,.95)";
}

function escapeHtml(s){
  return s
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

async function ensureAutoId(){
  if (editingRowId) return;
  try{
    const id = await api.nextId(currentEntity);
    setFormField("id", id);
  }catch(_){}
}

async function onSave(){
  const payload = getFormPayload();

  if (!payload.id || String(payload.id).trim()===""){
    await ensureAutoId();
    payload.id = getFormPayload().id;
  }

  const missing = validate(currentEntity, payload);
  if (missing.length){
    setMsg(`Campos obrigatórios: ${missing.join(", ")}`, false);
    return;
  }

  // limpa módulos não usados (consistência para a planilha)
  if (currentEntity === "compositions"){
    const count = TIPO_MODULO_TO_COUNT[payload.tipoModulo] || 1;
    for (let i=count+1;i<=4;i++){
      payload[`tipoImplemento${i}`] = "";
      payload[`placa${i}`] = "";
      payload[`chassi${i}`] = "";
    }
  }

  try{
    if (editingRowId){
      await api.update(currentEntity, editingRowId, payload);
      setMsg(navigator.onLine ? "Atualizado com sucesso." : "Atualização enfileirada (offline).");
    }else{
      await api.create(currentEntity, payload);
      setMsg(navigator.onLine ? "Criado com sucesso." : "Criação enfileirada (offline).");
    }
    await onNew();
    await loadAndRender();
  }catch(err){
    setMsg(String(err.message || err), false);
  }
}

async function onNew(){
  editingRowId = null;
  if (currentEntity === "compositions"){
    renderForm(currentEntity, { tipoModulo: "1 Módulo (Solteiro)" });
  } else {
    renderForm(currentEntity, {});
  }
  await ensureAutoId();
}

async function onSync(){
  try{
    const r = await api.syncQueue();
    if (!navigator.onLine){
      setMsg("Você está offline. Não foi possível sincronizar.", false);
    }else{
      setMsg(`Sync concluído: ${r.synced} enviado(s). Pendentes: ${r.pending}.`, true);
      await loadAndRender();
    }
  }catch(err){
    setMsg(String(err.message || err), false);
  }
}

function initPWA(){
  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
}

function bindUI(){
  entitySelect.addEventListener("change", async () => {
    currentEntity = entitySelect.value;
    await onNew();
    await loadAndRender();
  });

  saveBtn.addEventListener("click", onSave);
  newBtn.addEventListener("click", onNew);

  refreshBtn.addEventListener("click", loadAndRender);
  syncBtn.addEventListener("click", onSync);

  searchInput.addEventListener("input", () => renderTable(currentEntity, currentData));
  limitSelect.addEventListener("change", () => renderTable(currentEntity, currentData));

  window.addEventListener("online", async () => {
    updateNetBadge();
    await onSync();
  });
  window.addEventListener("offline", () => updateNetBadge());
}

(async function main(){
  initPWA();
  bindUI();
  updateNetBadge();
  currentEntity = entitySelect.value;
  await onNew();
  await loadAndRender();
  try { await api.ping(); } catch(_){}
})();
