// src/main.jsx
if (typeof window !== 'undefined' && window.location.hostname.endsWith('.localhost')) {
  window.location.hostname = 'localhost';
}
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.jsx'
import { PostHogProvider } from 'posthog-js/react'

// Remove console outputs globally from the frontend
// console.log = () => { };
// console.info = () => { };
// console.debug = () => { };
// console.warn = () => { };
// console.error = () => { };

const options = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  capture_pageview: 'history_change'
}

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {posthogKey && !posthogKey.includes('dummy') ? (
      <PostHogProvider apiKey={posthogKey} options={options}>
        <App />
      </PostHogProvider>
    ) : (
      <App />
    )}
  </StrictMode>,
)
