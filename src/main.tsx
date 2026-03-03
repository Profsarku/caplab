import { StrictMode, Component, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div style={{
          padding: '24px', fontFamily: 'monospace', color: '#f87171',
          background: '#0f172a', minHeight: '100vh',
        }}>
          <h2 style={{ color: '#fbbf24', marginBottom: '12px' }}>
            ⚠ Render Error
          </h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '13px', color: '#f87171' }}>
            {(error as Error).message}
          </pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '11px', color: '#94a3b8', marginTop: '12px' }}>
            {(error as Error).stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
