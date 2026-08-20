import { useState } from "react";
import { db } from "@/api/db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function LivroRegistro() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const selectedLivroMedId = searchParams.get("medId");
  const queryClient = useQueryClient();

  // Loss state
  const [isPerdaModalOpen, setIsPerdaModalOpen] = useState(false);
  const [perdaQtd, setPerdaQtd] = useState("");
  const [perdaMotivoPreset, setPerdaMotivoPreset] = useState("");
  const [perdaMotivoCustom, setPerdaMotivoCustom] = useState("");
  const [perdaLote, setPerdaLote] = useState("");

  // Puxar usuário logado do localStorage ou usar padrão
  const storedUser = JSON.parse(localStorage.getItem("pharma_user") || "null");
  const currentUser = storedUser || { full_name: "Administrador", crf: "_______" };

  const { data: medicamentos = [] } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: saidasLivro = [] } = useQuery({
    queryKey: ['saidas', 'livro344'],
    queryFn: () => db.entities.Saida.list('-created_date'),
  });

  const { data: entradasLivro = [] } = useQuery({
    queryKey: ['entradas', 'livro344'],
    queryFn: () => db.entities.Entrada.list('-created_date'),
  });

  const historicoMovimentos = (() => {
    if (!selectedLivroMedId) return [];

    const entradas = entradasLivro.filter(e => e.medicamento_id === selectedLivroMedId && (e.quantidade || 0) > 0).map(e => {
      let parsedDate = new Date();
      try {
        const dateStr = e.data_entrada || e.created_at || new Date().toISOString();
        parsedDate = parseISO(dateStr);
        if (isNaN(parsedDate)) parsedDate = new Date();
      } catch (err) {
        parsedDate = new Date();
      }
      return {
        ...e,
        tipo: 'ENTRADA',
        dataObj: parsedDate
      };
    });
    
      const saidas = saidasLivro
      .filter(s => s.medicamento_id === selectedLivroMedId && s.motivo !== 'Transferência de Estoque' && (s.quantidade || 0) > 0)
      .map(s => {
        let parsedDate = new Date();
        try {
          const dateStr = s.data_saida || s.created_at || new Date().toISOString();
          parsedDate = parseISO(dateStr);
          if (isNaN(parsedDate)) parsedDate = new Date();
        } catch (e) {
          parsedDate = new Date();
        }
        return {
          ...s,
          tipo: s.destino === 'Perda' || s.motivo === 'Perda' ? 'PERDA' : 'SAIDA',
          dataObj: parsedDate
        };
      });
    
    const todos = [...entradas, ...saidas].sort((a, b) => {
      const dayA = format(a.dataObj, 'yyyy-MM-dd');
      const dayB = format(b.dataObj, 'yyyy-MM-dd');
      if (dayA !== dayB) return dayA.localeCompare(dayB);
      const createdA = new Date(a.created_at || 0).getTime();
      const createdB = new Date(b.created_at || 0).getTime();
      return createdA - createdB;
    });
    
    let saldoAtual = 0;
    return todos.map(mov => {
      if (mov.tipo === 'ENTRADA') saldoAtual += (mov.quantidade || 0);
      else saldoAtual -= (mov.quantidade || 0);
      return { ...mov, saldo: saldoAtual };
    });
  })();

  const handleRegistrarPerda = async (e) => {
    e.preventDefault();
    const finalMotivo = perdaMotivoPreset === "Outro" ? perdaMotivoCustom : perdaMotivoPreset;
    
    if (!perdaQtd || !finalMotivo || !perdaLote) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    try {
      await db.entities.Saida.create({
        medicamento_id: selectedLivroMedId,
        quantidade: parseInt(perdaQtd, 10),
        destino: "Perda",
        motivo: finalMotivo,
        responsavel: currentUser.full_name,
        numero_lote: perdaLote,
        data_saida: new Date().toISOString()
      });
      
      const med = medicamentos.find(m => m.id === selectedLivroMedId);
      if (med) {
        await db.entities.Medicamento.update(med.id, {
          estoque_satelite: Math.max(0, (med.estoque_satelite || 0) - parseInt(perdaQtd, 10))
        });
      }

      toast.success("Perda registrada com sucesso e estoque deduzido.");
      setIsPerdaModalOpen(false);
      setPerdaQtd(""); setPerdaMotivoPreset(""); setPerdaMotivoCustom(""); setPerdaLote("");
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
    } catch (err) {
      toast.error("Erro ao registrar perda.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const medicamento = medicamentos.find(m => m.id === selectedLivroMedId);

  if (!selectedLivroMedId || medicamentos.length === 0) {
    return <div className="p-12 text-center text-slate-500 font-medium">Carregando livro...</div>;
  }

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto flex justify-between items-center mb-6 no-print">
        <Button 
          variant="outline" 
          onClick={() => window.history.back()}
          className="gap-2 bg-white hover:bg-slate-100 text-slate-700 shadow-sm border-slate-300 font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Voltar para Portaria
        </Button>
        <div className="flex gap-2">
          <Button 
            onClick={() => setIsPerdaModalOpen(true)} 
            variant="outline"
            className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 shadow-sm font-semibold"
          >
            <AlertTriangle className="w-4 h-4" />
            Registrar Perda
          </Button>
          <Button onClick={handlePrint} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-semibold">
            <Printer className="w-4 h-4" />
            Imprimir Livro
          </Button>
        </div>
      </div>

      <div id="livro-print-area" className="max-w-5xl mx-auto border border-slate-200 shadow-xl bg-white p-4 sm:p-8 rounded-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold uppercase underline mb-3 text-slate-900">FOLHA DO LIVRO DE REGISTRO ESPECÍFICO</h1>
          <h2 className="text-xl font-bold text-slate-800">
            Medicamento: {medicamento ? `${medicamento.nome} ${medicamento.unidade_medida && medicamento.unidade_medida.toLowerCase() !== 'un' ? `- ${medicamento.unidade_medida}` : ""} ${medicamento.apresentacao ? `- ${medicamento.apresentacao}` : ""}` : ""}
          </h2>
          <p className="text-base mt-2 text-slate-600 font-medium">Portaria SVS/MS nº 344/1998</p>
          <p className="text-sm mt-1 text-slate-500 font-semibold">Unidade: Farmácia Satélite</p>
        </div>

        <Table className="border-collapse w-full border border-slate-300">
          <TableHeader>
            <TableRow className="bg-slate-100/80">
              <TableHead className="font-bold text-slate-800 text-center border border-slate-300" colSpan={3}>DATA</TableHead>
              <TableHead className="font-bold text-slate-800 border border-slate-300" rowSpan={2}>HISTÓRICO</TableHead>
              <TableHead className="font-bold text-slate-800 text-center border border-slate-300" colSpan={3}>MOVIMENTO</TableHead>
              <TableHead className="font-bold text-slate-800 text-center border border-slate-300" rowSpan={2}>ESTOQUE</TableHead>
              <TableHead className="font-bold text-slate-800 text-center border border-slate-300" rowSpan={2}>ASSINATURA DO RESP. TÉCNICO</TableHead>
              <TableHead className="font-bold text-slate-800 border border-slate-300" rowSpan={2}>OBSERVAÇÕES</TableHead>
            </TableRow>
            <TableRow className="bg-slate-100/80">
              <TableHead className="font-bold text-slate-800 text-center text-xs w-10 px-1 border border-slate-300">Dia</TableHead>
              <TableHead className="font-bold text-slate-800 text-center text-xs w-10 px-1 border border-slate-300">Mês</TableHead>
              <TableHead className="font-bold text-slate-800 text-center text-xs w-12 px-1 border border-slate-300">Ano</TableHead>
              
              <TableHead className="font-bold text-slate-800 text-center text-xs w-16 px-1 border border-slate-300">Entrada</TableHead>
              <TableHead className="font-bold text-slate-800 text-center text-xs w-16 px-1 border border-slate-300">Saída</TableHead>
              <TableHead className="font-bold text-slate-800 text-center text-xs w-16 px-1 border border-slate-300">Perdas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {historicoMovimentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8 text-slate-500 italic border border-slate-300">
                    Nenhum registro encontrado para este medicamento.
                  </TableCell>
                </TableRow>
              ) : (
                historicoMovimentos.map((mov) => {
                  const d = mov.dataObj;
                  return (
                    <TableRow key={mov.id + mov.tipo} className="hover:bg-slate-50">
                      <TableCell className="text-center font-mono text-xs px-1 border border-slate-300 text-slate-700">{String(d.getDate()).padStart(2, '0')}</TableCell>
                      <TableCell className="text-center font-mono text-xs px-1 border border-slate-300 text-slate-700">{String(d.getMonth() + 1).padStart(2, '0')}</TableCell>
                      <TableCell className="text-center font-mono text-xs px-1 border border-slate-300 text-slate-700">{d.getFullYear()}</TableCell>
                      
                      <TableCell className="font-semibold text-slate-800 uppercase text-xs border border-slate-300 pl-2">
                        {mov.tipo === 'ENTRADA' ? (mov.fornecedor_nome || 'Estoque Central') : 
                          (mov.tipo === 'PERDA' ? 'PERDA / QUEBRA' : (mov.paciente_nome || mov.ala_nome || mov.destino || 'Paciente'))}
                      </TableCell>
                      
                      <TableCell className="text-center font-bold text-emerald-700 bg-emerald-50/50 px-1 border border-slate-300">{mov.tipo === 'ENTRADA' ? mov.quantidade : '-'}</TableCell>
                      <TableCell className="text-center font-bold text-blue-700 bg-blue-50/50 px-1 border border-slate-300">{mov.tipo === 'SAIDA' ? mov.quantidade : '-'}</TableCell>
                      <TableCell className="text-center font-bold text-red-700 bg-red-50/50 px-1 border border-slate-300">{mov.tipo === 'PERDA' ? mov.quantidade : '-'}</TableCell>
                      
                      <TableCell className="text-center font-bold text-slate-900 bg-slate-100/50 border border-slate-300 text-sm">{mov.saldo}</TableCell>
                      <TableCell className="border border-slate-300 p-0 align-middle text-center">
                        <div className="flex flex-col items-center justify-center w-full py-1">
                          <span className="text-[9px] font-bold text-slate-800 uppercase print:text-[8px]">
                            {currentUser.full_name}
                          </span>
                          <span className="text-[8px] text-slate-600 print:text-[7px]">
                            CRF: {currentUser.crf || '_________'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[10px] text-slate-600 min-w-[150px] border border-slate-300 px-2 break-words whitespace-normal" title={`Lote: ${mov.numero_lote || mov.lote || '-'} | Resp: ${mov.responsavel || '-'}`}>
                        Lote: {mov.numero_lote || mov.lote || "-"} {mov.motivo ? `| ${mov.motivo.replace(/ fixa/gi, '').replace(/Fixa/g, '').replace('1 dias', '1 dia')}` : ''}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
          </TableBody>
        </Table>
      </div>
      
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
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
          .p-4, .sm\\:p-8 { padding: 0 !important; }
          .max-w-5xl { max-w: none !important; border: none !important; box-shadow: none !important; margin: 0 !important; }
          
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #94a3b8 !important; }
          .bg-slate-100\\/80 { background-color: #f1f5f9 !important; }
          .bg-emerald-50\\/50 { background-color: #ecfdf5 !important; }
          .bg-blue-50\\/50 { background-color: #eff6ff !important; }
          .bg-red-50\\/50 { background-color: #fef2f2 !important; }
        }
      `}</style>
      
      <Dialog open={isPerdaModalOpen} onOpenChange={setIsPerdaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Quebra / Perda</DialogTitle>
            <DialogDescription>
              Informe os dados da perda para ser registrada no Livro. O estoque será reduzido.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegistrarPerda} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade Perdida</Label>
                <Input type="number" min="1" value={perdaQtd} onChange={e => setPerdaQtd(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Número do Lote</Label>
                <Input value={perdaLote} onChange={e => setPerdaLote(e.target.value)} placeholder="Obrigatório" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Motivo da Perda</Label>
              <Select value={perdaMotivoPreset} onValueChange={setPerdaMotivoPreset} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Quebra de ampola">Quebra de ampola</SelectItem>
                  <SelectItem value="Vencimento">Vencimento</SelectItem>
                  <SelectItem value="Extravio">Extravio</SelectItem>
                  <SelectItem value="Danificado">Danificado (Lote/Embalagem)</SelectItem>
                  <SelectItem value="Furto">Furto</SelectItem>
                  <SelectItem value="Outro">Outro...</SelectItem>
                </SelectContent>
              </Select>
              {perdaMotivoPreset === "Outro" && (
                <Input value={perdaMotivoCustom} onChange={e => setPerdaMotivoCustom(e.target.value)} placeholder="Especifique o motivo..." required className="mt-2" />
              )}
            </div>
            <div className="space-y-2">
              <Label>Responsável (Farmacêutico)</Label>
              <Input value={currentUser.full_name} disabled className="bg-slate-100 text-slate-500 font-medium" />
              <p className="text-[10px] text-slate-500">O responsável é preenchido automaticamente com o usuário logado.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPerdaModalOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white">Salvar Registro</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
