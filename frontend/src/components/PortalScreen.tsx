import React, { useState, useEffect } from 'react';

interface PortalScreenProps {
  portalId: string;
  token: string;
  onBackToHub: () => void;
}

export const PortalScreen: React.FC<PortalScreenProps> = ({ portalId, token, onBackToHub }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [combatLogs, setCombatLogs] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPortalState = async () => {
    try {
      const res = await fetch(`/api/portal/${portalId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        setMessage(json.error || 'Erro ao carregar estado do portal');
      }
    } catch (err: any) {
      setMessage('Erro de conexão ao carregar portal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalState();
  }, [portalId, token]);

  const handleMove = async (direction: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST') => {
    setActionLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ direction }),
      });
      const json = await res.json();
      if (res.ok) {
        setMessage(json.message);
        if (json.session) {
          setData((prev: any) => ({
            ...prev,
            character: {
              ...prev.character,
              energy: json.energyRemaining,
            },
            session: json.session,
            currentMonster: json.encounter,
          }));
        }
      } else {
        setMessage(json.error || 'Não foi possível mover');
      }
    } catch (err: any) {
      setMessage('Erro ao tentar mover');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCombatAction = async (actionType: 'ATTACK' | 'SPELL', spellMatrixId?: string) => {
    setActionLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/combat/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ actionType, spellMatrixId }),
      });
      const json = await res.json();
      if (res.ok) {
        if (json.combatLog) {
          setCombatLogs((prev) => [...prev, ...json.combatLog]);
        }
        setData((prev: any) => ({
          ...prev,
          character: {
            ...prev.character,
            hp: json.playerHp,
            crystals: json.rewards ? prev.character.crystals + json.rewards.crystals : prev.character.crystals,
          },
          session: json.session,
          currentMonster: json.session.status === 'IN_COMBAT'
            ? { ...prev.currentMonster, currentHp: json.monsterHp }
            : null,
        }));
      } else {
        setMessage(json.error || 'Erro na ação de combate');
      }
    } catch (err: any) {
      setMessage('Erro durante o turno de combate');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-purple-400 font-bold text-lg animate-pulse">
          Carregando portal e enviando sinal para o servidor...
        </div>
      </div>
    );
  }

  const { portal, session, character, currentMonster, spells = [] } = data || {};
  const grid = (portal?.gridData || []) as number[][];
  const inCombat = session?.status === 'IN_COMBAT';

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-purple-300 flex items-center space-x-2">
            <span>🌀 {portal?.name || 'Portal'}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-purple-900/50 text-purple-300 border border-purple-700">
              Rank {portal?.rank}
            </span>
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Posição Atual: X: {session?.posX}, Y: {session?.posY} | Status: <span className="text-amber-400 font-semibold">{session?.status}</span>
          </p>
        </div>

        <button
          onClick={onBackToHub}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg transition"
        >
          ⬅ Voltar ao Hub
        </button>
      </div>

      {message && (
        <div className="bg-purple-950/60 border border-purple-600/50 text-purple-200 px-4 py-3 rounded-lg text-sm font-medium">
          {message}
        </div>
      )}

      {/* Main Grid + Combat Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Top: 10x10 Grid Representation */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col items-center">
          <h3 className="text-lg font-bold text-slate-200 mb-4 self-start">
            🗺 Mapas do Grid (10x10)
          </h3>

          <div className="grid grid-cols-10 gap-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
            {grid.map((row, y) =>
              row.map((cell, x) => {
                const isPlayer = session?.posX === x && session?.posY === y;
                const isBoss = portal?.bossX === x && portal?.bossY === y;
                const isWall = cell === 1;

                let cellBg = 'bg-slate-900 border-slate-800 text-slate-600';
                if (isWall) cellBg = 'bg-slate-800/80 border-slate-700 text-slate-500';
                if (isBoss) cellBg = 'bg-red-950/60 border-red-800 text-red-400';
                if (isPlayer) cellBg = 'bg-purple-600 border-purple-400 text-white font-bold ring-2 ring-purple-400 shadow-lg';

                return (
                  <div
                    key={`${x}-${y}`}
                    className={`w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center text-xs font-semibold rounded border transition ${cellBg}`}
                    title={`(${x}, ${y}) - ${isWall ? 'Parede' : isBoss ? 'Sala do Boss' : 'Caminho'}`}
                  >
                    {isPlayer ? '🧙‍♂️' : isBoss ? '💀' : isWall ? '⬛' : '▫'}
                  </div>
                );
              })
            )}
          </div>

          {/* Directional Controls */}
          {!inCombat && session?.status === 'EXPLORING' && (
            <div className="mt-6 flex flex-col items-center space-y-2">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">
                Controles de Movimento (-1 Energia)
              </span>
              <button
                disabled={actionLoading}
                onClick={() => handleMove('NORTH')}
                className="bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white font-bold w-12 h-12 rounded-lg shadow-md transition disabled:opacity-50 flex items-center justify-center text-lg"
              >
                ▲
              </button>
              <div className="flex space-x-2">
                <button
                  disabled={actionLoading}
                  onClick={() => handleMove('WEST')}
                  className="bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white font-bold w-12 h-12 rounded-lg shadow-md transition disabled:opacity-50 flex items-center justify-center text-lg"
                >
                  ◀
                </button>
                <button
                  disabled={actionLoading}
                  onClick={() => handleMove('SOUTH')}
                  className="bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white font-bold w-12 h-12 rounded-lg shadow-md transition disabled:opacity-50 flex items-center justify-center text-lg"
                >
                  ▼
                </button>
                <button
                  disabled={actionLoading}
                  onClick={() => handleMove('EAST')}
                  className="bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white font-bold w-12 h-12 rounded-lg shadow-md transition disabled:opacity-50 flex items-center justify-center text-lg"
                >
                  ▶
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Combat / Session Status */}
        <div className="lg:col-span-5 space-y-6">
          {/* Combat Box */}
          {inCombat && currentMonster ? (
            <div className="bg-slate-900 border-2 border-red-600/60 rounded-xl p-6 shadow-2xl shadow-red-950/40">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-red-400 flex items-center space-x-2">
                  <span>⚔️ Em Combate: {currentMonster.name}</span>
                </h3>
                {currentMonster.isBoss && (
                  <span className="text-xs px-2 py-1 bg-red-900/80 text-red-200 rounded uppercase font-extrabold border border-red-500">
                    BOSS
                  </span>
                )}
              </div>

              {/* Monster HP Bar */}
              <div className="space-y-1 mb-6">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>HP do Monstro</span>
                  <span>{currentMonster.currentHp} / {currentMonster.hp}</span>
                </div>
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-red-500 h-full transition-all duration-300"
                    style={{
                      width: `${Math.max(0, Math.min(100, (currentMonster.currentHp / currentMonster.hp) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Player HP Bar */}
              <div className="space-y-1 mb-6">
                <div className="flex justify-between text-xs font-semibold text-slate-300">
                  <span>Seu HP</span>
                  <span>{character?.hp} / {character?.maxHp}</span>
                </div>
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="bg-emerald-500 h-full transition-all duration-300"
                    style={{
                      width: `${Math.max(0, Math.min(100, ((character?.hp || 0) / (character?.maxHp || 100)) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {/* Combat Actions */}
              <div className="space-y-3">
                <button
                  disabled={actionLoading}
                  onClick={() => handleCombatAction('ATTACK')}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg transition shadow-lg shadow-red-950/50 disabled:opacity-50"
                >
                  🗡️ Ataque Físico
                </button>

                {spells.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Usar Feitiço Matriz:
                    </span>
                    <div className="grid grid-cols-1 gap-2">
                      {spells.map((spell: any) => (
                        <button
                          key={spell.id}
                          disabled={actionLoading}
                          onClick={() => handleCombatAction('SPELL', spell.id)}
                          className="bg-purple-900/60 hover:bg-purple-800/80 border border-purple-600/50 text-purple-200 text-sm font-semibold p-2.5 rounded-lg text-left transition flex items-center justify-between disabled:opacity-50"
                        >
                          <span>🔥 {spell.name}</span>
                          <span className="text-amber-300 font-bold">Dano Base: {spell.baseDamage}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="text-lg font-bold text-slate-200 mb-2">
                🌲 Nenhum inimigo no momento
              </h3>
              <p className="text-slate-400 text-sm">
                Use os botões de direção no grid para explorar os corredores do portal. Você pode encontrar monstros aleatórios ou alcançar a sala do Chefe no destino final!
              </p>
            </div>
          )}

          {/* Combat History Log */}
          {combatLogs.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Histórico de Combate
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs text-slate-300 font-mono bg-slate-950 p-3 rounded-lg border border-slate-800">
                {combatLogs.map((log, index) => (
                  <div key={index} className="border-b border-slate-900 pb-1">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
