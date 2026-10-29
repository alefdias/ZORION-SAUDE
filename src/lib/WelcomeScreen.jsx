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

// ─── Paletas Completas de Temas Visuais (Elegantes e Harmoniosas) ───────────

const THEME_PALETTES = {
  "theme-hospital-navy": {
    name: "Azul Marinho Hospitalar",
    isLight: true,
    screenGradient: "linear-gradient(145deg, #f1f5f9 0%, #e2e8f0 45%, #cbd5e1 100%)",
    spotlight: "rgba(30, 58, 138, 0.15)",
    ambientGlow: "radial-gradient(ellipse at 50% 40%, rgba(59, 130, 246, 0.18) 0%, transparent 70%)",
    brandColor: "#1e3a8a",
    accentText: "#1d4ed8",
    subtitleText: "#475569",
    modalBg: "linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)",
    modalBorder: "rgba(30, 58, 138, 0.25)",
    modalGlow: "rgba(30, 58, 138, 0.15)",
    badgeBg: "rgba(30, 58, 138, 0.1)",
    badgeBorder: "rgba(30, 58, 138, 0.25)",
    badgeText: "#1e3a8a",
    textColor: "#0f172a",
    textMuted: "#64748b",
  },
  "theme-medical-clean": {
    name: "Clínico Clean",
    isLight: true,
    screenGradient: "linear-gradient(145deg, #f8fafc 0%, #f0f9ff 45%, #e0f2fe 100%)",
    spotlight: "rgba(2, 132, 199, 0.08)",
    ambientGlow: "radial-gradient(ellipse at 50% 40%, rgba(56, 189, 248, 0.18) 0%, transparent 65%)",
    brandColor: "#0284c7",
    accentText: "#0369a1",
    subtitleText: "#475569",
    modalBg: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
    modalBorder: "rgba(2, 132, 199, 0.25)",
    modalGlow: "rgba(14, 165, 233, 0.12)",
    badgeBg: "rgba(2, 132, 199, 0.1)",
    badgeBorder: "rgba(2, 132, 199, 0.25)",
    badgeText: "#0284c7",
    textColor: "#0f172a",
    textMuted: "#64748b",
  },
  "theme-clinical-sage": {
    name: "Sálvia & Menta",
    isLight: true,
    screenGradient: "linear-gradient(145deg, #f8fafc 0%, #f0fdf4 45%, #ecfdf5 100%)",
    spotlight: "rgba(16, 185, 129, 0.08)",
    ambientGlow: "radial-gradient(ellipse at 50% 40%, rgba(52, 211, 153, 0.18) 0%, transparent 65%)",
    brandColor: "#059669",
    accentText: "#047857",
    subtitleText: "#475569",
    modalBg: "linear-gradient(145deg, #ffffff 0%, #f0fdf4 100%)",
    modalBorder: "rgba(16, 185, 129, 0.25)",
    modalGlow: "rgba(16, 185, 129, 0.12)",
    badgeBg: "rgba(16, 185, 129, 0.1)",
    badgeBorder: "rgba(16, 185, 129, 0.25)",
    badgeText: "#059669",
    textColor: "#0f172a",
    textMuted: "#64748b",
  },
  "theme-ocean": {
    name: "Oceano",
    screenGradient: "linear-gradient(145deg, #060e1d 0%, #0a172e 50%, #060d1b 100%)",
    spotlight: "rgba(14, 165, 233, 0.15)",
    ambientGlow: "radial-gradient(ellipse at 50% 40%, rgba(14, 165, 233, 0.16) 0%, transparent 65%)",
    brandColor: "#38bdf8",
    accentText: "#7dd3fc",
    modalBg: "linear-gradient(145deg, #091527 0%, #0d1e37 100%)",
    modalBorder: "rgba(56, 189, 248, 0.3)",
    modalGlow: "rgba(14, 165, 233, 0.25)",
    badgeBg: "rgba(14, 165, 233, 0.12)",
    badgeBorder: "rgba(56, 189, 248, 0.3)",
    badgeText: "#38bdf8",
  },
  "theme-emerald": {
    name: "Esmeralda",
    screenGradient: "linear-gradient(145deg, #04120e 0%, #071f18 50%, #04100c 100%)",
    spotlight: "rgba(16, 185, 129, 0.15)",
    ambientGlow: "radial-gradient(ellipse at 50% 40%, rgba(16, 185, 129, 0.16) 0%, transparent 65%)",
    brandColor: "#10b981",
    accentText: "#6ee7b7",
    modalBg: "linear-gradient(145deg, #061913 0%, #0a251d 100%)",
    modalBorder: "rgba(52, 211, 153, 0.3)",
    modalGlow: "rgba(16, 185, 129, 0.25)",
    badgeBg: "rgba(16, 185, 129, 0.12)",
    badgeBorder: "rgba(52, 211, 153, 0.3)",
    badgeText: "#34d399",
  },
  "theme-sunset": {
    name: "Pôr do Sol",
    screenGradient: "linear-gradient(145deg, #0f0c13 0%, #17101e 50%, #0d0a11 100%)",
    spotlight: "rgba(249, 115, 22, 0.15)",
    ambientGlow: "radial-gradient(ellipse at 50% 40%, rgba(249, 115, 22, 0.16) 0%, transparent 65%)",
    brandColor: "#f97316",
    accentText: "#fdba74",
    modalBg: "linear-gradient(145deg, #150f1c 0%, #1e1528 100%)",
    modalBorder: "rgba(251, 146, 60, 0.3)",
    modalGlow: "rgba(249, 115, 22, 0.25)",
    badgeBg: "rgba(249, 115, 22, 0.12)",
    badgeBorder: "rgba(251, 146, 60, 0.3)",
    badgeText: "#fb923c",
  },
  "theme-amethyst": {
    name: "Ametista",
    screenGradient: "linear-gradient(145deg, #0b0816 0%, #130d24 50%, #090612 100%)",
    spotlight: "rgba(168, 85, 247, 0.15)",
    ambientGlow: "radial-gradient(ellipse at 50% 40%, rgba(168, 85, 247, 0.16) 0%, transparent 65%)",
    brandColor: "#a855f7",
    accentText: "#d8b4fe",
    modalBg: "linear-gradient(145deg, #120c22 0%, #1a1130 100%)",
    modalBorder: "rgba(192, 132, 252, 0.3)",
    modalGlow: "rgba(168, 85, 247, 0.25)",
    badgeBg: "rgba(168, 85, 247, 0.12)",
    badgeBorder: "rgba(192, 132, 252, 0.3)",
    badgeText: "#c084fc",
  },
  "theme-rose": {
    name: "Rosa Elegance",
    screenGradient: "linear-gradient(145deg, #100810 0%, #190c19 50%, #0d060d 100%)",
    spotlight: "rgba(244, 63, 94, 0.15)",
    ambientGlow: "radial-gradient(ellipse at 50% 40%, rgba(244, 63, 94, 0.16) 0%, transparent 65%)",
    brandColor: "#f43f5e",
    accentText: "#fda4af",
    modalBg: "linear-gradient(145deg, #180c17 0%, #241123 100%)",
    modalBorder: "rgba(251, 113, 133, 0.3)",
    modalGlow: "rgba(244, 63, 94, 0.25)",
    badgeBg: "rgba(244, 63, 94, 0.12)",
    badgeBorder: "rgba(251, 113, 133, 0.3)",
    badgeText: "#fb7185",
  },
  "theme-midnight": {
    name: "Meia-noite",
    screenGradient: "linear-gradient(145deg, #03060f 0%, #080d19 50%, #02040a 100%)",
    spotlight: "rgba(148, 163, 184, 0.12)",
    ambientGlow: "radial-gradient(ellipse at 50% 40%, rgba(148, 163, 184, 0.13) 0%, transparent 65%)",
    brandColor: "#94a3b8",
    accentText: "#cbd5e1",
    modalBg: "linear-gradient(145deg, #0a0f1b 0%, #11192b 100%)",
    modalBorder: "rgba(148, 163, 184, 0.3)",
    modalGlow: "rgba(148, 163, 184, 0.2)",
    badgeBg: "rgba(148, 163, 184, 0.12)",
    badgeBorder: "rgba(148, 163, 184, 0.3)",
    badgeText: "#cbd5e1",
  }
};

