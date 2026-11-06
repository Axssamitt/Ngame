import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const SQL_FILE = path.join(__dirname, 'init_db.sql');
const HTML_FILE = path.join(__dirname, 'desafio-empreendedor.html');

// In-memory state synchronized from/to SQL file representation
let gameState = {
  turno: 0,
  empresas: [],
  limitesSetor: {
    industria: { maxPct: 0.09, vagasMax: 9, ocupadas: 0 },
    comercio: { maxPct: 0.28, vagasMax: 28, ocupadas: 0 },
    servico: { maxPct: 0.55, vagasMax: 55, ocupadas: 0 },
  },
  ordensB2B: [],
  transacoesB2B: [],
};

// Carrega as tabelas e seeds do init_db.sql
function loadFromSQL() {
  if (!fs.existsSync(SQL_FILE)) return;
  const content = fs.readFileSync(SQL_FILE, 'utf-8');

  // Parse rudimentary seeds from SQL
  const regexEmpresa = /INSERT INTO empresas[^(]+\(([^)]+)\)\s+VALUES\s+([\s\S]+?)(?=ON CONFLICT|;)/i;
  const match = content.match(regexEmpresa);
  if (match && match[2]) {
    const rows = match[2].split(/\),\s*\(/);
    gameState.empresas = rows.map((r, i) => {
      const clean = r.replace(/[()']/g, '').split(',').map(s => s.trim());
      return {
        id: clean[0] || `emp_${i + 1}`,
        nome: clean[1] || `Empresa ${i + 1}`,
        setor: clean[2] || 'comercio',
        categoria: clean[3] || 'alimentos',
        caixa: parseFloat(clean[4]) || 10000,
        reputacao: parseInt(clean[5]) || 50,
        qualidade: parseInt(clean[6]) || 50,
        preco: parseFloat(clean[7]) || 50,
        marketing: parseFloat(clean[8]) || 0,
        capacidade: parseInt(clean[9]) || 200,
        estoqueProduto: parseInt(clean[10]) || 100,
        estoqueInsumos: parseInt(clean[11]) || 100,
        metaProducao: parseInt(clean[12]) || 100,
        ultimoFaturamento: 0,
        ultimoLucro: 0,
        ultimoDRE: null,
      };
    });

    gameState.limitesSetor.industria.ocupadas = gameState.empresas.filter(e => e.setor === 'industria').length;
    gameState.limitesSetor.comercio.ocupadas = gameState.empresas.filter(e => e.setor === 'comercio').length;
    gameState.limitesSetor.servico.ocupadas = gameState.empresas.filter(e => e.setor === 'servico').length;
  }
}

function exportStateToSQL() {
  let sql = `-- Desafio Empreendedor: Snapshot gerado em ${new Date().toISOString()}\n`;
  sql += `UPDATE estado_jogo SET turno_atual = ${gameState.turno};\n\n`;

  gameState.empresas.forEach(e => {
    sql += `INSERT INTO empresas (id, nome, setor, categoria, caixa, reputacao, qualidade, preco_venda, marketing, capacidade_producao, estoque_produto, estoque_insumos, meta_producao)\n`;
    sql += `VALUES ('${e.id}', '${e.nome.replace(/'/g, "''")}', '${e.setor}', '${e.categoria}', ${e.caixa.toFixed(2)}, ${e.reputacao}, ${e.qualidade}, ${e.preco.toFixed(2)}, ${e.marketing.toFixed(2)}, ${e.capacidade}, ${e.estoqueProduto}, ${e.estoqueInsumos || 0}, ${e.metaProducao || 0})\n`;
    sql += `ON CONFLICT (id) DO UPDATE SET caixa = EXCLUDED.caixa, estoque_produto = EXCLUDED.estoque_produto, reputacao = EXCLUDED.reputacao;\n`;
  });

  return sql;
}

loadFromSQL();

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // 1. Rota raiz / serve o jogo HTML
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(HTML_FILE).pipe(res);
    return;
  }

  // 2. Download do schema SQL
  if (url.pathname === '/api/sql/init') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    fs.createReadStream(SQL_FILE).pipe(res);
    return;
  }

  // 3. Exportar estado atual para dump SQL
  if (url.pathname === '/api/sql/export') {
    const dump = exportStateToSQL();
    res.writeHead(200, {
      'Content-Type': 'application/sql',
      'Content-Disposition': 'attachment; filename="desafio_dump.sql"',
    });
    res.end(dump);
    return;
  }

  // 4. API de Estado
  if (url.pathname === '/api/state' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(gameState));
    return;
  }

  // 5. Salvar estado do frontend
  if (url.pathname === '/api/state' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (data.empresas) gameState.empresas = data.empresas;
        if (data.turno !== undefined) gameState.turno = data.turno;
        if (data.ordensB2B) gameState.ordensB2B = data.ordensB2B;
        if (data.transacoesB2B) gameState.transacoesB2B = data.transacoesB2B;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, turno: gameState.turno }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'JSON inválido' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🏭 Desafio Empreendedor - Servidor Local Executando!`);
    console.log(`👉 Acesse no navegador: http://localhost:${PORT}`);
    console.log(`📄 Arquivo SQL carregado: ${SQL_FILE}`);
    console.log(`💾 Endpoint dump SQL: http://localhost:${PORT}/api/sql/export`);
    console.log(`======================================================\n`);
  });
}

export default server;
