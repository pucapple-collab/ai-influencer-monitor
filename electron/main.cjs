const { app, BrowserWindow, ipcMain, clipboard, screen } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 340,
    height: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: true,
    hasShadow: false,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  win.loadFile('widget.html');

  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      (() => {
        let dragging = false;

        document.addEventListener('mousedown', (event) => {
          if (event.button !== 0) return;

          const target = event.target;

          if (
            target.closest('#character') ||
            target.closest('.panel') ||
            target.closest('button')
          ) {
            return;
          }

          dragging = true;

          window.electronDrag?.start(
            event.clientX,
            event.clientY
          );

          event.preventDefault();
        });

        document.addEventListener('mousemove', (event) => {
          if (!dragging) return;

          window.electronDrag?.move();
        });

        document.addEventListener('mouseup', () => {
          if (!dragging) return;

          dragging = false;
          window.electronDrag?.end();
        });
      })();
    `);
  });
}

app.whenReady().then(createWindow);

ipcMain.on('widget-drag-start', (event, { offsetX, offsetY }) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  if (!win) return;

  const point = screen.getCursorScreenPoint();

  win.__dragOffsetX = Number(offsetX || 0);
  win.__dragOffsetY = Number(offsetY || 0);
  win.__dragging = true;

  win.setPosition(
    Math.round(point.x - win.__dragOffsetX),
    Math.round(point.y - win.__dragOffsetY),
    false
  );
});

ipcMain.on('widget-drag', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  if (!win || !win.__dragging) return;

  const point = screen.getCursorScreenPoint();

  win.setPosition(
    Math.round(point.x - win.__dragOffsetX),
    Math.round(point.y - win.__dragOffsetY),
    false
  );
});

ipcMain.on('widget-drag-end', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  if (!win) return;

  win.__dragging = false;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});


ipcMain.handle("monitor:get", async () => {
  const response = await fetch("http://localhost:3000/api/monitor", {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Monitor API HTTP ${response.status}`);
  }

  return await response.json();
});

ipcMain.handle("monitor:copy", (_event, text) => {
  clipboard.writeText(String(text ?? ""));
  return true;
});

