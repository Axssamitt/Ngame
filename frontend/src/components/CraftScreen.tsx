import React, { useState, useEffect } from 'react';

interface CraftScreenProps {
  token: string;
  onBackToHub: () => void;
}

export const CraftScreen: React.FC<CraftScreenProps> = ({ token, onBackToHub }) => {
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [spellName, setSpellName] = useState('');
  const [selectedScrollId, setSelectedScrollId] = useState('');
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [crafting, setCrafting] = useState(false);

  const fetchInventory = async () => {
    try {
      const res = await fetch('/api/craft/inventory', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) {
        setInventoryItems(json.inventory || []);
      }
    } catch (err) {
      setError('Erro ao carregar inventário');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [token]);

  const scrolls = inventoryItems.filter((i) => i.type === 'SCROLL' && i.quantity > 0);
  const components = inventoryItems.filter((i) => i.type === 'COMPONENT' && i.quantity > 0);

  const toggleComponent = (itemId: string) => {
    setSelectedComponentIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  // Preview total spell damage calculation
  const selectedScroll = scrolls.find((s) => s.itemId === selectedScrollId);
  const componentBonuses = selectedComponentIds.reduce((sum, id) => {
    const comp = components.find((c) => c.itemId === id);
    return sum + (comp ? comp.bonusDamage : 0);
  }, 0);

  const previewBaseDamage = selectedScrollId ? 15 + (selectedScroll?.bonusDamage || 0) + componentBonuses : 0;

  const handleCraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!spellName || !selectedScrollId) {
      setError('Informe o nome da magia e selecione um pergaminho básico.');
      return;
    }

    setCrafting(true);

    try {
      const res = await fetch('/api/craft/spell', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          spellName,
          scrollItemId: selectedScrollId,
          componentItemIds: selectedComponentIds,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setMessage(`✨ Feitiço Matriz "${json.spellMatrix.name}" criado com sucesso! (Dano Base: ${json.spellMatrix.baseDamage})`);
        setSpellName('');
        setSelectedScrollId('');
        setSelectedComponentIds([]);
        fetchInventory();
      } else {
        setError(json.error || 'Erro ao criar feitiço');
      }
    } catch (err: any) {
      setError('Erro de comunicação durante a fusão');
    } finally {
      setCrafting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-purple-400 font-bold text-lg animate-pulse">
          Carregando materiais do inventário...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-purple-300">
            ✨ Altar de Fusão de Feitiços
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Funda um Pergaminho Básico com componentes mágicos para criar uma Magia Matriz Soulbound.
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
        <div className="bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 p-4 rounded-xl text-sm font-semibold">
          {message}
        </div>
      )}

      {error && (
        <div className="bg-red-950/80 border border-red-500/50 text-red-200 p-4 rounded-xl text-sm font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleCraft} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-xl">
        {/* Spell Name Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Nome da Sua Nova Magia
          </label>
          <input
            type="text"
            required
            value={spellName}
            onChange={(e) => setSpellName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-slate-100 focus:outline-none focus:border-purple-500 font-medium"
            placeholder="Ex: Bola de Fogo Ancestral, Lança Incandescente..."
          />
        </div>

        {/* Scroll Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            1. Selecione um Pergaminho Básico (Obrigatório)
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {scrolls.map((scroll) => (
              <div
                key={scroll.itemId}
                onClick={() => setSelectedScrollId(scroll.itemId)}
                className={`p-4 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                  selectedScrollId === scroll.itemId
                    ? 'bg-purple-900/40 border-purple-500 ring-2 ring-purple-500'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <h4 className="font-bold text-purple-200">{scroll.name}</h4>
                  <p className="text-xs text-slate-400">Quantidade: {scroll.quantity}</p>
                </div>
                <span className="text-xs font-bold px-2 py-1 bg-purple-950 text-purple-300 rounded border border-purple-800">
                  Base 15 Dano
                </span>
              </div>
            ))}

            {scrolls.length === 0 && (
              <div className="col-span-full bg-slate-950 p-4 rounded-lg border border-slate-800 text-slate-500 text-sm text-center">
                Você não possui nenhum Pergaminho Básico no inventário.
              </div>
            )}
          </div>
        </div>

        {/* Component Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            2. Selecione Componentes Modificadores (Opcional)
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {components.map((comp) => {
              const isSelected = selectedComponentIds.includes(comp.itemId);
              return (
                <div
                  key={comp.itemId}
                  onClick={() => toggleComponent(comp.itemId)}
                  className={`p-4 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <h4 className="font-bold text-amber-200">{comp.name}</h4>
                    <p className="text-xs text-slate-400">Disponível: {comp.quantity}</p>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 bg-amber-950 text-amber-300 rounded border border-amber-800">
                    +{comp.bonusDamage} Dano
                  </span>
                </div>
              );
            })}

            {components.length === 0 && (
              <div className="col-span-full bg-slate-950 p-4 rounded-lg border border-slate-800 text-slate-500 text-sm text-center">
                Nenhum componente elemental encontrado no inventário.
              </div>
            )}
          </div>
        </div>

        {/* Spell Result Preview Box */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wider block">Prévia do Feitiço Matriz</span>
            <h3 className="text-xl font-bold text-slate-200 mt-1">
              {spellName || 'Nome da Magia'}
            </h3>
            <span className="text-xs text-purple-400 italic">Vincular a Alma (Soulbound ao Criador)</span>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-500 uppercase tracking-wider block">Dano Base Calculado</span>
            <span className="text-2xl font-extrabold text-amber-400">
              🔥 {previewBaseDamage}
            </span>
          </div>
        </div>

        {/* Submit Craft Button */}
        <button
          type="submit"
          disabled={crafting || !selectedScrollId || !spellName}
          className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-extrabold py-3.5 rounded-xl transition duration-200 shadow-xl shadow-purple-950/50 disabled:opacity-50"
        >
          {crafting ? 'Realizando Fusão Mágica...' : '⚡ Forjar Feitiço Matriz'}
        </button>
      </form>
    </div>
  );
};
