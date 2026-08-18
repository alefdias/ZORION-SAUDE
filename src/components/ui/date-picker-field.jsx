import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { CalendarIcon } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function DatePickerField({ label, required, value, onChange, className, disabled, id, errorClass }) {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState("");

    // Update local input string when external value changes
    useEffect(() => {
        if (!value) {
            setInputValue("");
            return;
        }
        try {
            const d = parse(value, "yyyy-MM-dd", new Date());
            if (isValid(d)) {
                setInputValue(format(d, "dd/MM/yyyy"));
            }
        } catch {
            setInputValue("");
        }
    }, [value]);

    // Handle manual typing
    const handleInputChange = (e) => {
        let val = e.target.value.replace(/[^0-9/]/g, ""); // Allow only numbers and slashes
        setInputValue(val);

        // Try to parse "DD/MM/YYYY" or "DDMMYYYY"
        if (val.length === 10 && /^\d{2}\/\d{2}\/\d{4}$/.test(val)) {
            const parsed = parse(val, "dd/MM/yyyy", new Date());
            if (isValid(parsed)) {
                const y = parsed.getFullYear();
                const m = String(parsed.getMonth() + 1).padStart(2, "0");
                const d = String(parsed.getDate()).padStart(2, "0");
                onChange(`${y}-${m}-${d}`);
            }
        } else if (val === "") {
            onChange("");
        }
    };

    const handleBlur = () => {
        // Formata e revalida ao perder o foco
        if (!inputValue) {
            onChange("");
            return;
        }
        const parsed = parse(inputValue, "dd/MM/yyyy", new Date());
        if (isValid(parsed) && inputValue.length === 10) {
            // já está ok
        } else {
            // Volta pro valor anterior válido
            if (value) {
                const d = parse(value, "yyyy-MM-dd", new Date());
                if (isValid(d)) setInputValue(format(d, "dd/MM/yyyy"));
            } else {
                setInputValue("");
            }
        }
    };

    const parseDateFromValue = (str) => {
        if (!str) return undefined;
        try {
            const d = parse(str, "yyyy-MM-dd", new Date());
            return isValid(d) ? d : undefined;
        } catch {
            return undefined;
        }
    };

    const selected = parseDateFromValue(value);

    const handleSelect = (date) => {
        if (!date) {
            onChange("");
            setOpen(false);
            return;
        }
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        onChange(`${y}-${m}-${d}`);
        setInputValue(format(date, "dd/MM/yyyy"));
        setOpen(false);
    };

    return (
        <div className="flex flex-col gap-1.5">
            {label && (
                <Label htmlFor={id} className="flex items-center gap-1">
                    {label}
                    {required && <span className="text-red-500">*</span>}
                </Label>
            )}
            <div className="relative flex items-center">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={disabled}
                            className="absolute left-1 z-10 text-slate-400 hover:text-emerald-600 hover:bg-slate-100/50"
                        >
                            <CalendarIcon className="w-4 h-4" />
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
                
                <Input
                    id={id}
                    type="text"
                    placeholder="DD/MM/AAAA"
                    value={inputValue}
                    onChange={handleInputChange}
                    onBlur={handleBlur}
                    disabled={disabled}
                    maxLength={10}
                    className={cn("pl-10 h-9", errorClass, className)}
                />
            </div>
        </div>
    );
}
