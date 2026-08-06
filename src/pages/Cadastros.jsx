import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Alas from "./Alas";
import Fornecedores from "./Fornecedores";
import { Building2, Hospital } from "lucide-react";

export default function Cadastros() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Cadastros</h1>
          <p className="text-slate-500 text-sm mt-0.5">Gerenciamento de Fornecedores e Alas do Hospital</p>
        </div>
      </div>

      <Tabs defaultValue="fornecedores" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="fornecedores" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Fornecedores
          </TabsTrigger>
          <TabsTrigger value="alas" className="flex items-center gap-2">
            <Hospital className="w-4 h-4" />
            Alas do Hospital
          </TabsTrigger>
        </TabsList>
        <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <TabsContent value="fornecedores" className="m-0 border-none outline-none">
            <Fornecedores isTab={true} />
          </TabsContent>
          <TabsContent value="alas" className="m-0 border-none outline-none">
            <Alas isTab={true} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
