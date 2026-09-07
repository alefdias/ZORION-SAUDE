import * as React from "react";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function ComboboxFornecedor({
  fornecedores = [],
  value,
  onChange,
  placeholder = "Selecione o fornecedor..."
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selectedForn = React.useMemo(() => {
    return fornecedores.find((f) => f.id === value);
  }, [fornecedores, value]);

  const filteredFornecedores = React.useMemo(() => {
    if (!search.trim()) return fornecedores.slice(0, 80);
    const term = search.toLowerCase();
    const cleanDigits = term.replace(/[^0-9]/g, "");

    return fornecedores.filter(f => {
      const nomeStr = (f.nome || f.razao_social || "").toLowerCase();
      const cnpjClean = (f.cnpj || "").replace(/[^0-9]/g, "");
      const munStr = (f.municipio || "").toLowerCase();
      const ufStr = (f.uf || "").toLowerCase();

      return (
        nomeStr.includes(term) ||
        munStr.includes(term) ||
        ufStr === term ||
        (cleanDigits.length >= 3 && cnpjClean.includes(cleanDigits))
      );
    }).slice(0, 80);
  }, [fornecedores, search]);

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal text-left h-10 px-3 bg-white border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2 truncate overflow-hidden">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <span className={cn("truncate text-sm", !selectedForn && "text-muted-foreground")}>
              {selectedForn 
                ? (selectedForn.razao_social || selectedForn.nome) 
                : placeholder}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[340px] max-w-[95vw] p-0 shadow-2xl border border-slate-200 z-50 bg-white"
        align="start"
        onWheel={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false} className="w-full">
          <CommandInput
            placeholder="Buscar distribuidora por Razão Social, CNPJ ou Cidade..."
            value={search}
            onValueChange={setSearch}
            className="h-10 text-sm"
          />
          <CommandList
            className="max-h-[260px] overflow-y-auto w-full overscroll-contain select-none"
            onWheel={(e) => e.stopPropagation()}
          >
            <CommandEmpty className="py-6 text-center text-sm text-slate-500">
              Nenhuma distribuidora encontrada.
            </CommandEmpty>
            <CommandGroup heading={`Distribuidoras (${fornecedores.length.toLocaleString('pt-BR')} cadastradas)`} className="px-1 py-1 font-semibold text-slate-700">
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onChange("__none__");
                  setOpen(false);
                }}
                className="cursor-pointer text-slate-500 italic py-2 text-xs"
              >
                — Nenhum / Remover Fornecedor —
              </CommandItem>

              {filteredFornecedores.map((forn) => {
                const isSelected = forn.id === value;
                return (
                  <CommandItem
                    key={forn.id}
                    value={forn.id}
                    onSelect={() => {
                      onChange(forn.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between py-2 px-3 cursor-pointer rounded-md my-0.5 transition-colors",
                      isSelected ? "bg-blue-50 text-blue-900" : "hover:bg-slate-100 text-slate-800"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0 text-blue-600",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-xs truncate">
                          {forn.razao_social || forn.nome}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 font-mono">
                          {forn.cnpj && <span>CNPJ: {forn.cnpj}</span>}
                          {forn.municipio && <span>• {forn.municipio}/{forn.uf}</span>}
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
