const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('invoicesDesktop', {
  platform: 'desktop',
})
