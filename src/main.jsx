import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Suppress noisy browser-extension messaging errors (e.g. Chrome extensions disconnecting)
window.addEventListener('unhandledrejection', (event) => {
  const errMsg = event?.reason?.message || (typeof event?.reason === 'string' ? event.reason : '');
  if (
    errMsg.includes('Could not establish connection. Receiving end does not exist') ||
    errMsg.includes('message channel closed before a response was received')
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
