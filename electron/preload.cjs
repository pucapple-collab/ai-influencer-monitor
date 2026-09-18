const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronDrag', {
  start: (offsetX, offsetY) => {
    ipcRenderer.send('widget-drag-start', { offsetX, offsetY });
  },
  move: () => {
    ipcRenderer.send('widget-drag');
  },
  end: () => {
    ipcRenderer.send('widget-drag-end');
  }
});

contextBridge.exposeInMainWorld("monitor", {
  get: () => ipcRenderer.invoke("monitor:get"),
  copy: (text) => ipcRenderer.invoke("monitor:copy", text),
});
