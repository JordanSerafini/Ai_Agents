import React, { useState } from 'react';
import Messagerie from './components/chat/Messagerie';


const App: React.FC = () => {

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center">
      {/* Barre de titre draggable */}
      <div className="titlebar absolute top-0 left-0 right-0"></div>
      <Messagerie />
    </div>
  );
};

export default App; 