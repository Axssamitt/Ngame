-- ============================================================================
-- DESAFIO EMPREENDEDOR — ESTRUTURA DO BANCO DE DADOS E PROCEDIMENTO DE TURNO
-- Compatível com PostgreSQL / Supabase e adaptável para SQLite local
-- ============================================================================

-- Habilitar extensão para geração de UUID se estiver no PostgreSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA DE LIMITES POR SETOR
CREATE TABLE IF NOT EXISTS limites_setor (
  setor VARCHAR(30) PRIMARY KEY,
  percentual_max NUMERIC(5, 4) NOT NULL,
  vagas_max INT NOT NULL DEFAULT 100,
  vagas_ocupadas INT NOT NULL DEFAULT 0
);

-- Inserir dados padrão de limites setoriais
INSERT INTO limites_setor (setor, percentual_max, vagas_max, vagas_ocupadas)
VALUES
  ('industria', 0.0900, 9, 0),
  ('comercio', 0.2800, 28, 0),
  ('servico', 0.5500, 55, 0)
ON CONFLICT (setor) DO UPDATE SET
  percentual_max = EXCLUDED.percentual_max,
  vagas_max = EXCLUDED.vagas_max;

-- 2. TABELA DE CONFIGURAÇÃO DE CATEGORIAS DE PRODUTOS/SERVIÇOS
CREATE TABLE IF NOT EXISTS categorias (
  id VARCHAR(50) PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  setor VARCHAR(30) NOT NULL,
  demanda_base INT NOT NULL,
  preco_referencia NUMERIC(10, 2) NOT NULL,
  elasticidade NUMERIC(5, 2) NOT NULL,
  peso_qualidade NUMERIC(5, 2) NOT NULL DEFAULT 0.30
);

INSERT INTO categorias (id, nome, setor, demanda_base, preco_referencia, elasticidade, peso_qualidade)
VALUES
  ('alimentos', 'Alimentos', 'comercio', 10000, 50.00, -0.80, 0.30),
  ('vestuario', 'Vestuário', 'comercio', 6000, 80.00, -0.70, 0.40),
  ('eletronicos', 'Eletrônicos', 'comercio', 3000, 200.00, -0.50, 0.50),
  ('insumos', 'Insumos Industriais', 'industria', 5000, 30.00, -0.60, 0.20),
  ('marketing', 'Marketing e Consultoria', 'servico', 2000, 100.00, -0.90, 0.40),
  ('logistica', 'Logística e Frete', 'servico', 2500, 70.00, -0.60, 0.30)
ON CONFLICT (id) DO UPDATE SET
  demanda_base = EXCLUDED.demanda_base,
  preco_referencia = EXCLUDED.preco_referencia;