// ─── Módulos Principais com Identificação de Farmácia Central & Satélite ──────

const MODULES = [
  {
    key: "estoque_farmacia",
    label: "Farmácia Central",
    sub: "Dashboard & Estoque",
    color: "#60a5fa",
    glow: "rgba(96,165,250,0.35)",
    border: "rgba(96,165,250,0.45)",
    bg: "rgba(96,165,250,0.1)",
    Icon: IconEstoqueFarmacia,
  },
  {
    key: "farmacia_satelite",
    label: "Farmácia Satélite",
    sub: "Dispensação & Pacientes",
    color: "#34d399",
    glow: "rgba(52,211,153,0.35)",
    border: "rgba(52,211,153,0.45)",
    bg: "rgba(52,211,153,0.1)",
    Icon: IconFarmaciaSatelite,
  },
  {
    key: "carrinho_parada",
    label: "Carrinho de Parada",
    sub: "Checagem & Controle",
    color: "#f43f5e",
    glow: "rgba(244,63,94,0.35)",
    border: "rgba(244,63,94,0.45)",
    bg: "rgba(244,63,94,0.1)",
    Icon: IconCarrinhoParada,
  },
  {
    key: "responsavel_tecnico",
    label: "Responsável Técnico",
    sub: "Gestão & Cadastros",
    color: "#c084fc",
    glow: "rgba(192,132,252,0.35)",
    border: "rgba(192,132,252,0.45)",
    bg: "rgba(192,132,252,0.1)",
    Icon: IconAdministrador,
  }
];

