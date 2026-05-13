import { useEffect } from 'react';
import { AppShell } from './components/AppShell';
import { useResearchStore } from './store/researchStore';

const themeClasses: Record<string, string> = {
  'simple-pro': 'theme-simple-pro',
  'soft-market': 'theme-soft-market',
  'dark-trader': 'theme-dark-trader',
  'natural-board': 'theme-natural-board',
};

function App() {
  const { theme } = useResearchStore();

  useEffect(() => {
    const body = document.body;
    Object.values(themeClasses).forEach((cls) => body.classList.remove(cls));
    body.classList.add(themeClasses[theme] ?? 'theme-simple-pro');
  }, [theme]);

  return (
    <main className="app-main mx-auto max-w-7xl text-theme">
      <AppShell />
    </main>
  );
}

export default App;
