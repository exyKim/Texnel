// preload.js
const { contextBridge, ipcRenderer } = require('electron');

/**
 * 1) 허용 채널 화이트리스트 (보안)
 *  - invoke: 요청/응답형
 *  - events: 메인 → 렌더러 푸시형
 */
const INVOKE_CHANNELS = new Set([
  'scan-files',
  'scan-file',
  'ping',
  'sanitize-file',     // ★ 추가
  'pick-directory',    // ★ 추가
  'save-sanitized-to', // ★ 추가
  'open-path',         // ★ 추가
]);

const EVENT_CHANNELS = new Set([
  'scan-progress',
  'scan-result',
  'scan-complete',
]);

/**
 * 2) 공용 구독 유틸 (remove용 핸들 반환)
 */
function subscribe(channel, cb) {
  if (!EVENT_CHANNELS.has(channel)) {
    console.warn('[preload] blocked event channel:', channel);
    return () => {};
  }
  const listener = (_evt, data) => {
    try { cb?.(data); } catch (e) { console.error('[preload] subscribe cb error:', e); }
  };
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

/**
 * 3) 안전한 invoke 래퍼
 */
function safeInvoke(channel, ...args) {
  if (!INVOKE_CHANNELS.has(channel)) {
    return Promise.reject(new Error(`Invalid IPC channel: ${channel}`));
  }
  return ipcRenderer.invoke(channel, ...args);
}

/**
 * 4) window.electron 에 노출
 */
contextBridge.exposeInMainWorld('electron', {
  // ---- invoke: 렌더러 → 메인 (요청/응답형) ----
  invoke: safeInvoke,

  // ---- 진행 상황/부분 결과/완료: 메인 → 렌더러 (푸시형) ----
  onScanProgress: (cb) => subscribe('scan-progress', cb),  // { done, total, name? }
  onScanResult:   (cb) => subscribe('scan-result', cb),    // { name, result }
  onScanComplete: (cb) => subscribe('scan-complete', cb),  // { total, results }

  /**
   * (선택) 제한된 generic on/off가 필요하면 아래를 사용:
   * - 의도치 않은 채널 구독을 막기 위해 EVENT_CHANNELS 밖은 차단
   */
  on: (channel, listener) => {
    if (!EVENT_CHANNELS.has(channel)) {
      console.warn('[preload] blocked generic on():', channel);
      return () => {};
    }
    const wrapped = (_evt, data) => {
      try { listener?.(data); } catch (e) { console.error('[preload] on() cb error:', e); }
    };
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
  },

  off: (channel, listener) => {
    if (!EVENT_CHANNELS.has(channel)) return;
    try { ipcRenderer.removeListener(channel, listener); } catch {}
  },
});