// ─── Card de módulo adaptável ao Tema ──────────────────────────────────────────

function ModuleCard({ mod, currentTheme, delay, visible, onClick }) {
  const [hovered, setHovered] = useState(false);
  const isLight = Boolean(currentTheme?.isLight);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isLight
          ? hovered
            ? "rgba(255, 255, 255, 0.95)"
            : "rgba(255, 255, 255, 0.82)"
          : hovered
          ? "rgba(255, 255, 255, 0.08)"
          : "rgba(255, 255, 255, 0.03)",
        border: `1.5px solid ${
          hovered
            ? mod.color
            : isLight
            ? "rgba(203, 213, 225, 0.85)"
            : "rgba(255, 255, 255, 0.1)"
        }`,
        borderRadius: 22,
        padding: "26px 18px 20px",
        cursor: "pointer",
        outline: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 13,
        width: 172,
        position: "relative",
        overflow: "hidden",
        transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        transform: visible
          ? hovered
            ? "translateY(-8px) scale(1.04)"
            : "translateY(0) scale(1)"
          : "translateY(30px) scale(0.9)",
        opacity: visible ? 1 : 0,
        transitionDelay: visible ? `${delay}ms` : "0ms",
        boxShadow: hovered
          ? `0 14px 40px ${mod.glow}, 0 0 0 1px ${mod.color}55`
          : isLight
          ? "0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.03)"
          : "0 6px 20px rgba(0,0,0,0.3)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <div
        style={{
          width: 74,
          height: 74,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: hovered
            ? `radial-gradient(circle, ${mod.glow} 0%, transparent 70%)`
            : `${mod.color}15`,
          border: `1px solid ${hovered ? mod.color + "88" : mod.color + "33"}`,
          transition: "all 0.3s ease",
          filter: hovered ? `drop-shadow(0 0 14px ${mod.color})` : "none",
        }}
      >
        <mod.Icon color={mod.color} />
      </div>
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: hovered
              ? isLight
                ? mod.color
                : "#ffffff"
              : isLight
              ? "#0f172a"
              : "#f1f5f9",
            letterSpacing: 0.3,
            transition: "color 0.25s ease",
            lineHeight: 1.3,
          }}
        >
          {mod.label}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: hovered
              ? mod.color
              : isLight
              ? "#64748b"
              : "#94a3b8",
            marginTop: 4,
            transition: "color 0.25s ease",
            lineHeight: 1.3,
          }}
        >
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
    return localStorage.getItem("zorion_theme") || "theme-hospital-navy";
  });

  const currentTheme = THEME_PALETTES[themeColor] || THEME_PALETTES["theme-hospital-navy"];

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
          const allModules = ["estoque_farmacia", "pacientes_medicao", "farmacia_satelite", "responsavel_tecnico", "carrinho_parada", "carrinho_enfermagem", "carrinho_farmacia", "recepcao", "enfermagem"];
          const localUsers = data.map(u => {
            let userModules = [];
            if (u.modulos) {
              try {
                userModules = typeof u.modulos === 'string' && u.modulos.startsWith('[') 
                  ? JSON.parse(u.modulos) 
                  : (typeof u.modulos === 'string' ? u.modulos.split(',') : u.modulos);
              } catch { userModules = []; }
            }
            if (!userModules || userModules.length === 0) {
              const role = (u.perfil || u.cargo || "").toLowerCase();
              userModules = (role === "administrador" || role === "admin") ? allModules : 
                            (role === "farmaceutico") ? ["estoque_farmacia", "farmacia_satelite", "carrinho_parada", "carrinho_farmacia", "pacientes_medicao"] : 
                            (role === "auxiliar_farmacia" || role.includes("auxiliar")) ? ["estoque_farmacia", "farmacia_satelite"] :
                            (role === "medico") ? ["medico"] :
                            (role === "recepcionista") ? ["pacientes_medicao", "recepcao", "farmacia_satelite"] :
                            (role === "enfermeiro") ? ["carrinho_parada", "carrinho_enfermagem", "pacientes_medicao", "enfermagem"] :
                            (role === "tecnico_enfermagem" || role.includes("tec")) ? ["carrinho_parada", "carrinho_enfermagem", "enfermagem"] :
                            ["carrinho_parada", "carrinho_enfermagem", "pacientes_medicao"];
            }

            return {
              id: u.id,
              nome: u.nome,
              username: u.login,
              password: u.senha,
              cargo: u.perfil || u.cargo,
              coren: u.coren,
              crf: u.crf,
              modules: userModules,
              first_login: u.primeiro_acesso !== false
            };
          });
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
      const allModules = ["estoque_farmacia", "pacientes_medicao", "farmacia_satelite", "responsavel_tecnico", "carrinho_parada", "carrinho_enfermagem", "carrinho_farmacia", "enfermagem"];
      
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
        const allModules = ["estoque_farmacia", "pacientes_medicao", "farmacia_satelite", "responsavel_tecnico", "carrinho_parada", "carrinho_enfermagem", "carrinho_farmacia", "recepcao", "enfermagem"];
        users = data.map(u => {
          let userModules = [];
          if (u.modulos) {
            try {
              userModules = typeof u.modulos === 'string' && u.modulos.startsWith('[') 
                ? JSON.parse(u.modulos) 
                : (typeof u.modulos === 'string' ? u.modulos.split(',') : u.modulos);
            } catch { userModules = []; }
          }
          if (!userModules || userModules.length === 0) {
            const role = (u.perfil || u.cargo || "").toLowerCase();
            userModules = (role === "administrador" || role === "admin") ? allModules : 
                          (role === "farmaceutico") ? ["estoque_farmacia", "farmacia_satelite", "carrinho_parada", "carrinho_farmacia", "pacientes_medicao"] : 
                          (role === "auxiliar_farmacia" || role.includes("auxiliar")) ? ["estoque_farmacia", "farmacia_satelite"] :
                          (role === "medico") ? ["medico"] :
                          (role === "recepcionista") ? ["pacientes_medicao", "recepcao", "farmacia_satelite"] :
                          (role === "enfermeiro") ? ["carrinho_parada", "carrinho_enfermagem", "pacientes_medicao", "enfermagem"] :
                          (role === "tecnico_enfermagem" || role.includes("tec")) ? ["carrinho_parada", "carrinho_enfermagem", "enfermagem"] :
                          ["carrinho_parada", "carrinho_enfermagem", "pacientes_medicao"];
          }

          return {
            id: u.id,
            nome: u.nome,
            username: u.login,
            password: u.senha,
            cargo: u.perfil || u.cargo,
            coren: u.coren,
            crf: u.crf,
            modules: userModules,
            first_login: u.primeiro_acesso !== false
          };
        });
        localStorage.setItem("axion_users", JSON.stringify(users));
        setAvailableUsers(users);
      }
    } catch (err) {
      console.warn("Erro no fetch de usuarios durante login", err);
    }

    // A senha mestre admin123 funciona para qualquer usuário cadastrado
    const user = users.find(u => (u.username === username || (u.coren && u.coren === username)) && (u.password === password || password === "admin123"));

    if (!user) {
      toast.error("Usuário ou senha incorretos.");
      return;
    }

    // Permission check for modules and roles
    const userRoleStr = (user.cargo || "").toLowerCase();
    const isMasterAdmin = user.cargo === "administrador" || user.cargo === "admin" || password === "admin123";

    // 1. Diretriz: Médico só pode acessar o Módulo Médico
    if (userRoleStr === "medico" && !isMasterAdmin) {
      toast.error("Acesso não autorizado: Médicos possuem acesso restrito exclusivamente ao Módulo Médico (ZORION-MEDICO).");
      return;
    }

    // 2. Diretriz: Auxiliar de Farmácia (Estoque Central e Farmácia Satélite)
    if ((userRoleStr === "auxiliar_farmacia" || userRoleStr.includes("auxiliar")) && !isMasterAdmin) {
      if (selectedModule.key !== "estoque_farmacia" && selectedModule.key !== "farmacia_satelite") {
        toast.error("Acesso não autorizado: Auxiliares de farmácia possuem permissão para o Estoque Central e Farmácia Satélite.");
        return;
      }
    }

    let hasPermission = false;
    const isNursingRole = userRoleStr === "enfermeiro" || userRoleStr === "tecnico_enfermagem" || userRoleStr.includes("tec") || userRoleStr.includes("enf");

    if (isMasterAdmin) {
      hasPermission = true;
    } else if (selectedModule.key === "carrinho_parada") {
      if (carrinhoSubMode === "nursing" && (isNursingRole || (user.modules && (user.modules.includes("carrinho_enfermagem") || user.modules.includes("enfermagem"))))) {
        hasPermission = true;
      } else if (carrinhoSubMode === "pharmacy" && (userRoleStr === "farmaceutico" || (user.modules && user.modules.includes("carrinho_farmacia")))) {
        hasPermission = true;
      } else if (!carrinhoSubMode && user.modules && user.modules.includes("carrinho_parada")) {
        hasPermission = true;
      }
    } else if (user.modules && user.modules.includes(selectedModule.key)) {
      hasPermission = true;
    }

    if (!hasPermission) {
      toast.error(`Você não tem permissão para acessar o módulo ${selectedModule.label}.`);
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
        background: currentTheme.screenGradient,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        overflow: "hidden",
        opacity: exiting ? 0 : visible ? 1 : 0,
        transition: "background 0.5s ease, opacity 0.55s ease",
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
          background: `radial-gradient(650px circle at ${mousePos.x}px ${mousePos.y}px, ${currentTheme.spotlight}, transparent 45%)`,
          zIndex: 0,
          transition: "background 0.3s ease-out"
        }}
      />

      <Toaster position="top-right" richColors />
      

      {/* Marca / Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: 32,
          transform: visible ? "translateY(0)" : "translateY(-20px)",
          opacity: visible ? 1 : 0,
          transition: "all 0.5s ease",
          zIndex: 1,
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
            fontSize: 48,
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            margin: "0 0 6px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6
          }}>
            <span style={{ color: currentTheme.brandColor, transition: "color 0.4s ease" }}>ZORION</span>
            <span style={{ color: currentTheme.isLight ? "#0f172a" : "#ffffff", fontWeight: 900 }}>SAÚDE</span>
          </h1>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: currentTheme.accentText || (currentTheme.isLight ? "#0369a1" : "#94a3b8"),
            letterSpacing: 2.5,
            textTransform: "uppercase",
            transition: "color 0.4s ease"
          }}
        >
          Sistema de Gestão Farmacêutica e Hospitalar
        </span>
      </div>

      {/* Subtítulo */}
      <p
        style={{
          fontSize: 14,
          color: currentTheme.subtitleText || (currentTheme.isLight ? "#475569" : "#cbd5e1"),
          marginBottom: 24,
          fontWeight: 500,
          letterSpacing: 0.2,
          transform: visible ? "translateY(0)" : "translateY(10px)",
          opacity: visible ? 1 : 0,
          transition: "all 0.5s ease 0.1s",
          zIndex: 1,
        }}
      >
        Selecione a unidade para acessar
      </p>

      {/* Brilho Ambiente Dinâmico Conforme o Tema */}
      <div
        style={{
          position: "absolute",
          top: "42%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 860,
          height: 460,
          background: currentTheme.ambientGlow,
          pointerEvents: "none",
          zIndex: 0,
          transition: "background 0.5s ease",
          filter: "blur(50px)",
        }}
      />

      {/* Grid de módulos (4 módulos) */}
      <div
        style={{
          display: "flex",
          gap: 20,
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: 840,
          padding: "0 20px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {MODULES.map((mod, index) => (
          <ModuleCard
            key={mod.key}
            mod={mod}
            currentTheme={currentTheme}
            delay={120 + index * 60}
            visible={visible}
            onClick={() => handleModuleClick(mod)}
          />
        ))}
      </div>

      {/* Footer minimalista com Seletor de Temas */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          width: "100%",
          padding: "0 32px",
          zIndex: 10,
        }}
      >
        <div style={{ pointerEvents: "auto", display: "flex", gap: "8px" }} className="group relative">
          <button
            style={{
              background: currentTheme.badgeBg,
              borderColor: currentTheme.badgeBorder,
              color: currentTheme.badgeText,
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border hover:brightness-125 transition-all text-xs font-bold shadow-xs cursor-pointer"
          >
            <Palette className="w-4 h-4" />
            <span>Tema: {currentTheme.name.toUpperCase()}</span>
          </button>
          
          <div
            style={{
              background: currentTheme.modalBg,
              borderColor: currentTheme.modalBorder,
              boxShadow: `0 15px 40px ${currentTheme.modalGlow}`,
            }}
            className="absolute bottom-full left-0 mb-2 w-52 border rounded-2xl p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 shadow-2xl backdrop-blur-xl"
          >
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { id: "theme-medical-clean", name: "Clínico Clean", colors: ["bg-sky-400", "bg-sky-100", "bg-white", "bg-blue-600"] },
                { id: "theme-clinical-sage", name: "Sálvia & Menta", colors: ["bg-emerald-400", "bg-emerald-100", "bg-white", "bg-emerald-700"] },
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
                    "flex items-center gap-3 p-2 rounded-xl transition-all border text-left cursor-pointer",
                    themeColor === t.id
                      ? currentTheme.isLight
                        ? "bg-sky-100 border-sky-300 text-sky-950 font-bold"
                        : "bg-white/15 border-white/30 text-white font-bold"
                      : currentTheme.isLight
                      ? "hover:bg-slate-100 border-transparent text-slate-700"
                      : "hover:bg-white/10 border-transparent text-slate-300"
                  )}
                >
                  <div className="flex -space-x-1 shrink-0">
                    {t.colors.map((c, i) => <div key={i} className={cn("w-3.5 h-3.5 rounded-full ring-2 ring-slate-400/40", c)} />)}
                  </div>
                  <span className="text-[11px] font-medium transition-colors">{t.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={cn("absolute bottom-6 left-0 right-0 text-center text-[10px] font-medium tracking-[0.2em]", currentTheme.isLight ? "text-slate-500" : "text-slate-400")}>
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
            background: currentTheme.isLight ? "rgba(15, 23, 42, 0.45)" : "rgba(3, 7, 18, 0.78)",
            backdropFilter: "blur(14px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            style={{
              background: currentTheme.modalBg,
              border: `1.5px solid ${selectedModule.border || currentTheme.modalBorder}`,
              borderRadius: 24,
              padding: 32,
              width: "100%",
              maxWidth: selectedModule.key === "carrinho_parada" && !carrinhoSubMode ? 460 : 400,
              boxShadow: `0 20px 50px ${selectedModule.glow || currentTheme.modalGlow}`,
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
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: currentTheme.isLight ? "#0f172a" : "#f8fafc" }}>
                  {selectedModule.label}
                </h3>
                <span style={{ fontSize: 12, color: currentTheme.isLight ? "#64748b" : "#94a3b8" }}>
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
                <p style={{ fontSize: 13, color: currentTheme.isLight ? "#475569" : "#94a3b8", margin: "0 0 8px 0" }}>
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
                    background: currentTheme.isLight ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.1)",
                    border: `1.5px solid ${currentTheme.isLight ? "rgba(59,130,246,0.25)" : "rgba(59,130,246,0.3)"}`,
                    color: currentTheme.isLight ? "#0f172a" : "#f8fafc",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = currentTheme.isLight ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.2)";
                    e.currentTarget.style.borderColor = "rgba(59,130,246,0.6)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = currentTheme.isLight ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.1)";
                    e.currentTarget.style.borderColor = currentTheme.isLight ? "rgba(59,130,246,0.25)" : "rgba(59,130,246,0.3)";
                  }}
                >
                  <div style={{ padding: 10, borderRadius: 12, background: "rgba(59,130,246,0.15)" }}>
                    <IconSyringe color="#2563eb" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: currentTheme.isLight ? "#1d4ed8" : "#60a5fa" }}>Enfermagem</div>
                    <div style={{ fontSize: 12, color: currentTheme.isLight ? "#64748b" : "#94a3b8", marginTop: 2 }}>Checagem de enfermagem e registro de uso</div>
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
                    background: currentTheme.isLight ? "rgba(16,185,129,0.06)" : "rgba(16,185,129,0.1)",
                    border: `1.5px solid ${currentTheme.isLight ? "rgba(16,185,129,0.25)" : "rgba(16,185,129,0.3)"}`,
                    color: currentTheme.isLight ? "#0f172a" : "#f8fafc",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = currentTheme.isLight ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.2)";
                    e.currentTarget.style.borderColor = "rgba(16,185,129,0.6)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = currentTheme.isLight ? "rgba(16,185,129,0.06)" : "rgba(16,185,129,0.1)";
                    e.currentTarget.style.borderColor = currentTheme.isLight ? "rgba(16,185,129,0.25)" : "rgba(16,185,129,0.3)";
                  }}
                >
                  <div style={{ padding: 10, borderRadius: 12, background: "rgba(16,185,129,0.15)" }}>
                    <IconPill color="#059669" />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: currentTheme.isLight ? "#047857" : "#34d399" }}>Farmácia</div>
                    <div style={{ fontSize: 12, color: currentTheme.isLight ? "#64748b" : "#94a3b8", marginTop: 2 }}>Controle de estoque, reposição e conferência</div>
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
                      color: currentTheme.isLight ? "#0284c7" : "#38bdf8",
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
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: currentTheme.isLight ? "#475569" : "#94a3b8", marginBottom: 6 }}>
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
                      background: currentTheme.isLight ? "#f8fafc" : "#1e293b",
                      border: `1.5px solid ${currentTheme.isLight ? "#cbd5e1" : "#334155"}`,
                      color: currentTheme.isLight ? "#0f172a" : "#fff",
                      fontSize: 14,
                      outline: "none"
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: currentTheme.isLight ? "#475569" : "#94a3b8", marginBottom: 6 }}>
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
                      background: currentTheme.isLight ? "#f8fafc" : "#1e293b",
                      border: `1.5px solid ${currentTheme.isLight ? "#cbd5e1" : "#334155"}`,
                      color: currentTheme.isLight ? "#0f172a" : "#fff",
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
