import { MapaMensalDispensacao } from "@/components/relatorios/MapaMensalDispensacao";

export default function MapaDispensacao() {
  return (
    <div className="min-h-full bg-slate-50/50 dark:bg-slate-950 p-4 sm:p-6 print:p-0 print:bg-white">
      <MapaMensalDispensacao />
    </div>
  );
}
