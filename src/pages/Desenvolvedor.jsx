import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { generateLicenseKey } from '@/lib/license';
import { toast } from 'sonner';
import { Key, Copy, Check } from 'lucide-react';

export default function Desenvolvedor() {
  const [auth, setAuth] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [plan, setPlan] = useState('1');
  const [maxComputers, setMaxComputers] = useState('1');
  const [offlineLimit, setOfflineLimit] = useState('15');
  
  const [generatedKey, setGeneratedKey] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleAuth = (e) => {
    e.preventDefault();
    if (password === 'axion2024') { // Senha hardcoded para proteger a tela
      setAuth(true);
    } else {
      toast.error('Senha incorreta.');
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const months = parseInt(plan, 10);
      const planName = months === 0 ? 'Vitalício' : `${months} Meses`;
      
      const license = await generateLicenseKey(planName, months, maxComputers, offlineLimit);
      setGeneratedKey(license.key);
      setCopied(false);
      toast.success('Chave gerada com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar chave. Verifique a conexão com o banco.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      toast.success('Chave copiada para a área de transferência!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  if (!auth) {
    return (
      <div className="flex items-center justify-center h-full min-h-[80vh]">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription>Área exclusiva para desenvolvedores.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-2">
                <Label>Senha de Acesso</Label>
                <Input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">Entrar</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Key className="w-6 h-6 text-blue-500" />
          Gerador de Licenças
        </h1>
        <p className="text-slate-500">Crie novas chaves de acesso para o sistema Axion Saúde.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova Licença</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>Plano (Validade)</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Mês</SelectItem>
                  <SelectItem value="3">3 Meses</SelectItem>
                  <SelectItem value="6">6 Meses</SelectItem>
                  <SelectItem value="12">1 Ano</SelectItem>
                  <SelectItem value="0">Vitalício</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Máx. Computadores Simultâneos</Label>
              <Input 
                type="number" 
                min="1" 
                value={maxComputers}
                onChange={e => setMaxComputers(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Limite Offline (Dias)</Label>
              <Select value={offlineLimit} onValueChange={setOfflineLimit}>
                <SelectTrigger>
                  <SelectValue placeholder="Limite sem internet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 Dias</SelectItem>
                  <SelectItem value="15">15 Dias</SelectItem>
                  <SelectItem value="30">30 Dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleGenerate} disabled={loading} className="w-full md:w-auto">
            {loading ? 'Gerando...' : 'Gerar Chave (Serial Key)'}
          </Button>

          {generatedKey && (
            <div className="mt-6 p-6 border rounded-xl bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center space-y-4">
              <p className="text-sm text-slate-500 font-medium uppercase tracking-wider">Chave Gerada com Sucesso</p>
              <div className="flex items-center gap-3">
                <code className="text-2xl md:text-3xl font-mono font-bold tracking-widest text-blue-600 dark:text-blue-400 select-all">
                  {generatedKey}
                </code>
                <Button variant="outline" size="icon" onClick={copyToClipboard} className="shrink-0">
                  {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                </Button>
              </div>
              <p className="text-xs text-slate-400 text-center max-w-sm">
                Envie esta chave para o cliente. Ele poderá ativá-la na tela inicial do sistema clicando no indicador vermelho.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
