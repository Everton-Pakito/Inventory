import { cacheGet, cacheSet, queueAdd, queueList, queueDelete } from "./db.js";

// COLE A URL DO SEU DEPLOY DO APPS SCRIPT (termina com /exec)
const API_URL = "COLE_AQUI_SUA_URL_DO_APPS_SCRIPT";

async function apiGet(params){
  const url = new URL(API_URL);
  Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { method:"GET" });
  if (!res.ok) throw new Error("Falha no GET");
  return res.json();
}

async function apiPost(body){
  const res = await fetch(API_URL, {
    method:"POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("Falha no POST");
  return res.json();
}

export async function ping(){ return apiGet({ action:"ping" }); }
export async function init(){ return apiGet({ action:"init" }); }

export async function nextId(entity){
  if (navigator.onLine){
    const r = await apiGet({ action:"nextId", entity });
    if (!r?.ok) throw new Error(r?.error || "Erro nextId");
    return r.id;
  }
  const ts = Date.now().toString().slice(-12);
  return `Pr-${ts}`;
}

export async function list(entity){
  try{
    const r = await apiGet({ action:"list", entity });
    if (r?.ok) await cacheSet(`list:${entity}`, r.data);
    return r.data || [];
  }catch(_){
    return (await cacheGet(`list:${entity}`)) || [];
  }
}

export async function create(entity, payload){
  if (navigator.onLine){
    const r = await apiPost({ action:"create", entity, payload });
    if (!r?.ok) throw new Error(r?.error || "Erro create");
    return r.row;
  }
  const q = { id: crypto.randomUUID(), ts: Date.now(), op: "create", entity, payload };
  await queueAdd(q);
  return { ...payload, _offline: true };
}

export async function update(entity, rowId, payload){
  if (navigator.onLine){
    const r = await apiPost({ action:"update", entity, rowId, payload });
    if (!r?.ok) throw new Error(r?.error || "Erro update");
    return r.row;
  }
  const q = { id: crypto.randomUUID(), ts: Date.now(), op: "update", entity, rowId, payload };
  await queueAdd(q);
  return { ...payload, _offline: true };
}

export async function remove(entity, rowId){
  if (navigator.onLine){
    const r = await apiPost({ action:"delete", entity, rowId });
    if (!r?.ok) throw new Error(r?.error || "Erro delete");
    return r.result;
  }
  const q = { id: crypto.randomUUID(), ts: Date.now(), op: "delete", entity, rowId };
  await queueAdd(q);
  return { deleted: rowId, _offline: true };
}

export async function syncQueue(){
  if (!navigator.onLine) return { ok:false, synced:0, pending: (await queueList()).length };

  const items = (await queueList()).sort((a,b)=>a.ts-b.ts);
  let synced = 0;

  for (const it of items){
    try{
      if (it.op === "create"){
        const r = await apiPost({ action:"create", entity: it.entity, payload: it.payload });
        if (!r?.ok) throw new Error(r?.error || "Erro create (sync)");
      } else if (it.op === "update"){
        const r = await apiPost({ action:"update", entity: it.entity, rowId: it.rowId, payload: it.payload });
        if (!r?.ok) throw new Error(r?.error || "Erro update (sync)");
      } else if (it.op === "delete"){
        const r = await apiPost({ action:"delete", entity: it.entity, rowId: it.rowId });
        if (!r?.ok) throw new Error(r?.error || "Erro delete (sync)");
      }
      await queueDelete(it.id);
      synced++;
    }catch(_){
      break;
    }
  }

  return { ok:true, synced, pending: (await queueList()).length };
}

export async function getQueueCount(){ return (await queueList()).length; }
