import React from 'react';

interface HubProps {
  character: any;
  portals: any[];
  onSelectPortal: (portalId: string) => void;
  onNavigateCraft: () => void;
  onLogout: () => void;
}

export const HubScreen: React.FC<HubProps> = ({
  character,
  portals,
  onSelectPortal,
  onNavigateCraft,
  onLogout,
}) => {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Top Header / Player Profile Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-amber-500 flex items-center justify-center font-bold text-2xl shadow-lg">
            {character?.name?.[0] || 'A'}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-100">{character?.name || 'Aventureiro'}</h2>
            <div className="flex items-center space-x-3 text-sm text-slate-400 mt-1">
              <span>Nível {character?.level || 1}</span>
              <span>•</span>
              <span className="text-emerald-400">XP: {character?.exp || 0}</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="flex items-center space-x-6 bg-slate-950 px-6 py-3 rounded-lg border border-slate-800">
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider block">Vida (HP)</span>
            <span className="text-lg font-bold text-red-400">
              {character?.hp ?? 100} / {character?.maxHp ?? 100}
            </span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider block">Energia</span>
            <span className="text-lg font-bold text-sky-400">
              {character?.energy ?? 100} / {character?.maxEnergy ?? 100}
            </span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider block">Cristais (Premium)</span>
            <span className="text-lg font-bold text-amber-400">
              💎 {character?.crystals ?? 0}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onNavigateCraft}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-4 py-2 rounded-lg transition shadow-md shadow-purple-900/30"
          >
            ✨ Criar Feitiço
          </button>
          <button
            onClick={onLogout}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg transition"
          >
            Sair
          </button>
        </div>
      </div>

      {/* Main Hub Section: Portals List */}
      <div>
        <h3 className="text-xl font-bold text-slate-200 mb-4 flex items-center space-x-2">
          <span>🌀 Portais de Exploração Disponíveis</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portals.map((portal) => (
            <div
              key={portal.id}
              className="bg-slate-900 border border-slate-800 hover:border-purple-500/50 rounded-xl p-6 transition duration-200 shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-extrabold uppercase px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Rank {portal.rank}
                  </span>
                  <span className="text-xs text-slate-400">Grid {portal.gridWidth}x{portal.gridHeight}</span>
                </div>
                <h4 className="text-xl font-bold text-purple-300">{portal.name}</h4>
                <p className="text-slate-400 text-sm mt-2">
                  Explore os corredores sombrios desta masmorra, derrote monstros e enfrente o chefe no final!
                </p>
              </div>

              <button
                onClick={() => onSelectPortal(portal.id)}
                className="mt-6 w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-2.5 rounded-lg transition shadow-md shadow-purple-900/30"
              >
                Entrar no Portal (-1 Energia / Mover)
              </button>
            </div>
          ))}

          {portals.length === 0 && (
            <div className="col-span-full bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
              Nenhum portal disponível no momento.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
