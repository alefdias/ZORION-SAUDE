import React, { useState, useEffect } from "react";
import { Users, FileText, Pill, Activity, Printer, CheckCircle2, User, Brain, AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function Medico() {
  const [setores, setSetores] = useState([]);
  const [pacientesInternados, setPacientesInternados] = useState([]);
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  
  // Prontuário states
  const [activeTab, setActiveTab] = useState("evolucao");
  const [novaEvolucao, setNovaEvolucao] = useState("");
  const [prescricoes, setPrescricoes] = useState([]);
  
  // Nova prescrição state
  const [novaPrescricao, setNovaPrescricao] = useState({ medicamento: "", posologia: "", via: "VO" });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const s = localStorage.getItem("hospital_estrutura");
    if (s) {
      const parsedSetores = JSON.parse(s);
      setSetores(parsedSetores);
      
      const internados = [];
      parsedSetores.forEach(setor => {
        setor.leitos.forEach(leito => {
          if (leito.status === 'Ocupado' && leito.paciente) {
            internados.push({
              ...leito.paciente,
              leitoId: leito.id,
              leitoNumero: leito.numero,
              setorNome: setor.nome,
              setorId: setor.id
            });
          }
        });
      });
      setPacientesInternados(internados);
    }
    
    const p = localStorage.getItem("hospital_prescricoes");
    if (p) setPrescricoes(JSON.parse(p));
  };

  const handleOpenProntuario = (paciente) => {
    setSelectedPaciente(paciente);
    setActiveTab("evolucao");
  };

  const handleSalvarEvolucao = () => {
    if (!novaEvolucao.trim()) return;
    
    // In a real app, save to hospital_evolucoes
    toast.success("Evolução médica registrada com sucesso!");
    setNovaEvolucao("");
  };

  const handleAddPrescricao = () => {
    if (!novaPrescricao.medicamento || !novaPrescricao.posologia) {
      toast.error("Preencha o medicamento e a posologia.");
      return;
    }

    const newPrescricao = {
      id: Date.now(),
      pacienteId: selectedPaciente.id,
      prontuario: selectedPaciente.prontuario,
      pacienteNome: selectedPaciente.nome,
      leito: `${selectedPaciente.setorNome} - ${selectedPaciente.leitoNumero}`,
      medicamento: novaPrescricao.medicamento,
      posologia: novaPrescricao.posologia,
      via: novaPrescricao.via,
      data: new Date().toISOString(),
      status_farmacia: "Pendente", // Pendente de liberação
      status_enfermagem: "Aguardando Checagem" 
    };

    const updatedPrescricoes = [...prescricoes, newPrescricao];
    setPrescricoes(updatedPrescricoes);
    localStorage.setItem("hospital_prescricoes", JSON.stringify(updatedPrescricoes));
    
    setNovaPrescricao({ medicamento: "", posologia: "", via: "VO" });
    toast.success("Prescrição adicionada e enviada à Farmácia!");
  };

  const handlePrintReceita = () => {
    // Fake print window
    const printWindow = window.open('', '', 'width=800,height=600');
    
    const patientPrescricoes = prescricoes.filter(p => p.prontuario === selectedPaciente.prontuario);
    
    let html = `
      <html>
      <head>
        <title>Receituário Médico - ${selectedPaciente.nome}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
          .patient-info { margin-bottom: 30px; border: 1px solid #ccc; padding: 15px; border-radius: 8px; }
          .med-list { margin-bottom: 50px; }
          .med-item { margin-bottom: 15px; font-size: 16px; }
          .footer { text-align: center; margin-top: 100px; }
          .signature { border-top: 1px solid #000; width: 300px; margin: 0 auto; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>AXION ERP HOSPITALAR - RECEITUÁRIO MÉDICO</h2>
        </div>
        <div class="patient-info">
          <strong>Paciente:</strong> ${selectedPaciente.nome} <br/>
          <strong>Prontuário:</strong> ${selectedPaciente.prontuario} <br/>
          <strong>Leito:</strong> ${selectedPaciente.setorNome} - ${selectedPaciente.leitoNumero} <br/>
          <strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}
        </div>
        <div class="med-list">
          <h3>Prescrições:</h3>
          ${patientPrescricoes.map((p, i) => `
            <div class="med-item">
              <strong>${i+1}. ${p.medicamento}</strong> - Via: ${p.via}<br/>
              <em>Posologia: ${p.posologia}</em>
            </div>
          `).join('')}
        </div>
        <div class="footer">
          <div class="signature">Assinatura e Carimbo do Médico</div>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const prescricoesPaciente = selectedPaciente ? prescricoes.filter(p => p.prontuario === selectedPaciente.prontuario) : [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Brain className="w-6 h-6 text-blue-500" />
          Corpo Clínico (Médico)
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Selecione um paciente internado para evolução e prescrição.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pacientesInternados.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-800">
            Nenhum paciente internado no momento.
          </div>
        ) : (
          pacientesInternados.map(paciente => (
            <div key={paciente.id} onClick={() => handleOpenProntuario(paciente)} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm hover:border-blue-500 cursor-pointer transition-all group">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 overflow-hidden group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                  {paciente.foto ? (
                    <img src={paciente.foto} alt="Foto" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">{paciente.nome}</h3>
                  <div className="flex gap-2 text-xs mt-1">
                    <span className="text-slate-500 font-mono">Pront: {paciente.prontuario}</span>
                    <span className="text-slate-500">• {paciente.idade} anos</span>
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-2">
                    {paciente.setorNome} - Leito {paciente.leitoNumero}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={!!selectedPaciente} onOpenChange={(open) => !open && setSelectedPaciente(null)}>
        {selectedPaciente && (
          <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-slate-50 dark:bg-slate-900 border-0 h-[80vh] flex flex-col">
            <div className="bg-blue-600 dark:bg-blue-800 p-6 text-white shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center overflow-hidden">
                  {selectedPaciente.foto ? (
                    <img src={selectedPaciente.foto} alt="Foto" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-8 h-8" />
                  )}
                </div>
                <div>
                  <DialogTitle className="text-2xl font-bold">{selectedPaciente.nome}</DialogTitle>
                  <p className="text-blue-100 text-sm mt-1 font-mono">Prontuário: {selectedPaciente.prontuario} • {selectedPaciente.idade} anos • {selectedPaciente.setorNome} (Leito {selectedPaciente.leitoNumero})</p>
                </div>
              </div>
            </div>

            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 px-6 pt-2">
              <button 
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'evolucao' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                onClick={() => setActiveTab('evolucao')}
              >
                Evolução Médica
              </button>
              <button 
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'prescricao' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                onClick={() => setActiveTab('prescricao')}
              >
                Prescrição Eletrônica
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50">
              {activeTab === 'evolucao' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      Nova Evolução
                    </h3>
                    <textarea 
                      className="w-full h-32 p-3 text-sm border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      placeholder="Descreva o estado mental atual do paciente, padrão de sono, comportamento..."
                      value={novaEvolucao}
                      onChange={(e) => setNovaEvolucao(e.target.value)}
                    ></textarea>
                    <div className="mt-3 flex justify-end">
                      <Button onClick={handleSalvarEvolucao} className="bg-blue-600 hover:bg-blue-700 text-white">Assinar e Salvar Evolução</Button>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-500" />
                      Histórico Clínico (Resumo)
                    </h3>
                    <div className="text-sm text-slate-500 flex flex-col gap-3">
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">Admissão: {new Date().toLocaleDateString()}</p>
                        <p>Paciente internado via classificação de risco. Tipo: {selectedPaciente.tipo}. Avaliação inicial: {selectedPaciente.status}.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'prescricao' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <Pill className="w-4 h-4 text-blue-500" />
                      Adicionar Medicamento
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Medicamento</label>
                        <Input 
                          placeholder="Ex: HALDOL 5mg/ml (Haloperidol)" 
                          value={novaPrescricao.medicamento}
                          onChange={(e) => setNovaPrescricao({...novaPrescricao, medicamento: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Posologia</label>
                        <Input 
                          placeholder="Ex: 1-0-1 (Manhã e Noite)" 
                          value={novaPrescricao.posologia}
                          onChange={(e) => setNovaPrescricao({...novaPrescricao, posologia: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Via</label>
                        <select 
                          className="mt-1 flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          value={novaPrescricao.via}
                          onChange={(e) => setNovaPrescricao({...novaPrescricao, via: e.target.value})}
                        >
                          <option value="VO">VO (Via Oral)</option>
                          <option value="IM">IM (Intramuscular)</option>
                          <option value="EV">EV (Endovenosa)</option>
                          <option value="SC">SC (Subcutânea)</option>
                        </select>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button onClick={handleAddPrescricao} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                        <Plus className="w-4 h-4" /> Prescrever
                      </Button>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">Prescrições Ativas</h3>
                      {prescricoesPaciente.length > 0 && (
                        <Button variant="outline" size="sm" onClick={handlePrintReceita} className="gap-2 border-slate-300 dark:border-slate-700">
                          <Printer className="w-4 h-4" /> Imprimir Receita
                        </Button>
                      )}
                    </div>
                    
                    {prescricoesPaciente.length === 0 ? (
                      <div className="p-8 text-center text-slate-500">
                        Nenhuma medicação prescrita no momento.
                      </div>
                    ) : (
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                          <tr>
                            <th className="px-4 py-3 font-medium">Medicamento</th>
                            <th className="px-4 py-3 font-medium">Via</th>
                            <th className="px-4 py-3 font-medium">Posologia</th>
                            <th className="px-4 py-3 font-medium">Status Farmácia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {prescricoesPaciente.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                              <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{p.medicamento}</td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-bold">{p.via}</span>
                              </td>
                              <td className="px-4 py-3">{p.posologia}</td>
                              <td className="px-4 py-3">
                                {p.status_farmacia === 'Pendente' ? (
                                  <span className="flex items-center gap-1 text-orange-600 text-xs font-bold">
                                    <AlertCircle className="w-3.5 h-3.5" /> Pendente Liberação
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Liberado
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
