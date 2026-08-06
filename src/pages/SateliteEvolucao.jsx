import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/api/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, Printer } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getApresentacaoEDosagem } from "./Medicamentos";

export default function SateliteEvolucao() {
  // Puxar usuário logado do localStorage ou usar padrão
  const currentUser = JSON.parse(localStorage.getItem("pharma_user") || '{"full_name": "Administrador", "crf": "_______"}');

  const { data: medicamentos = [] } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const medsSorted = useMemo(() => {
    return [...medicamentos].sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  }, [medicamentos]);

  return (
    <div className="h-full flex flex-col p-4 md:p-6 space-y-4">
      <Card className="border-0 shadow-sm overflow-hidden bg-white dark:bg-slate-900 p-4 sm:p-6 space-y-6 flex-1 flex flex-col">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800 print:hidden">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xl flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-indigo-600" />
              Folha de Evolução e Requisição de Insumos
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Planilha padronizada de medicamentos com campos em branco (Pedida / Atendida) para preenchimento manual a caneta.
            </p>
          </div>
          <Button 
            onClick={() => window.print()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 shadow-md shrink-0"
          >
            <Printer className="w-4 h-4" />
            Imprimir Folha de Evolução
          </Button>
        </div>

        {/* ÁREA IMPRESSA / VISUALIZAÇÃO A4 ULTRA COMPACTA */}
        <div className="print:p-0 flex-1">
          {/* Cabeçalho da Folha Físico de Impressão */}
          <div className="hidden print:block mb-3 border-b border-slate-900 pb-1.5">
            <h1 className="text-sm font-black text-center uppercase tracking-wider text-slate-900">
              FOLHA DE EVOLUÇÃO E PEDIDO DE MEDICAMENTOS — FARMÁCIA SATÉLITE
            </h1>
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-800 mt-2">
              <div>Data: ____/____/________</div>
              <div>Setor / Ala: __________________</div>
              <div>Turno: (  ) Manhã  (  ) Tarde  (  ) Noite</div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200 print:border-none">
            <Table className="border-collapse border border-slate-300 dark:border-slate-800 w-full text-[11px] print:text-[10px]">
              <TableHeader className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 sticky top-0 z-10 print:static">
                <TableRow className="print:h-5">
                  <TableHead className="border border-slate-300 print:border-slate-400 font-bold text-slate-900 py-1 px-2">Nome do Medicamento</TableHead>
                  <TableHead className="border border-slate-300 print:border-slate-400 font-bold text-slate-900 w-24 py-1 px-2">Dosagem</TableHead>
                  <TableHead className="border border-slate-300 print:border-slate-400 font-bold text-slate-900 w-28 py-1 px-2">Apresentação</TableHead>
                  <TableHead className="border border-slate-300 print:border-slate-400 font-bold text-slate-900 text-center w-20 py-1 px-1">Qtd. Pedida</TableHead>
                  <TableHead className="border border-slate-300 print:border-slate-400 font-bold text-slate-900 text-center w-20 py-1 px-1">Qtd. Atendida</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medsSorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-slate-400 border border-slate-300">
                      Nenhum medicamento cadastrado na padronização.
                    </TableCell>
                  </TableRow>
                ) : (
                  medsSorted.map((med) => {
                    const info = getApresentacaoEDosagem(med);
                    return (
                      <TableRow key={med.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 print:h-5">
                        <TableCell className="border border-slate-300 print:border-slate-400 font-semibold text-slate-800 dark:text-slate-200 py-1 px-2">
                          {med.nome}
                        </TableCell>
                        <TableCell className="border border-slate-300 print:border-slate-400 font-mono text-slate-700 dark:text-slate-300 font-bold py-1 px-2 text-[10px]">
                          {info.dosagem}
                        </TableCell>
                        <TableCell className="border border-slate-300 print:border-slate-400 text-slate-600 dark:text-slate-400 py-1 px-2 text-[10px]">
                          {info.apresentacao}
                        </TableCell>
                        <TableCell className="border border-slate-300 print:border-slate-400 text-center py-1 px-1 h-6 bg-slate-50/50 print:bg-slate-50/20">
                        </TableCell>
                        <TableCell className="border border-slate-300 print:border-slate-400 text-center py-1 px-1 h-6 bg-slate-50/50 print:bg-slate-50/20">
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Rodapé de Impressão — Apenas Farmacêutico */}
          <div className="hidden print:flex flex-col items-center justify-center mt-6 pt-4 border-t border-slate-400 text-center text-xs">
            <div className="w-64 border-b border-slate-900 h-6 mb-1"></div>
            <p className="font-bold text-slate-900 text-[11px] uppercase mt-1">
              {currentUser.full_name}
            </p>
            <p className="text-slate-600 text-[9px] mt-0.5">CRF: {currentUser.crf || '_______'} • Farmácia Satélite</p>
          </div>
        </div>
      </Card>

      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body, html, #root { 
            height: auto !important;
            min-height: auto !important;
            display: block !important;
            overflow: visible !important;
            print-color-adjust: exact; 
            -webkit-print-color-adjust: exact; 
            background-color: white !important;
          }
          /* Fix for flex layouts causing blank prints */
          div, main {
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          .no-print, nav, header, footer, button, aside { display: none !important; }
          .p-4, .md\\:p-6, .sm\\:p-6 { padding: 0 !important; }
          .border-0, .shadow-sm { border: none !important; box-shadow: none !important; margin: 0 !important; }
          
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #94a3b8 !important; }
          .bg-slate-100 { background-color: #f1f5f9 !important; }
        }
      `}</style>
    </div>
  );
}
