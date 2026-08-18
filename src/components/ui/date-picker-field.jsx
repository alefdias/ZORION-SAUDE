import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { CalendarIcon } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

/**
 * DatePickerField — campo de seleção de data com calendário pop-up.
 * 
 * Props:
 *  - label: string — rótulo do campo
 *  - required: bool — exibe asterisco vermelho
 *  - value: string — data no formato "YYYY-MM-DD"
 *  - onChange: (value: string) => void — callback com a data em "YYYY-MM-DD"
 *  - className: string — classes extras para o botão
 *  - disabled: bool
 *  - id: string
 */
export function DatePickerField({ label, required, value, onChange, className, disabled, id, errorClass }) {
    const [open, setOpen] = useState(false);

    // Converter string "YYYY-MM-DD" → Date object
    const parseDate = (str) => {
        if (!str) return undefined;
        try {
            const d = parse(str, "yyyy-MM-dd", new Date());
            return isValid(d) ? d : undefined;
        } catch {
            return undefined;
        }
    };

    const selected = parseDate(value);

    const handleSelect = (date) => {
        if (!date) {
            onChange("");
            setOpen(false);
            return;
        }
        // Formatar como "YYYY-MM-DD" (sem fuso horário)
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        onChange(`${y}-${m}-${d}`);
        setOpen(false);
    };

    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <Label htmlFor={id} className="flex items-center gap-1">
                    <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                    {label}
                    {required && <span className="text-red-500">*</span>}
                </Label>
            )}
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id={id}
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        className={cn(
                            "w-full justify-start text-left font-normal h-9 px-3",
                            !selected && "text-muted-foreground",
                            errorClass,
                            className
                        )}
                    >
                        {selected
                            ? format(selected, "dd/MM/yyyy")
                            : <span className="text-slate-400 text-sm">Selecionar data...</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start" side="bottom">
                    <Calendar
                        mode="single"
                        selected={selected}
                        onSelect={handleSelect}
                        initialFocus
                        locale={ptBR}
                        defaultMonth={selected}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}
