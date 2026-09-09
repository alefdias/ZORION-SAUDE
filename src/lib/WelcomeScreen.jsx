/**
 * WelcomeScreen.jsx
 * Tela inicial antes de entrar no sistema.
 * Exibe os 4 módulos do hospital em ordem alfabética.
 */

import { useState, useEffect } from "react";
import logo from "../assets/logo-tr.png";
import { Toaster, toast } from "sonner";
import { addLog } from "./logger";
import { ServerConnectionBadge } from "@/components/ServerConnectionBadge";
import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { db } from "@/api/db";

// ─── Ícones SVG ───────────────────────────────────────────────────────────────

const IconEstoqueFarmacia = ({ color }) => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <path
      d="M2 7l10-5 10 5v10l-10 5L2 17V7z"
      stroke={color} strokeWidth="1.5" strokeLinejoin="round"
      fill={color + "18"}
    />
    <path
      d="M12 2l10 5-10 5L2 7l10-5z"
      stroke={color} strokeWidth="1.5" strokeLinejoin="round"
      fill={color + "28"}
    />
    <line x1="12" y1="12" x2="12" y2="22" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="7" y1="9.5" x2="7" y2="19.5" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    <line x1="17" y1="9.5" x2="17" y2="19.5" stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
  </svg>
);

const IconFarmaciaSatelite = ({ color }) => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <path d="M9 3h6l1 4H8L9 3z" stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill={color + "22"} />
    <path d="M8 7v9a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3V7" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="8" y1="11" x2="16" y2="11" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
    <path d="M17 5 q2-1 2 2" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7" />
    <path d="M18.5 3.5 q3-1 3 3.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.5" />
    <circle cx="17" cy="5" r="0.6" fill={color} />
  </svg>
);

const IconAdministrador = ({ color }) => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2L4 6v6c0 5.25 3.5 9.74 8 11 4.5-1.26 8-5.75 8-11V6L12 2z"
      stroke={color} strokeWidth="1.5" strokeLinejoin="round"
      fill={color + "18"}
    />
    <path
      d="M12 7l1.12 2.27L15.5 9.64l-1.75 1.7.41 2.41L12 12.6l-2.16 1.15.41-2.41-1.75-1.7 2.38-.37L12 7z"
      stroke={color} strokeWidth="1" strokeLinejoin="round"
      fill={color + "66"}
    />
  </svg>
);

const IconCarrinhoParada = ({ color }) => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="6" width="16" height="12" rx="2" stroke={color} strokeWidth="1.5" fill={color + "18"} />
    <rect x="10" y="8" width="4" height="8" rx="0.5" fill={color + "55"} />
    <rect x="8" y="10" width="8" height="4" rx="0.5" fill={color + "55"} />
    <circle cx="8" cy="20" r="1.5" stroke={color} strokeWidth="1.2" fill={color + "33"} />
    <circle cx="16" cy="20" r="1.5" stroke={color} strokeWidth="1.2" fill={color + "33"} />
    <path d="M6 6V4h12v2" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

const IconSyringe = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m18 2 4 4" />
    <path d="m17 7 3-3" />
    <path d="M19 9 8.7 19.3c-1 1-2.5 1-3.4 0l-.6-.6c-1-1-1-2.5 0-3.4L15 5" />
    <path d="m9 11 4 4" />
    <path d="m5 19-3 3" />
    <path d="m14 4 6 6" />
  </svg>
);

const IconPill = ({ color }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
    <path d="m8.5 8.5 7 7" />
  </svg>
);

const IconUsers = ({ color }) => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" fill={color + "18"} />
    <circle cx="9" cy="7" r="4" fill={color + "28"} />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

// ─── Módulos (Ordem Alfabética: Carrinho, Estoque, Farmácia Satélite, Responsável Técnico) ───

