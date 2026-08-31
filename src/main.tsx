import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from '@/components/ErrorBoundary'

window.addEventListener('error', event => {
  console.error('[global-error]', event.error ?? event.message)
})
window.addEventListener('unhandledrejection', event => {
  console.error('[unhandled-rejection]', event.reason)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </ErrorBoundary>
  </StrictMode>,
)
