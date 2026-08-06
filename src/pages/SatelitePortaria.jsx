import { useState } from "react";
import { db } from "@/api/db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Book, Printer, AlertTriangle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { isPsicotropico, getPortaria344List } from "@/utils/mavUtils";
import { useNavigate } from "react-router-dom";

export default function SatelitePortaria() {
  const [selectedLista, setSelectedLista] = useState("");
  const [selectedLivroMedId, setSelectedLivroMedId] = useState("");
  const [isPerdaModalOpen, setIsPerdaModalOpen] = useState(false);
  const [perdaQtd, setPerdaQtd] = useState("");
  const [perdaMotivoPreset, setPerdaMotivoPreset] = useState("");
  const [perdaMotivoCustom, setPerdaMotivoCustom] = useState("");
  const [perdaLote, setPerdaLote] = useState("");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const storedUser = JSON.parse(localStorage.getItem("pharma_user") || "null");
  const currentUser = storedUser || { full_name: "Administrador" };
  
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
      queryClient.invalidateQueries({ queryKey: ['saidas', 'livro344'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
    } catch (err) {
      toast.error("Erro ao registrar perda.");
    }
  };
  const historicoMovimentos = (() => {
    if (!selectedLivroMedId) return [];

    // 1. ENTRADAS: Compras reais do fornecedor (ignora transferências internas)
    const entradas = entradasLivro.filter(e => e.medicamento_id === selectedLivroMedId).map(e => ({
      ...e,
      tipo: 'ENTRADA',
      dataObj: parseISO(e.data_entrada || e.created_at)
    }));
    
    // 2. SAÍDAS: Dispensações para pacientes e Perdas (ignora transferências internas)
    const saidas = saidasLivro
      .filter(s => s.medicamento_id === selectedLivroMedId && s.motivo !== 'Transferência de Estoque')
      .map(s => ({
        ...s,
        tipo: s.destino === 'Perda' || s.motivo === 'Perda' ? 'PERDA' : 'SAIDA',
        dataObj: parseISO(s.data_saida || s.created_at)
      }));
    
    // Juntar e ordenar cronologicamente (se a data for igual, desempata pela data exata de criação no sistema)
    const todos = [...entradas, ...saidas].sort((a, b) => {
      // Isolar apenas o dia (YYYY-MM-DD) na timezone local usando o date-fns
      const dayA = format(a.dataObj, 'yyyy-MM-dd');
      const dayB = format(b.dataObj, 'yyyy-MM-dd');

      // Se forem de dias diferentes, o dia mais antigo vem primeiro
      if (dayA !== dayB) return dayA.localeCompare(dayB);
      
      // Se for no MESMO DIA, usar a hora/minuto/segundo que foi registrado no sistema (created_at)
      const createdA = new Date(a.created_at || 0).getTime();
      const createdB = new Date(b.created_at || 0).getTime();
      return createdA - createdB;
    });
    
    let saldoAtual = 0;
    const historico = todos.map(mov => {
      if (mov.tipo === 'ENTRADA') {
        saldoAtual += (mov.quantidade || 0);
      } else {
        saldoAtual -= (mov.quantidade || 0);
      }
      return { ...mov, saldo: saldoAtual };
    });
    
    // Retornar em ordem cronológica (mais antigo primeiro, como em um livro físico)
    return historico;
  })();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 space-y-4">
      <div className="no-print">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Book className="w-7 h-7 text-indigo-600" />
          Folha do Livro de Registro Específico
        </h1>
        <p className="text-slate-500 text-sm">Controle de Saídas de Medicamentos Sujeitos a Controle Especial na Farmácia Satélite</p>
      </div>

      <Card className="p-6 border-0 shadow-sm space-y-6 flex-1">
        <div className="flex flex-col sm:flex-row gap-4 w-full no-print">
          <div className="flex-1 sm:max-w-xs">
            <Label className="mb-2 block">1. Selecione a Lista (Portaria 344)</Label>
            <Select 
              value={selectedLista} 
              onValueChange={(val) => {
                setSelectedLista(val);
                setSelectedLivroMedId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolha a categoria da receita..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Entorpecentes (Listas A1 e A2)">Entorpecentes (Listas A1 e A2)</SelectItem>
                <SelectItem value="Psicotrópicos (Listas A3, B1 e B2)">Psicotrópicos (Listas A3, B1 e B2)</SelectItem>
                <SelectItem value="Controle Especial (Listas C1, C2, C4 e C5)">Controle Especial (Listas C1, C2, C4 e C5)</SelectItem>
                <SelectItem value="Imunossupressores (Lista C3)">Imunossupressores (Lista C3)</SelectItem>
                <SelectItem value="Outros Controlados">Outros Controlados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 flex-grow">
            <Label className="mb-2 block">2. Selecione o Medicamento</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={selectedLivroMedId} onValueChange={(val) => {
                setSelectedLivroMedId(val);
                if (val) {
                  navigate(`/LivroRegistro?medId=${val}`);
                }
              }} disabled={!selectedLista}>
                <SelectTrigger className="flex-1 h-11 w-full truncate">
                  <SelectValue placeholder={selectedLista ? "Escolha o medicamento..." : "Selecione a lista primeiro"} />
                </SelectTrigger>
                <SelectContent className="max-w-[90vw] sm:max-w-none">
                  {medicamentos
                    .filter(m => isPsicotropico(m.categoria) && getPortaria344List(m.nome) === selectedLista)
                    .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
                    .map(med => (
                      <SelectItem key={med.id} value={med.id}>
                        {med.nome} {med.unidade_medida && med.unidade_medida.toLowerCase() !== 'un' ? `- ${med.unidade_medida}` : ""} {med.apresentacao ? `- ${med.apresentacao}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              
              {selectedLivroMedId && (
                <div className="flex gap-2 shrink-0">
                  <Button 
                    onClick={() => navigate(`/LivroRegistro?medId=${selectedLivroMedId}`)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md gap-2 h-11 px-6 whitespace-nowrap"
                  >
                    <Book className="w-4 h-4" />
                    Abrir Livro
                  </Button>
                  <Button 
                    onClick={() => setIsPerdaModalOpen(true)}
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 gap-2 h-11 px-4 whitespace-nowrap"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Registrar Perda
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="py-16 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 no-print mt-6 flex-1 flex flex-col items-center justify-center">
          <Book className="w-16 h-16 mx-auto mb-4 opacity-20 text-indigo-500" />
          <h3 className="text-lg font-semibold text-slate-600 mb-1">Livro de Registro Específico</h3>
          <p className="max-w-md mx-auto">
            Selecione uma lista e um medicamento acima. O livro de movimentações será aberto para visualização e impressão em tela cheia.
          </p>
        </div>
      </Card>

      <Dialog open={isPerdaModalOpen} onOpenChange={setIsPerdaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Quebra / Perda</DialogTitle>
            <DialogDescription>
              Informe os dados da perda de estoque para ser registrada no Livro.
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
      
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 15mm;
          }
          body { 
            print-color-adjust: exact; 
            -webkit-print-color-adjust: exact; 
            background-color: white !important;
          }
          .no-print, nav, header, footer, button, aside { display: none !important; }
          .print-only { display: block !important; }
          .p-6 { padding: 0 !important; }
          
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #e2e8f0 !important; }
          .bg-slate-100 { background-color: #f1f5f9 !important; }
        }
      `}</style>
    </div>
  );
}
