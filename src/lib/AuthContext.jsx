import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  useEffect(() => {
    // Sistema offline: usuário local fixo, sem autenticação cloud
    const localUser = {
      name: "Administrador",
      email: "admin@farmacia.local",
      role: "admin",
    };
    setUser(localUser);
    setIsAuthenticated(true);
    setIsLoadingAuth(false);
  }, []);

  const logout = () => {
    // Em app offline, logout é no-op
    console.log("Logout não disponível em modo offline");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      user: { name: "Administrador", email: "admin@farmacia.local", role: "admin" },
      isAuthenticated: true,
      isLoadingAuth: false,
      logout: () => { },
    };
  }
  return context;
}
