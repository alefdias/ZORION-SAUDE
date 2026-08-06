import { parseISO, isValid, differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Clock, XCircle, ChevronRight, X, Calendar, Package, Hash, Printer } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

const alertConfig = {
    vencidos: {
        title: "Medicamentos Vencidos",
        icon: XCircle,
        color: "text-red-600",
        bg: "bg-red-50",
        border: "border-red-200",
        headerBg: "bg-red-600",
        badgeBg: "bg-red-100 text-red-700",
    },
    vencimento: {
        title: "Próximos ao Vencimento (4 meses)",
        icon: Clock,
        color: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-200",
        headerBg: "bg-amber-600",
        badgeBg: "bg-amber-100 text-amber-700",
    },
    estoque_baixo: {
        title: "Estoque Baixo",
        icon: AlertTriangle,
        color: "text-orange-600",
        bg: "bg-orange-50",
        border: "border-orange-200",
        headerBg: "bg-orange-600",
        badgeBg: "bg-orange-100 text-orange-700",
    },
};

const getDaysColor = (days) => {
    if (days < 0) return "text-red-700 bg-red-100 border border-red-200";
    if (days <= 30) return "text-red-600 bg-red-50 border border-red-200";
    if (days <= 60) return "text-orange-600 bg-orange-50 border border-orange-200";
    return "text-amber-600 bg-amber-50 border border-amber-200";
};

