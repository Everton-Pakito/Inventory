# Inventário (Web App + PWA) com Google Sheets (CRUD)

Sistema de cadastro e inventário (Veículos e Composições) para rodar no **GitHub Pages** e usar **Google Sheets** como banco de dados via **Google Apps Script (Web App)**.

Inclui:
- CRUD completo: criar / listar / editar / excluir
- PWA (instalável + cache offline)
- Offline-first: fila de sincronização com IndexedDB
- ID automático padrão **Pr-000001** (sequencial por aba)

---

## 1) Configurar a planilha (Google Sheets)

Crie uma planilha e duas abas:

### Aba: `Vehicles`
Na linha 1 (cabeçalho), cole:
```
id,status,frota,placa,chassi,marca,modelo,ano,tipo
```

### Aba: `Compositions`
Na linha 1 (cabeçalho), cole:
```
id,status,tipoModulo,frota,marca,ano,tipoImplemento1,placa1,chassi1,tipoImplemento2,placa2,chassi2,tipoImplemento3,placa3,chassi3,tipoImplemento4,placa4,chassi4
```

> Regra: o campo **Tipo (Módulos)** define quantos módulos aparecem no formulário.  
> - 1 Módulo: preenche módulo 1  
> - 2 Módulos: preenche módulos 1 e 2  
> - 3 Módulos: preenche módulos 1,2,3  
> - 4 Módulos: preenche módulos 1,2,3,4  
> Os módulos não usados são gravados vazios na planilha.

---

## 2) Configurar o Google Apps Script (API)

1. Abra a planilha > **Extensões > Apps Script**
2. Cole o conteúdo de `backend/Code.gs`
3. Em `Code.gs`, configure:
   - `SPREADSHEET_ID = "..."` (ID da sua planilha)
4. Clique em **Deploy > New deployment**
5. Tipo: **Web app**
6. Execute as: **Me**
7. Who has access: **Anyone**
8. Conclua e copie a URL (termina com `/exec`)

### Testes rápidos
- `.../exec?action=ping`
- `.../exec?action=list&entity=vehicles`
- `.../exec?action=nextId&entity=compositions`

---

## 3) Configurar o Frontend (GitHub Pages)

1. Abra `api.js` e cole a URL do Apps Script em:
   - `const API_URL = "..."`

2. Suba os arquivos na raiz do seu repositório.

3. Ative o GitHub Pages:
- Settings > Pages
- Source: Deploy from a branch
- Branch: `main` / root

---

## 4) Uso
- Selecione Veículo ou Composição
- Clique em Novo
- O campo Id é preenchido automaticamente
- Salve, edite e exclua na tabela
- Offline: ações entram em fila. Ao reconectar, use Sync (ou sincroniza automaticamente ao voltar online).

---

## Estrutura
- `/` frontend
- `/backend/Code.gs` backend (cole no Apps Script)
