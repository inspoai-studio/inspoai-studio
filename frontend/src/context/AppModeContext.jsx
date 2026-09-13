import React, { createContext, useContext } from 'react';
import { useLocation } from 'react-router-dom';

const AppModeContext = createContext({ isLegacyMode: false });

export const AppModeProvider = ({ children }) => {
  const location = useLocation();
  const isLegacyMode = location.pathname.startsWith('/inspoai/v1/allfeature');

  return (
    <AppModeContext.Provider value={{ isLegacyMode }}>
      {children}
    </AppModeContext.Provider>
  );
};

export const useAppMode = () => useContext(AppModeContext);