const MODULES = [
  {
    key: "carrinho_parada",
    label: "Carrinho de Parada",
    sub: "Checagem e Controle",
    color: "#f43f5e",
    glow: "rgba(244,63,94,0.3)",
    border: "rgba(244,63,94,0.4)",
    bg: "rgba(244,63,94,0.08)",
    Icon: IconCarrinhoParada,
  },
  {
    key: "estoque_farmacia",
    label: "Estoque",
    sub: "Gestão e Envio",
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.3)",
    border: "rgba(167,139,250,0.4)",
    bg: "rgba(167,139,250,0.08)",
    Icon: IconEstoqueFarmacia,
  },
  {
    key: "farmacia_satelite",
    label: "Farmácia Satélite",
    sub: "Dispensação",
    color: "#fb923c",
    glow: "rgba(251,146,60,0.3)",
    border: "rgba(251,146,60,0.4)",
    bg: "rgba(251,146,60,0.08)",
    Icon: IconFarmaciaSatelite,
  },
  {
    key: "responsavel_tecnico",
    label: "Responsável Técnico",
    sub: "Gestão de Usuários",
    color: "#34d399",
    glow: "rgba(52,211,153,0.3)",
    border: "rgba(52,211,153,0.4)",
    bg: "rgba(52,211,153,0.08)",
    Icon: IconAdministrador,
  }
];

// ─── Card de módulo ───────────────────────────────────────────────────────────

