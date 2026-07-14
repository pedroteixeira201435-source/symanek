import React from 'react'

// Catches render errors so a single broken module never white-screens the whole
// Suite during UAT. Shows a recover action instead.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Suite error boundary:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
          <div style={{ maxWidth: 440, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
            <h1 style={{ fontSize: 20, margin: '0 0 6px' }}>Something went wrong</h1>
            <p style={{ color: '#5b6b78', fontSize: 14, margin: '0 0 16px' }}>
              This screen hit an unexpected error. Reload to continue — your session is safe.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '10px 18px', borderRadius: 999, border: 0, background: '#254e73', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
