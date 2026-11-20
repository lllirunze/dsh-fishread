/**
 * The only bridge between the reader window's sandboxed page and its main
 * process. No filesystem, no network, no privileged API beyond these actions.
 */
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('fishread', {
  platform: process.platform,
  ready: () => ipcRenderer.invoke('fishread:ready'),
  chooseFile: () => ipcRenderer.invoke('fishread:choose-file'),
  retryGbk: (token) => ipcRenderer.invoke('fishread:retry-gbk', token),
  cancelImport: (token) => ipcRenderer.invoke('fishread:cancel-import', token),
  confirmImport: (token) => ipcRenderer.invoke('fishread:confirm-import', token),
  getChapter: (index) => ipcRenderer.invoke('fishread:chapter', index),
  saveProgress: (progress) => ipcRenderer.invoke('fishread:progress', progress),
  setPrefs: (patch) => ipcRenderer.invoke('fishread:set-prefs', patch),
  hideWindow: () => ipcRenderer.invoke('fishread:hide'),
  showWindow: () => ipcRenderer.invoke('fishread:show'),
  closeWindow: () => ipcRenderer.invoke('fishread:close'),
  showExample: () => ipcRenderer.invoke('fishread:example'),
  onInit: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('fishread:init', listener)
    return () => ipcRenderer.removeListener('fishread:init', listener)
  },
  onLocale: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('fishread:locale', listener)
    return () => ipcRenderer.removeListener('fishread:locale', listener)
  },
  onPrefs: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('fishread:prefs', listener)
    return () => ipcRenderer.removeListener('fishread:prefs', listener)
  },
  onImport: (callback) => {
    const listener = () => callback()
    ipcRenderer.on('fishread:import', listener)
    return () => ipcRenderer.removeListener('fishread:import', listener)
  },
  onPage: (callback) => {
    const listener = (_event, direction) => callback(direction)
    ipcRenderer.on('fishread:page', listener)
    return () => ipcRenderer.removeListener('fishread:page', listener)
  },
})
