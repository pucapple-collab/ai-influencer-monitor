const { app, BrowserWindow, ipcMain, clipboard, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(__dirname, '..');

async function getLocalStatus() {
  const result = {
    projectPath: PROJECT_ROOT,
    nextServer: false,
    electronPid: process.pid,
    gitBranch: null,
    gitDirty: null,
    checkedAt: new Date().toISOString()
  };

  try {
    const response = await fetch('http://localhost:3000/api/monitor', {
      cache: 'no-store'
    });
    result.nextServer = response.ok;
  } catch {}

  try {
    const { stdout: branch } = await execFileAsync(
      'git',
      ['branch', '--show-current'],
      { cwd: PROJECT_ROOT }
    );
    result.gitBranch = branch.trim() || null;

    const { stdout: changes } = await execFileAsync(
      'git',
      ['status', '--porcelain'],
      { cwd: PROJECT_ROOT }
    );
    result.gitDirty = changes.trim().length > 0;
  } catch {}

  return result;
}

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
  const local = await getLocalStatus();

  try {
    const runtimePath = path.join(PROJECT_ROOT, "runtime", "local-status.json");

    if (fs.existsSync(runtimePath)) {
      const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8"));

      local.runtime = runtime;
      local.nextServer = runtime.nextServer ?? local.nextServer;
      local.gitBranch = runtime.gitBranch ?? local.gitBranch;
      local.gitDirty = runtime.gitDirty ?? local.gitDirty;
      local.checkedAt = runtime.checkedAt ?? local.checkedAt;
    }
  } catch (error) {
    local.runtimeError =
      error instanceof Error ? error.message : String(error);
  }

  try {
    const response = await fetch("http://localhost:3000/api/monitor", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Monitor API HTTP ${response.status}`);
    }

    const remote = await response.json();

    return {
      ...remote,
      local,
    };
  } catch (error) {
    return {
      ok: false,
      timestamp: new Date().toISOString(),
      summary: {
        status: "LOCAL",
        message: "Next.js Monitor API가 실행되지 않았어요."
      },
      local,
      error: error instanceof Error ? error.message : String(error)
    };
  }
});

ipcMain.handle("monitor:copy", (_event, text) => {
  clipboard.writeText(String(text ?? ""));
  return true;
});

