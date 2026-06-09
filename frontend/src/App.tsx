import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import IDE from './pages/IDE';

function App() {
  const [currentProject, setCurrentProject] = useState<string | null>(null);

  if (currentProject) {
    return <IDE projectName={currentProject} onBack={() => setCurrentProject(null)} />;
  }

  return <Dashboard onSelectProject={setCurrentProject} />;
}

export default App;
