import { Component } from 'react';

/**
 * Fanger fejl i appen, så skærmen aldrig bare bliver sort.
 * Viser fejlbeskeden, så den kan sendes videre til den der vedligeholder appen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[JustNails] Fejl i appen:', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const detail = `${error?.name || 'Error'}: ${error?.message || String(error)}\n${location.pathname}\n${navigator.userAgent}`;
    return (
      <div className="crash">
        <h2>Noget gik galt</h2>
        <p className="muted">Tryk på knappen for at genindlæse. Sker det igen, så tag et skærmbillede af teksten herunder og send det til Patrick.</p>
        <pre>{detail}</pre>
        <button className="btn gold" onClick={() => location.reload()}>Genindlæs appen</button>
      </div>
    );
  }
}
