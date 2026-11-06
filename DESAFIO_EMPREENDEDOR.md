# Desafio Empreendedor — Especificação do Jogo, Motor Econômico e Prompts para Lovable / Jules

Este documento consolida a especificação arquitetural, os modelos matemáticos refinados, o esquema de dados relacional e os prompts completos para geração da aplicação no **Lovable** e no **Jules**.

---

## 1. Visão Geral e Decisões Fundamentais de Arquitetura

O **Desafio Empreendedor** é um jogo de simulação empresarial assíncrono projetado para operar com cadência diária (1 dia no mundo real = 1 mês econômico no jogo). Três premissas reduzem radicalmente a complexidade técnica e maximizam a experiência pedagógica e competitiva:

1. **Modelo de Ordens Permanentes (*Standing Orders*):**
   - O jogador configura preço de venda, verba de marketing, capacidade/alvos de produção e ordens/ofertas B2B no momento em que desejar.
   - Às 00:00 (fuso do servidor), o turno é processado deterministicamente em lote com base no estado salvo.
   - Não há tempo de espera ou dependência de jogadores estarem online simultaneamente. Caso um jogador fique inativo, sua empresa opera com as últimas diretrizes configuradas.

2. **Demanda Agregada B2C com Curva Microeconômica:**
   - Em vez de simular milhões de agentes individuais, o motor simula o mercado agregado por setor e categoria.
   - A demanda de cada nicho varia com o "humor do mercado" (±15%) e eventos macroeconômicos.
   - A fatia de mercado (*market share*) de cada empresa é determinada por uma função de atratividade ponderada por elasticidade de preço, esforço de marketing, qualidade técnica e reputação acumulada.

3. **Escopo Enxuto de Produtos e Cadeia de Suprimentos:**
   - **Alimentos** (Indústria -> Comércio -> B2C)
   - **Vestuário** (Indústria -> Comércio -> B2C)
   - **Eletrônicos** (Indústria -> Comércio -> B2C)
   - **Insumos Industriais** (Fornecedores NPC / Indústria -> Indústria [B2B])
   - **Marketing / Consultoria** (Serviços -> Todos os setores [B2B])
   - **Logística** (Serviços -> Todos os setores [B2B])

---

## 2. Modelos Matemáticos Refinados

### 2.1 Demanda B2C e Cálculo de Atratividade
A cada categoria de varejo, a demanda total agregada no turno $t$ é:
$$D_{\text{total}} = D_{\text{base}} \times \left(1 + \frac{\Delta_{\text{humor}}}{100}\right) \times (1 + E_{\text{evento}})$$

Para cada empresa $i$ competindo na categoria:
$$\text{Score}(i) = \left(\frac{P_{\text{ref}}}{P_i}\right)^{-\epsilon} \times \left(1 + \frac{M_i}{1000} \times 0.5\right) \times \left(1 + \frac{Q_i}{100} \times W_q\right) \times \left(1 + \frac{R_i}{100} \times 0.2\right)$$
- $P_i$: Preço praticado pela empresa $i$.
- $P_{\text{ref}}$: Preço de referência da categoria.
- $\epsilon$: Coeficiente de elasticidade-preço (ex: $-0.8$ para alimentos, $-0.7$ para vestuário, $-0.5$ para eletrônicos).
- $M_i$: Verba alocada em marketing.
- $Q_i$: Nível de qualidade do produto ($0$ a $100$).
- $R_i$: Reputação da marca ($0$ a $100$).
- $W_q$: Peso de qualidade da categoria.

Fatia de mercado e unidades vendidas:
$$\text{Share}_i = \frac{\text{Score}(i)}{\sum_{j} \text{Score}(j)}$$
$$V_i = \min\left(\lfloor D_{\text{total}} \times \text{Share}_i \rfloor, \text{EstoqueDisponivel}_i\right)$$

