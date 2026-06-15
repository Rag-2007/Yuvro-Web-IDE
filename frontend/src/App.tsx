import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/Login';
import Dashboard from './pages/Dashboard';
import IDE from './pages/IDE';

function AppInner() {
  const { user } = useAuth();
  const [currentProject, setCurrentProject] = useState<string | null>(null);

  if (!user) return <LoginPage />;
  if (currentProject) return <IDE projectName={currentProject} onBack={() => setCurrentProject(null)} />;
  return <Dashboard onSelectProject={setCurrentProject} />;
}

function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

export default App;
