import { useState, useEffect } from 'react';
import { useWelcome } from "@/lib/AppInitializer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { addLog } from "@/lib/logger";
import { db } from "@/api/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ComboboxMedicamento } from "@/components/ui/combobox-medicamento";
import { 
  Pill, 
  Syringe, 
  ArrowLeft, 
  User, 
  ClipboardCheck, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  Search,
  ShieldCheck,
  Zap,
  Clock,
  Siren,
  Bell,
  Check,
  PackageCheck,
  CalendarCheck,
  AlertOctagon,
  Lock,
  Trash2,
  Pencil,
  ArrowRight
} from "lucide-react";

// A lista padrão de medicamentos foi migrada para o banco de dados oficial via tabela CarrinhoPadronizacao.

// Carrinhos de Parada Padrão do Hospital
const DEFAULT_CARTS = [
  { id: 'r2', nome: 'Carrinho R2', setor: 'Setor R2' },
  { id: 'r3', nome: 'Carrinho R3', setor: 'Setor R3' },
  { id: 'ucp', nome: 'Carrinho UCP', setor: 'Setor UCP' }
];

export default function CarrinhoParada() {
  const { showWelcome } = useWelcome();
  const queryClient = useQueryClient();
  const [viewState, setViewState] = useState('role_selection'); // 'role_selection', 'pharmacy', 'nursing'
  const [nursingView, setNursingView] = useState('dashboard'); // 'dashboard', 'form', 'print_preview', 'emergency_form', 'daily_seal_form'
  
  // Storage de Multi-Carrinhos
  const [carrinhos, setCarrinhos] = useState(() => {
    const saved = localStorage.getItem("axion_carrinhos_lista");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return DEFAULT_CARTS;
  });

  const [carrinhoSelecionadoId, setCarrinhoSelecionadoId] = useState('r2');

  // Form State para criar / gerenciar carrinhos
  const [isCriandoCarrinho, setIsCriandoCarrinho] = useState(false);
  const [isGerenciandoCarrinhos, setIsGerenciandoCarrinhos] = useState(false);
  const [novoCarrinhoNome, setNovoCarrinhoNome] = useState('');
  const [novoCarrinhoSetor, setNovoCarrinhoSetor] = useState('');
  const [carrinhoOrigemCopia, setCarrinhoOrigemCopia] = useState('r2');

  // State para edição de carrinho
  const [editingCartId, setEditingCartId] = useState(null);
  const [editingCartNome, setEditingCartNome] = useState('');
  const [editingCartSetor, setEditingCartSetor] = useState('');

  // Storage de Checagens Mensais (Completa)
  const [checagensMensais, setChecagensMensais] = useState([]);
  const [selectedChecagem, setSelectedChecagem] = useState(null);
  
  // Storage de Checagens Diárias do Lacre
  const [checagensDiariasLacre, setChecagensDiariasLacre] = useState([]);

  // Dados puxados do Banco Oficial
  const { data: medicamentos = [] } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });
  const { data: lotes = [] } = useQuery({
    queryKey: ['lotes'],
    queryFn: () => db.entities.Lote.list(),
  });
  const { data: padronizacao = [] } = useQuery({
    queryKey: ['carrinho_padronizacao'],
    queryFn: () => db.entities.CarrinhoPadronizacao.list(),
  });
  const { data: estoqueCentral = [] } = useQuery({
    queryKey: ['carrinho_estoque_central'],
    queryFn: () => db.entities.CarrinhoEstoqueCentral.list(),
  });
  const { data: estoqueFisico = [] } = useQuery({
    queryKey: ['carrinho_estoque_fisico'],
    queryFn: () => db.entities.CarrinhoEstoqueFisico.list(),
  });

  // Form State para adicionar novo item ao padrão
  const [novoItemMedicamentoId, setNovoItemMedicamentoId] = useState('');
  const [novoItemQtd, setNovoItemQtd] = useState(1);
  const [isAdicionandoItem, setIsAdicionandoItem] = useState(false);

  // Lacre Registrado Atual no Sistema
  const [lacreRegistradoAtual, setLacreRegistradoAtual] = useState('784512');
  const [carrinhoBloqueado, setCarrinhoBloqueado] = useState(false);

  // Storage de Solicitações de Reposição / Chamados de Emergência
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [selectedSolicitacaoToReplenish, setSelectedSolicitacaoToReplenish] = useState(null);
  const [selectedInconsistencia, setSelectedInconsistencia] = useState(null);
  const [novoLacreResolverInconsistencia, setNovoLacreResolverInconsistencia] = useState('');
  const [novoLacreFarmacia, setNovoLacreFarmacia] = useState('');
  const [farmaceuticoNome, setFarmaceuticoNome] = useState('');
  const [reposicaoQtds, setReposicaoQtds] = useState({}); // { padronizacaoId: qtdARepor }
  const [reposicaoJustificativa, setReposicaoJustificativa] = useState('');

  // Form State para Distribuição do Estoque Central para o Carrinho Físico
  const [selectedCentralItem, setSelectedCentralItem] = useState(null);
  const [distribuirDestinoId, setDistribuirDestinoId] = useState('');
  const [distribuirQtd, setDistribuirQtd] = useState(1);

  // Form State para Checagem Mensal
  const [enfermeiroNome, setEnfermeiroNome] = useState('');
  const [coren, setCoren] = useState('');
  const [setor, setSetor] = useState('Emergência / UTI');
  const [lacreAtual, setLacreAtual] = useState('');
  const [novoLacre, setNovoLacre] = useState('');
  const [testeDesfibrilador, setTesteDesfibrilador] = useState(true);
  const [testeCargaBateria, setTesteCargaBateria] = useState(true);
  const [itemsCheckState, setItemsCheckState] = useState([]);
  const [filterText, setFilterText] = useState('');

  // Form State para Checagem Diária do Lacre
  const [lacreDigitadoDiario, setLacreDigitadoDiario] = useState('');
  const [observacaoDiariaLacre, setObservacaoDiariaLacre] = useState('');

  // Form State para Abertura em Emergência (Atendimento a Paciente)
  const [pacienteNome, setPacienteNome] = useState('');
  const [leito, setLeito] = useState('');
  const [prontuario, setProntuario] = useState('');
  const [medicoResponsavel, setMedicoResponsavel] = useState('');
  const [motivoAbertura, setMotivoAbertura] = useState('Parada Cardiorrespiratória (PCR)');
  const [lacreRompidoEmergencia, setLacreRompidoEmergencia] = useState('');
  const [novoLacreEmergencia, setNovoLacreEmergencia] = useState('');
  const [itensConsumidos, setItensConsumidos] = useState({});

  useEffect(() => {
    const checkMode = () => {
      const mode = sessionStorage.getItem("axion_carrinho_mode");
      if (mode === "nursing") {
        setViewState(prev => prev !== "nursing" ? "nursing" : prev);
      } else if (mode === "pharmacy") {
        setViewState(prev => prev !== "pharmacy" ? "pharmacy" : prev);
      }

      const userStr = sessionStorage.getItem("axion_active_user");
      if (userStr) {
        try {
          const u = JSON.parse(userStr);
          if (u.nome) {
            setEnfermeiroNome(prev => prev !== u.nome ? u.nome : prev);
            setFarmaceuticoNome(prev => prev !== u.nome ? u.nome : prev);
          }
        } catch (e) {}
      }
    };

    checkMode();
    const interval = setInterval(checkMode, 800);
    return () => clearInterval(interval);
  }, []);

  // Carregar dados específicos do Carrinho Selecionado
  useEffect(() => {
    if (!carrinhoSelecionadoId) return;



    // 2. Lacre ativo
    const savedSeal = localStorage.getItem(`axion_carrinho_lacre_ativo_${carrinhoSelecionadoId}`) || localStorage.getItem("axion_carrinho_lacre_ativo") || '784512';
    setLacreRegistradoAtual(savedSeal);

    // 3. Bloqueio
    const savedBloqueio = (localStorage.getItem(`axion_carrinho_bloqueado_${carrinhoSelecionadoId}`) || localStorage.getItem("axion_carrinho_bloqueado")) === "true";
    setCarrinhoBloqueado(savedBloqueio);

    // 4. Checagens Mensais
    const savedChecks = localStorage.getItem(`axion_carrinho_checagens_${carrinhoSelecionadoId}`) || localStorage.getItem("axion_carrinho_checagens");
    if (savedChecks) {
      try { setChecagensMensais(JSON.parse(savedChecks)); } catch (e) { setChecagensMensais([]); }
    } else { setChecagensMensais([]); }

    // 5. Checagens Diárias
    const savedDaily = localStorage.getItem(`axion_carrinho_checagens_diarias_${carrinhoSelecionadoId}`) || localStorage.getItem("axion_carrinho_checagens_diarias");
    if (savedDaily) {
      try { setChecagensDiariasLacre(JSON.parse(savedDaily)); } catch (e) { setChecagensDiariasLacre([]); }
    } else { setChecagensDiariasLacre([]); }

    // 6. Solicitações de Emergência
    const savedReqs = localStorage.getItem(`axion_carrinho_solicitacoes_${carrinhoSelecionadoId}`) || localStorage.getItem("axion_carrinho_solicitacoes");
    if (savedReqs) {
      try { setSolicitacoes(JSON.parse(savedReqs)); } catch (e) { setSolicitacoes([]); }
    } else { setSolicitacoes([]); }
  }, [carrinhoSelecionadoId]);

  // Criar Novo Carrinho com opção de copiar padronização
  const criarNovoCarrinho = (e) => {
    e.preventDefault();
    if (!novoCarrinhoNome || !novoCarrinhoSetor) {
      toast.error("Preencha o Nome e o Setor do novo carrinho.");
      return;
    }

    const newId = 'carrinho_' + Date.now().toString();
    const novoObj = {
      id: newId,
      nome: novoCarrinhoNome.trim(),
      setor: novoCarrinhoSetor.trim()
    };

    const novaLista = [...carrinhos, novoObj];
    setCarrinhos(novaLista);
    localStorage.setItem("axion_carrinhos_lista", JSON.stringify(novaLista));

    // Copiar padronização de insumos do carrinho origem (ou DEFAULT_ITEMS)
    const origemKey = `axion_carrinho_padrao_items_${carrinhoOrigemCopia}`;
    const padraoOrigemStr = localStorage.getItem(origemKey) || localStorage.getItem("axion_carrinho_padrao_items");
    let padraoParaCopiar = DEFAULT_ITEMS;
    if (padraoOrigemStr) {
      try {
        const parsed = JSON.parse(padraoOrigemStr);
        if (Array.isArray(parsed) && parsed.length > 0) padraoParaCopiar = parsed;
      } catch (err) {
        console.error(err);
      }
    }

    localStorage.setItem(`axion_carrinho_padrao_items_${newId}`, JSON.stringify(padraoParaCopiar));
    const lacreGerado = Math.floor(100000 + Math.random() * 900000).toString();
    localStorage.setItem(`axion_carrinho_lacre_ativo_${newId}`, lacreGerado);

    addLog(farmaceuticoNome || 'Farmacêutico', "Novo Carrinho", `Criado carrinho "${novoCarrinhoNome}" para o setor "${novoCarrinhoSetor}".`);
    toast.success(`✅ Novo carrinho "${novoCarrinhoNome}" criado com sucesso!`);
    setNovoCarrinhoNome('');
    setNovoCarrinhoSetor('');
    setIsCriandoCarrinho(false);
    setCarrinhoSelecionadoId(newId);
  };

  const salvarEdicaoCarrinho = (e) => {
    e.preventDefault();
    if (!editingCartNome || !editingCartSetor) return;

    const atualizados = carrinhos.map(c => {
      if (c.id === editingCartId) {
        return { ...c, nome: editingCartNome.trim(), setor: editingCartSetor.trim() };
      }
      return c;
    });

    setCarrinhos(atualizados);
    localStorage.setItem("axion_carrinhos_lista", JSON.stringify(atualizados));
    toast.success("✅ Dados do carrinho atualizados com sucesso!");
    setEditingCartId(null);
  };

  const excluirCarrinho = (cartId) => {
    if (carrinhos.length <= 1) {
      toast.error("O sistema deve manter pelo menos 1 Carrinho de Parada.");
      return;
    }
    const cartObj = carrinhos.find(c => c.id === cartId);
    if (!window.confirm(`Tem certeza que deseja excluir o ${cartObj?.nome}? Todos os registros vinculados serão mantidos no histórico.`)) return;

    const atualizados = carrinhos.filter(c => c.id !== cartId);
    setCarrinhos(atualizados);
    localStorage.setItem("axion_carrinhos_lista", JSON.stringify(atualizados));

    if (carrinhoSelecionadoId === cartId) {
      setCarrinhoSelecionadoId(atualizados[0].id);
    }

    toast.success(`🗑️ ${cartObj?.nome} excluído com sucesso!`);
  };

  const iniciarNovaChecagemMensal = () => {
    const initialItems = padronizacao.map(item => ({
      ...item,
      nome: item.medicamento_nome,
      isMav: item.is_mav,
      conforme: true,
      qtdConferida: item.qtd_padrao,
      loteConferido: '',
      validadeConferida: '',
      observacao: ''
    }));
    setItemsCheckState(initialItems);
    setLacreAtual(lacreRegistradoAtual);
    setNovoLacre('');
    setNursingView('form');
  };

  const iniciarChecagemDiariaLacre = () => {
    setLacreDigitadoDiario('');
    setObservacaoDiariaLacre('');
    setNursingView('daily_seal_form');
  };

  const iniciarAberturaEmergencia = () => {
    setPacienteNome('');
    setLeito('');
    setProntuario('');
    setMedicoResponsavel('');
    setMotivoAbertura('Parada Cardiorrespiratória (PCR)');
    setLacreRompidoEmergencia(lacreRegistradoAtual);
    setNovoLacreEmergencia('');
    
    const initialConsumo = {};
    padronizacao.forEach(item => {
      initialConsumo[item.id] = 0;
    });
    setItensConsumidos(initialConsumo);
    setNursingView('emergency_form');
  };

  const handleItemChange = (id, field, value) => {
    setItemsCheckState(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const updateConsumo = (id, delta) => {
    setItensConsumidos(prev => {
      const current = prev[id] || 0;
      const nextVal = Math.max(0, current + delta);
      return { ...prev, [id]: nextVal };
    });
  };

  // Salvar Checagem Mensal Completa
  const salvarChecagemMensal = (e) => {
    e.preventDefault();
    if (!enfermeiroNome || !coren) {
      toast.error("Por favor, preencha o Nome do Enfermeiro e o COREN.");
      return;
    }
    if (!lacreAtual) {
      toast.error("Por favor, informe o número do Lacre Atual.");
      return;
    }

    const temDivergencia = itemsCheckState.some(
      item => !item.conforme || item.qtdConferida !== item.qtdPadrao || item.observacao.trim() !== ''
    );

    const novoLacreDefinitivo = novoLacre || lacreAtual;

    const novaChecagem = {
      id: Date.now().toString(),
      tipo: 'Mensal',
      dataHora: new Date().toISOString(),
      enfermeiroNome,
      coren,
      setor,
      lacreAtual,
      novoLacre: novoLacreDefinitivo,
      testeDesfibrilador,
      testeCargaBateria,
      status: temDivergencia ? 'Com Divergência' : 'Conforme',
      items: itemsCheckState
    };

    const novasChecagens = [novaChecagem, ...checagensMensais];
    setChecagensMensais(novasChecagens);
    localStorage.setItem(`axion_carrinho_checagens_${carrinhoSelecionadoId}`, JSON.stringify(novasChecagens));

    setLacreRegistradoAtual(novoLacreDefinitivo);
    localStorage.setItem(`axion_carrinho_lacre_ativo_${carrinhoSelecionadoId}`, novoLacreDefinitivo);

    // Limpar inconsistências da lista de alertas da Farmácia pois a Enfermagem auditou o carrinho
    const diariasAtualizadas = checagensDiariasLacre.map(c => {
      if (c.status && c.status.includes('INCONSISTÊNCIA')) {
        return {
          ...c,
          status: `✓ AUDITADO & RESOLVIDO PELA ENFERMAGEM (Lacre: ${novoLacreDefinitivo})`,
          resolvidoEm: new Date().toISOString(),
          resolvidoPor: enfermeiroNome
        };
      }
      return c;
    });
    setChecagensDiariasLacre(diariasAtualizadas);
    localStorage.setItem(`axion_carrinho_checagens_diarias_${carrinhoSelecionadoId}`, JSON.stringify(diariasAtualizadas));

    // Desbloquear a checagem diária pois a auditoria mensal foi concluída
    setCarrinhoBloqueado(false);
    localStorage.removeItem(`axion_carrinho_bloqueado_${carrinhoSelecionadoId}`);

    toast.success("✅ Checagem Mensal concluída! Carrinho auditado e Checagem Diária liberada.");
    setSelectedChecagem(novaChecagem);
    setNursingView('print_preview');
  };

  // Limpar Históricos para Testes
  const limparHistoricos = () => {
    setChecagensDiariasLacre([]);
    setChecagensMensais([]);
    setSolicitacoes([]);
    setCarrinhoBloqueado(false);
    localStorage.removeItem(`axion_carrinho_checagens_diarias_${carrinhoSelecionadoId}`);
    localStorage.removeItem(`axion_carrinho_checagens_${carrinhoSelecionadoId}`);
    localStorage.removeItem(`axion_carrinho_solicitacoes_${carrinhoSelecionadoId}`);
    localStorage.removeItem(`axion_carrinho_bloqueado_${carrinhoSelecionadoId}`);
    toast.success("✨ Todos os históricos e bloqueios foram limpos para testes!");
  };

  // Handlers para Farmácia gerenciar Padronização Oficial


  const adicionarNovoItemPadrao = async (e) => {
    e.preventDefault();
    if (!novoItemMedicamentoId) {
      toast.error("Selecione um medicamento válido do banco de dados.");
      return;
    }
    
    const medSelecionado = medicamentos.find(m => m.id === novoItemMedicamentoId);
    if (!medSelecionado) return;

    const dose = (medSelecionado.dosagem || medSelecionado.concentracao || (medSelecionado.unidade_medida && !["un", "unidade", "unid", "-", ""].includes(medSelecionado.unidade_medida.toLowerCase()) ? medSelecionado.unidade_medida : "")).trim();
    const apres = medSelecionado.apresentacao ? ` [${medSelecionado.apresentacao}]` : "";
    const doseStr = dose ? ` - ${dose}` : "";
    const nomeCompleto = `${medSelecionado.nome}${apres}${doseStr}`;

    try {
      await db.entities.CarrinhoPadronizacao.create({
        medicamento_id: medSelecionado.id,
        medicamento_nome: nomeCompleto,
        qtd_padrao: parseInt(novoItemQtd, 10) || 1,
        is_mav: Boolean(medSelecionado.is_mav)
      });

      queryClient.invalidateQueries({ queryKey: ['carrinho_padronizacao'] });

      setNovoItemMedicamentoId('');
      setNovoItemQtd(1);
      setIsAdicionandoItem(false);
      toast.success("Novo item adicionado à padronização!");
    } catch (e) {
      toast.error("Erro ao adicionar padronização: " + e);
    }
  };

  const excluirItemPadrao = async (id) => {
    try {
      await db.entities.CarrinhoPadronizacao.delete(id);
      queryClient.invalidateQueries({ queryKey: ['carrinho_padronizacao'] });
      toast.success("Item removido da padronização.");
    } catch (e) {
      toast.error("Erro ao remover: " + e);
    }
  };

  // Salvar Checagem Diária do Lacre
  const salvarChecagemDiariaLacre = (e) => {
    e.preventDefault();
    if (!enfermeiroNome || !coren) {
      toast.error("Preencha o Nome do Enfermeiro e COREN.");
      return;
    }
    if (!lacreDigitadoDiario) {
      toast.error("Digite o número do lacre que está no carrinho hoje.");
      return;
    }

    const lacreCorreto = lacreRegistradoAtual.trim();
    const lacreDigitado = lacreDigitadoDiario.trim();
    const isConforme = lacreCorreto === lacreDigitado;

    const registroDiario = {
      id: Date.now().toString(),
      tipo: 'Diária do Lacre',
      dataHora: new Date().toISOString(),
      enfermeiroNome,
      coren,
      setor,
      lacreRegistrado: lacreCorreto,
      lacreDigitado: lacreDigitado,
      status: isConforme ? 'Conforme (Lacre Intacto)' : 'INCONSISTÊNCIA (Lacre Violado/Divergente)',
      observacao: observacaoDiariaLacre
    };

    const novasDiarias = [registroDiario, ...checagensDiariasLacre];
    setChecagensDiariasLacre(novasDiarias);
    localStorage.setItem(`axion_carrinho_checagens_diarias_${carrinhoSelecionadoId}`, JSON.stringify(novasDiarias));

    if (isConforme) {
      toast.success("✅ Checagem diária realizada: Lacre intacto e conforme!");
    } else {
      toast.error("🚨 INCONSISTÊNCIA DETECTADA! A Checagem Diária foi BLOQUEADA. É necessário realizar a Checagem Mensal Completa para auditar e liberar o carrinho.");
      addLog(enfermeiroNome, "Alerta Lacre", `Inconsistência no lacre do Carrinho: Registrado ${lacreCorreto} vs Encontrado ${lacreDigitado}`);
      setCarrinhoBloqueado(true);
      localStorage.setItem(`axion_carrinho_bloqueado_${carrinhoSelecionadoId}`, "true");
    }

    setNursingView('dashboard');
  };

  // Enviar Chamado de Emergência para a Farmácia
  const salvarAberturaEmergencia = async (e) => {
    e.preventDefault();
    if (!pacienteNome || !leito) {
      toast.error("Preencha o Nome do Paciente e o Leito.");
      return;
    }
    if (!enfermeiroNome || !coren) {
      toast.error("Preencha o Nome do Enfermeiro e o COREN.");
      return;
    }
    if (!lacreRompidoEmergencia) {
      toast.error("Informe o número do lacre rompido.");
      return;
    }

    const listaConsumidos = padronizacao.filter(item => (itensConsumidos[item.id] || 0) > 0)
      .map(item => ({
        id: item.id,
        nome: item.medicamento_nome,
        qtd: itensConsumidos[item.id]
      }));

    if (listaConsumidos.length === 0) {
      toast.error("Selecione ao menos 1 medicamento ou material utilizado no atendimento.");
      return;
    }

    const novaSolicitacao = {
      id: Date.now().toString(),
      dataHora: new Date().toISOString(),
      pacienteNome,
      leito,
      prontuario: prontuario || 'S/N',
      medicoResponsavel: medicoResponsavel || 'Não informado',
      motivo: motivoAbertura,
      lacreRompido: lacreRompidoEmergencia,
      novoLacreColocado: novoLacreEmergencia || 'Aguardando Reposição',
      enfermeiroNome,
      coren,
      setor,
      itens: listaConsumidos,
      status: 'pendente'
    };

    if (novoLacreEmergencia) {
      setLacreRegistradoAtual(novoLacreEmergencia);
      localStorage.setItem(`axion_carrinho_lacre_ativo_${carrinhoSelecionadoId}`, novoLacreEmergencia);
    }

    const novasSolicitacoes = [novaSolicitacao, ...solicitacoes];
    setSolicitacoes(novasSolicitacoes);
    localStorage.setItem(`axion_carrinho_solicitacoes_${carrinhoSelecionadoId}`, JSON.stringify(novasSolicitacoes));

    // Descontar itens consumidos do Estoque Físico do Carrinho
    const carrinhoId = carrinhoSelecionadoId;
    for (const item of listaConsumidos) {
      // Achar item no estoque físico
      const padItem = padronizacao.find(p => p.id === item.id);
      if (!padItem) continue;
      const itensNoFisico = estoqueFisico
        .filter(e => e.carrinho_id === carrinhoId && e.medicamento_id === padItem.medicamento_id)
        .sort((a, b) => new Date(a.data_validade || a.validade) - new Date(b.data_validade || b.validade));
      let qtdParaDescontar = item.qtd;
      for (const fisico of itensNoFisico) {
        if (qtdParaDescontar <= 0) break;
        const desconta = Math.min(fisico.quantidade, qtdParaDescontar);
        const novaQtd = fisico.quantidade - desconta;
        try {
          if (novaQtd <= 0) {
            await db.entities.CarrinhoEstoqueFisico.delete(fisico.id);
          } else {
            await db.entities.CarrinhoEstoqueFisico.update(fisico.id, { quantidade: novaQtd });
          }
          qtdParaDescontar -= desconta;
        } catch (err) {
          console.error('Erro ao descontar estoque físico:', err);
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: ['carrinho_estoque_fisico'] });

    addLog(enfermeiroNome, "Emergência Carrinho", `Abertura para paciente ${pacienteNome} (Leito: ${leito}). Solicitada reposição à Farmácia.`);

    toast.success("🚨 Chamado de emergência registrado! Alerta enviado para a Farmácia.");
    setNursingView('dashboard');
  };

  // Farmácia: Atender Reposição com controle de estoque central item a item
  const confirmarReposicaoFarmacia = async (e) => {
    e.preventDefault();
    if (!farmaceuticoNome || !novoLacreFarmacia) {
      toast.error("Preencha o nome do farmacêutico e o número do novo lacre.");
      return;
    }

    const req = selectedSolicitacaoToReplenish;
    let totalRepostos = 0;
    let totalNecessario = 0;

    for (const item of req.itens) {
      const padItem = padronizacao.find(p => p.id === item.id);
      if (!padItem) continue;

      const qtdARepor = parseInt(reposicaoQtds[item.id] ?? Math.min(item.qtd, estoqueCentral.filter(c => c.medicamento_id === padItem.medicamento_id).reduce((s,c)=>s+(c.quantidade||0),0)), 10);
      totalNecessario += item.qtd;
      totalRepostos += qtdARepor;

      if (qtdARepor <= 0) continue;

      // Retirar do Estoque Central (FEFO) e adicionar ao Estoque Físico
      const centraisDesse = estoqueCentral
        .filter(c => c.medicamento_id === padItem.medicamento_id)
        .sort((a, b) => new Date(a.data_validade || a.validade) - new Date(b.data_validade || b.validade));

      let qtdRestante = qtdARepor;
      for (const central of centraisDesse) {
        if (qtdRestante <= 0) break;
        const usa = Math.min(central.quantidade, qtdRestante);
        try {
          const novaCentralQtd = central.quantidade - usa;
          if (novaCentralQtd <= 0) {
            await db.entities.CarrinhoEstoqueCentral.delete(central.id);
          } else {
            await db.entities.CarrinhoEstoqueCentral.update(central.id, { quantidade: novaCentralQtd });
          }

          const existenteFisico = estoqueFisico.find(
            f => f.carrinho_id === carrinhoSelecionadoId
              && f.medicamento_id === padItem.medicamento_id
              && (f.numero_lote === (central.numero_lote || central.lote) || f.lote === (central.lote || central.numero_lote))
          );
          if (existenteFisico) {
            await db.entities.CarrinhoEstoqueFisico.update(existenteFisico.id, { quantidade: existenteFisico.quantidade + usa });
          } else {
            await db.entities.CarrinhoEstoqueFisico.create({
              carrinho_id: carrinhoSelecionadoId,
              medicamento_id: padItem.medicamento_id,
              medicamento_nome: padItem.medicamento_nome,
              lote_id: central.lote_id || 'UNKNOWN',
              numero_lote: central.numero_lote || central.lote,
              data_validade: central.data_validade || central.validade,
              lote: central.lote || central.numero_lote,
              validade: central.validade || central.data_validade,
              quantidade: usa,
              is_mav: padItem.is_mav
            });
          }

          await db.entities.CarrinhoMovimentacao.create({
            tipo: 'abastecimento_carrinho',
            medicamento_id: padItem.medicamento_id,
            medicamento_nome: padItem.medicamento_nome,
            lote_id: central.lote_id || 'UNKNOWN',
            numero_lote: central.numero_lote || central.lote,
            quantidade: usa,
            carrinho_id: carrinhoSelecionadoId,
            responsavel: farmaceuticoNome,
            observacao: `Reposição após emergência - Paciente: ${req.pacienteNome}`
          });

          qtdRestante -= usa;
        } catch (err) {
          console.error('Erro na reposição do item:', err);
        }
      }
    }

    const isTotal = totalRepostos >= totalNecessario;
    const statusFinal = isTotal ? 'reposto' : 'parcialmente_reposto';

    const newSolicitacoes = solicitacoes.map(s => {
      if (s.id === req.id) {
        return {
          ...s,
          status: statusFinal,
          novoLacreAtribuido: novoLacreFarmacia,
          farmaceuticoNome,
          repostoEm: new Date().toISOString(),
          justificativaParcial: !isTotal ? reposicaoJustificativa : ''
        };
      }
      return s;
    });

    setSolicitacoes(newSolicitacoes);
    localStorage.setItem(`axion_carrinho_solicitacoes_${carrinhoSelecionadoId}`, JSON.stringify(newSolicitacoes));
    setLacreRegistradoAtual(novoLacreFarmacia);
    localStorage.setItem(`axion_carrinho_lacre_ativo_${carrinhoSelecionadoId}`, novoLacreFarmacia);
    setCarrinhoBloqueado(false);
    localStorage.removeItem(`axion_carrinho_bloqueado_${carrinhoSelecionadoId}`);

    queryClient.invalidateQueries({ queryKey: ['carrinho_estoque_central'] });
    queryClient.invalidateQueries({ queryKey: ['carrinho_estoque_fisico'] });

    addLog(farmaceuticoNome, "Reposição Carrinho",
      `${isTotal ? 'Reposição completa' : 'Reposição parcial'} após emergência do paciente ${req.pacienteNome}. Novo lacre: ${novoLacreFarmacia}`);

    toast.success(isTotal
      ? `✅ Carrinho reposto completamente! Lacre ${novoLacreFarmacia} aplicado.`
      : `⚠️ Reposição parcial registrada. Lacre ${novoLacreFarmacia} aplicado.`);

    setSelectedSolicitacaoToReplenish(null);
    setReposicaoQtds({});
    setReposicaoJustificativa('');
    setNovoLacreFarmacia('');
    setFarmaceuticoNome('');
  };

  const distribuirParaCarrinho = async (e) => {
    e.preventDefault();
    if (!selectedCentralItem || !distribuirDestinoId) {
      toast.error("Selecione um item e um carrinho de destino.");
      return;
    }
    const qtd = parseInt(distribuirQtd, 10);
    if (qtd <= 0 || qtd > selectedCentralItem.quantidade) {
      toast.error("Quantidade inválida ou superior ao estoque central.");
      return;
    }

    try {
      // 1. Atualizar ou criar CarrinhoEstoqueFisico
      const existente = estoqueFisico.find(x => x.carrinho_id === distribuirDestinoId && x.medicamento_id === selectedCentralItem.medicamento_id && (x.lote === selectedCentralItem.lote || x.numero_lote === selectedCentralItem.numero_lote));
      if (existente) {
        await db.entities.CarrinhoEstoqueFisico.update(existente.id, { quantidade: existente.quantidade + qtd });
      } else {
        await db.entities.CarrinhoEstoqueFisico.create({
          carrinho_id: distribuirDestinoId,
          medicamento_id: selectedCentralItem.medicamento_id,
          medicamento_nome: selectedCentralItem.medicamento_nome,
          lote_id: selectedCentralItem.lote_id || 'UNKNOWN',
          numero_lote: selectedCentralItem.numero_lote || selectedCentralItem.lote,
          data_validade: selectedCentralItem.data_validade || selectedCentralItem.validade,
          lote: selectedCentralItem.lote || selectedCentralItem.numero_lote,
          validade: selectedCentralItem.validade || selectedCentralItem.data_validade,
          quantidade: qtd,
          is_mav: selectedCentralItem.is_mav
        });
      }

      // 2. Subtrair do CarrinhoEstoqueCentral
      await db.entities.CarrinhoEstoqueCentral.update(selectedCentralItem.id, { quantidade: selectedCentralItem.quantidade - qtd });

      // 3. Opcional: CarrinhoMovimentacao
      await db.entities.CarrinhoMovimentacao.create({
        tipo: 'abastecimento_carrinho',
        medicamento_id: selectedCentralItem.medicamento_id,
        medicamento_nome: selectedCentralItem.medicamento_nome,
        lote_id: selectedCentralItem.lote_id || 'UNKNOWN',
        numero_lote: selectedCentralItem.numero_lote || selectedCentralItem.lote,
        quantidade: qtd,
        carrinho_id: distribuirDestinoId,
        responsavel: 'Farmacêutico',
        observacao: 'Abastecimento a partir do Estoque Central'
      });

      queryClient.invalidateQueries({ queryKey: ['carrinho_estoque_central'] });
      queryClient.invalidateQueries({ queryKey: ['carrinho_estoque_fisico'] });
      
      setSelectedCentralItem(null);
      setDistribuirDestinoId('');
      setDistribuirQtd('');
      toast.success("Medicamento distribuído para o carrinho físico com sucesso!");
    } catch (e) {
      toast.error("Erro na distribuição: " + (e.message || e));
    }
  };

  const retornarParaCentral = async (itemFisico) => {
    if (!window.confirm(`Deseja realmente retornar ${itemFisico.quantidade} un de ${itemFisico.medicamento_nome} para o Estoque Central?`)) return;
    try {
      await db.entities.CarrinhoEstoqueFisico.delete(itemFisico.id);
      
      const central = estoqueCentral.find(c => c.medicamento_id === itemFisico.medicamento_id && (c.lote === itemFisico.lote || c.numero_lote === itemFisico.numero_lote || c.numero_lote === itemFisico.lote));
      if (central) {
        await db.entities.CarrinhoEstoqueCentral.update(central.id, { quantidade: central.quantidade + itemFisico.quantidade });
      } else {
        await db.entities.CarrinhoEstoqueCentral.create({
          medicamento_id: itemFisico.medicamento_id,
          medicamento_nome: itemFisico.medicamento_nome,
          lote_id: itemFisico.lote_id || 'UNKNOWN',
          numero_lote: itemFisico.numero_lote || itemFisico.lote,
          data_validade: itemFisico.data_validade || itemFisico.validade,
          lote: itemFisico.lote || itemFisico.numero_lote,
          validade: itemFisico.validade || itemFisico.data_validade,
          quantidade: itemFisico.quantidade,
          is_mav: itemFisico.is_mav
        });
      }

      await db.entities.CarrinhoMovimentacao.create({
        tipo: 'transferencia_central',
        medicamento_id: itemFisico.medicamento_id,
        medicamento_nome: itemFisico.medicamento_nome,
        lote_id: itemFisico.lote_id || 'UNKNOWN',
        numero_lote: itemFisico.numero_lote || itemFisico.lote,
        quantidade: itemFisico.quantidade,
        carrinho_id: itemFisico.carrinho_id,
        responsavel: 'Farmacêutico',
        observacao: 'Devolução do Carrinho Físico para o Estoque Central'
      });

      queryClient.invalidateQueries({ queryKey: ['carrinho_estoque_central'] });
      queryClient.invalidateQueries({ queryKey: ['carrinho_estoque_fisico'] });
      toast.success(`Retornado ${itemFisico.quantidade} un para o Estoque Central com sucesso!`);
    } catch (e) {
      toast.error("Erro ao retornar: " + (e.message || e));
    }
  };

  // Resolver Inconsistência de Lacre pela Farmácia
  const resolverInconsistenciaLacre = (e) => {
    e.preventDefault();
    if (!novoLacreResolverInconsistencia) {
      toast.error("Por favor, digite o número do Novo Lacre de Segurança.");
      return;
    }

    const atualizadas = checagensDiariasLacre.map(c => {
      if (c.id === selectedInconsistencia.id) {
        return {
          ...c,
          status: `✓ RESOLVIDO (Novo Lacre: ${novoLacreResolverInconsistencia})`,
          resolvidoEm: new Date().toISOString(),
          resolvidoPor: farmaceuticoNome || 'Farmacêutico'
        };
      }
      return c;
    });

    setChecagensDiariasLacre(atualizadas);
    localStorage.setItem("axion_carrinho_checagens_diarias", JSON.stringify(atualizadas));

    setLacreRegistradoAtual(novoLacreResolverInconsistencia);
    localStorage.setItem("axion_carrinho_lacre_ativo", novoLacreResolverInconsistencia);

    setCarrinhoBloqueado(false);
    localStorage.removeItem("axion_carrinho_bloqueado");

    addLog(farmaceuticoNome || 'Farmacêutico', "Resolução Lacre", `Inconsistência resolvida. Novo lacre: ${novoLacreResolverInconsistencia}`);

    toast.success("✅ Novo lacre atribuído com sucesso! Carrinho desbloqueado.");
    setSelectedInconsistencia(null);
    setNovoLacreResolverInconsistencia('');
  };

  const abrirImpressao = (checagem) => {
    setSelectedChecagem(checagem);
    setNursingView('print_preview');
  };

  const acionarImpressaoImpressora = () => {
    window.print();
  };

  const renderCartSelectorHeader = (showCreateButton = true) => {
    return (
      <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg border border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold border border-blue-500/30">
            🛒
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 block uppercase tracking-wider">Carrinho de Parada Selecionado</span>
            <div className="flex items-center gap-2 mt-0.5">
              <select 
                value={carrinhoSelecionadoId}
                onChange={e => setCarrinhoSelecionadoId(e.target.value)}
                className="bg-white text-slate-900 font-black text-sm rounded-lg border border-slate-300 px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {carrinhos.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome} — ({c.setor})
                  </option>
                ))}
              </select>
              {carrinhoBloqueado ? (
                <Badge className="bg-red-500 text-white animate-pulse">🔒 BLOQUEADO</Badge>
              ) : (
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">✓ ATIVO</Badge>
              )}
            </div>
          </div>
        </div>

        {showCreateButton && (
          <div className="flex gap-2">
            <Button 
              onClick={() => setIsCriandoCarrinho(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 text-xs shadow-md shadow-emerald-600/20"
            >
              <Plus className="w-4 h-4" />
              Criar Novo Carrinho
            </Button>
            <Button 
              onClick={() => setIsGerenciandoCarrinhos(true)}
              variant="outline"
              className="border-slate-700 text-slate-200 hover:bg-slate-800 text-xs font-semibold gap-1.5"
            >
              <Pencil className="w-3.5 h-3.5" />
              Gerenciar / Excluir
            </Button>
          </div>
        )}
      </div>
    );
  };

  // ─── TELA DA FARMÁCIA (ALERTAS E REPOSIÇÕES) ────────────────────────────────
  const renderPharmacy = () => {
    const safeSolicitacoes = Array.isArray(solicitacoes) ? solicitacoes : [];
    const safeChecagensDiarias = Array.isArray(checagensDiariasLacre) ? checagensDiariasLacre : [];
    const safeItemsPadrao = Array.isArray(padronizacao) ? padronizacao : [];

    const pendentes = safeSolicitacoes.filter(s => s && s.status === 'pendente');
    const repostas = safeSolicitacoes.filter(s => s && s.status === 'reposto');
    const inconsistencias = safeChecagensDiarias.filter(c => c && c.status && typeof c.status === 'string' && c.status.includes('INCONSISTÊNCIA'));

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4 mb-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => showWelcome && showWelcome()}
            className="rounded-full w-10 h-10 border-slate-200 dark:border-slate-800"
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Controle da Farmácia</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Gestão, Reposição e Padronização dos Carrinhos de Parada</p>
          </div>
        </div>

        {renderCartSelectorHeader(true)}

        {/* Lacre Ativo Registrado */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Lacre de Segurança Atual do Carrinho</span>
              <span className="font-mono font-extrabold text-lg text-slate-900 dark:text-slate-100">{lacreRegistradoAtual}</span>
            </div>
          </div>
          <Badge className={carrinhoBloqueado ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>
            {carrinhoBloqueado ? "🔒 BLOQUEADO POR DIVERGÊNCIA" : "✓ LACRE OK"}
          </Badge>
        </div>

        {/* Banner de Alerta Urgente de Inconsistência de Lacre */}
        {inconsistencias.length > 0 && (
          <div className="bg-red-600 text-white p-5 rounded-2xl shadow-xl flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center font-bold">
                <AlertOctagon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-black flex items-center gap-2">
                  🚨 ALERTA DE SEGURANÇA: INCONSISTÊNCIA DE LACRE DETECTADA! ({inconsistencias.length})
                </h3>
                <p className="text-white/90 text-sm">
                  A Enfermagem detectou divergência no lacre. O carrinho foi bloqueado e o alerta sumirá quando a Enfermagem realizar a Checagem Mensal Completa.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabela de Inconsistências de Lacre Pendentes */}
        {inconsistencias.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-red-300 dark:border-red-900 overflow-hidden shadow-md">
            <div className="p-4 border-b border-red-200 dark:border-red-900 flex justify-between items-center bg-red-50 dark:bg-red-950/40">
              <h4 className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
                <AlertOctagon className="w-5 h-5" />
                Alertas de Lacre Violado / Divergente
              </h4>
              <Badge variant="destructive">{inconsistencias.length} Alerta(s)</Badge>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3 font-medium">Data / Hora</th>
                    <th className="px-4 py-3 font-medium">Enfermeiro(a)</th>
                    <th className="px-4 py-3 font-medium">Lacre Esperado</th>
                    <th className="px-4 py-3 font-medium">Lacre Encontrado</th>
                    <th className="px-4 py-3 font-medium">Status do Alerta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {inconsistencias.map((inc) => (
                    <tr key={inc.id} className="bg-red-50/40 dark:bg-red-950/20 hover:bg-red-50 transition-colors">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {new Date(inc.dataHora).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">{inc.enfermeiroNome}</span>
                        <span className="text-xs text-slate-400">COREN: {inc.coren}</span>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-xs">{inc.lacreRegistrado}</td>
                      <td className="px-4 py-3 font-mono font-extrabold text-xs text-red-600">{inc.lacreDigitado}</td>
                      <td className="px-4 py-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 flex items-center gap-1.5 w-fit">
                          <Clock className="w-3.5 h-3.5" />
                          Aguardando Checagem Mensal da Enfermagem
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Banner de Alerta Urgente de Emergência */}
        {pendentes.length > 0 && (
          <div className="bg-red-500/10 border-2 border-red-500/40 p-5 rounded-2xl flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-500 text-white flex items-center justify-center font-bold">
                <Siren className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                  🚨 REPOSIÇÃO URGENTE SOLICITADA ({pendentes.length})
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm">
                  O Carrinho de Parada foi aberto para atendimento de emergência. A reposição deve ser realizada imediatamente.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tabela de Chamados Pendentes */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-red-50/50 dark:bg-red-950/20">
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Bell className="w-4 h-4 text-red-500" />
              Solicitações de Reposição Pendentes
            </h4>
            <Badge variant="destructive">{pendentes.length} Pendente(s)</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Data / Hora</th>
                  <th className="px-4 py-3 font-medium">Paciente / Leito</th>
                  <th className="px-4 py-3 font-medium">Motivo</th>
                  <th className="px-4 py-3 font-medium">Lacre Rompido</th>
                  <th className="px-4 py-3 font-medium">Enfermeiro(a)</th>
                  <th className="px-4 py-3 font-medium">Itens Solicitados</th>
                  <th className="px-4 py-3 font-medium text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {pendentes.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {new Date(req.dataHora).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">{req.pacienteNome}</span>
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">Leito: {req.leito}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-amber-600 dark:text-amber-400">{req.motivo}</td>
                    <td className="px-4 py-3 font-mono font-bold text-xs">{req.lacreRompido}</td>
                    <td className="px-4 py-3">
                      {req.enfermeiroNome}
                      <span className="text-xs text-slate-400 block">COREN: {req.coren}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {(Array.isArray(req.itens) ? req.itens : []).map(it => (
                          <span key={it.id || Math.random()} className="px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 text-xs font-semibold">
                            {it.qtd || 1}x {(it.nome || 'Item').split(' ')[0]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button 
                        size="sm" 
                        onClick={() => {
                          setSelectedSolicitacaoToReplenish(req);
                          setNovoLacreFarmacia(Math.floor(100000 + Math.random() * 900000).toString());
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-md shadow-emerald-600/20"
                      >
                        <PackageCheck className="w-4 h-4" />
                        Atender & Repor
                      </Button>
                    </td>
                  </tr>
                ))}
                {pendentes.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-8 text-slate-400">
                      Nenhuma solicitação de reposição urgente pendente no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Gestão de Padronização de Itens (Exclusivo Farmácia) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-blue-50/50 dark:bg-blue-950/20">
            <div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Pill className="w-5 h-5 text-blue-600" />
                Padronização Oficial de Insumos e Quantidades (Exclusivo Farmácia)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Defina a lista de itens padronizados do Carrinho de Parada, altere as quantidades padrão exigidas, adicione ou remova itens.
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setIsAdicionandoItem(!isAdicionandoItem)} 
                variant="outline" 
                size="sm"
                className="gap-1.5 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Novo Item
              </Button>
            </div>
          </div>

          {/* Form para adicionar novo item ao padrão */}
          {isAdicionandoItem && (
            <form onSubmit={adicionarNovoItemPadrao} className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-7 gap-3 items-end">
              <div className="sm:col-span-3">
                <label className="text-xs font-semibold block mb-1">Medicamento do Estoque *</label>
                <ComboboxMedicamento
                  medicamentos={medicamentos}
                  value={novoItemMedicamentoId}
                  onChange={(val) => setNovoItemMedicamentoId(val)}
                />
              </div>
              <div className="sm:col-span-1">
                <label className="text-xs font-semibold block mb-1">Qtd Padrão *</label>
                <Input 
                  type="number" 
                  min="1" 
                  required 
                  value={novoItemQtd} 
                  onChange={e => setNovoItemQtd(e.target.value)} 
                  className="bg-white dark:bg-slate-900"
                />
              </div>
              <div className="sm:col-span-2 flex gap-2 pt-6">
                <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white w-full font-bold text-xs">
                  Confirmar
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAdicionandoItem(false)} className="text-xs">
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome do Medicamento</th>
                  <th className="px-4 py-3 font-medium text-center" title="Medicamento de Alta Vigilância">MAV</th>
                  <th className="px-4 py-3 font-medium text-center">Qtd Padrão Exigida</th>
                  <th className="px-4 py-3 font-medium text-center">Estoque no Carrinho</th>
                  <th className="px-4 py-3 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {padronizacao.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      <span className={`font-medium text-xs h-8 bg-transparent border-transparent ${item.is_mav ? 'text-red-600 dark:text-red-400 font-bold' : ''}`}>
                        {item.medicamento_nome}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.is_mav ? <Badge variant="destructive">MAV</Badge> : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-extrabold text-sm text-center">{item.qtd_padrao}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(() => {
                        const itensFisicos = estoqueFisico.filter(e => e.medicamento_id === item.medicamento_id && e.carrinho_id === carrinhoSelecionadoId);
                        const totalNosFisicos = itensFisicos.reduce((acc, curr) => acc + (curr.quantidade || 0), 0);
                        const qtdAlvo = item.qtd_padrao;
                        const ok = totalNosFisicos >= qtdAlvo;
                        const falta = Math.max(0, qtdAlvo - totalNosFisicos);
                        return (
                          <div className="flex flex-col items-center gap-1 w-full max-w-[280px] mx-auto">
                            <div className="flex items-center gap-1 mb-1">
                              <span className={`font-bold text-sm ${
                                totalNosFisicos === 0 ? 'text-slate-400' :
                                ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                              }`}>
                                {totalNosFisicos}
                              </span>
                              <span className="text-[10px] text-slate-500">/ {qtdAlvo} exigido</span>
                            </div>
                            
                            {itensFisicos.length > 0 ? (
                              <div className="w-full space-y-1">
                                {itensFisicos.map(e => {
                                  const nomeCarrinho = carrinhos.find(c => c.id === e.carrinho_id)?.nome || 'Carrinho';
                                  const valFormatada = e.data_validade || e.validade ? new Date(e.data_validade || e.validade).toLocaleDateString('pt-BR') : '';
                                  return (
                                    <div key={e.id} className="flex justify-between items-center bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-[10px] text-slate-600 dark:text-slate-300">
                                      <div className="flex flex-col items-start leading-tight">
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">{nomeCarrinho}: <span className="text-blue-600 dark:text-blue-400">{e.quantidade} un</span></span>
                                        <span>Lote: {e.numero_lote || e.lote} | Val: {valFormatada}</span>
                                      </div>
                                      <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="h-6 px-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 ml-1"
                                        title="Retornar ao Estoque Central"
                                        onClick={() => retornarParaCentral(e)}
                                      >
                                        ⤺ Devolver
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400">sem estoque</span>
                            )}
                            {!ok && totalNosFisicos > 0 && (
                              <span className="text-[10px] text-amber-500 font-semibold mt-1">faltam {falta} no total</span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        onClick={() => excluirItemPadrao(item.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Estoque Central do Carrinho de Parada */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm mt-6">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-emerald-50/50 dark:bg-emerald-950/20">
            <div>
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-emerald-600" />
                Estoque Central dos Carrinhos (Farmácia)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Medicamentos separados do almoxarifado, exclusivos para montar/repor os Carrinhos Físicos.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome do Medicamento</th>
                  <th className="px-4 py-3 font-medium text-center">Lote</th>
                  <th className="px-4 py-3 font-medium text-center">Validade</th>
                  <th className="px-4 py-3 font-medium text-center">Qtd Disponível</th>
                  <th className="px-4 py-3 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {estoqueCentral.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">
                      <span className={`font-medium text-xs h-8 bg-transparent border-transparent ${item.is_mav ? 'text-red-600 dark:text-red-400 font-bold' : ''}`}>
                        {item.medicamento_nome}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-mono">{item.lote}</td>
                    <td className="px-4 py-3 text-center text-xs">{new Date(item.validade).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 text-center font-extrabold text-sm">{item.quantidade}</td>
                    <td className="px-4 py-3 text-center">
                      <Button 
                        size="sm" 
                        onClick={() => setSelectedCentralItem(item)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        Distribuir
                      </Button>
                    </td>
                  </tr>
                ))}
                {estoqueCentral.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-400">
                      O Estoque Central de Carrinhos está vazio. Transfira medicamentos da Tela de Estoque Geral.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL DISTRIBUIR DO ESTOQUE CENTRAL */}
        {selectedCentralItem && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-emerald-600" />
                  Distribuir Insumo para Carrinho Físico
                </h3>
                <button onClick={() => setSelectedCentralItem(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl space-y-2 text-xs">
                <p><span className="font-bold text-slate-700 dark:text-slate-300">Medicamento:</span> {selectedCentralItem.medicamento_nome}</p>
                <p><span className="font-bold text-slate-700 dark:text-slate-300">Lote:</span> {selectedCentralItem.lote} | <span className="font-bold text-slate-700 dark:text-slate-300">Validade:</span> {new Date(selectedCentralItem.validade).toLocaleDateString('pt-BR')}</p>
                <p><span className="font-bold text-slate-700 dark:text-slate-300">Disponível no Estoque Central:</span> <span className="font-bold text-emerald-600">{selectedCentralItem.quantidade} un</span></p>
              </div>

              <form onSubmit={distribuirParaCarrinho} className="space-y-4 pt-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Selecione o Carrinho de Destino *</label>
                  <select 
                    required 
                    value={distribuirDestinoId} 
                    onChange={e => setDistribuirDestinoId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 text-sm"
                  >
                    <option value="">-- Selecione o Carrinho --</option>
                    {carrinhos.map(c => (
                      <option key={c.id} value={c.id}>{c.nome} ({c.setor})</option>
                    ))}
                  </select>
                </div>
                {distribuirDestinoId && selectedCentralItem && (
                  (() => {
                    const padrao = padronizacao.find(p => p.medicamento_id === selectedCentralItem.medicamento_id);
                    const qtdExigida = padrao ? padrao.qtd_padrao : 0;
                    
                    const itensNoCarrinho = estoqueFisico.filter(e => e.carrinho_id === distribuirDestinoId && e.medicamento_id === selectedCentralItem.medicamento_id);
                    const qtdAtual = itensNoCarrinho.reduce((acc, curr) => acc + (curr.quantidade || 0), 0);
                    
                    const falta = Math.max(0, qtdExigida - qtdAtual);

                    return (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800 text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-blue-800 dark:text-blue-300 font-semibold">Status no Carrinho Selecionado:</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                          <div className="bg-white dark:bg-slate-800 p-2 rounded shadow-sm">
                            <span className="block text-[10px] text-slate-500 uppercase font-bold">Qtd Atual</span>
                            <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{qtdAtual}</span>
                          </div>
                          <div className="bg-white dark:bg-slate-800 p-2 rounded shadow-sm">
                            <span className="block text-[10px] text-slate-500 uppercase font-bold">Padrão</span>
                            <span className="font-bold text-sm text-blue-600">{qtdExigida}</span>
                          </div>
                          <div className={`p-2 rounded shadow-sm ${falta > 0 ? 'bg-red-50 text-red-700 dark:bg-red-900/30' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30'}`}>
                            <span className="block text-[10px] uppercase font-bold">Faltam</span>
                            <span className="font-bold text-sm">{falta}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Quantidade a Transferir *</label>
                  <Input 
                    required 
                    type="number"
                    min="1"
                    max={selectedCentralItem.quantidade}
                    value={distribuirQtd} 
                    onChange={e => setDistribuirQtd(e.target.value)} 
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 mt-6">
                  <Button type="button" variant="outline" onClick={() => setSelectedCentralItem(null)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2">
                    Distribuir e Salvar
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE REPOSIÇÃO COMPLETO */}
        {selectedSolicitacaoToReplenish && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setSelectedSolicitacaoToReplenish(null); }}>
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <PackageCheck className="w-5 h-5 text-emerald-600" />
                  Atender Reposição do Carrinho
                </h3>
                <button onClick={() => setSelectedSolicitacaoToReplenish(null)} className="text-slate-400 hover:text-slate-600 text-xl font-bold">✕</button>
              </div>

              {/* Info do atendimento */}
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl space-y-1 text-xs">
                <p><span className="font-bold text-slate-700 dark:text-slate-300">Paciente:</span> {selectedSolicitacaoToReplenish.pacienteNome} (Leito: {selectedSolicitacaoToReplenish.leito})</p>
                <p><span className="font-bold text-slate-700 dark:text-slate-300">Solicitante:</span> {selectedSolicitacaoToReplenish.enfermeiroNome} | COREN: {selectedSolicitacaoToReplenish.coren}</p>
                <p><span className="font-bold text-slate-700 dark:text-slate-300">Lacre Rompido:</span> <span className="font-mono font-bold text-red-600">{selectedSolicitacaoToReplenish.lacreRompido}</span></p>
              </div>

              {/* Itens para repor */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 block">Itens para Repor:</label>
                {selectedSolicitacaoToReplenish.itens.map(item => {
                  const padItem = padronizacao.find(p => p.id === item.id);
                  const qtdNoPadrao = padItem?.qtd_padrao || 0;

                  // Calcular qtd atual no carrinho físico
                  const qtdAtualFisico = padItem
                    ? estoqueFisico.filter(f => f.carrinho_id === carrinhoSelecionadoId && f.medicamento_id === padItem.medicamento_id)
                        .reduce((s, f) => s + (f.quantidade || 0), 0)
                    : 0;

                  // Calcular qtd disponível no estoque central
                  const qtdNoCentral = padItem
                    ? estoqueCentral.filter(c => c.medicamento_id === padItem.medicamento_id)
                        .reduce((s, c) => s + (c.quantidade || 0), 0)
                    : 0;

                  const qtdNecessaria = item.qtd; // quanto foi usado
                  const qtdMaxRepor = Math.min(qtdNecessaria, qtdNoCentral);
                  const qtdAtual = reposicaoQtds[item.id] ?? qtdMaxRepor;

                  return (
                    <div key={item.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
                      <div className="flex justify-between items-start">
                        <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{item.nome}</span>
                        <span className="text-xs text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded">{item.qtd} usados</span>
                      </div>

                      {/* Status do estoque */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-center">
                          <div className="text-slate-500">No Carrinho Agora</div>
                          <div className="font-bold text-slate-700 dark:text-slate-200">{qtdAtualFisico} / {qtdNoPadrao}</div>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg text-center">
                          <div className="text-amber-600">Precisa Repor</div>
                          <div className="font-bold text-amber-700">{qtdNecessaria}</div>
                        </div>
                        <div className={`p-2 rounded-lg text-center ${qtdNoCentral >= qtdNecessaria ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-red-50 dark:bg-red-950/30'}`}>
                          <div className={`${qtdNoCentral >= qtdNecessaria ? 'text-emerald-600' : 'text-red-600'}`}>No Estoque Central</div>
                          <div className={`font-bold ${qtdNoCentral >= qtdNecessaria ? 'text-emerald-700' : 'text-red-700'}`}>{qtdNoCentral}</div>
                        </div>
                      </div>

                      {qtdNoCentral === 0 ? (
                        <div className="text-xs bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 p-2 rounded font-semibold">
                          ⚠️ Sem estoque no Central! Solicite transferência do almoxarifado.
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap">Qtd a Repor:</label>
                          <input
                            type="number" min="0" max={qtdMaxRepor}
                            value={qtdAtual}
                            onChange={e => {
                              const val = Math.min(parseInt(e.target.value, 10) || 0, qtdMaxRepor);
                              setReposicaoQtds(prev => ({ ...prev, [item.id]: val }));
                            }}
                            className="w-20 text-center border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-sm font-bold bg-white dark:bg-slate-950"
                          />
                          <span className="text-xs text-slate-500">máx. {qtdMaxRepor} disponível</span>
                          <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded ${
                            qtdAtual >= qtdNecessaria ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {qtdAtualFisico + qtdAtual} / {qtdNoPadrao} no carrinho
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Justificativa (para reposição parcial) */}
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Justificativa (obrigatório se reposição for parcial)
                </label>
                <textarea
                  rows={2}
                  value={reposicaoJustificativa}
                  onChange={e => setReposicaoJustificativa(e.target.value)}
                  placeholder="Ex: Sem estoque de Lidocaína no central. Solicitado almoxarifado."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 text-sm resize-none"
                />
              </div>

              <form onSubmit={confirmarReposicaoFarmacia} className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Farmêcêutico Responsável *</label>
                    <input
                      required
                      value={farmaceuticoNome}
                      onChange={e => setFarmaceuticoNome(e.target.value)}
                      placeholder="Ex: Dra. Ana Paula"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Nº do Novo Lacre *</label>
                    <input
                      required
                      value={novoLacreFarmacia}
                      onChange={e => setNovoLacreFarmacia(e.target.value)}
                      placeholder="000000"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-2.5 text-sm font-mono font-bold tracking-wider"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setSelectedSolicitacaoToReplenish(null)}>Cancelar</Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2">
                    <Check className="w-4 h-4" />
                    Confirmar Reposição e Lacrar
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE CRIAÇÃO DE NOVO CARRINHO */}
        {isCriandoCarrinho && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-emerald-600" />
                  Cadastrar Novo Carrinho de Parada
                </h3>
                <button 
                  onClick={() => setIsCriandoCarrinho(false)} 
                  className="text-slate-400 hover:text-slate-600 text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={criarNovoCarrinho} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold block mb-1 text-slate-700 dark:text-slate-300">Nome do Carrinho *</label>
                  <Input 
                    required 
                    value={novoCarrinhoNome} 
                    onChange={e => setNovoCarrinhoNome(e.target.value)} 
                    placeholder="Ex: Carrinho R3, Carrinho UCP"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1 text-slate-700 dark:text-slate-300">Setor / Localização *</label>
                  <Input 
                    required 
                    value={novoCarrinhoSetor} 
                    onChange={e => setNovoCarrinhoSetor(e.target.value)} 
                    placeholder="Ex: Setor R3, Setor UCP"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1 text-slate-700 dark:text-slate-300">Copiar Padronização Padrão de *</label>
                  <select 
                    value={carrinhoOrigemCopia} 
                    onChange={e => setCarrinhoOrigemCopia(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2.5 text-xs font-semibold"
                  >
                    {carrinhos.map(c => (
                      <option key={c.id} value={c.id}>
                        Copiar de {c.nome} ({c.setor})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">
                    O novo carrinho herdará todos os insumos, medicamentos e quantidades padrão do carrinho selecionado.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-3">
                  <Button type="button" variant="outline" onClick={() => setIsCriandoCarrinho(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2">
                    <Check className="w-4 h-4" />
                    Criar Carrinho
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL DE GERENCIAR / EXCLUIR / EDITAR CARRINHOS */}
        {isGerenciandoCarrinhos && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-blue-600" />
                  Gerenciar Carrinhos de Parada do Hospital
                </h3>
                <button 
                  onClick={() => {
                    setIsGerenciandoCarrinhos(false);
                    setEditingCartId(null);
                  }} 
                  className="text-slate-400 hover:text-slate-600 text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {carrinhos.map((cart) => (
                  <div key={cart.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                    {editingCartId === cart.id ? (
                      <form onSubmit={salvarEdicaoCarrinho} className="flex-1 flex gap-2 items-center">
                        <Input 
                          value={editingCartNome} 
                          onChange={e => setEditingCartNome(e.target.value)} 
                          placeholder="Nome" 
                          className="h-8 text-xs bg-white dark:bg-slate-950"
                        />
                        <Input 
                          value={editingCartSetor} 
                          onChange={e => setEditingCartSetor(e.target.value)} 
                          placeholder="Setor" 
                          className="h-8 text-xs bg-white dark:bg-slate-950"
                        />
                        <Button type="submit" size="sm" className="h-8 bg-blue-600 text-white text-xs px-2">Salvar</Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setEditingCartId(null)} className="h-8 text-xs px-2">X</Button>
                      </form>
                    ) : (
                      <>
                        <div>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">{cart.nome}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Setor: {cart.setor}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => {
                              setEditingCartId(cart.id);
                              setEditingCartNome(cart.nome);
                              setEditingCartSetor(cart.setor);
                            }}
                            className="h-8 text-xs gap-1"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Editar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => excluirCarrinho(cart.id)}
                            className="h-8 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
                <Button 
                  size="sm" 
                  onClick={() => {
                    setIsGerenciandoCarrinhos(false);
                    setIsCriandoCarrinho(true);
                  }} 
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Cadastrar Mais Um Carrinho
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsGerenciandoCarrinhos(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── TELA DA ENFERMAGEM: DASHBOARD PRINCIPAL ───────────────────────────────
  const renderNursingDashboard = () => {
    const safeChecagensDiarias = Array.isArray(checagensDiariasLacre) ? checagensDiariasLacre : [];
    const safeChecagensMensais = Array.isArray(checagensMensais) ? checagensMensais : [];

    return (
      <div className="space-y-6">
        {renderCartSelectorHeader(false)}
        {/* Banner de Bloqueio por Inconsistência */}
        {carrinhoBloqueado && (
          <div className="bg-red-500/10 border-2 border-red-500/50 p-5 rounded-2xl flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold shadow-lg shadow-red-600/30">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-red-600 dark:text-red-400 flex items-center gap-2">
                  🚨 CHECAGEM DIÁRIA BLOQUEADA POR INCONSISTÊNCIA DE LACRE!
                </h3>
                <p className="text-slate-700 dark:text-slate-300 text-sm">
                  Foi detectada uma divergência no lacre do carrinho. A Checagem Diária foi <strong>BLOQUEADA</strong>. É obrigatório realizar a <strong>Checagem Mensal Completa</strong> para auditar os medicamentos/materiais e liberar o carrinho.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Lacre de Segurança Atual */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
            <div>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Lacre de Segurança Registrado no Sistema</span>
              <span className="font-mono font-extrabold text-lg text-slate-900 dark:text-slate-100">{lacreRegistradoAtual}</span>
            </div>
          </div>
          <Badge className={carrinhoBloqueado ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"}>
            {carrinhoBloqueado ? "🔒 BLOQUEADO" : "✓ ATIVO"}
          </Badge>
        </div>

        {/* Três Opções Principais da Enfermagem */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 1. Abertura em Emergência */}
          <div className="bg-gradient-to-br from-red-500 to-rose-600 text-white p-6 rounded-2xl shadow-xl flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-extrabold uppercase tracking-wider">Emergência / PCR</span>
                <Siren className="w-7 h-7 text-white animate-bounce" />
              </div>
              <h3 className="text-xl font-black">Abertura em Emergência (Paciente)</h3>
              <p className="text-white/90 text-sm mt-1">
                Para romper o lacre e retirar medicação em PCR/Urgência. Notifica a Farmácia para reposição imediata.
              </p>
            </div>

            <Button 
              onClick={iniciarAberturaEmergencia}
              className="bg-white text-red-600 hover:bg-slate-100 font-extrabold py-6 rounded-xl text-sm shadow-lg shadow-black/20 gap-2 border-none"
            >
              <Siren className="w-5 h-5 text-red-600" />
              🚨 Abertura em Emergência
            </Button>
          </div>

          {/* 2. Checagem Diária do Lacre */}
          <div className={`p-6 rounded-2xl border-2 shadow-sm flex flex-col justify-between space-y-4 transition-all ${
            carrinhoBloqueado 
              ? 'bg-slate-100/90 dark:bg-slate-900/40 border-red-300 dark:border-red-900/50 opacity-80' 
              : 'bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-900/50'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  carrinhoBloqueado ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                }`}>
                  {carrinhoBloqueado ? '🔒 BLOQUEADO' : 'Rotina Diária'}
                </span>
                {carrinhoBloqueado ? (
                  <Lock className="w-7 h-7 text-red-500" />
                ) : (
                  <ShieldCheck className="w-7 h-7 text-amber-500" />
                )}
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Checagem Diária do Lacre</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                {carrinhoBloqueado 
                  ? 'Checagem diária suspensa temporariamente devido a inconsistência de lacre. É necessário realizar a Checagem Mensal Completa.'
                  : 'Conferência rápida realizada todos os dias: digita o número do lacre atual para verificar se o selo continua intacto.'
                }
              </p>
            </div>

            <Button 
              onClick={() => {
                if (carrinhoBloqueado) {
                  toast.error("🚨 Checagem Diária Bloqueada! Realize a Checagem Mensal Completa para auditar e liberar o carrinho.");
                } else {
                  iniciarChecagemDiariaLacre();
                }
              }}
              className={`py-6 rounded-xl text-sm font-bold gap-2 ${
                carrinhoBloqueado 
                  ? 'bg-slate-400 hover:bg-slate-500 text-white cursor-not-allowed shadow-none' 
                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20'
              }`}
            >
              {carrinhoBloqueado ? (
                <>
                  <Lock className="w-5 h-5" />
                  🔒 Bloqueado por Inconsistência
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  Conferir Lacre de Hoje
                </>
              )}
            </Button>
          </div>

          {/* 3. Checagem Mensal Completa */}
          <div className={`p-6 rounded-2xl shadow-sm flex flex-col justify-between space-y-4 transition-all ${
            carrinhoBloqueado 
              ? 'bg-blue-50/70 dark:bg-blue-950/20 border-2 border-blue-500 dark:border-blue-400 shadow-xl ring-2 ring-blue-400/50' 
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
          }`}>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  carrinhoBloqueado ? 'bg-blue-600 text-white font-extrabold animate-pulse' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                }`}>
                  {carrinhoBloqueado ? '⭐ AÇÃO OBRIGATÓRIA' : '1x ao Mês'}
                </span>
                <CalendarCheck className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Checagem Mensal Completa</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Conferência de todos os medicamentos, lotes, validades e equipamentos com emissão de relatório para carimbo.
              </p>
            </div>

            <Button 
              onClick={iniciarNovaChecagemMensal}
              className={`py-6 rounded-xl text-sm font-bold gap-2 ${
                carrinhoBloqueado
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-600/30 animate-bounce'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20'
              }`}
            >
              <Plus className="w-5 h-5" />
              {carrinhoBloqueado ? '✨ Realizar Auditoria e Liberar Carrinho' : 'Iniciar Checagem Mensal'}
            </Button>
          </div>
        </div>

        {/* Histórico de Checagens Diárias do Lacre */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-amber-50/30 dark:bg-amber-950/10">
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-500" />
              Histórico das Checagens Diárias do Lacre
            </h4>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">{safeChecagensDiarias.length} registro(s)</span>
              {(safeChecagensDiarias.length > 0 || safeChecagensMensais.length > 0 || carrinhoBloqueado) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={limparHistoricos}
                  className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 gap-1 h-7"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar Histórico
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Data / Hora</th>
                  <th className="px-4 py-3 font-medium">Enfermeiro(a)</th>
                  <th className="px-4 py-3 font-medium">Lacre Sistema</th>
                  <th className="px-4 py-3 font-medium">Lacre Digitado</th>
                  <th className="px-4 py-3 font-medium">Status do Lacre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {safeChecagensDiarias.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {item.dataHora ? new Date(item.dataHora).toLocaleString('pt-BR') : '-'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{item.enfermeiroNome}</td>
                    <td className="px-4 py-3 font-mono text-xs">{item.lacreRegistrado}</td>
                    <td className="px-4 py-3 font-mono font-bold text-xs">{item.lacreDigitado}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        (item.status && typeof item.status === 'string' && item.status.includes('Conforme'))
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 font-bold'
                      }`}>
                        {item.status || 'Indefinido'}
                      </span>
                    </td>
                  </tr>
                ))}
                {safeChecagensDiarias.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center py-6 text-slate-400">
                      Nenhuma checagem diária do lacre gravada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Histórico de Checagens Mensais Completa */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-blue-600" />
              Histórico das Checagens Mensais (Completa)
            </h4>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">{safeChecagensMensais.length} registro(s)</span>
              {safeChecagensMensais.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={limparHistoricos}
                  className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 gap-1 h-7"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpar Histórico
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Data / Hora</th>
                  <th className="px-4 py-3 font-medium">Enfermeiro(a)</th>
                  <th className="px-4 py-3 font-medium">COREN</th>
                  <th className="px-4 py-3 font-medium">Lacre</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {safeChecagensMensais.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {item.dataHora ? new Date(item.dataHora).toLocaleString('pt-BR') : '-'}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{item.enfermeiroNome}</td>
                    <td className="px-4 py-3">{item.coren}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{item.lacreAtual}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        item.status === 'Conforme' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => abrirImpressao(item)}
                        className="gap-1.5 text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50"
                      >
                        <Printer className="w-4 h-4" />
                        Imprimir Folha Mensal
                      </Button>
                    </td>
                  </tr>
                ))}
                {safeChecagensMensais.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center py-6 text-slate-400">
                      Nenhuma checagem mensal realizada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ─── TELA DA ENFERMAGEM: CHECAGEM DIÁRIA DO LACRE ────────────────────────────
  const renderDailySealForm = () => {
    const lacreCorreto = lacreRegistradoAtual.trim();
    const lacreDigitado = lacreDigitadoDiario.trim();
    const temDigitacao = lacreDigitado.length > 0;
    const isIgual = lacreDigitado === lacreCorreto;

    return (
      <form onSubmit={salvarChecagemDiariaLacre} className="space-y-6 max-w-2xl mx-auto">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <Button 
            type="button"
            variant="outline" 
            size="icon" 
            onClick={() => setNursingView('dashboard')}
            className="rounded-full w-10 h-10 border-slate-200 dark:border-slate-800"
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-amber-500" />
              Checagem Diária do Lacre de Segurança
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Verificação simples diária para garantir que o lacre não foi violado
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conferência do Lacre do Carrinho</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Nome do Enfermeiro(a) *</label>
                <Input 
                  required 
                  value={enfermeiroNome} 
                  onChange={e => setEnfermeiroNome(e.target.value)} 
                  placeholder="Nome do enfermeiro"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">COREN *</label>
                <Input 
                  required 
                  value={coren} 
                  onChange={e => setCoren(e.target.value)} 
                  placeholder="123456-ENF"
                />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-500 block">Número do Lacre Registrado no Sistema:</span>
              <span className="font-mono font-extrabold text-2xl text-slate-900 dark:text-white tracking-widest block">{lacreRegistradoAtual}</span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Digite o Número do Lacre do Carrinho Hoje *</label>
              <Input 
                required 
                value={lacreDigitadoDiario} 
                onChange={e => setLacreDigitadoDiario(e.target.value)} 
                className="font-mono font-extrabold text-xl py-6 tracking-widest"
                placeholder="Informe o lacre observado no carrinho"
              />
            </div>

            {/* Resultado da Validação do Lacre */}
            {temDigitacao && (
              <div className={`p-4 rounded-xl border flex items-center gap-3 transition-all ${
                isIgual 
                  ? 'bg-green-50 border-green-300 text-green-800 dark:bg-green-950/30 dark:text-green-300' 
                  : 'bg-red-50 border-red-300 text-red-800 dark:bg-red-950/30 dark:text-red-300'
              }`}>
                {isIgual ? (
                  <>
                    <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                    <div>
                      <span className="font-bold block">✓ LACRE CONFORME (INTACTO)</span>
                      <span className="text-xs">O lacre digitado é idêntico ao registrado no sistema.</span>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertOctagon className="w-6 h-6 text-red-600 shrink-0 animate-bounce" />
                    <div>
                      <span className="font-bold block">🚨 INCONSISTÊNCIA DE LACRE DETECTADA!</span>
                      <span className="text-xs block">O lacre digitado ({lacreDigitado}) é DIFERENTE do cadastrado ({lacreCorreto}). Será gerado relatório de inconformidade para a Farmácia.</span>
                    </div>
                  </>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Observações (Opcional)</label>
              <Input 
                value={observacaoDiariaLacre} 
                onChange={e => setObservacaoDiariaLacre(e.target.value)} 
                placeholder="Ex: Checagem realizada sem alterações"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => setNursingView('dashboard')}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-amber-500 hover:bg-amber-600 text-white font-bold gap-2 px-6">
            <CheckCircle2 className="w-5 h-5" />
            Salvar Checagem Diária do Lacre
          </Button>
        </div>
      </form>
    );
  };

  // ─── TELA DA ENFERMAGEM: FORMULÁRIO DE ABERTURA EM EMERGÊNCIA (PACIENTE) ────
  const renderEmergencyForm = () => {
    const safeItemsPadrao = Array.isArray(padronizacao) ? padronizacao : [];
    return (
    <form onSubmit={salvarAberturaEmergencia} className="space-y-6">
      <div className="flex items-center justify-between bg-red-600 text-white p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <Button 
            type="button"
            variant="outline" 
            size="icon" 
            onClick={() => setNursingView('dashboard')}
            className="rounded-full w-10 h-10 border-white/30 text-white hover:bg-white/20"
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h3 className="text-xl font-black flex items-center gap-2">
              <Siren className="w-6 h-6 animate-bounce" />
              Abertura do Carrinho em Emergência (Atendimento a Paciente)
            </h3>
            <p className="text-white/80 text-sm">
              Registre os dados do paciente e selecione as medicações consumidas para enviar notificação urgente à Farmácia
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" className="text-white border-white/30 hover:bg-white/10" onClick={() => setNursingView('dashboard')}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-white text-red-600 hover:bg-slate-100 font-extrabold gap-2">
            🚨 Confirmar & Pedir Reposição
          </Button>
        </div>
      </div>

      <Card className="border-red-200 dark:border-red-900/50">
        <CardHeader className="pb-3 bg-red-50/50 dark:bg-red-950/20">
          <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-400">
            <User className="w-4 h-4" />
            Identificação do Paciente e Atendimento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Nome do Paciente *</label>
              <Input 
                required 
                value={pacienteNome} 
                onChange={e => setPacienteNome(e.target.value)} 
                placeholder="Ex: João da Silva"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Leito / Quarto *</label>
              <Input 
                required 
                value={leito} 
                onChange={e => setLeito(e.target.value)} 
                placeholder="Ex: Leito 04 - UTI"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Nº Prontuário / CPF</label>
              <Input 
                value={prontuario} 
                onChange={e => setProntuario(e.target.value)} 
                placeholder="Ex: 987456"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Médico Responsável</label>
              <Input 
                value={medicoResponsavel} 
                onChange={e => setMedicoResponsavel(e.target.value)} 
                placeholder="Ex: Dr. Carlos Eduardo"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 pt-2">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Motivo do Atendimento</label>
              <select 
                value={motivoAbertura} 
                onChange={e => setMotivoAbertura(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-2.5 text-sm"
              >
                <option value="Parada Cardiorrespiratória (PCR)">Parada Cardiorrespiratória (PCR)</option>
                <option value="Insuficiência Respiratória Aguda">Insuficiência Respiratória Aguda</option>
                <option value="Choque Anafilático / Séptico">Choque Anafilático / Séptico</option>
                <option value="Outra Emergência Grave">Outra Emergência Grave</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Nº do Lacre Rompido *</label>
              <Input 
                required 
                value={lacreRompidoEmergencia} 
                onChange={e => setLacreRompidoEmergencia(e.target.value)} 
                className="font-mono font-bold text-red-600"
                placeholder="000000"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Nº do Novo Lacre</label>
              <Input 
                value={novoLacreEmergencia} 
                onChange={e => setNovoLacreEmergencia(e.target.value)} 
                className="font-mono font-bold text-emerald-600"
                placeholder="Preencher se relacrado"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">Enfermeiro(a) Solicitante *</label>
              <Input 
                required 
                value={enfermeiroNome} 
                onChange={e => setEnfermeiroNome(e.target.value)} 
                placeholder="Nome do enfermeiro"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">COREN *</label>
              <Input 
                required 
                value={coren} 
                onChange={e => setCoren(e.target.value)} 
                placeholder="Ex: 123456-ENF"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Syringe className="w-4 h-4 text-blue-600" />
            Selecione as Medicações e Materiais Utilizados no Atendimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {safeItemsPadrao.map((item) => {
              const qtd = itensConsumidos[item.id] || 0;

              return (
                <div 
                  key={item.id} 
                  className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                    qtd > 0 
                      ? 'bg-red-50 dark:bg-red-950/30 border-red-400 dark:border-red-800 shadow-sm' 
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div>
                    <span className={`font-bold text-xs block ${item.is_mav ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}`}>
                      {Boolean(item.is_mav) && <AlertTriangle className="w-3 h-3 inline mr-1 text-red-600" title="Medicamento de Alta Vigilância" />}
                      {item.medicamento_nome}
                    </span>
                    <span className="text-[10px] text-slate-400">Padrão: {item.qtd_padrao} un {Boolean(item.is_mav) && '- MAV'}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      onClick={() => updateConsumo(item.id, -1)}
                      className="w-7 h-7 h-auto p-0 rounded-lg text-slate-600"
                    >
                      -
                    </Button>
                    <span className={`w-6 text-center font-extrabold text-sm ${qtd > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {qtd}
                    </span>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      onClick={() => updateConsumo(item.id, 1)}
                      className="w-7 h-7 h-auto p-0 rounded-lg bg-red-600 text-white border-none hover:bg-red-700"
                    >
                      +
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3 pt-4">
        <Button type="button" variant="outline" onClick={() => setNursingView('dashboard')}>
          Cancelar
        </Button>
        <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-extrabold gap-2 px-8 py-3 rounded-xl shadow-xl shadow-red-600/30">
          <Siren className="w-5 h-5" />
          Confirmar Atendimento & Solicitar Reposição Imediata
        </Button>
      </div>
    </form>
    );
  };

  // ─── TELA DA ENFERMAGEM: FORMULÁRIO DE CHECAGEM MENSAL ───────────────────────
  const renderNursingForm = () => {
    const filteredItems = itemsCheckState.filter(item => 
      (item.nome && typeof item.nome === 'string' && item.nome.toLowerCase().includes(filterText.toLowerCase())) ||
      (item.categoria && typeof item.categoria === 'string' && item.categoria.toLowerCase().includes(filterText.toLowerCase()))
    );

    return (
      <form onSubmit={salvarChecagemMensal} className="space-y-6">
        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4">
            <Button 
              type="button"
              variant="outline" 
              size="icon" 
              onClick={() => setNursingView('dashboard')}
              className="rounded-full w-10 h-10 border-slate-200 dark:border-slate-800"
            >
              <ArrowLeft size={18} />
            </Button>
            <div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                Folha de Checagem Mensal
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">
                Conferência completa realizada 1 vez ao mês de todos os medicamentos, lotes, validades e equipamentos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={() => setNursingView('dashboard')}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Finalizar e Imprimir Folha Mensal
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                Dados do Responsável e Setor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Nome do Enfermeiro(a) *</label>
                  <Input 
                    required 
                    value={enfermeiroNome} 
                    onChange={e => setEnfermeiroNome(e.target.value)} 
                    placeholder="Ex: Maria Oliveira"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">COREN *</label>
                  <Input 
                    required 
                    value={coren} 
                    onChange={e => setCoren(e.target.value)} 
                    placeholder="Ex: 123456-ENF"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Setor / Ala</label>
                  <Input 
                    value={setor} 
                    onChange={e => setSetor(e.target.value)} 
                    placeholder="Ex: UTI Adulto"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Controle do Lacre
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Nº do Lacre Atual *</label>
                <Input 
                  required 
                  value={lacreAtual} 
                  onChange={e => setLacreAtual(e.target.value)} 
                  className="font-mono font-semibold tracking-wider"
                  placeholder="000000"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">Novo Lacre (Se trocado)</label>
                <Input 
                  value={novoLacre} 
                  onChange={e => setNovoLacre(e.target.value)} 
                  className="font-mono tracking-wider"
                  placeholder="Preencher se trocar"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Testes de Equipamentos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input 
                    type="checkbox" 
                    checked={testeDesfibrilador} 
                    onChange={e => setTesteDesfibrilador(e.target.checked)} 
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 block">Desfibrilador / DEA Testado</span>
                    <span className="text-xs text-slate-500">Ligado e emitindo sinal de pronto</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input 
                    type="checkbox" 
                    checked={testeCargaBateria} 
                    onChange={e => setTesteCargaBateria(e.target.checked)} 
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 block">Carga da Bateria OK</span>
                    <span className="text-xs text-slate-500">Conectado na rede e com bateria 100%</span>
                  </div>
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="font-semibold text-slate-800 dark:text-slate-200">
                Lista de Medicamentos e Materiais do Carrinho
              </h4>
              <p className="text-xs text-slate-500">
                Marque se está conforme. Altere lote, validade ou quantidade se houver alguma mudança.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input 
                value={filterText} 
                onChange={e => setFilterText(e.target.value)} 
                placeholder="Buscar item..." 
                className="pl-9 text-xs"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium text-center w-12">OK</th>
                  <th className="px-4 py-3 font-medium">Item / Descrição</th>
                  <th className="px-4 py-3 font-medium text-center">Qtd Padrão</th>
                  <th className="px-4 py-3 font-medium text-center w-24">Qtd Encontrada</th>
                  <th className="px-4 py-3 font-medium w-32">Lote</th>
                  <th className="px-4 py-3 font-medium w-36">Validade</th>
                  <th className="px-4 py-3 font-medium">Observações / Motivo Divergência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredItems.map((item) => (
                  <tr 
                    key={item.id} 
                    className={`transition-colors ${
                      !item.conforme || item.qtdConferida !== item.qtdPadrao
                        ? 'bg-amber-50/70 dark:bg-amber-950/20' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <td className="px-4 py-3 text-center">
                      <input 
                        type="checkbox"
                        checked={item.conforme}
                        onChange={e => handleItemChange(item.id, 'conforme', e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold block ${item.isMav ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}`}>
                        {Boolean(item.isMav) && <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 text-red-600" title="Medicamento de Alta Vigilância" />}
                        {item.nome}
                      </span>
                      <span className="text-xs text-slate-400">{item.categoria} {Boolean(item.isMav) && '• MAV'}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-600 dark:text-slate-400">
                      {item.qtdPadrao}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Input 
                        type="number"
                        min="0"
                        value={item.qtdConferida}
                        onChange={e => handleItemChange(item.id, 'qtdConferida', parseInt(e.target.value, 10) || 0)}
                        className="w-20 text-center font-bold h-8 text-xs mx-auto"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input 
                        value={item.loteConferido}
                        onChange={e => handleItemChange(item.id, 'loteConferido', e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input 
                        type="date"
                        value={item.validadeConferida}
                        onChange={e => handleItemChange(item.id, 'validadeConferida', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input 
                        value={item.observacao}
                        onChange={e => handleItemChange(item.id, 'observacao', e.target.value)}
                        placeholder="Ex: Lote trocado / Reposição solicitada"
                        className="h-8 text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="outline" onClick={() => setNursingView('dashboard')}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-blue-600/20">
            <CheckCircle2 className="w-5 h-5" />
            Finalizar Checagem e Gerar Folha Mensal para Impressão
          </Button>
        </div>
      </form>
    );
  };

  // ─── TELA DE IMPRESSÃO DA FOLHA MENSAL A4 ──────────────────────────────────
  const renderPrintPreview = () => {
    if (!selectedChecagem) return null;

    return (
      <div className="space-y-6">
        <div className="print:hidden flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <Button 
            variant="outline" 
            onClick={() => setNursingView('dashboard')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Painel
          </Button>

          <div className="flex items-center gap-3">
            <Button 
              onClick={acionarImpressaoImpressora}
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2 px-6 shadow-lg shadow-blue-600/20 font-medium"
            >
              <Printer className="w-5 h-5" />
              Imprimir Folha Mensal
            </Button>
          </div>
        </div>

        <div className="bg-white text-slate-900 p-8 rounded-xl shadow-xl max-w-4xl mx-auto border border-slate-300 print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none">
          <div className="flex justify-between items-center border-b-2 border-slate-800 pb-4 mb-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Axion Saúde</h1>
              <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Sistema de Gestão Hospitalar</p>
              <p className="text-sm font-semibold text-slate-800 mt-1">FOLHA DE CHECAGEM MENSAL — CARRINHO DE PARADA</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 uppercase tracking-wider">Data e Hora da Checagem</div>
              <div className="text-base font-bold text-slate-900">{selectedChecagem.dataHora ? new Date(selectedChecagem.dataHora).toLocaleString('pt-BR') : '-'}</div>
              <div className={`inline-block px-3 py-0.5 rounded text-xs font-bold mt-1 ${
                (selectedChecagem.status && selectedChecagem.status === 'Conforme') ? 'bg-slate-200 text-slate-800' : 'bg-amber-200 text-amber-900'
              }`}>
                STATUS: {(selectedChecagem.status || 'INDEFINIDO').toUpperCase()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs border border-slate-300 p-4 rounded mb-6 bg-slate-50">
            <div>
              <p><span className="font-bold">Enfermeiro(a) Responsável:</span> {selectedChecagem.enfermeiroNome}</p>
              <p><span className="font-bold">COREN:</span> {selectedChecagem.coren}</p>
              <p><span className="font-bold">Setor / Ala:</span> {selectedChecagem.setor}</p>
            </div>
            <div>
              <p><span className="font-bold">Nº do Lacre Conferido:</span> <span className="font-mono font-bold text-sm">{selectedChecagem.lacreAtual}</span></p>
              <p><span className="font-bold">Novo Lacre (Se trocado):</span> <span className="font-mono">{selectedChecagem.novoLacre || 'Sem alteração'}</span></p>
              <p><span className="font-bold">Desfibrilador / DEA:</span> {selectedChecagem.testeDesfibrilador ? 'OK (Testado)' : 'NÃO TESTADO'}</p>
            </div>
          </div>

          <table className="w-full text-left text-xs border-collapse border border-slate-300 mb-8">
            <thead>
              <tr className="bg-slate-200 text-slate-800 uppercase tracking-wider font-bold">
                <th className="border border-slate-300 px-2 py-1.5 text-center">Status</th>
                <th className="border border-slate-300 px-2 py-1.5">Item / Descrição</th>
                <th className="border border-slate-300 px-2 py-1.5 text-center">Qtd Pad.</th>
                <th className="border border-slate-300 px-2 py-1.5 text-center">Qtd Conf.</th>
                <th className="border border-slate-300 px-2 py-1.5">Lote</th>
                <th className="border border-slate-300 px-2 py-1.5">Validade</th>
                <th className="border border-slate-300 px-2 py-1.5">Observações</th>
              </tr>
            </thead>
            <tbody>
              {(Array.isArray(selectedChecagem.items) ? selectedChecagem.items : []).map((item) => (
                <tr key={item.id} className={!item.conforme || item.qtdConferida !== item.qtdPadrao ? 'bg-amber-50 font-medium' : ''}>
                  <td className="border border-slate-300 px-2 py-1.5 text-center font-bold">
                    {item.conforme && item.qtdConferida === item.qtdPadrao ? '✓ OK' : '⚠ ALT'}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 font-semibold text-slate-900">{item.nome}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center font-bold">{item.qtdPadrao}</td>
                  <td className="border border-slate-300 px-2 py-1.5 text-center font-bold">{item.qtdConferida}</td>
                  <td className="border border-slate-300 px-2 py-1.5 font-mono">{item.loteConferido}</td>
                  <td className="border border-slate-300 px-2 py-1.5">
                    {item.validadeConferida ? new Date(item.validadeConferida).toLocaleDateString('pt-BR') : '-'}
                  </td>
                  <td className="border border-slate-300 px-2 py-1.5 text-slate-700">{item.observacao || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-12 pt-8 border-t border-slate-300 grid grid-cols-2 gap-12 text-center text-xs">
            <div>
              <div className="border-b border-slate-400 mb-2 h-16 flex items-end justify-center pb-1">
                <span className="text-slate-400 italic text-[10px]">[ Assinatura e Carimbo do(a) Enfermeiro(a) ]</span>
              </div>
              <p className="font-bold text-slate-900">{selectedChecagem.enfermeiroNome}</p>
              <p className="text-slate-600">COREN: {selectedChecagem.coren}</p>
              <p className="text-slate-500 text-[10px] mt-0.5">Enfermeiro(a) Responsável pela Checagem</p>
            </div>

            <div>
              <div className="border-b border-slate-400 mb-2 h-16 flex items-end justify-center pb-1">
                <span className="text-slate-400 italic text-[10px]">[ Visto / Assinatura do Farmacêutico ]</span>
              </div>
              <p className="font-bold text-slate-900">Farmacêutico Responsável</p>
              <p className="text-slate-600">CRF: __________________</p>
              <p className="text-slate-500 text-[10px] mt-0.5">Conferência e Reposição da Farmácia</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── COMPONENTE ENFERMAGEM ──────────────────────────────────────────────────
  const renderNursing = () => (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8 print:hidden">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => {
              if (nursingView !== 'dashboard') {
                setNursingView('dashboard');
              } else if (showWelcome) {
                showWelcome();
              }
            }}
            className="rounded-full w-10 h-10 border-slate-200 dark:border-slate-800"
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Checagem Enfermagem</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Registro diário do lacre, abertura em emergência e checagem mensal do Carrinho de Parada</p>
          </div>
        </div>
      </div>

      {nursingView === 'dashboard' && renderNursingDashboard()}
      {nursingView === 'form' && renderNursingForm()}
      {nursingView === 'daily_seal_form' && renderDailySealForm()}
      {nursingView === 'emergency_form' && renderEmergencyForm()}
      {nursingView === 'print_preview' && renderPrintPreview()}
    </div>
  );

  const renderRoleSelection = () => (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-6 p-6">
      <div className="w-16 h-16 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
        <ShieldCheck className="w-8 h-8 text-blue-600" />
      </div>
      <div>
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">Carrinho de Parada de Emergência</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md">
          Selecione o seu perfil de acesso para gerenciar padronizações, reposições ou realizar a checagem do carrinho.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-lg pt-4">
        <button
          onClick={() => {
            sessionStorage.setItem("axion_carrinho_mode", "pharmacy");
            setViewState("pharmacy");
          }}
          className="p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-slate-900 shadow-md hover:shadow-xl transition-all flex flex-col items-center gap-3 text-center group"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Pill className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Controle da Farmácia</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Padronização de insumos, chamados de reposição e novos carrinhos.</p>
          </div>
        </button>

        <button
          onClick={() => {
            sessionStorage.setItem("axion_carrinho_mode", "nursing");
            setViewState("nursing");
          }}
          className="p-6 rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-white dark:bg-slate-900 shadow-md hover:shadow-xl transition-all flex flex-col items-center gap-3 text-center group"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Checagem Enfermagem</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Registro diário de lacre, checagem mensal e abertura em emergência.</p>
          </div>
        </button>
      </div>
    </div>
  );

  const activeMode = typeof window !== 'undefined' ? sessionStorage.getItem("axion_carrinho_mode") : null;
  const effectiveViewState = (viewState === 'role_selection' && (activeMode === 'pharmacy' || activeMode === 'nursing')) ? activeMode : viewState;

  return (
    <div className="min-h-[calc(100vh-64px)] w-full relative">
      <div className="max-w-6xl mx-auto w-full">
        {effectiveViewState === 'pharmacy' && renderPharmacy()}
        {effectiveViewState === 'nursing' && renderNursing()}
        {(effectiveViewState === 'role_selection' || !effectiveViewState) && renderRoleSelection()}
      </div>
    </div>
  );
}
