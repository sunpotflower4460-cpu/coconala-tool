/**
 * 画面側に `window.desktop` だけを公開する（Node・Electron の機能そのものは渡さない）。
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { DesktopApi, SiteState } from '../src/lib/desktopBridge';

const api: DesktopApi = {
  keys: {
    status: () => ipcRenderer.invoke('keys:status'),
    save: (input) => ipcRenderer.invoke('keys:save', input),
    clear: (site) => ipcRenderer.invoke('keys:clear', site),
    test: (site) => ipcRenderer.invoke('keys:test', site),
  },
  sites: {
    search: (query) => ipcRenderer.invoke('sites:search', query),
    setLayout: (layout) => ipcRenderer.send('sites:layout', layout),
    capture: () => ipcRenderer.invoke('sites:capture'),
    goBack: (market) => ipcRenderer.invoke('sites:back', market),
    reload: (market) => ipcRenderer.invoke('sites:reload', market),
    openInBrowser: (market) => ipcRenderer.invoke('sites:openInBrowser', market),
    captureSettings: () => ipcRenderer.invoke('sites:captureSettings'),
    setCaptureEnabled: (market, enabled) => ipcRenderer.invoke('sites:setCaptureEnabled', market, enabled),
    onState: (listener) => {
      const handler = (_e: unknown, states: SiteState[]) => listener(states);
      ipcRenderer.on('sites:state', handler);
      return () => ipcRenderer.removeListener('sites:state', handler);
    },
  },
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  appInfo: () => ipcRenderer.invoke('app:info'),
};

contextBridge.exposeInMainWorld('desktop', api);
