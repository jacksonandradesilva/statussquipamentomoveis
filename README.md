# Status Equipamentos Moveis Mina (React + Vite + Supabase)

Projeto migrado de HTML/JS puro para React com Vite, preparado para deploy no Vercel e persistencia no Supabase.

## 1. Rodar localmente

```bash
npm install
npm run dev
```

A aplicacao abre normalmente em `http://localhost:5173`.

## 2. Configurar Supabase

1. Crie um projeto no Supabase.
2. Rode o SQL de [supabase.sql](supabase.sql).
3. Copie `.env.example` para `.env`.
4. Preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
```

Sem essas variaveis, o app funciona em modo local usando `localStorage`.

## 3. Tabela usada

Tabela: `equipamentos_mina`

Tabela: `jps_mina`

Colunas:
- `id`
- `nome`
- `status`
- `causa`
- `descricao`
- `hora_inicio`
- `hora_fim`
- `data_hora_cadastro`
- `created_at`

As duas tabelas seguem a mesma estrutura para manter os cadastros e a visualizacao de status em paginas separadas.

## 4. Deploy no Vercel

1. Suba este repositorio no GitHub.
2. Importe o projeto no Vercel.
3. Em `Settings > Environment Variables`, adicione:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
4. Build command: `npm run build`
5. Output directory: `dist`

`vercel.json` ja inclui rewrite para SPA do React.
