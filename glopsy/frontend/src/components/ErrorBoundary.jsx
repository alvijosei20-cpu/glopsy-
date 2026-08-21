import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    console.error("STACK:", error?.stack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-sm border border-fuchsia-100 p-8 text-center max-w-md w-full">
            <h2 className="text-lg font-bold text-slate-800 mb-2">Algo salió mal</h2>
            <p className="text-slate-500 text-sm mb-6">Ocurrió un error inesperado en este componente.</p>
            {this.state.error && (
              <pre className="text-left text-xs text-red-600 bg-red-50 rounded-xl p-3 mb-6 overflow-auto whitespace-pre-wrap">
                {String(this.state.error?.message || this.state.error)}
                {'\n\n'}
                {String(this.state.error?.stack || '')}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white font-semibold px-6 py-2.5 rounded-xl text-sm shadow-md shadow-fuchsia-600/20 cursor-pointer"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
