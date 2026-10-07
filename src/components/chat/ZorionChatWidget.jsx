import React, { useState, useEffect, useRef, useMemo } from "react";
import { 
  MessagesSquare, 
  X, 
  Send, 
  Users, 
  Radio, 
  Search, 
  ArrowLeft, 
  Check,
  CheckCheck, 
  Circle, 
  ChevronDown,
  Building2,
  Stethoscope,
  Pill,
  UserCheck,
  ArrowLeftRight,
  Sparkles,
  Shield,
  Layers,
  Hospital
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatService, CHAT_CHANNELS } from "@/api/chatService";
import { listen } from "@tauri-apps/api/event";

// Som ao enviar mensagem (Feedback sonoro suave estilo WhatsApp / Messenger)
function playMessageSentSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    // Tom suave ascendente rápido (pop/tick)
    osc.frequency.setValueAtTime(480, now);
    osc.frequency.exponentialRampToValueAtTime(780, now + 0.08);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  } catch (e) {
    console.warn("Sent chime error:", e);
  }
}

// Som ao receber mensagem (Notificação audível cristalina estilo WhatsApp)
function playMessageReceivedSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Primeiro tom (E5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.16);

    // Segundo tom (A5 harmônico mais alto)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.07);
    gain2.gain.setValueAtTime(0.25, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.35);
  } catch (e) {
    console.warn("Received chime error:", e);
  }
}

