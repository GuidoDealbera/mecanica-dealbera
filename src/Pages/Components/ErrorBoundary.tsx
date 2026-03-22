import React from "react";
import { Button } from "@heroui/react";
import { MdErrorOutline, MdRefresh, MdArrowBack } from "react-icons/md";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onBack?: () => void;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // En producción se podría enviar a un servicio de logging (Sentry, etc.)
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleBack = () => {
    if (this.props.onBack) {
      this.props.onBack();
      this.setState({ hasError: false, error: null });
    } else {
      window.history.back();
      // Pequeño delay para que el historial navegue antes de limpiar el error
      setTimeout(() => this.setState({ hasError: false, error: null }), 100);
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = import.meta.env.DEV;
    const message = this.state.error?.message ?? "Error desconocido";

    return (
      <div className="w-full min-h-full flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-foreground-800 rounded-2xl shadow-xl shadow-black/30 border border-foreground-700 p-8 flex flex-col items-center gap-6 text-white">

          {/* Ícono */}
          <div className="p-4 rounded-full bg-danger-900/40 border border-danger-700/50">
            <MdErrorOutline size={40} className="text-danger-400" />
          </div>

          {/* Título y mensaje */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-2">
              Algo salió mal
            </h2>
            <p className="text-foreground-400 text-sm leading-relaxed">
              Ocurrió un error inesperado al renderizar esta sección.
              Podés intentar recargar o volver a la pantalla anterior.
            </p>
          </div>

          {/* Detalle técnico solo en desarrollo */}
          {isDev && (
            <div className="w-full bg-foreground-900 border border-danger-900/50 rounded-lg p-3">
              <p className="text-danger-400 text-xs font-mono break-words leading-relaxed">
                {message}
              </p>
            </div>
          )}

          {/* Acciones */}
          <div className="flex gap-3 w-full">
            <Button
              fullWidth
              color="default"
              startContent={<MdArrowBack size={18} />}
              onPress={this.handleBack}
            >
              Volver
            </Button>
            <Button
              fullWidth
              color="primary"
              startContent={<MdRefresh size={18} />}
              onPress={this.handleRetry}
            >
              Reintentar
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;