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
    placeholder = "Selecione o medicamento..."
}) {
    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")

    // O componente recebe os medicamentos inteiros como options
    const selectedMed = medicamentos.find((m) => m.id === value);

    const filteredMedicamentos = React.useMemo(() => {
        if (!search) return medicamentos.slice(0, 100);
        const term = search.toLowerCase();
        return medicamentos.filter(m => {
            const nomeStr = m.nome ? String(m.nome).toLowerCase() : "";
            const codigoStr = m.codigo ? String(m.codigo).toLowerCase() : "";
            return nomeStr.includes(term) || codigoStr.includes(term);
        }).slice(0, 100);
    }, [medicamentos, search]);

    const padronizados = React.useMemo(() => filteredMedicamentos.filter(m => m.padronizado), [filteredMedicamentos]);
    const naoPadronizados = React.useMemo(() => filteredMedicamentos.filter(m => !m.padronizado), [filteredMedicamentos]);

    const formatMedLabel = (m) => {
        if (!m) return "";
        const dose = (m.concentracao || (m.unidade_medida && !["un", "unidade", "unid", "-", ""].includes(m.unidade_medida.toLowerCase()) ? m.unidade_medida : "")).trim();
        const apres = m.apresentacao ? ` [${m.apresentacao}]` : "";
        const doseStr = dose ? ` - ${dose}` : "";
        return `${m.nome}${apres}${doseStr}`;
    };

    const renderItem = (m) => {
        const hasSatelite = Number(m.estoque_satelite || 0) > 0;
        
        return (
            <CommandItem
                key={m.id}
                value={m.id} // value passes through filter
                onSelect={(selectedVal) => {
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
                    value === m.id ? "bg-emerald-50 text-emerald-900 data-[selected=true]:bg-emerald-100" : "data-[selected=true]:bg-slate-100"
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
                        isMav(m) && "text-red-900 font-bold",
                        !isMav(m) && hasSatelite ? "text-emerald-700 font-bold" : "text-slate-800"
                    )} title={formatMedLabel(m)}>
                        {formatMedLabel(m)}
                        {isMav(m) && " (MAV)"}
                    </span>
                </div>
                {value === m.id && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600 shrink-0" />
                )}
            </CommandItem>
        );
    };

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
