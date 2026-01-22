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

const schema = {
  vehicles: {
    label: "Veículo",
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
    label: "Composição",
    fields: [
      { key:"tipoModulo", label:"Tipo (Módulos)", type:"select",
        options:["1 Módulo (Solteiro)","2 Módulo (Duplado)","3 Módulo (Tremiado)","4 Módulo (Tremiado + Dolly)"],
        required:true
      },
      { key:"id", label:"Id (automático)", type:"text", required:true, readonly:true },
      { key:"status", label:"Status", type:"select", options:["Ativo","Inativo","Manutenção"], required:true },
      { key:"tipoImplemento", label:"Tipo (Implemento)", type:"select", options:["Semi-Reboque","Reboque","Dolly-Reboque"], required:true },
      { key:"frota", label:"Frota", type:"text" },
      { key:"placa", label:"Placa", type:"text" },
      { key:"chassi", label:"Chassi", type:"text" },
      { key:"marca", label:"Marca", type:"select", options:["Fachinni","Randon","Usicamp"], required:true },
      { key:"ano", label:"Ano", type:"number" }
    ],
    table: ["id","status","frota","placa","marca","ano","tipoModulo","tipoImplemento"]
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

function renderForm(entity, data={}){
  const cfg = schema[entity];
  const fieldsHtml = cfg.fields.map(f => {
    const val = data[f.key] ?? "";
    const req = f.required ? "required" : "";
    const ro = f.readonly ? "readonly" : "";
    if (f.type === "select"){
      const opts = f.options.map(o => `<option ${String(o)===String(val)?"selected":""}>${o}</option>`).join("");
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
  }).join("");

  formArea.innerHTML = `<div class="grid">${fieldsHtml}</div>`;
}

function getFormPayload(entity){
  const cfg = schema[entity];
  const payload = {};
  for (const f of cfg.fields){
    const input = formArea.querySelector(`[data-key="${f.key}"]`);
    let v = input?.value ?? "";
    if (f.type === "number" && v !== "") v = Number(v);
    payload[f.key] = v;
  }
  return payload;
}

function setFormField(key, value){
  const input = formArea.querySelector(`[data-key="${key}"]`);
  if (input) input.value = value ?? "";
}

function validate(entity, payload){
  const cfg = schema[entity];
  const missing = cfg.fields
    .filter(f => f.required)
    .filter(f => String(payload[f.key] ?? "").trim() === "")
    .map(f => f.label);
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
  // Só gera ID automaticamente quando for "novo"
  if (editingRowId) return;
  try{
    const id = await api.nextId(currentEntity);
    setFormField("id", id);
  }catch(_){
    // silencioso: validação já exige id; tentaremos novamente
  }
}

async function onSave(){
  const payload = getFormPayload(currentEntity);

  // Garantir ID automático antes de validar
  if (!payload.id || String(payload.id).trim()===""){
    await ensureAutoId();
    payload.id = getFormPayload(currentEntity).id;
  }

  const missing = validate(currentEntity, payload);
  if (missing.length){
    setMsg(`Campos obrigatórios: ${missing.join(", ")}`, false);
    return;
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
  renderForm(currentEntity, {});
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