### 2.2 Motor de Matching B2B (Leilão com Livro de Ordens)
Para transações entre empresas (Indústria vendendo para Comércio, Fornecedor vendendo Insumos):
1. **Ordens de Compra ($B$):** Ordenadas decrescentemente por `preco_maximo` (quem paga mais tem prioridade).
2. **Ofertas de Venda ($S$):** Ordenadas crescentemente por `preco_minimo` (quem cobra menos tem prioridade).
3. **Casamento (*Clearing*):**
   - Se $B.\text{preco\_maximo} \ge S.\text{preco\_minimo}$:
     - Preço de liquidação: $P = \frac{B.\text{preco\_maximo} + S.\text{preco\_minimo}}{2}$ (ou preço do vendedor caso configurado).
     - Quantidade transacionada: $Q = \min(B.\text{quantidade\_restante}, S.\text{quantidade\_restante}, \lfloor B.\text{caixa} / P \rfloor)$.
     - Transfere estoque e debita/credita caixas imediatamente.

### 2.3 Produção Industrial
$$\text{QtdPossivel} = \min\left(\text{CapacidadeProducao}, \left\lfloor\frac{\text{EstoqueInsumos}}{\text{InsumoPorUnidade}}\right\rfloor\right)$$
$$\text{CustoInsumoTotal} = \text{QtdProduzida} \times \text{CustoUnitarioInsumo}$$

### 2.4 DRE e Fechamento de Caixa
- **Receita Bruta:** $R_{\text{bruta}} = V_{\text{B2C}} \times P_i + V_{\text{B2B}} \times P_{\text{liquidação}}$
- **Impostos:** $12\%$ sobre $R_{\text{bruta}}$
- **Custos Fixos:** Aluguel Setorial + Salários da Capacidade Instalada ($500 + \text{Capacidade} \times 2$)
- **Lucro Líquido:** $R_{\text{bruta}} - \text{Impostos} - \text{Custos Fixos} - \text{Custos Insumos} - M_i$
- **Caixa Final:** $\text{Caixa}_{t-1} + \text{Lucro Líquido}$

---

## 3. Esquema Relacional de Banco de Dados (PostgreSQL / Supabase)

```sql
-- Extensões necessárias
create extension if not exists "uuid-ossp";

-- 1. Empresas dos Jogadores
create table if not exists empresas (
  id uuid primary key default uuid_generate_v4(),
  jogador_id uuid not null,
  nome text not null,
  setor text not null check (setor in ('industria', 'comercio', 'servico')),
  categoria text not null check (categoria in ('alimentos', 'vestuario', 'eletronicos', 'insumos', 'marketing', 'logistica')),
  caixa numeric(15, 2) not null default 10000.00,
  reputacao int not null default 50 check (reputacao between 0 and 100),
  qualidade int not null default 50 check (qualidade between 0 and 100),
  preco_venda numeric(10, 2) not null default 50.00,
  marketing numeric(10, 2) not null default 0.00,
  capacidade_producao int not null default 200,
  estoque_produto int not null default 100,
  estoque_insumos int not null default 100,
  created_at timestamptz not null default now()
);

-- 2. Limites Populacionais de Setor
create table if not exists limites_setor (
  setor text primary key check (setor in ('industria', 'comercio', 'servico')),
  percentual_max numeric(5, 4) not null,
  vagas_max int not null default 100,
  vagas_ocupadas int not null default 0
);

-- Inicialização de quotas setoriais
insert into limites_setor (setor, percentual_max, vagas_max, vagas_ocupadas)
values
  ('industria', 0.0900, 9, 0),
  ('comercio', 0.2800, 28, 0),
  ('servico', 0.5500, 55, 0)
on conflict (setor) do nothing;

-- 3. Livro de Ordens B2B
create table if not exists ordens_compra (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  categoria text not null,
  quantidade int not null,
  preco_maximo numeric(10, 2) not null,
  status text not null default 'aberta' check (status in ('aberta', 'parcial', 'executada', 'cancelada')),
  created_at timestamptz not null default now()
);

create table if not exists ofertas_venda (
  id uuid primary key default uuid_generate_v4(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  categoria text not null,
  quantidade int not null,
  preco_minimo numeric(10, 2) not null,
  status text not null default 'aberta' check (status in ('aberta', 'parcial', 'executada', 'cancelada')),
  created_at timestamptz not null default now()
);

-- 4. Transações Executadas no Turno
create table if not exists transacoes_turno (
  id uuid primary key default uuid_generate_v4(),
  turno_numero int not null,
  comprador_id uuid not null references empresas(id),
  vendedor_id uuid not null references empresas(id),
  categoria text not null,
  quantidade int not null,
  preco_unitario numeric(10, 2) not null,
  total numeric(15, 2) not null,
  created_at timestamptz not null default now()
);

-- 5. Relatórios Financeiros e DRE por Turno
create table if not exists relatorios_turno (
  id uuid primary key default uuid_generate_v4(),
  turno_numero int not null,
  empresa_id uuid not null references empresas(id) on delete cascade,
  receita_bruta numeric(15, 2) not null default 0.00,
  custos_fixos numeric(15, 2) not null default 0.00,
  custos_variaveis numeric(15, 2) not null default 0.00,
  impostos numeric(15, 2) not null default 0.00,
  lucro_liquido numeric(15, 2) not null default 0.00,
  market_share numeric(5, 2) not null default 0.00,
  relatorio_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 6. Estado Geral do Jogo
create table if not exists estado_jogo (
  id int primary key default 1,
  turno_atual int not null default 0,
  evento_ativo text,
  evento_duracao int default 0,
  updated_at timestamptz not null default now()
);

insert into estado_jogo (id, turno_atual) values (1, 0) on conflict (id) do nothing;
```

