import React, { useState, useEffect, useRef } from "react";
import { 
  MessagesSquare, 
  X, 
  Send, 
  Sparkles, 
  Building2, 
  User, 
  CheckCheck,
  Minimize2,
  Smile
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatService } from "@/api/chatService";
import { listen } from "@tauri-apps/api/event";

// Alerta sonoro agradável para nova mensagem recebida
function playChatChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn("Chime chat:", e);
  }
}

export function ZorionChatWidget({ activeSection }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Identificação do usuário logado e do módulo no Zorion Saúde
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem("axion_active_user") || localStorage.getItem("pharma_user");
      if (stored) {
        const u = JSON.parse(stored);
        return {
          nome: u.nome || u.username || u.login || "Farmacêutico(a)",
          cargo: u.cargo || u.perfil || "Farmácia"
        };
      }
    } catch {}
    return { nome: "Farmacêutico(a)", cargo: "Farmácia" };
  });

  // Módulo de origem no Zorion Saúde (default: Farmácia Satélite)
  const currentModulo = activeSection?.id === "satelite" ? "Farmácia Satélite" : (activeSection?.name || "Farmácia Satélite");
  const canalAtivo = "farmacia_recepcao";

  const messagesEndRef = useRef(null);
  const lastMessageCountRef = useRef(0);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    try {
      const list = await ChatService.list(canalAtivo, 100);
      setMessages(list);

      // Se houver novas mensagens e a janela estiver fechada
      if (list.length > lastMessageCountRef.current) {
        const lastMsg = list[list.length - 1];
        if (lastMsg && lastMsg.remetente_modulo !== currentModulo) {
          playChatChime();
        }
      }
      lastMessageCountRef.current = list.length;

      if (!isOpen) {
        const count = await ChatService.countUnread(canalAtivo, currentModulo);
        setUnreadCount(count);
      } else {
        await ChatService.markAllAsRead(canalAtivo, currentModulo);
        setUnreadCount(0);
      }
    } catch (e) {
      console.warn("Erro ao carregar mensagens:", e);
    }
  };

  // Carrega ao montar e escuta eventos do PostgreSQL via Tauri
  useEffect(() => {
    fetchMessages();

    let unlistenUpdate;
    let unlistenChange;

    const setupListeners = async () => {
      try {
        unlistenUpdate = await listen("db_update", () => {
          fetchMessages();
        });
        unlistenChange = await listen("db_change", () => {
          fetchMessages();
        });
      } catch (e) {
        console.warn("Aviso ao vincular listeners do chat:", e);
      }
    };

    setupListeners();

    // Polling contínuo de 1.5s como garantia extra para entrega no mesmo instante
    const timer = setInterval(() => {
      fetchMessages();
    }, 1500);

    return () => {
      if (unlistenUpdate) unlistenUpdate();
      if (unlistenChange) unlistenChange();
      clearInterval(timer);
    };
  }, [isOpen, currentModulo]);

  // Sempre que as mensagens atualizarem ou abrir o chat, rola até o fim
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      ChatService.markAllAsRead(canalAtivo, currentModulo).then(() => setUnreadCount(0));
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const texto = inputText.trim();
    if (!texto || isSending) return;

    setIsSending(true);
    try {
      await ChatService.send({
        canal: canalAtivo,
        mensagem: texto,
        remetente_modulo: currentModulo,
        remetente_usuario: currentUser.nome,
        remetente_cargo: currentUser.cargo
      });
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

  const formatHora = (isoStr) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <>
      {/* Botão Flutuante no Canto Inferior Direito (Apenas Ícone Bonito e Grande) */}
      <div className="fixed bottom-4 right-4 z-50 flex items-center print:hidden no-print">
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) {
              setUnreadCount(0);
              ChatService.markAllAsRead(canalAtivo, currentModulo);
            }
          }}
          title={isOpen ? "Fechar Chat Zorion" : "Chat Zorion"}
          className={`group relative flex items-center justify-center w-14 h-14 rounded-full shadow-[0_10px_28px_rgba(2,132,199,0.45)] hover:shadow-[0_14px_38px_rgba(2,132,199,0.65)] hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer border-2 border-white/90 backdrop-blur-md ${
            isOpen
              ? "bg-slate-900 text-white"
              : "bg-gradient-to-tr from-sky-600 via-sky-500 to-blue-600 text-white"
          }`}
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white transition-transform duration-200 group-hover:rotate-90" />
          ) : (
            <MessagesSquare className="w-7 h-7 text-white transition-transform duration-200 group-hover:scale-110" />
          )}

          {/* Indicador de Status Online */}
          {!isOpen && (
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-400 border-2 border-white rounded-full shadow-xs"></span>
          )}

          {/* Badge de Mensagens Não Lidas */}
          {unreadCount > 0 && !isOpen && (
            <span className="absolute -top-1.5 -left-1.5 flex h-5.5 min-w-5.5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-black text-white ring-2 ring-white shadow-lg animate-bounce">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Janela do Chat Zorion */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-[380px] sm:w-[420px] max-w-[calc(100vw-32px)] h-[530px] max-h-[calc(100vh-100px)] bg-white rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200 print:hidden no-print">
          
          {/* Cabeçalho do Chat */}
          <div className="px-4 py-3 bg-gradient-to-r from-sky-700 via-sky-600 to-cyan-600 text-white flex items-center justify-between shrink-0 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xs">
                <MessagesSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm tracking-tight text-white leading-none">
                    Chat Zorion
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 px-1.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-sky-100 font-medium leading-none mt-1">
                  Farmácia Satélite ↔ Recepção
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsOpen(false)}
                title="Minimizar Chat"
                className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Área de Mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/80">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mb-3">
                  <MessagesSquare className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-700 text-sm">Nenhuma mensagem ainda</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[240px]">
                  Inicie a comunicação em tempo real entre a Farmácia Satélite e a Recepção!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.remetente_modulo === currentModulo;
                const isRecepcao = msg.remetente_modulo === "Recepção";

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-full`}
                  >
                    {/* Identificação do Remetente (quando for do outro módulo) */}
                    {!isMe && (
                      <div className="flex items-center gap-1.5 mb-1 px-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isRecepcao
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-sky-50 text-sky-700 border-sky-200"
                        }`}>
                          {msg.remetente_modulo}
                        </span>
                        <span className="text-[11px] font-bold text-slate-700">
                          {msg.remetente_usuario}
                        </span>
                      </div>
                    )}

                    {/* Balão da Mensagem */}
                    <div
                      className={`relative px-3.5 py-2.5 rounded-2xl max-w-[85%] text-xs shadow-xs break-words ${
                        isMe
                          ? "bg-sky-600 text-white rounded-tr-xs"
                          : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-xs"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed select-text font-normal">
                        {msg.mensagem}
                      </p>
                      <div
                        className={`flex items-center justify-end gap-1 text-[10px] mt-1 font-medium ${
                          isMe ? "text-sky-100" : "text-slate-400"
                        }`}
                      >
                        <span>{formatHora(msg.created_at)}</span>
                        {isMe && <CheckCheck className="w-3.5 h-3.5 text-sky-200" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Rodapé / Input de Digitação */}
          <div className="p-3 bg-white border-t border-slate-200/80 shrink-0">
            <div className="text-[10px] text-slate-400 mb-1.5 px-1 flex items-center justify-between">
              <span>
                Enviando como: <strong className="text-slate-700 font-semibold">{currentUser.nome}</strong> ({currentModulo})
              </span>
              <span className="text-[9px] text-slate-400 hidden sm:inline">Enter envia</span>
            </div>

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem para a Recepção..."
                className="flex-1 px-3.5 py-2 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 transition-all"
                disabled={isSending}
                autoFocus={isOpen}
              />
              <Button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl px-3.5 py-2 h-9 text-xs font-bold gap-1 shadow-sm shrink-0 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>

        </div>
      )}
    </>
  );
}
