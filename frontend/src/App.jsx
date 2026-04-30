import React, { useState } from 'react';
import TikiTakaGame from './components/TikiTakaGame';
import MainMenu from './components/MainMenu';
import { Home } from 'lucide-react';

function App() {
  const [currentMode, setCurrentMode] = useState('menu');

  if (currentMode === 'menu') {
    return <MainMenu onSelectMode={(mode) => setCurrentMode(mode)} />;
  }

  if (currentMode === 'grid') {
    return (
      <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
        {/* Compact Back Button */}
        <button 
          onClick={() => setCurrentMode('menu')}
          title="Back to Menu"
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            zIndex: 100,
            background: 'rgba(30, 41, 59, 0.8)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
          }}
        >
          <Home size={20} />
        </button>
        <TikiTakaGame />
      </div>
    );
  }

  return null;
}

export default App;