---

## 4. Prompts Prontos para Lovable

### Prompt Mestre (Fase 1: Fundação do Sistema)
```markdown
Build a web-based multiplayer business simulation game called "Desafio Empreendedor".

**Tech Stack:** React, TypeScript, Tailwind CSS, Lucide Icons, and Supabase.

**Core Concept:**
Players manage a company in an asynchronous daily turn economic simulation (1 day real time = 1 month in game).
Companies belong to one of 3 sectors with strict percentage caps on total server capacity:
- Indústria (max 9%)
- Comércio (max 28%)
- Serviços (max 55%)

Products/Categories:
- Alimentos, Vestuário, Eletrônicos (B2C & B2B)
- Insumos Industriais, Marketing/Consultoria, Logística (B2B)

**Key Pages & Components:**
1. Authentication & Onboarding (Supabase Auth).
2. Sector Slot Status (visual gauges showing industry 9%, commerce 28%, services 55% occupancy).
3. Company Creation modal that validates and decrements sector availability.
4. Company Dashboard with real-time stats:
   - Cash (Caixa), Inventory (Estoque), Selling Price, Marketing Spend, Reputation (0-100), Quality (0-100), Capacity.
5. Daily Turn Simulation trigger button with detailed DRE financial statements.

Provide clean, modular React components, modern glassmorphism or slate dark-mode styling, and informative tooltips explaining business concepts.
```

### Prompt de Refinamento (Fase 2: Motor Econômico B2C e Atratividade)
```markdown
Implement the full microeconomic consumer demand model for "Desafio Empreendedor".

In the turn engine:
1. Each turn, calculate daily consumer sentiment variance (humor: -15% to +15%) for each B2C category (alimentos, vestuario, eletronicos).
2. For each active retail company in the category, compute its Attractiveness Score:
   Score = (RefPrice / PlayerPrice)^(-elasticity) * (1 + (Marketing / 1000) * 0.5) * (1 + (Quality / 100) * WeightQuality) * (1 + (Reputation / 100) * 0.2)
   Category parameters:
   - alimentos: baseDemand 10000, refPrice 50, elasticity -0.8, weightQuality 0.3
   - vestuario: baseDemand 6000, refPrice 80, elasticity -0.7, weightQuality 0.4
   - eletronicos: baseDemand 3000, refPrice 200, elasticity -0.5, weightQuality 0.5
3. Distribute demand proportionally to Attractiveness Score. Cap units sold by company's available inventory.
4. Calculate gross revenue, apply 12% tax, charge fixed costs (Rent + Salaries = 500 + capacity * 2), calculate net profit and update cash and reputation.
5. Generate an interactive financial report (DRE) displayed directly on each company's card.
```

