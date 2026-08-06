import { useWelcome } from "./AppInitializer";

export default function PageNotFound() {
  const { showWelcome } = useWelcome();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
      <h2 className="text-2xl font-semibold text-gray-700 mb-2">
        Página não encontrada
      </h2>
      <p className="text-gray-500 mb-6 max-w-md">
        A página que você está procurando não existe ou foi movida.
      </p>
      <button
        onClick={() => {
          window.location.hash = "#/";
          showWelcome();
        }}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Voltar à Seleção de Módulos
      </button>
    </div>
  );
}