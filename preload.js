const { contextBridge, ipcRenderer } = require('electron');
const call = (c) => (a) => ipcRenderer.invoke(c, a);
contextBridge.exposeInMainWorld('api', {
  listData: call('data:list'), download: call('data:download'), cancelDownload: call('data:cancel'),
  importData: call('data:import'), getDir: call('dir:get'), chooseDir: call('dir:choose'), openDir: call('dir:open'), listFiles: call('files:list'), importFolder: call('files:import'), loadTicks: call('data:load'),
  saveSim: call('sim:save'), listSims: call('sim:list'), loadSim: call('sim:load'), deleteSim: call('sim:delete'),
  allTrades: call('trades:all'), kvGet: call('kv:get'), kvSet: call('kv:set'),
  saveText: call('export:save'), importJson: call('import:json'), exportTicks: call('data:export'), gaps: call('files:gaps'), openExt: call('ext:open'),
  attAdd: call('att:add'), attSave: call('att:save'), attRead: call('att:read'), attDel: call('att:del'),
  saveFile: call('file:save'), openFile: call('file:open'), pickImage: call('img:pick'), saveShot: call('shot:save'), listShots: call('shot:list'), delShot: call('shot:del'),
  exportTicks: call('data:export'), checkGaps: call('data:gaps'), importCandles: call('data:candles'),
  getLicense: call('lic:get'), activate: call('lic:activate'),
  onProgress: (cb) => ipcRenderer.on('dl:progress', (_, p) => cb(p)),
});
