/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import SateliteMovimentacoes from "./pages/SateliteMovimentacoes";
import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Cadastros from './pages/Cadastros';
import Configuracoes from './pages/Configuracoes';
import Dashboard from './pages/Dashboard';
import Emprestimos from './pages/Emprestimos';
import Entradas from './pages/Entradas';
import Estoque from './pages/Estoque';
import Medicamentos from './pages/Medicamentos';
import Inventario from './pages/Inventario';
import Movimentacoes from './pages/Movimentacoes';
import Relatorios from './pages/Relatorios';
import Saidas from './pages/Saidas';
import Vencimentos from './pages/Vencimentos';
import Satelite from './pages/Satelite';
import ResponsavelTecnico from './pages/ResponsavelTecnico';
import SateliteMovimentacoes from "./pages/SateliteMovimentacoes";
import SatelitePortaria from "./pages/SatelitePortaria";
import SateliteEstoque from "./pages/SateliteEstoque";
import CarrinhoParada from './pages/CarrinhoParada';
import PacientesMedicao from './pages/PacientesMedicao';
import LivroRegistro from './pages/LivroRegistro';
import SateliteEvolucao from './pages/SateliteEvolucao';
import SateliteAdiantamento from './pages/SateliteAdiantamento';
import Compras from './pages/Compras';
import PassagemPlantao from './pages/PassagemPlantao';
import SateliteInventario from './pages/SateliteInventario';
import __Layout from './Layout.jsx';


export const PAGES = {
  "Cadastros": Cadastros,
  "Configuracoes": Configuracoes,
  "Dashboard": Dashboard,
  "Emprestimos": Emprestimos,
  "Entradas": Entradas,
  "Estoque": Estoque,
  "Inventario": Inventario,
  "Medicamentos": Medicamentos,
  "Movimentacoes": Movimentacoes,
  "Relatorios": Relatorios,
  "Compras": Compras,
  "Saidas": Saidas,
  "Vencimentos": Vencimentos,
  "Satelite": Satelite,
  "SateliteMovimentacoes": SateliteMovimentacoes,
  "ResponsavelTecnico": ResponsavelTecnico,
  "SatelitePortaria": LivroRegistro,
  "SateliteEstoque": SateliteEstoque,
  "SateliteInventario": SateliteInventario,
  "CarrinhoParada": CarrinhoParada,
  "PacientesMedicao": PacientesMedicao,
  "LivroRegistro": LivroRegistro,
  "SateliteEvolucao": SateliteEvolucao,
  "SateliteAdiantamento": SateliteAdiantamento,
  "PassagemPlantao": PassagemPlantao,
}

export const pagesConfig = {
  mainPage: "Dashboard",
  Pages: PAGES,
  Layout: __Layout,
};