import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/theme.css'
import './styles/shell.css'

import { ConfigProvider } from 'antd'
import esES from 'antd/locale/es_ES'
import { ThemeProvider, useTheme } from './components/layout/ThemeProvider'
import { getAntdTheme } from './theme/antdTheme'

// ConfigProvider adentro del ThemeProvider: el toggle de tema (topbar) cambia
// los tokens de antd y los tokens CSS (theme.css) en el mismo render.
function Root() {
  const { theme } = useTheme()
  return (
    <ConfigProvider locale={esES} theme={getAntdTheme(theme)}>
      <App />
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <Root />
    </ThemeProvider>
  </React.StrictMode>,
)