### Prompt de Refinamento (Fase 3: Mercado B2B e Match por Leilão)
```markdown
Add the B2B Order Book & Double Auction matching engine.

Features:
1. B2B Order Book screen where:
   - Industrial companies can submit Sell Offers (category, quantity, minimum price).
   - Commercial companies can submit Buy Orders (category, quantity, maximum price).
2. During the turn execution:
   - Sort buy orders descending by max price (highest bid first).
   - Sort sell offers ascending by min price (lowest ask first).
   - Match orders where buy_max_price >= sell_min_price.
   - Clearing price is the average: (max_price + min_price) / 2.
   - Transfer stock, transfer cash between buyer and seller, and record transactions in `transacoes_turno`.
3. Provide an active order management UI with cancel buttons and filled order history.
```

---

## 5. Prompts Prontos para Jules

### Prompt 1: Implementação da Rotina de Turno no Backend Hono / Supabase
```markdown
Implement the daily economic turn processing algorithm for "Desafio Empreendedor" in TypeScript and Drizzle ORM.

Create `src/services/turnProcessor.ts` and route `POST /api/turn/process` with:
1. Market Mood & Macro Event:
   - Random mood variation (-15% to +15%) per category.
   - 12% probability of triggering a macro event (e.g., 'Black Friday', 'Crise Cambial', 'Incentivo Fiscal') with multi-turn durations.
2. B2B Double Auction Clearing:
   - Query open buy orders and sell offers.
   - Match highest bidder with lowest seller when buyer price >= seller price.
   - Compute cleared units, deduct cash from buyer, credit seller, update inventories, and record transaction logs.
3. Industrial Production:
   - For industrial firms with raw materials, produce finished units up to production capacity, consuming inputs and deducting input costs.
4. B2C Market Share Allocation:
   - Calculate attractiveness scores for all retail/services players based on price elasticity, marketing spend, quality and reputation.
   - Allocate market demand units proportionally, capped by current stock.
5. P&L, Taxation & Balance Sheet:
   - 12% gross revenue tax.
   - Sector-based rent (Industry: 2000, Commerce: 1500, Services: 1000) and labor costs ($500 + capacity * 2).
   - Net profit calculation, cash update, and reputation adjustments.
   - Persist full JSON report to `relatorios_turno`.
6. Write unit tests covering edge cases (e.g. stockouts, buyer without enough cash, zero competitors in category).
```

### Prompt 2: Agendamento Automatizado com pg_cron
```markdown
Write a migration file setting up automated daily execution of `processar_turno()` using PostgreSQL pg_cron at 00:00 UTC. Ensure the execution runs within a serializable transaction with idempotency checks and rollback safeguards.
```

---

## 6. Como Rodar Localmente (com Arquivo SQL)

Você pode executar o jogo localmente de três maneiras simples:

### Opção 1: Servidor Local Node.js (Recomendada)
O arquivo `server_local.js` sincroniza diretamente com o arquivo `init_db.sql`:
```bash
npm run start:local
# ou
node server_local.js
```
Acesse no seu navegador: `http://localhost:3000`

### Opção 2: Execução Direta no Navegador (Offline)
Basta abrir o arquivo `desafio-empreendedor.html` com dois cliques ou via `file://`.
Você pode clicar no botão **"💾 Exportar SQL"** a qualquer momento para gerar o dump SQL atualizado (`desafio_empreendedor_turno_X.sql`).

### Opção 3: Usando um Banco PostgreSQL Local ou Docker
Se você tiver PostgreSQL rodando localmente:
```bash
psql -U postgres -d postgres -f init_db.sql
```
Para simular a virada do dia via terminal:
```sql
SELECT processar_turno();
```
