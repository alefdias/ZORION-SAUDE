/**
 * AppInitializer.jsx
 * Componente de inicialização inteligente.
 * Exibe tela de loading enquanto o sistema decide entre:
 *   - Usar dados locais SQLite (abre instantaneamente)
 *   - Baixar dados iniciais do Nuvem (primeira execução)
 */

import { useEffect, useState, createContext, useContext } from "react";
import { initializeApp, initSyncManager } from "@/api/syncManager";
import logo from "../assets/logo-tr.png";
import { WelcomeScreen } from "./WelcomeScreen";

// ─── Contexto global para controle da WelcomeScreen ───────────────────────────
export const WelcomeContext = createContext({ showWelcome: () => {} });
export const useWelcome = () => useContext(WelcomeContext);

// ─── Tela de loading ──────────────────────────────────────────────────────────

function LoadingScreen({ message, progress, mode }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f2027 100%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      color: "#e2e8f0",
    }}>
      <div style={{
        width: 100, height: 100,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: 28,
      }}>
        <img src={logo} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain", transform: "scale(1.5)" }} />
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px", letterSpacing: 0.5, textTransform: "uppercase" }}>
        ZORION SAÚDE
      </h1>

      <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 32 }}>
        {mode === "Nuvem"
          ? "Baixando dados do servidor pela primeira vez…"
          : "Carregando dados locais…"}
      </p>

      {/* Barra de progresso */}
      <div style={{
        width: 280, height: 6, borderRadius: 3,
        background: "rgba(255,255,255,0.1)", overflow: "hidden",
      }}>
        <div style={{
          height: "100%", borderRadius: 3,
          background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
          width: `${progress}%`,
          transition: "width 0.3s ease",
        }} />
      </div>

      <p style={{ fontSize: 12, color: "#64748b", marginTop: 16, maxWidth: 300, textAlign: "center" }}>
        {message}
      </p>

      {/* Animação de spinner para carga leve */}
      {progress < 100 && (
        <div style={{
          marginTop: 24, width: 24, height: 24,
          border: "2px solid rgba(255,255,255,0.1)",
          borderTop: "2px solid #3b82f6",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function AppInitializer({ children }) {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [message, setMessage] = useState("Verificando banco de dados local…");
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        setMessage("Verificando banco de dados local…");
        setProgress(5);

        const result = await initializeApp();

        if (cancelled) return;

        if (result.mode === "local") {
          setMessage("Dados locais encontrados. Abrindo sistema…");
          setProgress(100);
          setMode("local");
          // Exibe WelcomeScreen antes de abrir
          setTimeout(() => {
            setLoading(false);
            setShowWelcome(true);
          }, 400);
        } else if (result.mode === "Nuvem") {
          // initializeApp já fez a carga completa com progress interno
          setMessage("Carga inicial concluída. Abrindo sistema…");
          setProgress(100);
          setMode("Nuvem");
          setTimeout(() => {
            setLoading(false);
            setShowWelcome(true);
          }, 600);
        } else {
          // Erro ou modo desconhecido — abre mesmo assim
          setMessage("Iniciando sem dados remotos…");
          setProgress(100);
          setTimeout(() => {
            setLoading(false);
            setShowWelcome(true);
          }, 500);
        }

        // Inicia listeners de rede
        initSyncManager();
      } catch (e) {
        console.error("[AppInitializer] Erro:", e);
        // Mesmo com erro, permite abrir o app
        setMessage("Abrindo sistema em modo local…");
        setProgress(100);
        setTimeout(() => {
          setLoading(false);
          setShowWelcome(true);
        }, 500);
      }
    }

    start();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <LoadingScreen message={message} progress={progress} mode={mode} />;
  }

  if (showWelcome) {
    return (
      <WelcomeScreen
        onEnter={(modKey) => {
          setShowWelcome(false);
          setReady(true);
          
          // Mapeamento de modulos para rotas
          const routeMap = {
            carrinho_enfermagem: "#/CarrinhoParada",
            carrinho_farmacia: "#/CarrinhoParada",
            carrinho_parada: "#/CarrinhoParada",
            estoque_farmacia: "#/Dashboard",
            pacientes_medicao: "#/PacientesMedicao",
            farmacia_satelite: "#/Satelite",
            responsavel_tecnico: "#/ResponsavelTecnico"
          };

          const sectionMap = {
            carrinho_enfermagem: "carrinho",
            carrinho_farmacia: "carrinho",
            carrinho_parada: "carrinho",
            estoque_farmacia: "estoque",
            pacientes_medicao: "satelite",
            farmacia_satelite: "satelite",
            responsavel_tecnico: "rt"
          };
          if (sectionMap[modKey]) {
            try { sessionStorage.setItem("zorion_active_section", sectionMap[modKey]); } catch (e) {}
          }
          
          if (routeMap[modKey]) {
            window.location.hash = routeMap[modKey];
          }
        }}
      />
    );
  }

  return (
    <WelcomeContext.Provider value={{ showWelcome: () => setShowWelcome(true) }}>
      {children}
    </WelcomeContext.Provider>
  );
}
