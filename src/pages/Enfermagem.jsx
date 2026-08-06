import { useState, useEffect } from "react";
import { Bed, Users, Clock, LogOut, CheckCircle2, FileText, AlertCircle, Pill, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function Enfermagem() {
  const [setores, setSetores] = useState([]);
  const [pendenciasGerais, setPendenciasGerais] = useState([]);
  const [selectedSetorId, setSelectedSetorId] = useState(null);

  // Dialog state for allocating bed
  const [openAllocate, setOpenAllocate] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedBedId, setSelectedBedId] = useState("");

  // Prontuário de Enfermagem
  const [prontuarioPaciente, setProntuarioPaciente] = useState(null);
  const [activeTab, setActiveTab] = useState("evolucao");
  const [prescricoesGerais, setPrescricoesGerais] = useState([]);
  const [novaEvolucao, setNovaEvolucao] = useState("");

  const loadData = () => {
    const s = localStorage.getItem("hospital_estrutura");
    if (s) setSetores(JSON.parse(s));
    
    const p = localStorage.getItem("hospital_pendencias");
    if (p) setPendenciasGerais(JSON.parse(p));

    const presc = localStorage.getItem("hospital_prescricoes");
    if (presc) setPrescricoesGerais(JSON.parse(presc));
  };

  useEffect(() => {
    loadData();
    window.addEventListener("storage", loadData);
    return () => window.removeEventListener("storage", loadData);
  }, []);

  const currentSetor = setores.find(s => s.id === selectedSetorId);
  const pendenciasSetor = pendenciasGerais.filter(p => p.setorId === String(selectedSetorId));

  const handleAllocateBed = () => {
    if (!selectedPatient || !selectedBedId) return;

    const newSetores = setores.map(s => {
      if (s.id === selectedSetorId) {
        return {
          ...s,
          leitos: s.leitos.map(l => {
            if (l.id.toString() === selectedBedId) {
              return { ...l, status: "Ocupado", paciente: selectedPatient };
            }
            return l;
          })
        };
      }
      return s;
    });

    const newPendencias = pendenciasGerais.filter(p => p.id !== selectedPatient.id);

    setSetores(newSetores);
    setPendenciasGerais(newPendencias);
    localStorage.setItem("hospital_estrutura", JSON.stringify(newSetores));
    localStorage.setItem("hospital_pendencias", JSON.stringify(newPendencias));

    setOpenAllocate(false);
    setSelectedPatient(null);
    setSelectedBedId("");
    toast.success("Paciente alocado com sucesso!");
  };

  const handleFreeBed = (leitoId) => {
    const newSetores = setores.map(s => {
      if (s.id === selectedSetorId) {
        return {
          ...s,
          leitos: s.leitos.map(l => {
            if (l.id === leitoId) {
              return { ...l, status: "Livre", paciente: null };
            }
            return l;
          })
        };
      }
      return s;
    });
    setSetores(newSetores);
    localStorage.setItem("hospital_estrutura", JSON.stringify(newSetores));
    setProntuarioPaciente(null);
    toast.success("Leito liberado e paciente de alta do setor.");
  };

  const handleChecarMedicacao = (id) => {
    const updated = prescricoesGerais.map(p => 
      p.id === id ? { ...p, status_enfermagem: "Checado" } : p
    );
    setPrescricoesGerais(updated);
    localStorage.setItem("hospital_prescricoes", JSON.stringify(updated));
    toast.success("Medicação checada com sucesso!");
  };

  const handleSalvarEvolucao = () => {
    if (!novaEvolucao.trim()) return;
    toast.success("Evolução de enfermagem salva!");
    setNovaEvolucao("");
  };

  const handleOpenProntuario = (leito) => {
    if (leito.status === "Ocupado" && leito.paciente) {
      setProntuarioPaciente({ ...leito.paciente, leitoId: leito.id, leitoNumero: leito.numero });
      setActiveTab("evolucao");
    }
  };

  if (!selectedSetorId) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6 flex flex-col items-center justify-center min-h-[70vh]">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Selecione o Setor de Atuação</h2>
        <p className="text-slate-500 mb-8">Por favor, indique em qual setor você fará o plantão agora.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
          {setores.length === 0 ? (
            <p className="col-span-2 text-center text-slate-400">Nenhum setor cadastrado no sistema. Solicite ao Administrador Geral.</p>
          ) : setores.map(setor => (
            <button
              key={setor.id}
              onClick={() => setSelectedSetorId(setor.id)}
              className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:border-blue-500 hover:shadow-md transition-all flex flex-col items-center gap-3 text-center"
            >
              <div className={`p-4 rounded-full ${setor.owner === 'terceirizado' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                <Bed className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{setor.nome}</h3>
                <p className="text-sm text-slate-500 uppercase font-semibold mt-1">
                  {setor.owner === 'terceirizado' ? 'Terceirizado' : 'Gestão Interna'}
                </p>
                <p className="text-xs text-slate-400 mt-2">{setor.leitos.length} Leitos totais</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const freeBeds = currentSetor.leitos.filter(l => l.status === "Livre");
  const prescricoesPaciente = prontuarioPaciente ? prescricoesGerais.filter(p => p.prontuario === prontuarioPaciente.prontuario) : [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Bed className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              Setor: {currentSetor.nome}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Painel de Gestão de Leitos, Admissões e Evolução Clínica
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="gap-2 text-slate-500 hover:text-slate-800"
          onClick={() => setSelectedSetorId(null)}
        >
          <LogOut className="w-4 h-4" />
          Trocar de Setor
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PENDÊNCIAS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-[400px]">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-orange-50/50 dark:bg-orange-900/10">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Pendências (Aguardando Leito)
            </h2>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-slate-50/30 dark:bg-transparent">
            {pendenciasSetor.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                <CheckCircle2 className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-700" />
                <p>Nenhum paciente aguardando leito neste setor.</p>
              </div>
            ) : pendenciasSetor.map(paciente => (
              <div key={paciente.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">{paciente.nome}</h3>
                  <div className="flex gap-2 text-xs mt-1">
                    <span className="text-slate-500 font-mono">Pront: {paciente.prontuario}</span>
                    <span className="text-slate-500">• {paciente.idade} anos</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 uppercase font-semibold">{paciente.tipo}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 uppercase font-semibold">{paciente.status}</span>
                  </div>
                </div>
                
                <Dialog open={openAllocate && selectedPatient?.id === paciente.id} onOpenChange={(open) => {
                  setOpenAllocate(open);
                  if (open) setSelectedPatient(paciente);
                  else { setSelectedPatient(null); setSelectedBedId(""); }
                }}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap">
                      Vincular Leito
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Vincular paciente ao Leito</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                      <p className="text-sm text-slate-500 mb-4">Selecione um leito livre para <strong>{paciente.nome}</strong> no setor {currentSetor.nome}.</p>
                      
                      <select 
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
                        value={selectedBedId}
                        onChange={(e) => setSelectedBedId(e.target.value)}
                      >
                        <option value="">Selecione um leito...</option>
                        {freeBeds.map(b => (
                          <option key={b.id} value={b.id}>Leito {b.numero}</option>
                        ))}
                      </select>
                      
                      {freeBeds.length === 0 && (
                        <p className="text-red-500 text-sm mt-2 font-medium">Não há leitos livres neste setor!</p>
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setOpenAllocate(false)}>Cancelar</Button>
                      <Button onClick={handleAllocateBed} disabled={!selectedBedId || freeBeds.length === 0}>
                        Confirmar Internação
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            ))}
          </div>
        </div>

        {/* LEITOS DO SETOR */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col min-h-[400px]">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-blue-50/50 dark:bg-blue-900/10">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Mapa de Leitos do Setor
            </h2>
          </div>

          <div className="p-4 flex-1 overflow-y-auto bg-slate-50/30 dark:bg-transparent">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentSetor.leitos.length === 0 ? (
                <p className="col-span-2 text-center text-slate-400 py-4">Nenhum leito configurado para este setor.</p>
              ) : currentSetor.leitos.map(leito => (
                <div 
                  key={leito.id} 
                  onClick={() => handleOpenProntuario(leito)}
                  className={`p-3 rounded-xl border transition-all ${
                    leito.status === 'Livre' 
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/10' 
                      : 'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/10 cursor-pointer hover:border-blue-400 hover:shadow-md'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      Leito {leito.numero}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                      leito.status === 'Livre' ? 'bg-emerald-200 text-emerald-800' : 'bg-blue-200 text-blue-800'
                    }`}>
                      {leito.status}
                    </span>
                  </div>
                  
                  {leito.status === 'Ocupado' && leito.paciente ? (
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{leito.paciente.nome}</p>
                      <p className="text-xs text-slate-500">
                        <span className="font-mono">Pront: {leito.paciente.prontuario}</span> • {leito.paciente.idade} anos
                      </p>
                      <p className="text-xs text-slate-500 mt-1 font-semibold text-orange-600/80">Avaliação: {leito.paciente.status}</p>
                    </div>
                  ) : (
                    <div className="py-2 text-center">
                      <p className="text-xs text-emerald-600/70 font-medium">Disponível para internação</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* PRONTUÁRIO DE ENFERMAGEM MODAL */}
      <Dialog open={!!prontuarioPaciente} onOpenChange={(open) => !open && setProntuarioPaciente(null)}>
        {prontuarioPaciente && (
          <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-slate-50 dark:bg-slate-900 border-0 h-[80vh] flex flex-col">
            <div className="bg-slate-800 dark:bg-slate-950 p-6 text-white shrink-0 relative">
              <div className="flex justify-between items-start">
                <div>
                  <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                    {prontuarioPaciente.nome}
                  </DialogTitle>
                  <p className="text-slate-300 text-sm mt-1 font-mono">
                    Prontuário: {prontuarioPaciente.prontuario} • Leito {prontuarioPaciente.leitoNumero} • {prontuarioPaciente.idade} anos
                  </p>
                  <div className="flex gap-2 mt-3">
                    <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-red-500/20 text-red-300 border border-red-500/30">
                      Risco: {prontuarioPaciente.status}
                    </span>
                  </div>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => handleFreeBed(prontuarioPaciente.leitoId)}
                >
                  Conceder Alta / Liberar Leito
                </Button>
              </div>
            </div>

            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 px-6 pt-2">
              <button 
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'evolucao' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                onClick={() => setActiveTab('evolucao')}
              >
                Evolução & Sinais Vitais
              </button>
              <button 
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'checagem' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                onClick={() => setActiveTab('checagem')}
              >
                Checagem de Medicação
                {prescricoesPaciente.filter(p => p.status_farmacia === 'Liberado' && p.status_enfermagem !== 'Checado').length > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    {prescricoesPaciente.filter(p => p.status_farmacia === 'Liberado' && p.status_enfermagem !== 'Checado').length}
                  </span>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50">
              {activeTab === 'evolucao' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      Anotação de Enfermagem (SOAP)
                    </h3>
                    <textarea 
                      className="w-full h-32 p-3 text-sm border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      placeholder="Relate o estado geral do paciente, alimentação, diurese, comportamento..."
                      value={novaEvolucao}
                      onChange={(e) => setNovaEvolucao(e.target.value)}
                    ></textarea>
                    <div className="mt-3 flex justify-end">
                      <Button onClick={handleSalvarEvolucao} className="bg-blue-600 hover:bg-blue-700 text-white">Assinar Evolução</Button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'checagem' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Pill className="w-4 h-4 text-blue-500" />
                      Aprazamento e Medicações Prescritas
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">Apenas medicações já liberadas pela Farmácia Satélite podem ser checadas.</p>
                    
                    {prescricoesPaciente.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                        Nenhuma medicação prescrita pelo médico para este paciente.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {prescricoesPaciente.map(p => {
                          const isLiberado = p.status_farmacia === "Liberado";
                          const isChecado = p.status_enfermagem === "Checado";

                          return (
                            <div key={p.id} className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${isChecado ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-900/10' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'}`}>
                              <div>
                                <h4 className={`font-bold ${isChecado ? 'text-emerald-800 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-100'}`}>
                                  {p.medicamento}
                                </h4>
                                <p className="text-sm text-slate-500 mt-1">
                                  <strong>Posologia:</strong> {p.posologia} | <strong>Via:</strong> {p.via}
                                </p>
                                <div className="flex gap-2 mt-2">
                                  {!isLiberado ? (
                                    <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded flex items-center gap-1">
                                      <Clock className="w-3 h-3" /> Aguardando Farmácia
                                    </span>
                                  ) : isChecado ? (
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> Medicado
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded flex items-center gap-1">
                                      <Activity className="w-3 h-3" /> Liberado para Checagem
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <Button 
                                disabled={!isLiberado || isChecado}
                                onClick={() => handleChecarMedicacao(p.id)}
                                className={isChecado ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}
                              >
                                {isChecado ? "Checado" : "Checar (Confirmar)"}
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>

    </div>
  );
}
