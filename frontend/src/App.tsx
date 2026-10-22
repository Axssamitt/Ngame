import React from 'react';
import { AuthScreen } from './components/AuthScreen';
import { HubScreen } from './components/HubScreen';
import { PortalScreen } from './components/PortalScreen';
import { CraftScreen } from './components/CraftScreen';

export default function App() {
  const [token, setToken] = React.useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = React.useState<any>(null);
  const [character, setCharacter] = React.useState<any>(null);
  const [portals, setPortals] = React.useState<any[]>([]);
  const [currentView, setCurrentView] = React.useState<'HUB' | 'PORTAL' | 'CRAFT'>('HUB');
  const [activePortalId, setActivePortalId] = React.useState<string | null>(null);

  const fetchHubData = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/portals');
      const json = await res.json();
      if (res.ok) {
        setPortals(json.portals || []);
      }
    } catch (err) {
      console.error('Error fetching portals:', err);
    }
  };

  React.useEffect(() => {
    if (token) {
      fetchHubData();
    }
  }, [token]);

  const handleLoginSuccess = (newToken: string, newUser: any, newCharacter: any) => {
    setToken(newToken);
    setUser(newUser);
    setCharacter(newCharacter);
    setCurrentView('HUB');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setCharacter(null);
    setCurrentView('HUB');
  };

  const handleSelectPortal = (portalId: string) => {
    setActivePortalId(portalId);
    setCurrentView('PORTAL');
  };

  if (!token) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {currentView === 'HUB' && (
        <HubScreen
          character={character}
          portals={portals}
          onSelectPortal={handleSelectPortal}
          onNavigateCraft={() => setCurrentView('CRAFT')}
          onLogout={handleLogout}
        />
      )}

      {currentView === 'PORTAL' && activePortalId && (
        <PortalScreen
          portalId={activePortalId}
          token={token}
          onBackToHub={() => {
            setCurrentView('HUB');
            fetchHubData();
          }}
        />
      )}

      {currentView === 'CRAFT' && (
        <CraftScreen
          token={token}
          onBackToHub={() => {
            setCurrentView('HUB');
            fetchHubData();
          }}
        />
      )}
    </div>
  );
}
