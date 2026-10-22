import React from 'react';

interface AuthProps {
  onLoginSuccess: (token: string, user: any, character: any) => void;
}

export const AuthScreen: React.FC<AuthProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = React.useState(true);
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [characterName, setCharacterName] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin
      ? { username, password }
      : { username, password, characterName };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha na autenticação');
      }

      localStorage.setItem('token', data.token);
      onLoginSuccess(data.token, data.user, data.character);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 text-slate-100">
      <div className="bg-slate-900 border border-purple-900/50 rounded-xl p-8 max-w-md w-full shadow-2xl shadow-purple-950/50">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-purple-400 via-pink-500 to-amber-400 bg-clip-text text-transparent">
            Grimório dos Portais
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Aventure-se em portais misteriosos e crie feitiços únicos
          </p>
        </div>

        {error && (
          <div className="bg-red-950/80 border border-red-500/50 text-red-200 text-sm p-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Usuário
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
              placeholder="Seu nome de usuário"
            />
          </div>

          {!isLogin && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Nome do Personagem
              </label>
              <input
                type="text"
                required
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
                placeholder="Ex: Merlin, Valéria..."
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Senha
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:border-purple-500"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold py-3 rounded-lg transition duration-200 shadow-lg shadow-purple-900/30 disabled:opacity-50"
          >
            {loading ? 'Carregando...' : isLogin ? 'Entrar no Mundo' : 'Criar Conta'}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-purple-400 hover:text-purple-300 text-sm font-medium transition"
          >
            {isLogin ? 'Não tem conta? Registre-se' : 'Já possui conta? Faça Login'}
          </button>
        </div>
      </div>
    </div>
  );
};
