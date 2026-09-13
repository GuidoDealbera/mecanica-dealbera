import React from "react";
import { Button } from "@heroui/react";
import { MdErrorOutline, MdRefresh, MdArrowBack } from "react-icons/md";
import { reportarError } from "../../Utils/reportarError";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  /**
   * Identificador corto de este error, para que el usuario pueda dictarlo por
   * teléfono y quien lo atiende lo encuentre en el log.
   *
   * El detalle técnico se mostraba sólo con `import.meta.env.DEV`: en producción
   * el usuario veía "ocurrió un error inesperado" y nada más. Un stack trace no
   * le sirve, pero un código sí, y es lo que convierte "se rompió" en algo que
   * se puede buscar.
   */
  errorId: string | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onBack?: () => void;
}

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Corto y en mayúsculas: se dicta por teléfono. Ocho caracteres alcanzan
    // para encontrarlo en el log de un día.
    const errorId = crypto.randomUUID().slice(0, 8).toUpperCase();
    return { hasError: true, error, errorId };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Al archivo de log, no a la consola. `console.error` va a las herramientas
    // de desarrollo, que en producción nadie abre: el error que reventó la
    // pantalla era el único que no quedaba registrado, justo cuando el usuario
    // llama y se le pide que mande los logs.
    reportarError("renderer:boundary", error, {
      componentStack: info.componentStack ?? undefined,
      // El mismo código que se le muestra al usuario: es lo que permite
      // encontrar **este** error entre todos los del archivo.
      errorId: this.state.errorId ?? undefined,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorId: null });
  };

  handleBack = () => {
    if (this.props.onBack) {
      this.props.onBack();
      this.setState({ hasError: false, error: null, errorId: null });
    } else {
      window.history.back();
      // Pequeño delay para que el historial navegue antes de limpiar el error
      setTimeout(
        () => this.setState({ hasError: false, error: null, errorId: null }),
        100
      );
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = import.meta.env.DEV;
    const message = this.state.error?.message ?? "Error desconocido";

    return (
      <div className="w-full min-h-full flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-content1 rounded-2xl shadow-xl shadow-black/30 border border-divider p-8 flex flex-col items-center gap-6 text-foreground">
          {/* Ícono */}
          <div className="p-4 rounded-full bg-danger-900/40 border border-danger-700/50">
            <MdErrorOutline size={40} className="text-danger-400" />
          </div>

          {/* Título y mensaje */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground mb-2">
              Algo salió mal
            </h2>
            <p className="text-foreground-400 text-sm leading-relaxed">
              Ocurrió un error inesperado al renderizar esta sección. Podés
              intentar recargar o volver a la pantalla anterior.
            </p>
            {/* El código es lo que convierte el "algo salió mal" en algo que
                se puede averiguar: el usuario lo dicta por teléfono y quien lo
                atiende lo busca en el log. Un stack trace no le sirve a él. */}
            <p className="text-foreground-500 text-xs mt-3 leading-relaxed">
              Si necesitás ayuda, pasá este código:{" "}
              <span className="font-mono font-semibold text-foreground-300">
                {this.state.errorId}
              </span>
              . El detalle quedó guardado en los registros de la aplicación
              (Gestión de datos → Ver logs).
            </p>
          </div>

          {/* Detalle técnico solo en desarrollo */}
          {isDev && (
            <div className="w-full bg-background border border-danger-900/50 rounded-lg p-3">
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
