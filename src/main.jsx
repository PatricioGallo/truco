import React from 'react'
import { createRoot } from 'react-dom/client'
import * as api from '@api'
import App from './App.jsx'
import './styles.css'

if (import.meta.env.MODE === 'mock') api.seedDemo?.()

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