function ModuleCard({ mod, delay, visible, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? mod.bg.replace("0.08", "0.16") : mod.bg,
        border: `1.5px solid ${hovered ? mod.border.replace("0.4", "0.8") : mod.border}`,
        borderRadius: 20,
        padding: "28px 20px 22px",
        cursor: "pointer",
        outline: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        width: 160,
        position: "relative",
        overflow: "hidden",
        transition: "all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)",
        transform: visible
          ? hovered ? "translateY(-8px) scale(1.04)" : "translateY(0) scale(1)"
          : "translateY(30px) scale(0.9)",
        opacity: visible ? 1 : 0,
        transitionDelay: visible ? `${delay}ms` : "0ms",
        boxShadow: hovered
          ? `0 8px 40px ${mod.glow}, 0 0 0 1px ${mod.border.replace("0.4", "0.2")}`
          : "0 2px 12px rgba(0,0,0,0.3)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div style={{
        width: 76,
        height: 76,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: hovered
          ? `radial-gradient(circle, ${mod.glow} 0%, transparent 70%)`
          : "transparent",
        transition: "background 0.3s ease",
        filter: hovered ? `drop-shadow(0 0 10px ${mod.color})` : "none",
      }}>
        <mod.Icon color={mod.color} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          color: hovered ? mod.color : "#cbd5e1",
          letterSpacing: 0.4,
          transition: "color 0.25s ease",
          lineHeight: 1.3,
        }}>
          {mod.label}
        </div>
        <div style={{
          fontSize: 10,
          color: hovered ? mod.color + "aa" : "#475569",
          marginTop: 4,
          transition: "color 0.25s ease",
          lineHeight: 1.4,
        }}>
          {mod.sub}
        </div>
      </div>
    </button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function WelcomeScreen({ onEnter }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  
  // Login State
  const [selectedModule, setSelectedModule] = useState(null);
  const [carrinhoSubMode, setCarrinhoSubMode] = useState(null); // null | 'nursing' | 'pharmacy'
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);
  
  // Mouse hover effect state
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Theme state
  const [themeColor, setThemeColorState] = useState(() => {
    return localStorage.getItem("zorion_theme") || "theme-ocean";
  });

  const setThemeColor = (newTheme) => {
    document.documentElement.classList.remove(themeColor);
    document.documentElement.classList.add(newTheme);
    localStorage.setItem("zorion_theme", newTheme);
    setThemeColorState(newTheme);
  };

  useEffect(() => {
    document.documentElement.classList.add(themeColor);
  }, []);

  const handleMouseMove = (e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  // Make sure at least default admin exists and sync users from Postgres
  useEffect(() => {
    const syncUsers = async () => {
      try {
        const data = await db.entities.Usuario.list();
        if (data && data.length > 0) {
          const allModules = ["estoque_farmacia", "pacientes_medicao", "farmacia_satelite", "responsavel_tecnico", "carrinho_parada", "carrinho_enfermagem", "carrinho_farmacia"];
          const localUsers = data.map(u => ({
              id: u.id,
              nome: u.nome,
              username: u.login,
              password: u.senha,
              cargo: u.perfil,
              coren: u.coren,
              crf: u.crf,
              modules: (u.perfil === "administrador" || u.cargo === "administrador") ? allModules : 
                       (u.perfil === "farmaceutico" || u.cargo === "farmaceutico") ? ["estoque_farmacia", "farmacia_satelite", "carrinho_parada", "carrinho_farmacia"] : 
                       ["carrinho_parada", "carrinho_enfermagem"],
              first_login: u.primeiro_acesso !== false
          }));
          localStorage.setItem("axion_users", JSON.stringify(localUsers));
          setAvailableUsers(localUsers);
          return;
        }
      } catch (e) {
        console.warn("Falha ao sincronizar usuarios do postgres no WelcomeScreen", e);
      }
      
      const saved = localStorage.getItem("axion_users");
      let users = saved ? JSON.parse(saved) : [];
      
      const adminIndex = users.findIndex(u => u.username === "admin");
      const allModules = ["estoque_farmacia", "pacientes_medicao", "farmacia_satelite", "responsavel_tecnico", "carrinho_parada", "carrinho_enfermagem", "carrinho_farmacia"];
      
      if (adminIndex === -1) {
        users.push({
          id: "1",
          nome: "Administrador RT",
          username: "admin",
          password: "admin123",
          modules: allModules,
          first_login: false
        });
        localStorage.setItem("axion_users", JSON.stringify(users));
      } else {
        let changed = false;
        if (users[adminIndex].password !== "admin123") {
          users[adminIndex].password = "admin123";
          changed = true;
        }
        allModules.forEach(m => {
          if (!users[adminIndex].modules.includes(m)) {
            users[adminIndex].modules.push(m);
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem("axion_users", JSON.stringify(users));
        }
      }
      setAvailableUsers(users);
    };

    syncUsers();
  }, []);

  const handleModuleClick = (mod) => {
    setSelectedModule(mod);
    setCarrinhoSubMode(null);
    setUsername("");
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setIsFirstLogin(false);
    setLoggedInUser(null);
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    let users = availableUsers;
    
    try {
      const data = await db.entities.Usuario.list();
      if (data && data.length > 0) {
        const allModules = ["estoque_farmacia", "pacientes_medicao", "farmacia_satelite", "responsavel_tecnico", "carrinho_parada", "carrinho_enfermagem", "carrinho_farmacia"];
        users = data.map(u => ({
            id: u.id,
            nome: u.nome,
            username: u.login,
            password: u.senha,
            cargo: u.perfil,
            coren: u.coren,
            crf: u.crf,
            modules: (u.perfil === "administrador" || u.cargo === "administrador") ? allModules : 
                     (u.perfil === "farmaceutico" || u.cargo === "farmaceutico") ? ["estoque_farmacia", "farmacia_satelite", "carrinho_parada", "carrinho_farmacia"] : 
                     ["carrinho_parada", "carrinho_enfermagem"],
            first_login: u.primeiro_acesso !== false
        }));
        localStorage.setItem("axion_users", JSON.stringify(users));
        setAvailableUsers(users);
      }
    } catch (err) {
      console.warn("Erro no fetch de usuarios durante login", err);
    }

    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
      toast.error("Usuário ou senha incorretos.");
      return;
    }

    // Permission check for Carrinho de Parada or specific subMode
    let hasPermission = false;
    if (user.cargo === "administrador" || user.modules.includes("carrinho_parada")) {
      hasPermission = true;
    } else if (carrinhoSubMode === "nursing" && (user.cargo === "enfermeiro" || user.modules.includes("carrinho_enfermagem"))) {
      hasPermission = true;
    } else if (carrinhoSubMode === "pharmacy" && (user.cargo === "farmaceutico" || user.modules.includes("carrinho_farmacia"))) {
      hasPermission = true;
    } else if (!carrinhoSubMode && user.modules.includes(selectedModule.key)) {
      hasPermission = true;
    }

    if (!hasPermission) {
      toast.error(`Você não tem permissão para acessar este perfil.`);
      return;
    }

    if (user.first_login) {
      setIsFirstLogin(true);
      setLoggedInUser(user);
      return;
    }

    // Success login
    sessionStorage.setItem("axion_active_user", JSON.stringify(user));
    localStorage.setItem("pharma_user", JSON.stringify(user));
    if (carrinhoSubMode) {
      sessionStorage.setItem("axion_carrinho_mode", carrinhoSubMode);
    }
    
    const modeName = carrinhoSubMode === "nursing" ? "Enfermagem" : carrinhoSubMode === "pharmacy" ? "Farmácia" : "";
    addLog(user.nome, "Login", `Acessou o módulo: ${selectedModule.label} ${modeName ? `(${modeName})` : ""}`);
    
    setExiting(true);
    setTimeout(() => onEnter(selectedModule.key), 550);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (newPassword.length < 3) {
      toast.error("A senha deve ter pelo menos 3 caracteres.");
      return;
    }

    try {
      // Tentar atualizar no PostgreSQL
      await db.entities.Usuario.update(loggedInUser.id, { senha: newPassword, primeiro_acesso: false });
    } catch (e) {
      console.warn("Falha ao atualizar no Postgres, prosseguindo com localstorage", e);
    }

    const users = JSON.parse(localStorage.getItem("axion_users") || "[]");
    const updatedUser = { ...loggedInUser, password: newPassword, first_login: false };
    const updatedUsers = users.map(u => u.id === loggedInUser.id ? updatedUser : u);
    localStorage.setItem("axion_users", JSON.stringify(updatedUsers));
    
    sessionStorage.setItem("axion_active_user", JSON.stringify(updatedUser));
    localStorage.setItem("pharma_user", JSON.stringify(updatedUser));
    if (carrinhoSubMode) {
      sessionStorage.setItem("axion_carrinho_mode", carrinhoSubMode);
    }
    addLog(updatedUser.nome, "Login", `Acessou o módulo: ${selectedModule.label} (Senha alterada)`);

    toast.success("Senha alterada com sucesso! Entrando...");
    setExiting(true);
    setTimeout(() => onEnter(selectedModule.key), 550);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "linear-gradient(145deg, #07111f 0%, #0b1a2e 40%, #060e1c 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        overflow: "hidden",
        opacity: exiting ? 0 : visible ? 1 : 0,
        transition: "opacity 0.55s ease",
      }}
    >
      {/* Spotlight Effect */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: "none",
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, rgba(59, 130, 246, 0.07), transparent 40%)`,
          zIndex: 0,
          transition: "background 0.15s ease-out"
        }}
      />

      <Toaster position="top-right" richColors />
      

      {/* Marca / Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: 44,
          transform: visible ? "translateY(0)" : "translateY(-20px)",
          opacity: visible ? 1 : 0,
          transition: "all 0.5s ease",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
          }}
        >
          <h1 style={{
            fontSize: 52,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: "-0.05em",
            margin: "0 0 4px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <span style={{ color: "#3b82f6" }}>ZOR</span>
            <span style={{ color: "#ffffff" }}>ION</span>
          </h1>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#475569",
            letterSpacing: 2.5,
            textTransform: "uppercase",
          }}
        >
          Sistema de Gestão Hospitalar
        </span>
      </div>

      {/* Subtítulo */}
      <p
        style={{
          fontSize: 14,
          color: "#64748b",
          marginBottom: 36,
          fontWeight: 500,
          letterSpacing: 0.2,
          transform: visible ? "translateY(0)" : "translateY(10px)",
          opacity: visible ? 1 : 0,
          transition: "all 0.5s ease 0.1s",
        }}
      >
        Selecione o módulo para acessar
      </p>

      {/* Grid de módulos (4 módulos) */}
      <div
        style={{
          display: "flex",
          gap: 20,
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: 800,
          padding: "0 20px",
        }}
      >
        {MODULES.map((mod, index) => (
          <ModuleCard
            key={mod.key}
            mod={mod}
            delay={120 + index * 60}
            visible={visible}
            onClick={() => handleModuleClick(mod)}
          />
        ))}
      </div>

      {/* Footer minimalista */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          padding: "0 32px",
        }}
      >
        <div style={{ pointerEvents: "auto", display: "flex", gap: "8px" }} className="group relative">
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/40 border border-slate-700/50 hover:bg-slate-700/50 transition-colors text-slate-300">
            <Palette className="w-4 h-4" />
            <span className="text-xs font-medium">Tema: {themeColor.replace("theme-", "").replace("padrao", "oceano").toUpperCase()}</span>
          </button>
          
          <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#0f172a] border border-slate-700 rounded-xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-2xl">
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { id: "theme-ocean", name: "Oceano", colors: ["bg-blue-600", "bg-blue-900", "bg-slate-100", "bg-white"] },
                { id: "theme-emerald", name: "Esmeralda", colors: ["bg-emerald-600", "bg-[#064e3b]", "bg-[#f0fdf4]", "bg-white"] },
                { id: "theme-midnight", name: "Meia-noite", colors: ["bg-slate-500", "bg-slate-900", "bg-[#020617]", "bg-slate-800"] },
                { id: "theme-sunset", name: "Pôr do Sol", colors: ["bg-orange-500", "bg-[#431407]", "bg-orange-50", "bg-white"] },
                { id: "theme-amethyst", name: "Ametista", colors: ["bg-purple-500", "bg-[#3b0764]", "bg-purple-50", "bg-white"] },
                { id: "theme-rose", name: "Rosa Elegance", colors: ["bg-rose-500", "bg-[#881337]", "bg-rose-50", "bg-white"] },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setThemeColor(t.id)}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg transition-colors border text-left",
                    themeColor === t.id ? "bg-slate-800 border-slate-600" : "hover:bg-slate-800/60 border-transparent"
                  )}
                >
                  <div className="flex -space-x-1 shrink-0">
                    {t.colors.map((c, i) => <div key={i} className={cn("w-3.5 h-3.5 rounded-full ring-2 ring-[#0f172a]", c)} />)}
                  </div>
                  <span className={cn("text-[11px] font-medium transition-colors", themeColor === t.id ? "text-white" : "text-slate-400")}>{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-6 left-0 right-0 text-center text-[10px] text-slate-500 font-medium tracking-[0.2em]">
          ZORION SAÚDE © 2026 — V1.0
        </div>
        
        <div style={{ pointerEvents: "auto" }}>
          <ServerConnectionBadge />
        </div>
      </div>

      {/* MODAL DO MÓDULO */}
      {selectedModule && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(3, 7, 18, 0.75)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: "#0f172a",
              border: `1.5px solid ${selectedModule.border}`,
              borderRadius: 24,
              padding: 32,
              width: "100%",
              maxWidth: selectedModule.key === "carrinho_parada" && !carrinhoSubMode ? 460 : 400,
              boxShadow: `0 20px 50px ${selectedModule.glow}`,
              position: "relative",
              transition: "all 0.3s ease",
            }}
          >
            {/* Fechar Modal */}
            <button
              onClick={() => { setSelectedModule(null); setCarrinhoSubMode(null); }}
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                background: "transparent",
                border: "none",
                color: "#64748b",
                fontSize: 20,
                cursor: "pointer",
              }}
            >
              ✕
            </button>

            {/* Header do Modal */}
            <div style={{ display: "flex", items: "center", gap: 14, marginBottom: 24 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                background: selectedModule.bg,
                border: `1px solid ${selectedModule.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <selectedModule.Icon color={selectedModule.color} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>
                  {selectedModule.label}
                </h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {selectedModule.key === "carrinho_parada"
                    ? carrinhoSubMode === "nursing" 
                      ? "Login — Enfermagem" 
                      : carrinhoSubMode === "pharmacy" 
                        ? "Login — Farmácia" 
                        : "Selecione o perfil de acesso"
                    : "Identifique-se para acessar"}
                </span>
              </div>
            </div>

            {/* SE É CARRINHO DE PARADA E AINDA NÃO ESCOLHEU O PERFIL */}
            {selectedModule.key === "carrinho_parada" && !carrinhoSubMode ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 8px 0" }}>
                  Escolha o setor para realizar o login:
                </p>

                {/* Botão Enfermagem */}
                <button
                  onClick={() => setCarrinhoSubMode("nursing")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "16px 20px",
                    borderRadius: 16,
                    background: "rgba(59,130,246,0.1)",
                    border: "1.5px solid rgba(59,130,246,0.3)",
                    color: "#f8fafc",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(59,130,246,0.2)";
                    e.currentTarget.style.borderColor = "rgba(59,130,246,0.6)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(59,130,246,0.1)";
                    e.currentTarget.style.borderColor = "rgba(59,130,246,0.3)";
                  }}
                >
                  <div style={{ padding: 10, borderRadius: 12, background: "rgba(59,130,246,0.2)" }}>
                    <IconSyringe color="#3b82f6" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#60a5fa" }}>Enfermagem</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Checagem de enfermagem e registro de uso</div>
                  </div>
                </button>

                {/* Botão Farmácia */}
                <button
                  onClick={() => setCarrinhoSubMode("pharmacy")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "16px 20px",
                    borderRadius: 16,
                    background: "rgba(16,185,129,0.1)",
                    border: "1.5px solid rgba(16,185,129,0.3)",
                    color: "#f8fafc",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(16,185,129,0.2)";
                    e.currentTarget.style.borderColor = "rgba(16,185,129,0.6)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(16,185,129,0.1)";
                    e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)";
                  }}
                >
                  <div style={{ padding: 10, borderRadius: 12, background: "rgba(16,185,129,0.2)" }}>
                    <IconPill color="#10b981" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#34d399" }}>Farmácia</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Controle de estoque, reposição e conferência</div>
                  </div>
                </button>
              </div>
            ) : !isFirstLogin ? (
              /* FORMULÁRIO DE LOGIN NORMAL OU APÓS SELECIONAR SUBMODE */
              <form onSubmit={handleLoginSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {selectedModule.key === "carrinho_parada" && (
                  <button
                    type="button"
                    onClick={() => setCarrinhoSubMode(null)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#38bdf8",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      textAlign: "left",
                      padding: 0,
                      marginBottom: -4
                    }}
                  >
                    ← Alterar perfil ({carrinhoSubMode === "nursing" ? "Enfermagem" : "Farmácia"})
                  </button>
                )}

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
                    Usuário
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Seu usuário"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: "#1e293b",
                      border: "1px solid #334155",
                      color: "#fff",
                      fontSize: 14,
                      outline: "none"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
                    Senha
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: "#1e293b",
                      border: "1px solid #334155",
                      color: "#fff",
                      fontSize: 14,
                      outline: "none"
                    }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    marginTop: 8,
                    padding: "12px",
                    borderRadius: 12,
                    background: selectedModule.color,
                    color: "#fff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                    boxShadow: `0 4px 14px ${selectedModule.glow}`
                  }}
                >
                  Entrar no Módulo
                </button>
              </form>
            ) : (
              /* Formulário de Troca de Senha Obrigatória */
              <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "rgba(234, 179, 8, 0.1)", border: "1px solid rgba(234, 179, 8, 0.3)", padding: 12, borderRadius: 12, color: "#eab308", fontSize: 12 }}>
                  Primeiro acesso detectado. Você precisa definir uma nova senha para continuar.
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Nova senha"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: "#1e293b",
                      border: "1px solid #334155",
                      color: "#fff",
                      fontSize: 14,
                      outline: "none"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      borderRadius: 12,
                      background: "#1e293b",
                      border: "1px solid #334155",
                      color: "#fff",
                      fontSize: 14,
                      outline: "none"
                    }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    marginTop: 8,
                    padding: "12px",
                    borderRadius: 12,
                    background: "#22c55e",
                    color: "#fff",
                    border: "none",
                    fontWeight: 700,
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  Salvar Nova Senha e Entrar
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