export function ZorionChatWidget({ activeSection, currentUser: propUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("canais"); // "canais" | "equipe" | "dm"
  const [selectedChannelId, setSelectedChannelId] = useState("central_satelite"); // Inicia prioritariamente em Satélite ⇄ Central
  const [activeContact, setActiveContact] = useState(null); // Funcionário selecionado para DM
  
  // Status de presença pessoal do usuário logado
  const [myStatus, setMyStatus] = useState(() => {
    return localStorage.getItem("zorion_my_status") || "online";
  });
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [moduloMenuOpen, setModuloMenuOpen] = useState(false);

  // Módulo de trabalho selecionado pelo operador
  const [manualModule, setManualModule] = useState(() => {
    return localStorage.getItem("zorion_chat_selected_module") || null;
  });

  // Lista de funcionários e pesquisa
  const [staffList, setStaffList] = useState([]);
  const [searchStaff, setSearchStaff] = useState("");
  const [staffModuleFilter, setStaffModuleFilter] = useState("todos"); // "todos" | "Central" | "Satélite" | "Recepção"
  const [unreadDms, setUnreadDms] = useState({ total: 0, bySender: {} });
  const [channelUnread, setChannelUnread] = useState({ total: 0, byChannel: {} });

  // Mensagens do canal ativo
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Identificação universal do usuário logado
  const currentUser = useMemo(() => {
    if (propUser && propUser.id) return propUser;
    try {
      const stored = 
        sessionStorage.getItem("axion_active_user") ||
        localStorage.getItem("pharma_user") ||
        sessionStorage.getItem("zorion_medico_user") ||
        sessionStorage.getItem("zorion_recepcao_user");
      if (stored) {
        const u = JSON.parse(stored);
        return {
          id: u.id || u.username || u.login || "user-temp-id",
          nome: u.nome || u.username || "Farmacêutico(a)",
          cargo: u.cargo || u.perfil || "Farmácia Central",
          crm: u.crm || "",
          coren: u.coren || "",
          crf: u.crf || "",
          login: u.login || u.username || ""
        };
      }
    } catch {}
    return { id: "user-default", nome: "Farmacêutico(a)", cargo: "Farmácia Central" };
  }, [propUser]);

  // Identificação inteligente do módulo atual
  const currentModulo = useMemo(() => {
    if (manualModule) return manualModule;
    if (activeSection?.id === "satelite") return "Satélite";
    if (activeSection?.id === "estoque" || activeSection?.id === "rt") return "Central";
    if (window.location.hash?.toLowerCase().includes("satelite") || window.location.pathname?.toLowerCase().includes("satelite")) {
      return "Satélite";
    }
    return "Central";
  }, [manualModule, activeSection]);

  const currentUserId = currentUser.id || currentUser.login;

  // Canal atual: geral, canal modular ou DM específico
  const currentCanal = useMemo(() => {
    if (activeTab === "dm" && activeContact) {
      return ChatService.getDmChannel(currentUserId, activeContact.id || activeContact.login);
    }
    return selectedChannelId || "central_satelite";
  }, [activeTab, activeContact, currentUserId, selectedChannelId]);

  const activeChannelMeta = useMemo(() => {
    return CHAT_CHANNELS.find(c => c.id === selectedChannelId) || CHAT_CHANNELS[0];
  }, [selectedChannelId]);

  const messagesEndRef = useRef(null);
  const lastMsgIdRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Listener para evento customizado de abrir chat externo (ex: vindo de botões de pedido)
  useEffect(() => {
    const handleExternalOpen = (e) => {
      setIsOpen(true);
      if (e?.detail?.canal) {
        setSelectedChannelId(e.detail.canal);
        setActiveTab("canais");
        setActiveContact(null);
      }
    };
    window.addEventListener("open_zorion_chat", handleExternalOpen);
    return () => window.removeEventListener("open_zorion_chat", handleExternalOpen);
  }, []);

  // Heartbeat de Presença (a cada 18 segundos)
  useEffect(() => {
    if (!currentUserId) return;

    const ping = () => {
      ChatService.updatePresence(currentUserId, myStatus, currentModulo);
    };

    ping();
    const interval = setInterval(ping, 18000);

    const handleUnload = () => {
      ChatService.updatePresence(currentUserId, "offline", currentModulo);
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [currentUserId, myStatus, currentModulo]);

  // Mudança de status pelo usuário
  const handleStatusChange = (newStatus) => {
    setMyStatus(newStatus);
    localStorage.setItem("zorion_my_status", newStatus);
    setStatusMenuOpen(false);
    ChatService.updatePresence(currentUserId, newStatus, currentModulo);
  };

  // Mudança explícita de módulo pelo usuário
  const handleModuleSelect = (mod) => {
    setManualModule(mod);
    localStorage.setItem("zorion_chat_selected_module", mod);
    setModuloMenuOpen(false);
    ChatService.updatePresence(currentUserId, myStatus, mod);
  };

  // Buscar lista de funcionários e status de DMs
  const fetchStaff = async () => {
    try {
      const list = await ChatService.listStaff(currentUserId);
      setStaffList(list);

      const dms = await ChatService.countUnreadDmsBySender(currentUserId);
      setUnreadDms(dms);
    } catch (e) {
      console.warn("Erro ao buscar equipe:", e);
    }
  };

  // Buscar contagem de não lidas por canal
  const fetchUnreadChannels = async () => {
    try {
      const res = await ChatService.countUnreadByChannels(currentUserId, currentModulo);
      setChannelUnread(res);
    } catch (e) {
      console.warn("Erro ao buscar não lidas de canais:", e);
    }
  };

  // Buscar mensagens do canal ativo
  const fetchMessages = async () => {
    try {
      const list = await ChatService.list(currentCanal, 100);
      setMessages(list);

      // Tocar som se mensagem nova não foi enviada por mim
      if (list.length > 0) {
        const last = list[list.length - 1];
        if (last && last.id !== lastMsgIdRef.current) {
          const isFromMe = last.remetente_id === currentUserId || 
                           last.remetente_usuario === currentUser.nome;
          if (!isFromMe && lastMsgIdRef.current !== null) {
            playMessageReceivedSound();
          }
          lastMsgIdRef.current = last.id;
        }
      }

      // Atualizar contadores
      if (isOpen) {
        await ChatService.markAllAsRead(currentCanal, currentUserId, currentModulo);
      }
      
      await fetchUnreadChannels();
      const dms = await ChatService.countUnreadDmsBySender(currentUserId);
      setUnreadDms(dms);
    } catch (e) {
      console.warn("Erro ao carregar mensagens:", e);
    }
  };

  // Listeners em tempo real (Postgres LISTEN / NOTIFY e Polling de contingência)
  useEffect(() => {
    fetchMessages();
    fetchStaff();
    fetchUnreadChannels();

    let unlistenUpdate;
    let unlistenChange;

    const setupListeners = async () => {
      try {
        unlistenUpdate = await listen("db_update", () => {
          fetchMessages();
          fetchStaff();
          fetchUnreadChannels();
        });
        unlistenChange = await listen("db_change", () => {
          fetchMessages();
          fetchStaff();
          fetchUnreadChannels();
        });
      } catch (e) {
        console.warn("Listeners chat aviso:", e);
      }
    };

    setupListeners();

    const msgTimer = setInterval(fetchMessages, isOpen ? 1800 : 4000);
    const staffTimer = setInterval(fetchStaff, 6000);

    return () => {
      if (unlistenUpdate) unlistenUpdate();
      if (unlistenChange) unlistenChange();
      clearInterval(msgTimer);
      clearInterval(staffTimer);
    };
  }, [isOpen, currentCanal, currentUserId]);

  useEffect(() => {
    if (isOpen && activeTab !== "equipe") {
      scrollToBottom();
      ChatService.markAllAsRead(currentCanal, currentUserId, currentModulo);
    }
  }, [messages, isOpen, activeTab, currentCanal]);

  // Envio de mensagem
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const texto = inputText.trim();
    if (!texto || isSending) return;

    setIsSending(true);
    try {
      const cargoStr = currentUser.crf ? `CRF ${currentUser.crf}` : 
                       currentUser.cargo || currentModulo;

      await ChatService.send({
        canal: currentCanal,
        mensagem: texto,
        remetente_id: currentUserId,
        remetente_modulo: currentModulo,
        remetente_usuario: currentUser.nome,
        remetente_cargo: cargoStr,
        destinatario_id: activeTab === "dm" && activeContact ? (activeContact.id || activeContact.login) : null,
        destinatario_nome: activeTab === "dm" && activeContact ? activeContact.nome : null,
        destinatario_modulo: activeTab === "dm" && activeContact ? activeContact.modulo_ativo : null
      });

      // Tocar som de envio ao mandar a mensagem (estilo WhatsApp)
      playMessageSentSound();

      setInputText("");
      await fetchMessages();
      scrollToBottom();
    } catch (e) {
      console.error("Falha ao enviar mensagem:", e);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Abrir conversa direta (1-a-1) com um funcionário
  const handleStartDm = (colleague) => {
    setActiveContact(colleague);
    setActiveTab("dm");
    setMessages([]);
    lastMsgIdRef.current = null;
  };

  // Total de não lidas para o badge do botão flutuante
  const totalUnreadBadge = (channelUnread?.total || 0) + (unreadDms?.total || 0);

  // Filtragem da lista de funcionários
  const filteredStaff = useMemo(() => {
    let list = staffList;
    if (staffModuleFilter !== "todos") {
      list = list.filter(s => (s.modulo_ativo || "").toLowerCase().includes(staffModuleFilter.toLowerCase()));
    }
    const q = searchStaff.toLowerCase().trim();
    if (!q) return list;
    return list.filter(s => 
      (s.nome || "").toLowerCase().includes(q) ||
      (s.crm || "").toLowerCase().includes(q) ||
      (s.coren || "").toLowerCase().includes(q) ||
      (s.crf || "").toLowerCase().includes(q) ||
      (s.modulo_ativo || "").toLowerCase().includes(q) ||
      (s.perfil || "").toLowerCase().includes(q)
    );
  }, [staffList, searchStaff, staffModuleFilter]);

  const onlineCount = useMemo(() => {
    return staffList.filter(s => s.status_online === "online" || s.status_online === "ocupado").length;
  }, [staffList]);

  // Formatação de hora
  const formatHora = (isoStr) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  // Renderizador de Badge de Status
  const renderStatusBadge = (status) => {
    switch (status) {
      case "online":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            Online
          </span>
        );
      case "ausente":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]"></span>
            Ausente
          </span>
        );
      case "ocupado":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></span>
            Ocupado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>
            Offline
          </span>
        );
    }
  };

  // Badge do módulo estilizado
  const renderModuloBadge = (mod) => {
    const m = (mod || "").toLowerCase();
    if (m.includes("satelite") || m.includes("satélite")) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <Pill className="w-3 h-3 text-emerald-600" />
          Satélite
        </span>
      );
    }
    if (m.includes("central") || m.includes("estoque")) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
          <Building2 className="w-3 h-3 text-sky-600" />
          Central
        </span>
      );
    }
    if (m.includes("recep") || m.includes("recepção")) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          <Hospital className="w-3 h-3 text-purple-600" />
          Recepção
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
        {mod || "Geral"}
      </span>
    );
  };

  return (
    <>
      {/* Botão Flutuante no Canto Inferior Direito */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center print:hidden no-print">
        <button
          onClick={() => {
            const nextState = !isOpen;
            setIsOpen(nextState);
            if (nextState) {
              ChatService.markAllAsRead(currentCanal, currentUserId, currentModulo);
              fetchStaff();
              fetchUnreadChannels();
            }
          }}
          title={isOpen ? "Fechar Chat Zorion" : "Zorion Chat Multi-Módulos"}
          className={`group relative flex items-center justify-center w-14 h-14 rounded-full shadow-[0_10px_30px_rgba(2,132,199,0.4)] hover:shadow-[0_14px_40px_rgba(2,132,199,0.6)] hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer border-2 border-white/90 dark:border-slate-700 backdrop-blur-md ${
            isOpen
              ? "bg-slate-900 text-white"
              : "bg-gradient-to-tr from-sky-600 via-sky-700 to-indigo-700 text-white ring-4 ring-sky-400/20"
          }`}
        >
          {isOpen ? (
            <X className="w-6 h-6 transition-transform group-hover:rotate-90 duration-200" />
          ) : (
            <MessagesSquare className="w-6 h-6 transition-transform group-hover:scale-110 duration-200" />
          )}

          {/* Badge total de mensagens não lidas */}
          {!isOpen && totalUnreadBadge > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-black text-white ring-2 ring-white shadow-lg animate-bounce">
              {totalUnreadBadge > 9 ? "9+" : totalUnreadBadge}
            </span>
          )}

          {/* Indicador do meu status no botão flutuante */}
          {!isOpen && (
            <span 
              className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 ${
                myStatus === "online" ? "bg-emerald-500" :
                myStatus === "ausente" ? "bg-amber-500" :
                myStatus === "ocupado" ? "bg-rose-500" : "bg-slate-400"
              }`}
            />
          )}
        </button>
      </div>

      {/* Janela de Chat Aberta */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-[94vw] sm:w-[440px] max-w-[440px] h-[610px] bg-white dark:bg-slate-900 rounded-3xl shadow-[0_25px_60px_rgba(15,23,42,0.35)] border border-slate-200/90 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300 print:hidden no-print">
          
          {/* Header Superior Principal */}
          <div className="p-3 bg-gradient-to-r from-sky-700 via-sky-800 to-indigo-900 text-white flex items-center justify-between shrink-0 shadow-md">
            
            {activeTab === "dm" && activeContact ? (
              // Topo no Modo Conversa Direta 1-a-1
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  onClick={() => {
                    setActiveTab("equipe");
                    setActiveContact(null);
                  }}
                  className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
                  title="Voltar para a lista de equipe"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>

                <div className="relative">
                  <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black text-sm text-white shadow-inner">
                    {(activeContact.nome || "U").charAt(0).toUpperCase()}
                  </div>
                  <span 
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-sky-700 ${
                      activeContact.status_online === "online" ? "bg-emerald-400" :
                      activeContact.status_online === "ausente" ? "bg-amber-400" :
                      activeContact.status_online === "ocupado" ? "bg-rose-400" : "bg-slate-400"
                    }`}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-xs truncate text-white flex items-center gap-1.5">
                    {activeContact.nome}
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] text-sky-100/90">
                    <span>{activeContact.status_online === "online" ? "Online agora" : activeContact.status_online === "ausente" ? "Ausente" : activeContact.status_online === "ocupado" ? "Ocupado" : activeContact.vistoTexto || "Offline"}</span>
                    {activeContact.modulo_ativo && (
                      <>
                        <span>•</span>
                        <span className="font-semibold text-sky-200">{activeContact.modulo_ativo}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              // Topo no Modo Normal
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 text-white shadow-xs shrink-0">
                  <MessagesSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-black text-sm tracking-tight text-white flex items-center gap-1.5">
                      Zorion Chat
                    </h3>
                    <span className="text-[9px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 px-1.5 py-0.2 rounded-full font-bold">
                      {onlineCount} online
                    </span>
                  </div>

                  {/* Seletor de Módulo Ativo do Usuário */}
                  <div className="relative inline-block mt-0.5">
                    <button
                      onClick={() => setModuloMenuOpen(!moduloMenuOpen)}
                      className="text-[10px] font-bold text-sky-100 hover:text-white flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-lg border border-white/15 transition-all cursor-pointer"
                      title="Clique para alternar seu módulo atual de envio"
                    >
                      <span>Módulo: <strong>{currentModulo}</strong></span>
                      <ChevronDown className="w-2.5 h-2.5 opacity-80" />
                    </button>

                    {moduloMenuOpen && (
                      <div className="absolute left-0 mt-1.5 w-44 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1 z-50 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-3 py-1 text-[9px] font-extrabold uppercase text-slate-400 border-b border-slate-100 dark:border-slate-700/60 mb-1">
                          Meu Módulo Ativo
                        </div>
                        <button
                          onClick={() => handleModuleSelect("Central")}
                          className={`w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-sky-50 dark:hover:bg-slate-700 cursor-pointer ${
                            currentModulo === "Central" ? "font-bold text-sky-600 bg-sky-50/70" : ""
                          }`}
                        >
                          <Building2 className="w-3.5 h-3.5 text-sky-600" />
                          <span>Módulo Central</span>
                        </button>
                        <button
                          onClick={() => handleModuleSelect("Satélite")}
                          className={`w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-emerald-50 dark:hover:bg-slate-700 cursor-pointer ${
                            currentModulo === "Satélite" ? "font-bold text-emerald-600 bg-emerald-50/70" : ""
                          }`}
                        >
                          <Pill className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Módulo Satélite</span>
                        </button>
                        <button
                          onClick={() => handleModuleSelect("Recepção")}
                          className={`w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-purple-50 dark:hover:bg-slate-700 cursor-pointer ${
                            currentModulo === "Recepção" ? "font-bold text-purple-600 bg-purple-50/70" : ""
                          }`}
                        >
                          <Hospital className="w-3.5 h-3.5 text-purple-600" />
                          <span>Módulo Recepção</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Ações do Header (Seletor de Meu Status + Fechar) */}
            <div className="flex items-center gap-1.5 shrink-0">
              
              {/* Seletor do Próprio Status */}
              <div className="relative">
                <button
                  onClick={() => setStatusMenuOpen(!statusMenuOpen)}
                  title="Alterar seu status de presença"
                  className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-[11px] font-bold transition-all cursor-pointer"
                >
                  <span 
                    className={`w-2 h-2 rounded-full ${
                      myStatus === "online" ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-pulse" :
                      myStatus === "ausente" ? "bg-amber-400" :
                      myStatus === "ocupado" ? "bg-rose-400" : "bg-slate-300"
                    }`}
                  />
                  <span className="capitalize">{myStatus}</span>
                  <ChevronDown className="w-3 h-3 text-white/80" />
                </button>

                {/* Dropdown de Status */}
                {statusMenuOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-50 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1 text-[10px] font-extrabold uppercase text-slate-400 border-b border-slate-100 dark:border-slate-700/60 mb-1">
                      Meu Status
                    </div>

                    <button
                      onClick={() => handleStatusChange("online")}
                      className={`w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer ${
                        myStatus === "online" ? "font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50/50" : ""
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
                      <span>Online</span>
                    </button>

                    <button
                      onClick={() => handleStatusChange("ausente")}
                      className={`w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer ${
                        myStatus === "ausente" ? "font-bold text-amber-600 dark:text-amber-400 bg-amber-50/50" : ""
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs" />
                      <span>Ausente</span>
                    </button>

                    <button
                      onClick={() => handleStatusChange("ocupado")}
                      className={`w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer ${
                        myStatus === "ocupado" ? "font-bold text-rose-600 dark:text-rose-400 bg-rose-50/50" : ""
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs" />
                      <span>Ocupado</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Fechar Janela */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/20 text-white/90 hover:text-white transition-colors cursor-pointer"
                title="Minimizar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Abas Principais (Canais dos Módulos vs Equipe) */}
          <div className="bg-slate-100/90 dark:bg-slate-800/80 px-2 py-1.5 border-b border-slate-200/80 dark:border-slate-700 flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab("canais");
                setActiveContact(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === "canais"
                  ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-sky-600" />
              <span>Canais & Módulos</span>
              {channelUnread?.total > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {channelUnread.total}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("equipe")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === "equipe"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Equipe & Status</span>
              {unreadDms?.total > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {unreadDms.total}
                </span>
              )}
            </button>

            {activeTab === "dm" && activeContact && (
              <div className="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold border border-indigo-200/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
                <span>1 a 1</span>
              </div>
            )}
          </div>

          {/* Sub-Header com Seletor dos Módulos / Canais (Quando na aba Canais) */}
          {activeTab === "canais" && (
            <div className="bg-white dark:bg-slate-900 px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 shadow-xs">
              {CHAT_CHANNELS.map((ch) => {
                const isSelected = selectedChannelId === ch.id;
                const unread = channelUnread?.byChannel?.[ch.id] || 0;

                // Estilos específicos por módulo
                let iconComponent = <Radio className="w-3.5 h-3.5" />;
                let activeStyle = "bg-slate-900 text-white";

                if (ch.id === "central_satelite") {
                  iconComponent = <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" />;
                  activeStyle = "bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-sky-500/20";
                } else if (ch.id === "modulo_central") {
                  iconComponent = <Building2 className="w-3.5 h-3.5 text-blue-400" />;
                  activeStyle = "bg-blue-600 text-white shadow-blue-500/20";
                } else if (ch.id === "modulo_satelite") {
                  iconComponent = <Pill className="w-3.5 h-3.5 text-emerald-400" />;
                  activeStyle = "bg-emerald-600 text-white shadow-emerald-500/20";
                } else if (ch.id === "modulo_recepcao") {
                  iconComponent = <Hospital className="w-3.5 h-3.5 text-purple-400" />;
                  activeStyle = "bg-purple-600 text-white shadow-purple-500/20";
                }

                return (
                  <button
                    key={ch.id}
                    onClick={() => {
                      setSelectedChannelId(ch.id);
                      setMessages([]);
                      lastMsgIdRef.current = null;
                      ChatService.markAllAsRead(ch.id, currentUserId, currentModulo);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer shadow-xs ${
                      isSelected
                        ? `${activeStyle} shadow-md scale-102`
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70"
                    }`}
                  >
                    {iconComponent}
                    <span>{ch.nome}</span>
                    {unread > 0 && (
                      <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* ================================================================= */}
          {/* CONTEÚDO PRINCIPAL - ABA EQUIPE */}
          {/* ================================================================= */}
          {activeTab === "equipe" ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-950/40">
              
              {/* Filtros de Módulo da Equipe */}
              <div className="p-2.5 bg-white dark:bg-slate-900 border-b border-slate-200/70 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {[
                    { id: "todos", label: "Todos" },
                    { id: "Central", label: "Central" },
                    { id: "Satélite", label: "Satélite" },
                    { id: "Recepção", label: "Recepção" }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setStaffModuleFilter(tab.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        staffModuleFilter === tab.id
                          ? "bg-sky-600 text-white shadow-xs"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Barra de Pesquisa de Funcionários */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchStaff}
                    onChange={(e) => setSearchStaff(e.target.value)}
                    placeholder="Buscar colaborador por nome, CRM, CRF..."
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  {searchStaff && (
                    <button
                      onClick={() => setSearchStaff("")}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Lista com Status de cada Funcionário */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredStaff.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6 space-y-2">
                    <Users className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Nenhum colaborador encontrado no filtro selecionado
                    </p>
                  </div>
                ) : (
                  filteredStaff.map((person) => {
                    const isSelf = person.isSelf;
                    const unreadForPerson = unreadDms?.bySender?.[person.id || person.login] || 0;

                    return (
                      <div
                        key={person.id || person.login}
                        onClick={() => !isSelf && handleStartDm(person)}
                        className={`group relative p-2.5 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 ${
                          isSelf 
                            ? "bg-slate-100/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-700 cursor-default opacity-85"
                            : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md cursor-pointer hover:scale-[1.01]"
                        }`}
                      >
                        {/* Avatar com badge luminoso de status */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center font-black text-slate-700 dark:text-slate-200 text-sm border border-slate-200 dark:border-slate-700 shadow-xs">
                              {(person.nome || "U").charAt(0).toUpperCase()}
                            </div>
                            <span 
                              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                                person.status_online === "online" ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" :
                                person.status_online === "ausente" ? "bg-amber-500" :
                                person.status_online === "ocupado" ? "bg-rose-500" : "bg-slate-300 dark:bg-slate-600"
                              }`}
                              title={person.status_online}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                                {person.nome}
                              </h4>
                              {isSelf && (
                                <span className="bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 text-[9px] font-extrabold px-1 py-0.2 rounded-md">
                                  Você
                                </span>
                              )}
                              {renderModuloBadge(person.modulo_ativo)}
                            </div>

                            <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {person.crf && <span className="font-semibold text-emerald-600">CRF {person.crf}</span>}
                              {person.crm && <span className="font-semibold text-sky-600">CRM {person.crm}</span>}
                              {person.coren && <span className="font-semibold text-indigo-600">COREN {person.coren}</span>}
                              {person.perfil && !person.crf && !person.crm && !person.coren && (
                                <span className="truncate max-w-[130px]">{person.perfil}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status visual e Ação */}
                        <div className="flex flex-col items-end shrink-0 gap-1">
                          {renderStatusBadge(person.status_online)}
                          <span className="text-[9px] text-slate-400 font-medium">
                            {person.vistoTexto}
                          </span>

                          {unreadForPerson > 0 && (
                            <span className="mt-0.5 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black shadow-xs animate-pulse">
                              {unreadForPerson} nova{unreadForPerson > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            // =================================================================
            // CONTEÚDO PRINCIPAL - ABA CANAIS OU ABA CONVERSA DIRETA (DM)
            // =================================================================
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/60 dark:bg-slate-950/40">
              
              {/* Banner Informativo do Canal Ativo */}
              {activeTab === "canais" && (
                <div className={`px-3 py-1.5 border-b text-[11px] flex items-center justify-between ${
                  selectedChannelId === "central_satelite" 
                    ? "bg-sky-50 dark:bg-sky-950/40 border-sky-100 dark:border-sky-900/60 text-sky-800 dark:text-sky-300"
                    : selectedChannelId === "modulo_central"
                    ? "bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/60 text-blue-800 dark:text-blue-300"
                    : selectedChannelId === "modulo_satelite"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300"
                    : selectedChannelId === "modulo_recepcao"
                    ? "bg-purple-50 dark:bg-purple-950/40 border-purple-100 dark:border-purple-900/60 text-purple-800 dark:text-purple-300"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                }`}>
                  <span className="font-semibold truncate">
                    {activeChannelMeta?.descricao}
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white/70 dark:bg-slate-900/70 shadow-2xs shrink-0">
                    {activeChannelMeta?.tag}
                  </span>
                </div>
              )}

              {/* Lista de Mensagens */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs p-6 space-y-2">
                    {activeTab === "dm" ? (
                      <>
                        <UserCheck className="w-10 h-10 text-indigo-400/50 animate-pulse" />
                        <p className="font-bold text-slate-700 dark:text-slate-200">
                          Conversa Direta com {activeContact?.nome}
                        </p>
                        <p className="text-[11px] max-w-xs leading-relaxed">
                          Canal 1-a-1 seguro e privado entre você e {activeContact?.nome}.
                        </p>
                      </>
                    ) : selectedChannelId === "central_satelite" ? (
                      <>
                        <ArrowLeftRight className="w-10 h-10 text-sky-500/50 animate-pulse" />
                        <p className="font-bold text-slate-700 dark:text-slate-200">
                          Linha Direta: Satélite ⇄ Central
                        </p>
                        <p className="text-[11px] max-w-xs leading-relaxed">
                          Comunicação rápida para reposições, pedidos urgentes e dúvidas técnicas entre a Farmácia Satélite e a Central.
                        </p>
                      </>
                    ) : (
                      <>
                        <MessagesSquare className="w-10 h-10 text-sky-400/50 animate-bounce" />
                        <p className="font-bold text-slate-700 dark:text-slate-200">
                          {activeChannelMeta?.nome}
                        </p>
                        <p className="text-[11px] max-w-xs leading-relaxed">
                          {activeChannelMeta?.descricao}
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.remetente_id === currentUserId || 
                                 m.remetente_usuario === currentUser.nome;

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        {/* Metadados do Remetente */}
                        <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400 font-semibold">
                          {renderModuloBadge(m.remetente_modulo)}
                          <span>•</span>
                          <span className="text-slate-600 dark:text-slate-300 font-bold">
                            {m.remetente_usuario}
                          </span>
                          {m.remetente_cargo && (
                            <span className="text-[9px] text-slate-400 font-normal">
                              ({m.remetente_cargo})
                            </span>
                          )}
                        </div>

                        {/* Balão de Mensagem */}
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs break-words shadow-2xs ${
                            isMe
                              ? "bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-tr-xs"
                              : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-tl-xs"
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap">{m.mensagem}</p>
                          <div
                            className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${
                              isMe ? "text-sky-100" : "text-slate-400"
                            }`}
                          >
                            <span>{formatHora(m.created_at)}</span>
                            {isMe && (
                              <div className="flex items-center ml-0.5">
                                {(m.lida === true || m.lida === 1 || m.lida === "t" || m.lida === "true") ? (
                                  <span title="Visualizada (2 pontos)" className="flex items-center text-sky-300 drop-shadow-[0_0_2px_rgba(56,189,248,0.8)]">
                                    <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                                  </span>
                                ) : (
                                  <span title="Enviada (1 ponto - aguardando visualização)" className="flex items-center text-white/70">
                                    <Check className="w-3.5 h-3.5 stroke-[2.2]" />
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Campo de Envio de Mensagem */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    activeTab === "dm" && activeContact
                      ? `Mensagem direta para ${activeContact.nome}...`
                      : selectedChannelId === "central_satelite"
                      ? "Mensagem para Satélite ⇄ Central..."
                      : `Mensagem no canal ${activeChannelMeta?.nome}...`
                  }
                  disabled={isSending}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!inputText.trim() || isSending}
                  className="w-10 h-10 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white shrink-0 shadow-md cursor-pointer disabled:opacity-50 transition-all"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          )}

        </div>
      )}
    </>
  );
}
