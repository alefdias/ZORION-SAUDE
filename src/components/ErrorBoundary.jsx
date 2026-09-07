import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Capturou erro:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.hash = "#/";
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-slate-800/90 border border-slate-700 rounded-2xl p-6 md:p-8 shadow-2xl text-center backdrop-blur">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-5 text-red-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h1 className="text-xl font-black text-white mb-2">
              Ocorreu um erro inesperado
            </h1>
            <p className="text-sm text-slate-400 mb-6">
              A tela não pôde ser carregada devido a uma inconsistência de dados ou erro de renderização.
            </p>

            {this.state.error && (
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-left font-mono text-xs text-red-300 overflow-x-auto mb-6 max-h-40">
                <p className="font-bold text-red-400 mb-1">{this.state.error.toString()}</p>
                {this.state.errorInfo?.componentStack && (
                  <pre className="text-[10px] text-slate-500 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack.slice(0, 500)}
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                onClick={this.handleReload}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar Tela
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="w-full sm:w-auto border-slate-600 text-slate-300 hover:bg-slate-700 font-bold text-xs gap-2"
              >
                <Home className="w-4 h-4" />
                Voltar ao Início
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
