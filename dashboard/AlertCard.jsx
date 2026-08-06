import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function AlertCard({ type, items }) {
  const config = {
    vencimento: {
      icon: Clock,
      title: "Próximos do Vencimento",
      color: "amber",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
    },
    estoque_baixo: {
      icon: Package,
      title: "Estoque Baixo",
      color: "red",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
    },
    vencidos: {
      icon: AlertTriangle,
      title: "Medicamentos Vencidos",
      color: "red",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
    },
  };

  const { icon: Icon, title, color, bgColor, borderColor } = config[type];

  if (!items || items.length === 0) return null;

  return (
    <Card className={cn("p-4 border", borderColor, bgColor)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("w-5 h-5", `text-${color}-600`)} />
        <h3 className="font-semibold text-slate-700">{title}</h3>
        <Badge variant="secondary" className={cn("ml-auto", `bg-${color}-100 text-${color}-700`)}>
          {items.length}
        </Badge>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {items.slice(0, 5).map((item, idx) => (
          <div key={idx} className="flex items-center justify-between text-sm bg-white/70 rounded-lg p-2">
            <div>
              <p className="font-medium text-slate-700">{item.nome}</p>
              <p className="text-xs text-slate-500">
                {type === "vencimento" || type === "vencidos"
                  ? `Lote: ${item.lote} • Vence: ${format(new Date(item.validade), "dd/MM/yyyy")}`
                  : `Atual: ${item.atual} • Mínimo: ${item.minimo}`
                }
              </p>
            </div>
            {(type === "vencimento" || type === "vencidos") && (
              <Badge variant={type === "vencidos" ? "destructive" : "outline"} className="text-xs">
                {type === "vencidos"
                  ? "Vencido"
                  : `${differenceInDays(new Date(item.validade), new Date())} dias`
                }
              </Badge>
            )}
          </div>
        ))}
        {items.length > 5 && (
          <p className="text-xs text-center text-slate-500 pt-2">
            +{items.length - 5} itens
          </p>
        )}
      </div>
    </Card>
  );
}