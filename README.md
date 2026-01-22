# Inventário (Web App + PWA) com Google Sheets (CRUD)

Este projeto é um **sistema de cadastro e inventário** (Veículos e Composições) para rodar como **Web App** no **GitHub Pages** e usar **Google Sheets como banco de dados** (via **Google Apps Script Web App**).

Inclui:
- CRUD completo: **criar / listar / editar / excluir**
- **PWA** (instalável, cache offline)
- **Offline-first**: fila de sincronização com **IndexedDB**
- **ID automático** no padrão **Pr-000001** (por entidade)

---

## 1) Pré-requisitos
- Conta Google
- Planilha no Google Sheets
- Repositório no GitHub com GitHub Pages habilitado

---

## 2) Configurar a planilha (Google Sheets)

Crie uma planilha e duas abas:

### Aba: `Vehicles`
Na linha 1 (cabeçalho), cole:
```
id,status,frota,placa,chassi,marca,modelo,ano,tipo
```

### Aba: `Compositions`
Na linha 1 (cabeçalho), cole:
```
id,status,tipoModulo,tipoImplemento,frota,placa,chassi,marca,ano
```

---

## 3) Configurar o Google Apps Script (API CRUD)

1. Abra a planilha > **Extensões > Apps Script**
2. Crie o arquivo `Code.gs` e cole o conteúdo de `backend/Code.gs` (neste ZIP)
3. Em `Code.gs`, configure:
   - `SPREADSHEET_ID = "..."` (ID da planilha)
4. Clique em **Deploy > New deployment**
5. Selecione **Web app**
6. Configure:
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Finalize o deploy e copie a URL que termina com `/exec`

### Teste rápido da API
No navegador, abra:
- `.../exec?action=ping`
- `.../exec?action=list&entity=vehicles`
- `.../exec?action=nextId&entity=vehicles`

---

## 4) Configurar o Frontend (GitHub Pages)

1. No projeto (frontend), abra `api.js` e cole a URL do Apps Script em:
   - `const API_URL = "COLE_AQUI_SUA_URL_DO_APPS_SCRIPT";`

2. Suba os arquivos para seu repositório (raiz do repo):
- `index.html`
- `styles.css`
- `app.js`
- `api.js`
- `db.js`
- `sw.js`
- `manifest.webmanifest`
- `icons/`

3. No GitHub:
- Settings > Pages
- Source: Deploy from a branch
- Branch: `main` / root

Abra a URL do GitHub Pages.

---

## 5) Como usar
- Selecione **Veículo** ou **Composição**
- Clique **Novo**
- O campo **Id** é preenchido automaticamente com **Pr-000001** (sequencial por aba)
- Preencha os demais campos e clique **Salvar**
- Na tabela, use **Editar** e **Excluir**
- Se ficar **offline**, as ações entram na fila
- Ao voltar online, clique **Sync** (ou ele tenta sincronizar automaticamente ao reconectar)

---

## 6) Observações importantes (Google Apps Script)
- Para **alterar a planilha**, faça novo deploy (ou use **Manage deployments**).
- Se você recriar o deploy, a URL pode mudar. Atualize `API_URL` no `api.js`.

---

## 7) Estrutura do ZIP
- `/` frontend (GitHub Pages)
- `/backend/Code.gs` (cole no Apps Script)

Bom trabalho.
