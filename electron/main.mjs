Set-Content -Path .\electron\main.mjs -Value @'
import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !!process.env.VITE_DEV_SERVER_URL;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#ffffff",
    title: "Incident Rescue Runbook",
    show: false, // show after content is ready
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true
    }
  });

  win.once("ready-to-show", () => win.show());

  if (isDev) {
    // Dev: point to Vite dev server
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // Prod: explicitly load a file:// URL to dist/index.html
    const indexFile = path.join(__dirname, "..", "dist", "index.html");
    const fileUrl = pathToFileURL(indexFile).toString();
    win.loadURL(fileUrl);

    // TEMP: open DevTools in prod just to diagnose blank screens
    // comment this out after it works once
    win.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
'@
