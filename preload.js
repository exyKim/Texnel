// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// 1) 허용 채널 화이트리스트 (보안)
const INVOKE_CHANNELS = new Set(['scan-files', 'scan-file', 'ping']);
const EVENT_CHANNELS  = new Set(['scan-progress', 'scan-result', 'scan-complete']);

// 2) 공용 구독 유틸 (remove용 핸들 반환)
function subscribe(channel, cb) {
  if (!EVENT_CHANNELS.has(channel)) {
    console.warn('[preload] blocked event channel:', channel);
    return () => {};
  }
  const listener = (_evt, data) => cb?.(data);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('electron', {
  // ---- invoke: 렌더러 → 메인 (요청/응답형) ----
  invoke: (channel, ...args) => {
    if (!INVOKE_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`Invalid IPC channel: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args);
  },

  // ---- 진행 상황/부분 결과/완료: 메인 → 렌더러 (푸시형) ----
  onScanProgress: (cb) => subscribe('scan-progress', cb),  // { done, total, name }
  onScanResult:   (cb) => subscribe('scan-result', cb),    // { name, result }
  onScanComplete: (cb) => subscribe('scan-complete', cb),  // { total, results }

  // (선택) 기존 generic on 유지하고 싶으면 안전하게 제한
  on: (channel, listener) => {
    // 화이트리스트 외 채널은 차단
    if (!EVENT_CHANNELS.has(channel)) {
      console.warn('[preload] blocked generic on():', channel);
      return () => {};
    }
    const wrapped = (_evt, data) => listener?.(data);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },
});
