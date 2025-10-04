const { contextBridge, ipcRenderer } = require('electron');

const invokeChannels = new Set(['scan-files', 'scan-file', 'ping']);

contextBridge.exposeInMainWorld('electron', {
	// window.electron.invoke('scan-files', items)
	invoke: (channel, ...args) => {
		if (!invokeChannels.has(channel)) {
			return Promise.reject(new Error(`Invalid IPC channel: ${channel}`));
		}
		return ipcRenderer.invoke(channel, ...args);
	},
	// 필요 시 이벤트 수신용
	on: (channel, listener) => {
		const wrapped = (_evt, ...a) => listener(...a);
		ipcRenderer.on(channel, wrapped);
		return () => ipcRenderer.removeListener(channel, wrapped);
	},
});
