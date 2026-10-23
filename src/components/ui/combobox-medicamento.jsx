import { normalizeSearch } from "@/utils/searchUtils";
import * as React from "react"
import { Check, ChevronsUpDown, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { isMav, isPsicotropico } from "@/utils/mavUtils"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

export function ComboboxMedicamento({
    medicamentos = [],
    value,
    onChange,
    placeholder = "Selecione o medicamento...",
    stockMode = "satelite", // "satelite" | "central" | "none"
    blockZeroStock = false
}) {
    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")

    // O componente recebe os medicamentos inteiros como options
    const selectedMed = medicamentos.find((m) => m.id === value);

    const filteredMedicamentos = React.useMemo(() => {
        if (!search || !search.trim()) return medicamentos.slice(0, 100);
        const term = normalizeSearch(search);
        const terms = term.split(/\s+/).filter(Boolean);
        return medicamentos.filter(m => {
            const fullText = normalizeSearch(`${m.nome || ""} ${m.codigo || ""} ${m.concentracao || ""} ${m.unidade_medida || ""} ${m.apresentacao || ""}`);
            return terms.every(t => fullText.includes(t));
        }).slice(0, 100);
    }, [medicamentos, search]);

    const padronizados = React.useMemo(() => filteredMedicamentos.filter(m => m.padronizado), [filteredMedicamentos]);
    const naoPadronizados = React.useMemo(() => filteredMedicamentos.filter(m => !m.padronizado), [filteredMedicamentos]);

    const formatMedLabel = (m) => {
        if (!m) return "";
        const dose = (m.concentracao || (m.unidade_medida && !["un", "unidade", "unid", "-", ""].includes(m.unidade_medida.toLowerCase()) ? m.unidade_medida : "")).trim();
        const apres = m.apresentacao ? ` [${m.apresentacao}]` : "";
        const doseStr = dose ? ` - ${dose}` : "";
        return `${m.nome}${doseStr}${apres}`;
    };

    const renderItem = (m) => {
        const isCentral = stockMode === "central";
        const stockVal = isCentral ? (Number(m.estoque_atual) || 0) : (Number(m.estoque_satelite) || 0);
        const hasStock = stockVal > 0;
        const isBlocked = blockZeroStock && !hasStock;

        return (
            <CommandItem
                key={m.id}
                value={m.id} // value passes through filter
                disabled={isBlocked}
                onSelect={(selectedVal) => {
                    if (isBlocked) return;
                    // Cmdk returns the internal lowercase value representing the id if there are uppercase on id (ex utils.uuid)
                    // We must match it back to the original case if our ids have case sensitivity
                    const correctMed = medicamentos.find(med => med.id.toLowerCase() === selectedVal || med.id === selectedVal);
                    if (correctMed) {
                        onChange(correctMed.id === value ? "" : correctMed.id)
                    } else {
                        onChange(selectedVal === value ? "" : selectedVal)
                    }
                    setOpen(false)
                }}
                className={cn(
                    "flex flex-col items-start px-3 py-2 text-sm cursor-pointer rounded-sm w-full max-w-full my-0.5 relative min-w-0 overflow-hidden",
                    isBlocked && "opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-900/40 select-none",
                    !isBlocked && value === m.id ? "bg-emerald-50 text-emerald-900 data-[selected=true]:bg-emerald-100" : !isBlocked ? "data-[selected=true]:bg-slate-100" : ""
                )}
            >
                <div className="flex items-start gap-2 w-full max-w-full min-w-0 pr-6">
                    {m.codigo && (
                        <span className="font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 uppercase shrink-0 text-slate-600 mt-0.5">
                            {m.codigo}
                        </span>
                    )}
                    {m.is_adiantamento && (
                        <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-semibold px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                            💳 Adiantamento
                        </span>
                    )}
                    {isPsicotropico(m.grupo_terapeutico) && (
                        <User className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" title="Requer nome do paciente" />
                    )}
                    <span className={cn(
                        "break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word] text-xs leading-snug flex-1 text-left min-w-0",
                        isBlocked && "text-slate-400 line-through",
                        !isBlocked && isMav(m) && "text-red-900 font-bold",
                        !isBlocked && !isMav(m) && hasStock ? "text-emerald-700 font-bold" : !isBlocked ? "text-slate-800" : ""
                    )} title={formatMedLabel(m)}>
                        {formatMedLabel(m)}
                        {isMav(m) && " (MAV)"}
                    </span>
                    {stockMode !== "none" && (
                        <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ml-auto whitespace-nowrap",
                            hasStock
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-red-50 text-red-600 border border-red-200"
                        )}>
                            {isCentral ? "Central: " : "Sat: "}{stockVal} un{hasStock ? "" : " (Zerado)"}
                        </span>
                    )}
                </div>
                {value === m.id && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600 shrink-0" />
                )}
            </CommandItem>
        );
    };

    const isCentralMode = stockMode === "central";
    const selectedStock = selectedMed 
        ? (isCentralMode ? (Number(selectedMed.estoque_atual) || 0) : (Number(selectedMed.estoque_satelite) || 0))
        : 0;

    return (
        <Popover open={open} onOpenChange={setOpen} modal={true}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full max-w-full justify-between font-normal h-auto min-h-10 text-left px-3 py-2 bg-white min-w-0 !whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word] overflow-hidden"
                >
                    {selectedMed ? (
                        <div className="flex items-start gap-2 min-w-0 flex-1 flex-wrap py-0.5 w-full">
                            {selectedMed.codigo && (
                                <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded uppercase shrink-0 text-slate-600 border border-slate-200 mt-0.5">
                                    {selectedMed.codigo}
                                </span>
                            )}
                            {selectedMed.is_adiantamento && (
                                <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-300 font-semibold px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                                    💳 Adiantamento
                                </span>
                            )}
                            {isPsicotropico(selectedMed.categoria) && (
                                <User className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" title="Requer nome do paciente" />
                            )}
                            <span className={cn("break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word] text-xs leading-snug flex-1 text-left min-w-0", isMav(selectedMed) && "text-red-900 font-bold")} title={formatMedLabel(selectedMed)}>
                                {formatMedLabel(selectedMed)}
                                {isMav(selectedMed) && " (MAV)"}
                            </span>
                            {stockMode !== "none" && (
                                <span className={cn(
                                    "text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 border mt-0.5",
                                    selectedStock > 0
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                        : "bg-red-50 text-red-600 border-red-200"
                                )}>
                                    {isCentralMode ? `Saldo Central: ${selectedStock} un` : `Saldo Satélite: ${selectedStock} un`}
                                    {selectedStock <= 0 ? " (Zerado)" : ""}
                                </span>
                            )}
                        </div>
                    ) : (
                        <span className="text-muted-foreground truncate">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent 
                className="w-[--radix-popover-trigger-width] max-w-[calc(100vw-2rem)] p-0 shadow-xl border-slate-200 overflow-hidden" 
                align="start"
                sideOffset={4}
                collisionPadding={10}
            >
                <Command shouldFilter={false} className="w-full max-w-full overflow-hidden">
                    <CommandInput 
                        placeholder="Buscar por código ou nome..." 
                        className="h-10 text-sm w-full" 
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandEmpty className="py-6 text-center text-sm text-slate-500">Nenhum medicamento encontrado.</CommandEmpty>
                    <CommandList
                        className="max-h-[250px] overflow-y-auto w-full max-w-full overflow-x-hidden"
                        onWheel={(e) => e.stopPropagation()}
                    >
                        {padronizados.length > 0 && (
                            <CommandGroup heading="Padronizados" className="px-1 py-1 font-semibold text-slate-700">
                                {padronizados.map(renderItem)}
                            </CommandGroup>
                        )}
                        {naoPadronizados.length > 0 && (
                            <CommandGroup heading="Não Padronizados" className="px-1 py-1 font-semibold text-slate-700 mt-2">
                                {naoPadronizados.map(renderItem)}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
