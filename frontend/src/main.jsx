import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import App from './App'
import ErpLayout from './layouts/ErpLayout'
import VetoLayout from './layouts/VetoLayout'
import Dispatch from './routes/Dispatch'
import RuleStudio from './routes/RuleStudio'
import AuditLog from './routes/AuditLog'
import { sessionStart } from './lib/session'
import './index.css'

// Stamped here, at boot, and deliberately not on first visit to /audit. An
// operator dispatches before they inspect the trail, so a timestamp created
// when /audit mounts would sit *after* their own decision and hide the one
// record they came to see.
sessionStart()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Navigate to="/dispatch" replace />} />
          <Route element={<ErpLayout />}>
            <Route path="dispatch" element={<Dispatch />} />
          </Route>
          <Route element={<VetoLayout />}>
            <Route path="rule-studio" element={<RuleStudio />} />
            <Route path="audit" element={<AuditLog />} />
          </Route>
          <Route path="*" element={<Navigate to="/dispatch" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
