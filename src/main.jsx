import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/theme.css'
import './styles/shell.css'

import { ConfigProvider, theme as antTheme } from 'antd'
import esES from 'antd/locale/es_ES'
import { ThemeProvider } from './components/layout/ThemeProvider'

const darkToken = {
  // brand
  colorPrimary: '#C4E94B',          // lima — actions
  colorInfo:    '#42D4E8',          // cyan — data
  colorSuccess: '#C4E94B',
  colorWarning: '#E0AB46',
  colorError:   '#E37C5C',
  colorLink:    '#42D4E8',

  // type
  fontFamily: "'Space Grotesk', -apple-system, system-ui, BlinkMacSystemFont, sans-serif",
  fontSize: 14,

  // surfaces
  colorBgBase:       '#0A0E18',
  colorBgLayout:     '#0A0E18',
  colorBgContainer:  '#141931',
  colorBgElevated:   '#1A2040',
  colorBgSpotlight:  '#222855',

  // borders
  colorBorder:           '#22284A',
  colorBorderSecondary:  '#1A2040',

  // text
  colorText:            '#EEEFE5',
  colorTextSecondary:   '#A8ADCB',
  colorTextTertiary:    '#6A7095',
  colorTextQuaternary:  '#4A5078',

  borderRadius: 10,
  borderRadiusLG: 16,
  controlHeight: 38,
  controlHeightLG: 46,
  controlHeightSM: 30,
  wireframe: false,
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <ConfigProvider
        locale={esES}
        theme={{
          algorithm: antTheme.darkAlgorithm,
          token: darkToken,
          components: {
            Layout: {
              bodyBg: '#0A0E18',
              headerBg: '#101426',
              siderBg: '#101426',
            },
            Card: { borderRadiusLG: 16, paddingLG: 20, colorBgContainer: '#141931' },
            Button: { fontWeight: 600, primaryShadow: 'none' },
            Input: { paddingBlock: 8, colorBgContainer: '#101426' },
            InputNumber: { colorBgContainer: '#101426' },
            Select: { colorBgContainer: '#101426', optionSelectedBg: '#1A2040' },
            DatePicker: { colorBgContainer: '#101426' },
            Modal: { borderRadiusLG: 16, contentBg: '#141931', headerBg: '#141931' },
            Table: {
              headerBg: '#1A2040',
              headerColor: '#A8ADCB',
              rowHoverBg: '#1A2040',
              borderColor: '#22284A',
              colorBgContainer: '#141931',
            },
            Tag: { defaultBg: '#1A2040', defaultColor: '#A8ADCB' },
            Drawer: { colorBgElevated: '#101426' },
            Menu: { itemSelectedBg: '#1A2040', itemSelectedColor: '#C4E94B', itemColor: '#A8ADCB' },
            Switch: { handleBg: '#0A0E18' },
            Tabs: { itemSelectedColor: '#C4E94B', inkBarColor: '#C4E94B' },
            Statistic: { colorTextHeading: '#EEEFE5' },
            Popover: { colorBgElevated: '#1A2040' },
            Tooltip: { colorBgSpotlight: '#1A2040' },
          },
        }}
      >
        <App />
      </ConfigProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
