# Inventário (Web App + PWA) com Google Sheets (CRUD)

Projeto para rodar no **GitHub Pages** e usar **Google Sheets** como banco de dados via **Google Apps Script (Web App)**.

## Principais pontos
- CRUD completo: criar / listar / editar / excluir
- PWA (instalável + cache offline)
- Offline-first: fila de sincronização (IndexedDB)
- ID automático padrão **Pr-000001** (sequencial por aba)
- **Automação do Google Sheets**: `GET ?action=init` cria abas e cabeçalhos
- **Composições por linhas**: cada módulo é 1 linha na planilha (mais legível)

---

## 1) Configurar o Apps Script
1. Abra sua planilha > **Extensões > Apps Script**
2. Substitua todo o conteúdo do projeto pelo arquivo `backend/Code.gs`
3. Edite somente:
   - `SPREADSHEET_ID = "..."`

### Publicar como Web App
- Deploy > New deployment
- Type: Web app
- Execute as: Me
- Who has access: Anyone
- Copie a URL (termina com `/exec`)

### Inicializar a planilha automaticamente
Abra:
- `.../exec?action=init`

---

## 2) Estrutura da planilha

### Aba: Vehicles
Cabeçalho (linha 1):
```
id,status,frota,placa,chassi,marca,modelo,ano,tipo
```

### Aba: Compositions (POR LINHAS)
Cada módulo ocupa 1 linha, repetindo o mesmo `id` da composição.

Cabeçalho (linha 1):
```
id,status,tipoModulo,modulo,frota,marca,ano,tipoImplemento,placa,chassi
```

Exemplo: composição `Pr-000123` com 3 módulos → 3 linhas (modulo=1,2,3).

---

## 3) Configurar o Frontend (GitHub Pages)
1. Abra `api.js` e cole sua URL do Apps Script:
   - `const API_URL = "..."`

2. Suba os arquivos do projeto na raiz do repositório
3. Ative o GitHub Pages:
- Settings > Pages
- Deploy from a branch
- main / root

---

## Testes rápidos
- `.../exec?action=ping`
- `.../exec?action=init`
- `.../exec?action=list&entity=vehicles`
- `.../exec?action=list&entity=compositions`
- `.../exec?action=nextId&entity=compositions`
