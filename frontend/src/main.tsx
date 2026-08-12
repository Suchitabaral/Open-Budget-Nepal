import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PreferencesProvider } from './features/preferences/PreferencesProvider.tsx'
import { initializePreferences } from './features/preferences/preferences.ts'

const initialPreferences = initializePreferences()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreferencesProvider initialPreferences={initialPreferences}><App /></PreferencesProvider>
  </StrictMode>,
)
