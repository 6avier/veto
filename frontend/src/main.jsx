import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import App from './App'
import ErpLayout from './layouts/ErpLayout'
import VetoLayout from './layouts/VetoLayout'
import Dispatch from './routes/Dispatch'
import RuleStudio from './routes/RuleStudio'
import AuditLog from './routes/AuditLog'
import './index.css'

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
