import React, { useState } from 'react';
import TikiTakaGame from './components/TikiTakaGame';
import MainMenu from './components/MainMenu';

function App() {
  const [currentMode, setCurrentMode] = useState('menu');

  if (currentMode === 'menu') {
    return <MainMenu onSelectMode={(mode) => setCurrentMode(mode)} />;
  }

  if (currentMode === 'grid') {
    return (
      <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
        {/* Added a back button to return to the menu */}
        <button 
          onClick={() => setCurrentMode('menu')}
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            zIndex: 100,
            background: 'rgba(30, 41, 59, 0.8)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            fontWeight: 'bold'
          }}
        >
          ← Back to Menu
        </button>
        <TikiTakaGame />
      </div>
    );
  }

  return null;
}

export default App;
