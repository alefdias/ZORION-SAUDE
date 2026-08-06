import { useState, useEffect } from "react";
import { 
  Users, UserPlus, Bed, Activity, Search, 
  Clock, Plus, AlertCircle, CheckCircle2, User, X, Brain
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

const tipoColors = {
  voluntaria: "bg-blue-500",
  involuntaria: "bg-orange-500",
  compulsoria: "bg-red-500",
};

const statusColors = {
  calmo: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
  agitado: "text-orange-600 bg-orange-50 dark:bg-orange-900/20",
  fuga: "text-red-600 bg-red-50 dark:bg-red-900/20",
};

export default function Recepcao() {
  const [searchTerm, setSearchTerm] = useState("");
  
  const [setoresDisponiveis, setSetoresDisponiveis] = useState([]);

  useEffect(() => {
    const s = localStorage.getItem("hospital_estrutura");
    if (s) setSetoresDisponiveis(JSON.parse(s));
  }, []);
  
  const [fila, setFila] = useState([]);
  const [visitantes, setVisitantes] = useState([]);

  // Form states
  const [novoPaciente, setNovoPaciente] = useState({ nome: "", prontuario: "", idade: "", tipo: "voluntaria", status: "calmo", setorId: "", foto: null });
  const [novoVisitante, setNovoVisitante] = useState({ nome: "", paciente: "", leito: "" });
  
  // Dialog controls
  const [openAdmissao, setOpenAdmissao] = useState(false);
  const [openVisitante, setOpenVisitante] = useState(false);

  const handleAddPaciente = () => {
    if (!novoPaciente.nome || !novoPaciente.idade || !novoPaciente.setorId) return;
    const newId = Date.now();
    
    const setorDestino = setoresDisponiveis.find(s => s.id.toString() === novoPaciente.setorId);
    const nomeSetor = setorDestino ? setorDestino.nome : "Sem Setor";

    const paciente = { 
      id: newId, 
      nome: novoPaciente.nome, 
      prontuario: novoPaciente.prontuario || Math.floor(Math.random() * 900000 + 100000).toString(),
      idade: novoPaciente.idade, 
      tempo: "0 min", 
      tipo: novoPaciente.tipo,
      status: novoPaciente.status,
      setorId: novoPaciente.setorId,
      nomeSetor
    };

    // Adiciona na fila local (Aguardando Avaliação)
    setFila([paciente, ...fila]);

    // Envia para as pendências da enfermagem
    const pendencias = JSON.parse(localStorage.getItem("hospital_pendencias") || "[]");
    pendencias.push(paciente);
    localStorage.setItem("hospital_pendencias", JSON.stringify(pendencias));

    setNovoPaciente({ nome: "", prontuario: "", idade: "", tipo: "voluntaria", status: "calmo", setorId: "" });
    setOpenAdmissao(false);
    
    // Mostra um aviso rápido (opcional, como o toast já está no layout, poderíamos usar)
    // toast.success("Paciente admitido e notificado para Enfermagem.");
  };

  const handleAddVisitante = () => {
    if (!novoVisitante.nome || !novoVisitante.paciente) return;
    const newId = Date.now();
    const horaAtual = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setVisitantes([{
      id: newId,
      nome: novoVisitante.nome,
      paciente: novoVisitante.paciente,
      leito: novoVisitante.leito || "Aguardando",
      entrada: horaAtual
    }, ...visitantes]);
    setNovoVisitante({ nome: "", paciente: "", leito: "" });
    setOpenVisitante(false);
  };

  const handleRemoveVisitante = (id) => {
    setVisitantes(visitantes.filter(v => v.id !== id));
  };

  const handleChamarPaciente = (id) => {
    setFila(fila.filter(p => p.id !== id));
  };

  const filaFiltrada = fila.filter(p => p.nome.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Recepção Psiquiátrica
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Gerenciamento de admissões, avaliações e visitantes.
          </p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <Dialog open={openAdmissao} onOpenChange={setOpenAdmissao}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 flex-1 md:flex-none">
                <UserPlus className="w-4 h-4" />
                Nova Admissão
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-slate-50 dark:bg-slate-900 border-0">
              <div className="bg-emerald-600 dark:bg-emerald-800 p-6 text-white flex justify-between items-center">
                <div>
                  <DialogTitle className="text-2xl font-bold">Ficha de Admissão Psiquiátrica</DialogTitle>
                  <p className="text-emerald-100 text-sm mt-1">Preencha os dados curriculares do paciente para internação</p>
                </div>
              </div>
              
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Coluna da Foto */}
                <div className="flex flex-col items-center gap-4">
                  <div className="w-40 h-48 bg-slate-200 dark:bg-slate-800 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400 overflow-hidden relative group cursor-pointer hover:border-emerald-500 hover:text-emerald-500 transition-colors">
                    {novoPaciente.foto ? (
                      <img src={novoPaciente.foto} alt="Foto do paciente" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <User className="w-12 h-12 mb-2 opacity-50" />
                        <span className="text-xs font-semibold uppercase tracking-wider text-center px-4">Adicionar<br/>Foto 3x4</span>
                      </>
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setNovoPaciente({...novoPaciente, foto: reader.result});
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 text-center uppercase font-bold tracking-wider">
                    Obrigatório para identificação<br/>no prontuário
                  </p>
                </div>

                {/* Coluna dos Dados */}
                <div className="md:col-span-2 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome Completo</label>
                      <Input 
                        placeholder="Nome civil do paciente" 
                        value={novoPaciente.nome}
                        onChange={(e) => setNovoPaciente({...novoPaciente, nome: e.target.value})}
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nº Prontuário</label>
                      <Input 
                        placeholder="Gerado auto. se vazio" 
                        value={novoPaciente.prontuario}
                        onChange={(e) => setNovoPaciente({...novoPaciente, prontuario: e.target.value})}
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11 font-mono"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Idade</label>
                      <Input 
                        type="number"
                        placeholder="Idade (anos)" 
                        value={novoPaciente.idade}
                        onChange={(e) => setNovoPaciente({...novoPaciente, idade: e.target.value})}
                        className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-11"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Tipo de Internação</label>
                      <select 
                        className="flex h-11 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        value={novoPaciente.tipo}
                        onChange={(e) => setNovoPaciente({...novoPaciente, tipo: e.target.value})}
                      >
                        <option value="voluntaria">Voluntária (Consentimento)</option>
                        <option value="involuntaria">Involuntária (Terceiros)</option>
                        <option value="compulsoria">Compulsória (Judicial)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Estado (Avaliação Inicial)</label>
                      <select 
                        className="flex h-11 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        value={novoPaciente.status}
                        onChange={(e) => setNovoPaciente({...novoPaciente, status: e.target.value})}
                      >
                        <option value="calmo">Calmo / Colaborativo</option>
                        <option value="agitado">Agitado / Agressivo</option>
                        <option value="fuga">Risco de Fuga / Contenção</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Encaminhamento (Setor)</label>
                      <select 
                        className="flex h-11 w-full rounded-md border border-slate-200 dark:border-slate-800 bg-emerald-50 dark:bg-emerald-900/10 px-3 py-2 text-sm font-semibold text-emerald-800 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        value={novoPaciente.setorId}
                        onChange={(e) => setNovoPaciente({...novoPaciente, setorId: e.target.value})}
                      >
                        <option value="">-- Selecionar Ala de Destino --</option>
                        {setoresDisponiveis.map(s => (
                          <option key={s.id} value={s.id}>{s.nome} ({s.owner === 'terceirizado' ? 'Terceirizada' : 'Geral'})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-100 dark:bg-slate-800/50 p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                <Button variant="outline" className="border-slate-300 dark:border-slate-700" onClick={() => setOpenAdmissao(false)}>Cancelar Admissão</Button>
                <Button onClick={handleAddPaciente} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold px-6">
                  <UserPlus className="w-4 h-4" /> Finalizar Admissão
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={openVisitante} onOpenChange={setOpenVisitante}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 flex-1 md:flex-none border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                <Users className="w-4 h-4" />
                Novo Visitante
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Novo Visitante</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Visitante/Acompanhante</label>
                  <Input 
                    placeholder="Ex: Maria José" 
                    value={novoVisitante.nome}
                    onChange={(e) => setNovoVisitante({...novoVisitante, nome: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do Paciente Visitado</label>
                  <Input 
                    placeholder="Ex: Carlos Alberto" 
                    value={novoVisitante.paciente}
                    onChange={(e) => setNovoVisitante({...novoVisitante, paciente: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Setor / Ala</label>
                  <Input 
                    placeholder="Ex: Ala Masculina 05" 
                    value={novoVisitante.leito}
                    onChange={(e) => setNovoVisitante({...novoVisitante, leito: e.target.value})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpenVisitante(false)}>Cancelar</Button>
                <Button onClick={handleAddVisitante}>Registrar Entrada</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Aguardando Avaliação</p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{fila.length}</h3>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Bed className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Vagas em Alas</p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">45</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Internados</p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">128</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-400">
            <User className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Visitantes Ativos</p>
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{visitantes.length}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Fila de Avaliação */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-500" />
              Aguardando Avaliação Psiquiátrica
            </h2>
            <div className="relative w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input 
                placeholder="Buscar paciente..." 
                className="pl-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-medium">Paciente</th>
                  <th className="px-6 py-4 font-medium">Idade / Tempo</th>
                  <th className="px-6 py-4 font-medium">Tipo de Admissão</th>
                  <th className="px-6 py-4 font-medium">Estado</th>
                  <th className="px-6 py-4 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filaFiltrada.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                      Nenhum paciente aguardando avaliação.
                    </td>
                  </tr>
                ) : filaFiltrada.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
                          <User className="w-4 h-4 text-slate-400" />
                        </div>
                        <div>
                          <span className="font-medium text-slate-700 dark:text-slate-200 block">{item.nome}</span>
                          <span className="text-xs text-slate-400 font-mono">Pront: {item.prontuario}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {item.idade} anos
                      <div className="text-xs mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {item.tempo}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${tipoColors[item.tipo]}`} />
                        <span className="capitalize text-slate-600 dark:text-slate-300">{item.tipo}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-semibold uppercase tracking-wider ${statusColors[item.status]}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleChamarPaciente(item.id)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                      >
                        Avaliar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Visitantes Ativos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-500" />
              Visitantes Ativos
            </h2>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-300px)] min-h-[400px]">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-800/20">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Visitantes no momento</p>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto space-y-3">
              {visitantes.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2 opacity-50" />
                  Nenhum visitante no momento
                </div>
              ) : visitantes.map(visitante => (
                <div key={visitante.id} className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800/50 transition-colors bg-white dark:bg-slate-900 flex items-start gap-3 relative group">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0 pr-6">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{visitante.nome}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">Visita: <span className="font-medium text-slate-700 dark:text-slate-300">{visitante.paciente}</span></p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-left truncate max-w-[120px]">
                        {visitante.leito}
                      </span>
                      <span className="text-[10px] text-slate-400">Entrou às {visitante.entrada}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRemoveVisitante(visitante.id)}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 bg-white dark:bg-slate-900 rounded-full p-1 shadow-sm border border-slate-200 dark:border-slate-700"
                    title="Registrar Saída"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
