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
  ChevronDown,
  Building2,
  Stethoscope,
  Pill,
  UserCheck,
  ArrowLeftRight,
  Shield,
  Layers,
  Hospital,
  MessageCircle,
  UserPlus,
  MessageSquarePlus,
  Lock,
  Megaphone
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
  // Inicia prioritariamente em "conversas" (Minhas Conversas Privadas por Login)
  const [activeTab, setActiveTab] = useState("conversas"); // "conversas" | "equipe" | "dm" | "canais"
  const [selectedChannelId, setSelectedChannelId] = useState("central_satelite");
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

  // Lista de conversas ativas do usuário logado
  const [userConversations, setUserConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

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

  // Identificação universal e estrita do usuário logado pelo seu LOGIN e ID
  const currentUser = useMemo(() => {
    let u = propUser;
    if (!u || (!u.id && !u.login)) {
      try {
        const stored = 
          sessionStorage.getItem("axion_active_user") ||
          localStorage.getItem("pharma_user") ||
          sessionStorage.getItem("zorion_medico_user") ||
          sessionStorage.getItem("zorion_recepcao_user");
        if (stored) {
          u = JSON.parse(stored);
        }
      } catch {}
    }
    if (u) {
      const login = String(u.login || u.username || "").trim();
      const id = String(u.id || login || "user-temp-id").trim();
      return {
        id,
        login: login || id,
        nome: u.nome || u.full_name || u.username || login || "Usuário",
        cargo: u.cargo || u.perfil || "Colaborador",
        crm: u.crm || "",
        coren: u.coren || "",
        crf: u.crf || "",
        modulo_ativo: u.modulo_ativo || ""
      };
    }
    return { id: "user-default", login: "default", nome: "Usuário", cargo: "Colaborador" };
  }, [propUser]);

  // Chaves padronizadas do usuário atual
  const currentUserId = currentUser.id || currentUser.login;
  const currentUserLogin = currentUser.login || currentUser.id;

  // Identificação do módulo atual
  const currentModulo = useMemo(() => {
    if (manualModule) return manualModule;
    if (activeSection?.id === "satelite") return "Satélite";
    if (activeSection?.id === "estoque" || activeSection?.id === "rt") return "Central";
    if (window.location.hash?.toLowerCase().includes("satelite") || window.location.pathname?.toLowerCase().includes("satelite")) {
      return "Satélite";
    }
    return "Central";
  }, [manualModule, activeSection]);

  // Canal atual: geral, canal modular ou DM específico estritamente privado
  const currentCanal = useMemo(() => {
    if (activeTab === "dm" && activeContact) {
      const myKey = currentUserId || currentUserLogin;
      const otherKey = activeContact.id || activeContact.login;
      return ChatService.getDmChannel(myKey, otherKey);
    }
    if (activeTab === "canais") {
      return selectedChannelId || "central_satelite";
    }
    return null;
  }, [activeTab, activeContact, currentUserLogin, currentUserId, selectedChannelId]);

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
      } else if (e?.detail?.contact) {
        handleStartDm(e.detail.contact);
      }
    };
    window.addEventListener("open_zorion_chat", handleExternalOpen);
    return () => window.removeEventListener("open_zorion_chat", handleExternalOpen);
  }, []);

  // Heartbeat de Presença do usuário atual
  useEffect(() => {
    if (!currentUserId && !currentUserLogin) return;

    const ping = () => {
      ChatService.updatePresence(currentUserLogin || currentUserId, myStatus, currentModulo);
    };

    ping();
    const interval = setInterval(ping, 18000);

    const handleUnload = () => {
      ChatService.updatePresence(currentUserLogin || currentUserId, "offline", currentModulo);
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [currentUserId, currentUserLogin, myStatus, currentModulo]);

  // Mudança de status pelo usuário
  const handleStatusChange = (newStatus) => {
    setMyStatus(newStatus);
    localStorage.setItem("zorion_my_status", newStatus);
    setStatusMenuOpen(false);
    ChatService.updatePresence(currentUserLogin || currentUserId, newStatus, currentModulo);
  };

  // Mudança explícita de módulo pelo usuário
  const handleModuleSelect = (mod) => {
    setManualModule(mod);
    localStorage.setItem("zorion_chat_selected_module", mod);
    setModuloMenuOpen(false);
    ChatService.updatePresence(currentUserLogin || currentUserId, myStatus, mod);
  };

  // Buscar lista de funcionários e contagem de DMs
  const fetchStaff = async () => {
    try {
      const list = await ChatService.listStaff(currentUserId);
      setStaffList(list);

      const dms = await ChatService.countUnreadDmsBySender(currentUserId, currentUserLogin);
      setUnreadDms(dms);
    } catch (e) {
      console.warn("Erro ao buscar equipe:", e);
    }
  };

  // Buscar contagem de não lidas por canal de aviso
  const fetchUnreadChannels = async () => {
    try {
      const res = await ChatService.countUnreadByChannels(currentUserId, currentModulo);
      setChannelUnread(res);
    } catch (e) {
      console.warn("Erro ao buscar não lidas de canais:", e);
    }
  };

  // Buscar conversas ativas privadas exclusivas do usuário logado
  const fetchUserConversations = async () => {
    if (!currentUserId && !currentUserLogin) return;
    try {
      setLoadingConversations(true);
      const list = await ChatService.listUserConversations(currentUserId, currentUserLogin);
      setUserConversations(list);
    } catch (e) {
      console.warn("Erro ao buscar conversas:", e);
    } finally {
      setLoadingConversations(false);
    }
  };

  // Buscar mensagens do canal ativo (apenas do canal atual com verificação de segurança)
  const fetchMessages = async () => {
    if (!currentCanal) return;
    try {
      const list = await ChatService.list(currentCanal, 100, currentUserId, currentUserLogin);
      setMessages(list);

      // Tocar som se mensagem nova não foi enviada por mim
      if (list.length > 0) {
        const last = list[list.length - 1];
        if (last && last.id !== lastMsgIdRef.current) {
          const isFromMe = 
            String(last.remetente_id || "").toLowerCase() === String(currentUserLogin).toLowerCase() || 
            String(last.remetente_id || "").toLowerCase() === String(currentUserId).toLowerCase() ||
            last.remetente_usuario === currentUser.nome;

          if (!isFromMe && lastMsgIdRef.current !== null) {
            playMessageReceivedSound();
          }
          lastMsgIdRef.current = last.id;
        }
      }

      // Atualizar contadores
      if (isOpen && currentCanal) {
        await ChatService.markAllAsRead(currentCanal, currentUserId, currentModulo, currentUserLogin);
      }
      
      await fetchUnreadChannels();
      const dms = await ChatService.countUnreadDmsBySender(currentUserId, currentUserLogin);
      setUnreadDms(dms);
    } catch (e) {
      console.warn("Erro ao carregar mensagens:", e);
    }
  };

  // Listeners em tempo real (Postgres LISTEN / NOTIFY e Polling)
  useEffect(() => {
    fetchMessages();
    fetchStaff();
    fetchUnreadChannels();
    fetchUserConversations();

    let unlistenUpdate;
    let unlistenChange;

    const setupListeners = async () => {
      try {
        unlistenUpdate = await listen("db_update", () => {
          fetchMessages();
          fetchStaff();
          fetchUnreadChannels();
          fetchUserConversations();
        });
        unlistenChange = await listen("db_change", () => {
          fetchMessages();
          fetchStaff();
          fetchUnreadChannels();
          fetchUserConversations();
        });
      } catch (e) {
        console.warn("Listeners chat aviso:", e);
      }
    };

    setupListeners();

    const msgTimer = setInterval(fetchMessages, isOpen && currentCanal ? 1800 : 4000);
    const staffTimer = setInterval(() => {
      fetchStaff();
      fetchUserConversations();
    }, 5000);

    return () => {
      if (unlistenUpdate) unlistenUpdate();
      if (unlistenChange) unlistenChange();
      clearInterval(msgTimer);
      clearInterval(staffTimer);
    };
  }, [isOpen, currentCanal, currentUserId, currentUserLogin]);

  useEffect(() => {
    if (isOpen && (activeTab === "dm" || activeTab === "canais") && currentCanal) {
      scrollToBottom();
      ChatService.markAllAsRead(currentCanal, currentUserId, currentModulo, currentUserLogin);
    }
  }, [messages, isOpen, activeTab, currentCanal]);

  // Envio de mensagem estritamente segura
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const texto = inputText.trim();
    if (!texto || isSending || !currentCanal) return;

    setIsSending(true);
    try {
      const cargoStr = currentUser.crf ? `CRF ${currentUser.crf}` : 
                       currentUser.crm ? `CRM ${currentUser.crm}` :
                       currentUser.cargo || currentModulo;

      const destKey = activeTab === "dm" && activeContact ? (activeContact.id || activeContact.login) : null;

      await ChatService.send({
        canal: currentCanal,
        mensagem: texto,
        remetente_id: currentUserLogin || currentUserId,
        remetente_modulo: currentModulo,
        remetente_usuario: currentUser.nome,
        remetente_cargo: cargoStr,
        destinatario_id: destKey,
        destinatario_nome: activeTab === "dm" && activeContact ? activeContact.nome : null,
        destinatario_modulo: activeTab === "dm" && activeContact ? activeContact.modulo_ativo : null
      });

      playMessageSentSound();
      setInputText("");
      await fetchMessages();
      await fetchUserConversations();
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

  // Abrir conversa a partir do item da lista de conversas
  const handleOpenConversation = (conv) => {
    const match = staffList.find(s => 
      String(s.login || "").toLowerCase() === String(conv.partnerId).toLowerCase() ||
      String(s.id || "").toLowerCase() === String(conv.partnerId).toLowerCase()
    );
    const contact = match || {
      id: conv.partnerId,
      login: conv.partnerId,
      nome: conv.partnerNome,
      modulo_ativo: conv.partnerModulo,
      cargo: conv.partnerCargo,
      status_online: "offline"
    };
    handleStartDm(contact);
  };

  // Total de não lidas para o badge do botão flutuante
  const totalUnreadBadge = (channelUnread?.total || 0) + (unreadDms?.total || 0);

  // Filtragem da lista de funcionários (evita o próprio usuário)
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
      (s.login || "").toLowerCase().includes(q) ||
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
              if (currentCanal) {
                ChatService.markAllAsRead(currentCanal, currentUserId, currentModulo, currentUserLogin);
              }
              fetchStaff();
              fetchUnreadChannels();
              fetchUserConversations();
            }
          }}
          title={isOpen ? "Fechar Chat Zorion" : "Zorion Chat - Conversas Privadas"}
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
                    setActiveTab("conversas");
                    setActiveContact(null);
                    fetchUserConversations();
                  }}
                  className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
                  title="Voltar para Minhas Conversas"
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
              // Topo no Modo Normal: Exibe identidade clara do usuário logado
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 text-white shadow-xs shrink-0">
                  <MessagesSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-black text-sm tracking-tight text-white flex items-center gap-1">
                      Zorion Chat
                    </h3>
                    <span 
                      title={`Seu login: @${currentUserLogin}`} 
                      className="text-[10px] bg-sky-400/25 text-sky-100 border border-sky-300/40 px-2 py-0.2 rounded-full font-bold truncate max-w-[150px]"
                    >
                      @{currentUserLogin}
                    </span>
                  </div>

                  {/* Seletor de Módulo Ativo do Usuário */}
                  <div className="relative inline-block mt-0.5">
                    <button
                      onClick={() => setModuloMenuOpen(!moduloMenuOpen)}
                      className="text-[10px] font-bold text-sky-100 hover:text-white flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-lg border border-white/15 transition-all cursor-pointer"
                      title="Clique para alternar seu módulo atual"
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

            {/* Ações do Topo Direito (Status do Usuário e Fechar) */}
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
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
                title="Minimizar Chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Abas Principais: Foco em Conversas Privadas por Usuário */}
          <div className="bg-slate-100/90 dark:bg-slate-800/80 px-2 py-1.5 border-b border-slate-200/80 dark:border-slate-700 flex items-center gap-1.5 shrink-0">
            
            {/* Aba 1: Minhas Conversas Privadas */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("conversas");
                setActiveContact(null);
                fetchUserConversations();
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === "conversas"
                  ? "bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
              title="Apenas as suas conversas privadas associadas ao seu login"
            >
              <MessageCircle className="w-3.5 h-3.5 text-sky-600" />
              <span>Conversas</span>
              {unreadDms?.total > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                  {unreadDms.total}
                </span>
              )}
            </button>

            {/* Aba 2: Nova Conversa / Lista de Equipe */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("equipe");
                setActiveContact(null);
                fetchStaff();
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === "equipe"
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
              title="Iniciar conversa privada com qualquer colaborador"
            >
              <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
              <span>Nova / Equipe</span>
            </button>

            {/* Aba 3: Mural Coletivo de Avisos */}
            <button
              type="button"
              onClick={() => {
                setActiveTab("canais");
                setActiveContact(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                activeTab === "canais"
                  ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
              title="Mural de avisos gerais entre setores"
            >
              <Megaphone className="w-3.5 h-3.5 text-amber-500" />
              <span>Mural</span>
              {channelUnread?.total > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full">
                  {channelUnread.total}
                </span>
              )}
            </button>

            {/* Indicador no Modo DM */}
            {activeTab === "dm" && activeContact && (
              <div className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-extrabold border border-indigo-200/60 flex items-center gap-1">
                <Lock className="w-3 h-3 text-indigo-500" />
                <span>Privado</span>
              </div>
            )}
          </div>

          {/* ================================================================= */}
          {/* CONTEÚDO PRINCIPAL: ABA "CONVERSAS" (INBOX PRIVADO DO USUÁRIO)    */}
          {/* ================================================================= */}
          {activeTab === "conversas" && (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50 dark:bg-slate-950/40">
              
              {/* Banner de Confidencialidade e Login */}
              <div className="px-3 py-2 bg-sky-50/80 dark:bg-sky-950/30 border-b border-sky-100 dark:border-sky-900/40 flex items-center justify-between text-[11px] text-sky-900 dark:text-sky-300">
                <div className="flex items-center gap-1.5 font-medium truncate">
                  <Lock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span className="truncate">
                    Chat Privado de: <strong>{currentUser.nome}</strong> (@{currentUserLogin})
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab("equipe")}
                  className="px-2 py-0.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                >
                  <MessageSquarePlus className="w-3 h-3" />
                  <span>Nova</span>
                </button>
              </div>

              {/* Lista de Conversas Recentes */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loadingConversations ? (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                    Carregando suas conversas...
                  </div>
                ) : userConversations.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-6 space-y-3">
                    <div className="w-14 h-14 rounded-3xl bg-sky-50 dark:bg-sky-950/50 border border-sky-100 dark:border-sky-900 flex items-center justify-center text-sky-500">
                      <Lock className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-700 dark:text-slate-200">
                        Nenhuma conversa ativa ainda
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-[260px] leading-relaxed">
                        Suas conversas são 100% privadas para o seu login (@{currentUserLogin}). Ninguém mais tem acesso a elas.
                      </p>
                    </div>
                    <Button
                      onClick={() => setActiveTab("equipe")}
                      size="sm"
                      className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl gap-1.5 cursor-pointer shadow-sm"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Iniciar Conversa com um Colega</span>
                    </Button>
                  </div>
                ) : (
                  userConversations.map((conv) => {
                    const matchStaff = staffList.find(s => 
                      String(s.login || "").toLowerCase() === String(conv.partnerId).toLowerCase() ||
                      String(s.id || "").toLowerCase() === String(conv.partnerId).toLowerCase()
                    );
                    const status = matchStaff?.status_online || "offline";

                    return (
                      <div
                        key={conv.partnerId}
                        onClick={() => handleOpenConversation(conv)}
                        className="group relative p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md cursor-pointer transition-all duration-200 flex items-center justify-between gap-3"
                      >
                        {/* Avatar com status */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-100 to-indigo-100 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center font-black text-sky-800 dark:text-slate-200 text-sm border border-slate-200 dark:border-slate-700 shadow-xs">
                              {(conv.partnerNome || "U").charAt(0).toUpperCase()}
                            </div>
                            <span 
                              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                                status === "online" ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" :
                                status === "ausente" ? "bg-amber-500" :
                                status === "ocupado" ? "bg-rose-500" : "bg-slate-300 dark:bg-slate-600"
                              }`}
                              title={status}
                            />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                                {conv.partnerNome}
                              </h4>
                              {renderModuloBadge(conv.partnerModulo)}
                            </div>

                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 max-w-[210px]">
                              {conv.lastMessageFromMe && <span className="font-semibold text-sky-600 dark:text-sky-400">Você: </span>}
                              {conv.lastMessage}
                            </p>
                          </div>
                        </div>

                        {/* Hora e Badge de Não Lidas */}
                        <div className="flex flex-col items-end shrink-0 gap-1">
                          <span className="text-[9px] text-slate-400 font-medium">
                            {formatHora(conv.lastMessageTime)}
                          </span>

                          {conv.unreadCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black shadow-xs animate-pulse">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ================================================================= */}
          {/* CONTEÚDO PRINCIPAL: ABA "EQUIPE & NOVA CONVERSA"                  */}
          {/* ================================================================= */}
          {activeTab === "equipe" && (
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
                    placeholder="Buscar colega por nome, cargo, CRM, CRF..."
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
                    const isSelf = 
                      (person.login && String(person.login).toLowerCase() === String(currentUserLogin).toLowerCase()) ||
                      (person.id && String(person.id).toLowerCase() === String(currentUserId).toLowerCase());

                    const unreadForPerson = unreadDms?.bySender?.[person.login] || unreadDms?.bySender?.[person.id] || 0;

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
                                <span className="bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-300 text-[9px] font-extrabold px-1.5 py-0.2 rounded-md">
                                  Você (@{currentUserLogin})
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
          )}

          {/* ================================================================= */}
          {/* CONTEÚDO PRINCIPAL: MURAL DE AVISOS GERAIS                        */}
          {/* ================================================================= */}
          {activeTab === "canais" && (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/60 dark:bg-slate-950/40">
              
              {/* Seletor dos Canais do Mural */}
              <div className="bg-white dark:bg-slate-900 px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 shadow-xs">
                {CHAT_CHANNELS.map((ch) => {
                  const isSelected = selectedChannelId === ch.id;
                  const unread = channelUnread?.byChannel?.[ch.id] || 0;

                  return (
                    <button
                      key={ch.id}
                      onClick={() => {
                        setSelectedChannelId(ch.id);
                        setMessages([]);
                        lastMsgIdRef.current = null;
                        ChatService.markAllAsRead(ch.id, currentUserId, currentModulo, currentUserLogin);
                      }}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 cursor-pointer shadow-xs ${
                        isSelected
                          ? "bg-slate-900 text-white shadow-md scale-102"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70"
                      }`}
                    >
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

              {/* Banner Informativo do Mural Público */}
              <div className="px-3 py-1.5 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-900/40 text-[10px] text-amber-800 dark:text-amber-300 flex items-center justify-between">
                <span>📢 <strong>Mural Público:</strong> Mensagens postadas aqui são visíveis para todos os operadores.</span>
                <span className="font-bold px-1.5 py-0.2 rounded bg-white/70 dark:bg-slate-900/70 shadow-2xs">
                  {activeChannelMeta?.tag}
                </span>
              </div>

              {/* Lista de Mensagens do Mural */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs p-6 space-y-2">
                    <MessagesSquare className="w-10 h-10 text-slate-300 animate-bounce" />
                    <p className="font-bold text-slate-700 dark:text-slate-200">
                      {activeChannelMeta?.nome}
                    </p>
                    <p className="text-[11px] max-w-xs leading-relaxed">
                      {activeChannelMeta?.descricao}
                    </p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = 
                      String(m.remetente_id || "").toLowerCase() === String(currentUserLogin).toLowerCase() ||
                      String(m.remetente_id || "").toLowerCase() === String(currentUserId).toLowerCase() ||
                      m.remetente_usuario === currentUser.nome;

                    return (
                      <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                        <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400 font-semibold">
                          {renderModuloBadge(m.remetente_modulo)}
                          <span>•</span>
                          <span className="text-slate-600 dark:text-slate-300 font-bold">
                            {m.remetente_usuario}
                          </span>
                        </div>
                        <div
                          className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs break-words shadow-2xs ${
                            isMe
                              ? "bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-tr-xs"
                              : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 rounded-tl-xs"
                          }`}
                        >
                          <p className="leading-relaxed whitespace-pre-wrap">{m.mensagem}</p>
                          <div className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${isMe ? "text-sky-100" : "text-slate-400"}`}>
                            <span>{formatHora(m.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Campo de Envio no Mural */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Postar aviso no canal ${activeChannelMeta?.nome}...`}
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

          {/* ================================================================= */}
          {/* CONTEÚDO PRINCIPAL: CHAT PRIVADO 1-A-1 (DM)                       */}
          {/* ================================================================= */}
          {activeTab === "dm" && activeContact && (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/60 dark:bg-slate-950/40">
              
              {/* Banner de Segurança: Ninguém vê esta conversa */}
              <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-100 dark:border-emerald-900/60 text-[10px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  <strong>Conversa Privada e Confidencial:</strong> Visível apenas para você (@{currentUserLogin}) e {activeContact.nome}.
                </span>
              </div>

              {/* Lista de Mensagens da Conversa Privada */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs p-6 space-y-2">
                    <UserCheck className="w-10 h-10 text-sky-500/50 animate-pulse" />
                    <p className="font-bold text-slate-700 dark:text-slate-200">
                      Conversa Direta com {activeContact?.nome}
                    </p>
                    <p className="text-[11px] max-w-xs leading-relaxed">
                      Envie uma mensagem abaixo. Este diálogo é estritamente confidencial e ninguém mais no hospital tem acesso.
                    </p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = 
                      String(m.remetente_id || "").toLowerCase() === String(currentUserLogin).toLowerCase() ||
                      String(m.remetente_id || "").toLowerCase() === String(currentUserId).toLowerCase() ||
                      m.remetente_usuario === currentUser.nome;

                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        {/* Remetente */}
                        <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400 font-semibold">
                          <span className="text-slate-600 dark:text-slate-300 font-bold">
                            {isMe ? "Você" : m.remetente_usuario}
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
                                  <span title="Visualizada" className="flex items-center text-sky-300 drop-shadow-[0_0_2px_rgba(56,189,248,0.8)]">
                                    <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                                  </span>
                                ) : (
                                  <span title="Enviada" className="flex items-center text-white/70">
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

              {/* Campo de Envio de Mensagem Privada */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Mensagem privada para ${activeContact.nome}...`}
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

export default ZorionChatWidget;