-- 3. TABELA DE EMPRESAS
CREATE TABLE IF NOT EXISTS empresas (
  id VARCHAR(64) PRIMARY KEY,
  jogador_id VARCHAR(64) NOT NULL DEFAULT 'local_player',
  nome VARCHAR(120) NOT NULL,
  setor VARCHAR(30) NOT NULL,
  categoria VARCHAR(50) NOT NULL,
  caixa NUMERIC(15, 2) NOT NULL DEFAULT 10000.00,
  reputacao INT NOT NULL DEFAULT 50,
  qualidade INT NOT NULL DEFAULT 50,
  preco_venda NUMERIC(10, 2) NOT NULL DEFAULT 50.00,
  marketing NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  capacidade_producao INT NOT NULL DEFAULT 200,
  estoque_produto INT NOT NULL DEFAULT 100,
  estoque_insumos INT NOT NULL DEFAULT 100,
  meta_producao INT NOT NULL DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABELA DE ORDENS DE COMPRA B2B
CREATE TABLE IF NOT EXISTS ordens_compra (
  id VARCHAR(64) PRIMARY KEY,
  empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  categoria VARCHAR(50) NOT NULL,
  quantidade INT NOT NULL,
  quantidade_restante INT NOT NULL,
  preco_maximo NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'aberta',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABELA DE OFERTAS DE VENDA B2B
CREATE TABLE IF NOT EXISTS ofertas_venda (
  id VARCHAR(64) PRIMARY KEY,
  empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  categoria VARCHAR(50) NOT NULL,
  quantidade INT NOT NULL,
  quantidade_restante INT NOT NULL,
  preco_minimo NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'aberta',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABELA DE TRANSAÇÕES B2B EXECUTADAS
CREATE TABLE IF NOT EXISTS transacoes_turno (
  id VARCHAR(64) PRIMARY KEY,
  turno_numero INT NOT NULL,
  comprador_id VARCHAR(64) NOT NULL REFERENCES empresas(id),
  vendedor_id VARCHAR(64) NOT NULL REFERENCES empresas(id),
  categoria VARCHAR(50) NOT NULL,
  quantidade INT NOT NULL,
  preco_unitario NUMERIC(10, 2) NOT NULL,
  total NUMERIC(15, 2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABELA DE RELATÓRIOS DO TURNO (DRE)
CREATE TABLE IF NOT EXISTS relatorios_turno (
  id VARCHAR(64) PRIMARY KEY,
  turno_numero INT NOT NULL,
  empresa_id VARCHAR(64) NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  receita_bruta NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  custos_fixos NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  custos_variaveis NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  impostos NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  lucro_liquido NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  market_share NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  unidades_vendidas INT NOT NULL DEFAULT 0,
  detalhes_json TEXT DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. ESTADO GERAL DO JOGO
CREATE TABLE IF NOT EXISTS estado_jogo (
  id INT PRIMARY KEY DEFAULT 1,
  turno_atual INT NOT NULL DEFAULT 0,
  evento_ativo VARCHAR(100),
  evento_descricao TEXT,
  evento_duracao INT DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO estado_jogo (id, turno_atual)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SEEDS INICIAIS DE DEMONSTRAÇÃO LOCAL
-- ============================================================================
INSERT INTO empresas (id, nome, setor, categoria, caixa, reputacao, qualidade, preco_venda, marketing, capacidade_producao, estoque_produto, estoque_insumos, meta_producao)
VALUES
  ('emp_1', 'AgroIndústria Aurora', 'industria', 'alimentos', 15000.00, 60, 65, 38.00, 200.00, 300, 250, 300, 150),
  ('emp_2', 'Supermercado Central', 'comercio', 'alimentos', 12000.00, 52, 50, 49.90, 450.00, 200, 180, 0, 0),
  ('emp_3', 'TechPrime Fábrica', 'industria', 'eletronicos', 20000.00, 55, 70, 160.00, 500.00, 150, 120, 200, 100)
ON CONFLICT (id) DO NOTHING;

UPDATE limites_setor SET vagas_ocupadas = (SELECT COUNT(*) FROM empresas WHERE setor = 'industria') WHERE setor = 'industria';
UPDATE limites_setor SET vagas_ocupadas = (SELECT COUNT(*) FROM empresas WHERE setor = 'comercio') WHERE setor = 'comercio';
UPDATE limites_setor SET vagas_ocupadas = (SELECT COUNT(*) FROM empresas WHERE setor = 'servico') WHERE setor = 'servico';

-- ============================================================================
-- STORED PROCEDURE DE PROCESSAMENTO DE TURNO (PostgreSQL / PLpgSQL)
-- ============================================================================
CREATE OR REPLACE FUNCTION processar_turno()
RETURNS INT AS $$
DECLARE
  v_turno INT;
  emp RECORD;
  v_aluguel NUMERIC;
  v_salarios NUMERIC;
  v_custos_fixos NUMERIC;
  v_custos_prod NUMERIC;
  v_imposto NUMERIC;
  v_lucro NUMERIC;
  v_receita NUMERIC;
  v_produzir INT;
BEGIN
  -- 1. Incrementar turno
  UPDATE estado_jogo SET turno_atual = turno_atual + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1 RETURNING turno_atual INTO v_turno;

  -- 2. Produção industrial
  FOR emp IN SELECT * FROM empresas WHERE setor = 'industria' LOOP
    v_produzir := LEAST(emp.capacidade_producao, emp.meta_producao, emp.estoque_insumos);
    IF v_produzir > 0 AND emp.caixa >= (v_produzir * 15.00) THEN
      v_custos_prod := v_produzir * 15.00;
      UPDATE empresas
      SET caixa = caixa - v_custos_prod,
          estoque_insumos = estoque_insumos - v_produzir,
          estoque_produto = estoque_produto + v_produzir
      WHERE id = emp.id;
    END IF;
  END LOOP;

  -- 3. Fechamento de custos e relatórios
  FOR emp IN SELECT * FROM empresas LOOP
    v_aluguel := CASE WHEN emp.setor = 'industria' THEN 2000.00 WHEN emp.setor = 'comercio' THEN 1500.00 ELSE 1000.00 END;
    v_salarios := 500.00 + (emp.capacidade_producao * 2.00);
    v_custos_fixos := v_aluguel + v_salarios;
    v_receita := 0.00;
    v_imposto := v_receita * 0.12;
    v_lucro := v_receita - v_custos_fixos - emp.marketing - v_imposto;

    UPDATE empresas
    SET caixa = caixa - v_custos_fixos - emp.marketing - v_imposto
    WHERE id = emp.id;

    INSERT INTO relatorios_turno (
      id, turno_numero, empresa_id, receita_bruta, custos_fixos, custos_variaveis, impostos, lucro_liquido, market_share, unidades_vendidas
    ) VALUES (
      'rel_' || v_turno || '_' || emp.id,
      v_turno,
      emp.id,
      v_receita,
      v_custos_fixos,
      emp.marketing,
      v_imposto,
      v_lucro,
      0,
      0
    );
  END LOOP;

  RETURN v_turno;
END;
$$ LANGUAGE plpgsql;