function AlertModal({ type, items, onClose }) {
    const config = alertConfig[type] || alertConfig.estoque_baixo;
    const Icon = config.icon;

    return (
        <div className="print-modal-wrapper fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Overlay */}
            <div
                className="print-overlay absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="print-modal-content relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className={`${config.headerBg} text-white px-6 py-4 flex items-center justify-between flex-shrink-0 no-print-bg`}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg leading-tight">{config.title}</h2>
                            <p className="text-white/70 text-xs">{items.length} {items.length === 1 ? "item encontrado" : "itens encontrados"}</p>
                        </div>
                    </div>
                    <div className="flex gap-2 no-print">
                        <button
                            onClick={() => window.print()}
                            className="h-8 px-3 rounded bg-white/20 hover:bg-white/30 flex items-center gap-2 text-xs font-semibold transition-colors text-white"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            Imprimir
                        </button>
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                        >
                            <X className="w-4 h-4 text-white" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="print-scroll-area overflow-y-auto flex-1">
                    {type === "estoque_baixo" ? (
                        <table className="w-full">
                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-1"><Package className="w-3 h-3" /> Medicamento</div>
                                    </th>
                                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Atual</th>
                                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Mínimo</th>
                                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items.map((item, i) => (
                                    <tr key={i} className="hover:bg-orange-50/50 transition-colors">
                                        <td className="py-3 px-4 font-medium text-slate-700 text-sm">{item.nome}</td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="font-bold text-red-700">{item.atual}</span>
                                        </td>
                                        <td className="py-3 px-4 text-center text-slate-500 text-sm">{item.minimo}</td>
                                        <td className="py-3 px-4 text-center">
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${item.atual === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                {item.atual === 0 ? "ZERADO" : "CRÍTICO"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="w-full">
                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-1"><Package className="w-3 h-3" /> Medicamento</div>
                                    </th>
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        <div className="flex items-center gap-1"><Hash className="w-3 h-3" /> Lote</div>
                                    </th>
                                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        <div className="flex items-center justify-center gap-1"><Calendar className="w-3 h-3" /> Validade</div>
                                    </th>
                                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        <div className="flex items-center justify-center gap-1"><Package className="w-3 h-3" /> Qtd.</div>
                                    </th>
                                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Dias</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {items
                                    .slice()
                                    .sort((a, b) => {
                                        const da = a.validade ? parseISO(a.validade) : null;
                                        const db = b.validade ? parseISO(b.validade) : null;
                                        if (!da) return 1;
                                        if (!db) return -1;
                                        return da - db;
                                    })
                                    .map((item, i) => {
                                        const validadeDate = item.validade ? parseISO(item.validade) : null;
                                        const daysLeft = validadeDate && isValid(validadeDate)
                                            ? differenceInDays(validadeDate, new Date())
                                            : null;

                                        return (
                                            <tr key={i} className="hover:bg-amber-50/40 transition-colors">
                                                <td className="py-3 px-4 font-medium text-slate-700 text-sm">{item.nome || item.medicamento}</td>
                                                <td className="py-3 px-4 text-slate-500 text-xs font-mono">{item.lote || "—"}</td>
                                                <td className="py-3 px-4 text-center text-xs text-slate-600">
                                                    {validadeDate && isValid(validadeDate)
                                                        ? format(validadeDate, "dd/MM/yyyy", { locale: ptBR })
                                                        : "—"}
                                                </td>
                                                <td className="py-3 px-4 text-center text-sm font-bold text-slate-800">
                                                    {item.qtd !== undefined ? item.qtd : "—"}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    {daysLeft !== null && (
                                                        <span className={`shrink-0 font-bold px-2 py-1 rounded text-[10px] ${getDaysColor(daysLeft)}`}>
                                                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d atrás` : `${daysLeft}d`}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AlertCard({ type, items = [] }) {
    const [modalAberto, setModalAberto] = useState(false);
    const config = alertConfig[type] || alertConfig.estoque_baixo;
    const Icon = config.icon;

    const getDaysColorInline = (days) => {
        if (days < 0) return "text-red-700 bg-red-100";
        if (days <= 30) return "text-red-600 bg-red-50 border border-red-200";
        if (days <= 60) return "text-orange-600 bg-orange-50 border border-orange-200";
        return "text-amber-600 bg-amber-50 border border-amber-200";
    };

    if (items.length === 0) {
        return (
            <Card className={`p-4 border ${config.border} ${config.bg} shadow-sm`}>
                <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-5 h-5 ${config.color}`} />
                    <h3 className={`font-semibold text-sm ${config.color}`}>{config.title}</h3>
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>0</span>
                </div>
                <p className="text-sm text-slate-400">Nenhum item encontrado.</p>
            </Card>
        );
    }

    return (
        <>
            <Card className={`p-4 border ${config.border} ${config.bg} shadow-sm`}>
                <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-5 h-5 ${config.color}`} />
                    <h3 className={`font-semibold text-sm ${config.color}`}>{config.title}</h3>
                    <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${config.badgeBg}`}>
                        {items.length}
                    </span>
                </div>
                <ul className="space-y-1">
                    {items.slice(0, 5).map((item, i) => {
                        const validadeDate = item.validade ? parseISO(item.validade) : null;
                        const daysLeft = validadeDate && isValid(validadeDate)
                            ? differenceInDays(validadeDate, new Date())
                            : null;

                        return (
                            <li key={i} className="text-xs text-slate-600 flex justify-between items-center gap-2">
                                <span className="truncate">• {item.nome || item.medicamento || `Item ${i + 1}`}</span>
                                {(type === "vencimento" || type === "vencidos") && daysLeft !== null && (
                                    <span className={`shrink-0 font-bold px-1.5 py-0.5 rounded text-[10px] ${getDaysColorInline(daysLeft)}`}>
                                        {daysLeft < 0 ? "Vencido" : `${daysLeft} dias`}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>

                {items.length > 5 && (
                    <button
                        onClick={() => setModalAberto(true)}
                        className={`mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border ${config.border} ${config.bg} ${config.color} text-xs font-semibold hover:brightness-95 transition-all cursor-pointer`}
                    >
                        Ver todos os {items.length} itens
                        <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                )}

                {items.length > 0 && items.length <= 5 && (
                    <button
                        onClick={() => setModalAberto(true)}
                        className={`mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs ${config.color} hover:underline transition-all cursor-pointer opacity-70`}
                    >
                        Ver detalhes
                        <ChevronRight className="w-3 h-3" />
                    </button>
                )}
            </Card>

            {modalAberto && (
                <AlertModal
                    type={type}
                    items={items}
                    onClose={() => setModalAberto(false)}
                />
            )}
            <style>{`
                @media print {
                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                    }
                    body * {
                        visibility: hidden;
                    }
                    .print-modal-wrapper, .print-modal-wrapper * {
                        visibility: visible;
                    }
                    
                    /* O segredo para não remontar linha é transformar TUDO que for pai da tabela em display: block e remover position fixo/absoluto onde não deve */
                    .print-modal-wrapper {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        display: block !important; 
                        width: 100% !important;
                        height: auto !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .print-overlay {
                        display: none !important;
                    }
                    .print-modal-content {
                        position: relative !important;
                        display: block !important;
                        width: 100% !important;
                        height: auto !important;
                        max-height: none !important;
                        overflow: visible !important;
                        transform: none !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                    }
                    .print-scroll-area {
                        overflow: visible !important;
                        display: block !important;
                        height: auto !important;
                        flex: none !important;
                    }

                    .no-print {
                        display: none !important;
                    }
                    .no-print-bg {
                        -webkit-print-color-adjust: exact;
                        color-adjust: exact;
                    }
                    
                    /* Configurações específicas de tabela para quebrar página certo */
                    table { 
                        border-collapse: collapse !important; 
                        width: 100% !important; 
                        page-break-inside: auto !important; 
                    }
                    tr { 
                        page-break-inside: avoid !important; 
                        page-break-after: auto !important; 
                    }
                    thead { 
                        display: table-header-group !important; 
                    }
                    th, td { 
                        border: 1px solid #ddd !important; 
                        padding: 8px !important; 
                    }
                }
            `}</style>
        </>
    );
}
