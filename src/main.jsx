import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/admin-responsive.css'

import { ConfigProvider } from 'antd'
import esES from 'antd/locale/es_ES'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider 
      locale={esES}
      theme={{
        token: {
          colorPrimary: '#764ba2',
          borderRadius: 8,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        },
        components: {
          Button: {
            controlHeight: 40,
            controlHeightSM: 32,
            controlHeightLG: 48,
          },
          Card: {
            borderRadiusLG: 16,
          },
          Input: {
            controlHeight: 40,
            controlHeightLG: 48,
          },
          Select: {
            controlHeight: 40,
            controlHeightLG: 48,
          }
        }
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>,
)
