// ==UserScript==
// @name         18dm小说下载器
// @namespace    http://tampermonkey.net/
// @version      4.2.0
// @description  一键下载18dm/18mh小说为TXT · UI v2（Lobe 实色层 / Lucide 图标 / PowerGlitch 成功态）· 章节缓存 · 增量更新 · 标签抽屉 · 悬浮条拖拽磁吸 · 收藏/黑名单 WebDAV 同步
// @author       you
// @match        *://18dm.net/*
// @match        *://*.18dm.net/*
// @match        *://18mh.net/*
// @match        *://*.18mh.net/*
// @require      https://update.greasyfork.org/scripts/593538/1936318/webdev-component.js
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      18dm.net
// @connect      *.18dm.net
// @connect      18mh.net
// @connect      *.18mh.net
// @connect      self
// @connect      *
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  var CONCURRENCY = 8;
  var MAX_RETRY = 2;
  var STORE_KEY = 'dm_dl_history_v2';
  var FAV_KEY = 'dm_dl_favorites_v1';
  var BAN_KEY = 'dm_dl_blacklist_v1';
  var CONTENT_KEY = 'dm_dl_content_v1';
  var DOCK_POS_KEY = 'dm_dl_dock_pos_v3';
  var downloading = false;
  var isCollapsed = false;
  var escBound = false;
  var dockDragBound = false;
  var tipFetched = false;

  var currentFileObj = null;
  var currentBlobUrl = null;

  // ========== SVG 图标（统一尺寸与颜色） ==========
  var ICONS = {
    download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17V3"/><path d="m6 11 6 6 6-6"/><path d="M19 21H5"/></svg>',
    heart: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    heartFill: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    menu: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/><path d="M8 7h6"/><path d="M8 11h8"/></svg>',
    fold: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m14 10 7-7"/><path d="M20 10h-6V4"/><path d="m3 21 7-7"/><path d="M4 14h6v6"/></svg>',
    refresh: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
    check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    arrow: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
    cloud: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>',
    ban: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>'
  };

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  // ========== 样式注入 ==========
  function injectStyles() {
    var old = document.getElementById('dm-dl-styles');
    if (old) old.remove();
    var css = document.createElement('style');
    css.id = 'dm-dl-styles';
    css.textContent = [
      ':root{',
      '--dm-glass:#1a1a1f;--dm-glass-border:rgba(255,255,255,0.08);',
      '--dm-text:#f4f4f5;--dm-text-dim:#a1a1aa;--dm-text-mute:#71717a;',
      '--dm-accent:#3b82f6;--dm-accent-soft:rgba(59,130,246,0.16);',
      '--dm-success:#34d399;--dm-fav:#fb7185;--dm-danger:#f87171;--dm-ban:#a1a1aa;',
      '--dm-ease:cubic-bezier(0.16, 1, 0.3, 1);',
      '--dm-r-lg:12px;--dm-r-md:10px;--dm-r-sm:8px;--dm-r-pill:999px;',
      '}',
      '#dm-dl-root *{box-sizing:border-box!important;-webkit-tap-highlight-color:transparent!important;outline:none!important}',
      '#dm-dl-root button{font-family:inherit!important;margin:0!important;border:none!important;background:none!important;cursor:pointer!important;user-select:none!important;-webkit-user-select:none!important}',
      '#dm-dl-root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,"PingFang SC","Microsoft YaHei",sans-serif!important}',

      /* Toast */
      '#dm-dl-toast-box{position:fixed!important;top:calc(14px + env(safe-area-inset-top, 0px))!important;left:50%!important;',
      'transform:translateX(-50%) translateY(-20px)!important;opacity:0!important;pointer-events:none!important;z-index:2147483647!important;',
      'width:min(90vw, 360px)!important;padding:12px 16px!important;border-radius:var(--dm-r-md)!important;',
      'background:var(--dm-glass)!important;',
      'border:1px solid var(--dm-glass-border)!important;box-shadow:0 12px 36px rgba(0,0,0,0.55)!important;',
      'color:var(--dm-text)!important;font-size:13px!important;line-height:1.5!important;',
      'transition:opacity .25s var(--dm-ease),transform .25s var(--dm-ease)!important}',
      '#dm-dl-toast-box.show{opacity:1!important;transform:translateX(-50%) translateY(0)!important;pointer-events:auto!important}',
      '#dm-dl-toast-title{font-weight:700;font-size:13.5px;margin-bottom:2px;display:flex;align-items:center;gap:6px}',
      '#dm-dl-toast-msg{font-size:12px;color:var(--dm-text-dim);white-space:pre-wrap}',
      '#dm-dl-toast-acts{display:flex;gap:8px;margin-top:10px}',
      '.dm-dl-toast-btn{flex:1;padding:8px 0;border-radius:var(--dm-r-sm);font-size:12.5px;font-weight:600;text-align:center;',
      'background:rgba(255,255,255,0.08);color:#fff;transition:background .15s,transform .12s}',
      '.dm-dl-toast-btn:hover{background:rgba(255,255,255,0.15)}',
      '.dm-dl-toast-btn:active{transform:scale(0.96)}',
      '.dm-dl-toast-btn.highlight{background:#3b82f6;box-shadow:0 2px 10px rgba(59,130,246,0.35)}',
      '.dm-dl-toast-btn.highlight:hover{filter:brightness(1.08)}',

      /* ===== 确认/提示弹窗（底部抽屉风格，PC+手机统一） ===== */
      '#dm-dl-modal-mask{position:fixed!important;inset:0!important;top:0!important;left:0!important;right:0!important;bottom:0!important;',
      'background:rgba(0,0,0,0.48)!important;z-index:2147483647!important;',
      'display:flex!important;align-items:flex-end!important;justify-content:center!important;overflow:hidden!important;',
      'opacity:0!important;visibility:hidden!important;pointer-events:none!important;will-change:opacity!important;',
      'transition:opacity .22s var(--dm-ease),visibility 0s linear .22s!important}',
      '#dm-dl-modal-mask.open{opacity:1!important;visibility:visible!important;pointer-events:auto!important;',
      'transition:opacity .22s var(--dm-ease),visibility 0s linear 0s!important}',
      '#dm-dl-dialog{width:100%!important;max-width:400px!important;margin:0 auto!important;',
      'background:#1a1a1f!important;border:1px solid var(--dm-glass-border)!important;',
      'border-radius:20px 20px 0 0!important;padding:22px 20px calc(18px + env(safe-area-inset-bottom, 0px))!important;',
      'box-shadow:0 -16px 48px rgba(0,0,0,0.5)!important;transform:translateY(110%)!important;',
      'transition:transform .28s var(--dm-ease)!important}',
      '#dm-dl-modal-mask.open #dm-dl-dialog{transform:translateY(0)!important}',
      '#dm-dl-dialog-title{font-size:16px;font-weight:700;color:#fff;margin-bottom:8px;text-align:center}',
      '#dm-dl-dialog-body{font-size:13.5px;line-height:1.6;color:var(--dm-text-dim);white-space:pre-wrap;text-align:center;margin-bottom:18px}',
      '#dm-dl-dialog-acts{display:flex;gap:10px}',
      '.dm-dl-dialog-btn{flex:1;height:42px;border-radius:var(--dm-r-md);font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center;',
      'transition:transform .12s,filter .15s,box-shadow .15s}',
      '.dm-dl-dialog-btn:active{transform:scale(0.96)}',
      '.dm-dl-dialog-btn.cancel{background:rgba(255,255,255,0.08);color:var(--dm-text)}',
      '.dm-dl-dialog-btn.cancel:hover{background:rgba(255,255,255,0.14)}',
      '.dm-dl-dialog-btn.confirm{background:#3b82f6;color:#fff;box-shadow:0 4px 14px rgba(59,130,246,0.28)}',
      '.dm-dl-dialog-btn.confirm:hover{filter:brightness(1.08)}',
      '.dm-dl-dialog-btn.danger{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;box-shadow:0 4px 14px rgba(239,68,68,0.35)}',
      '.dm-dl-dialog-btn.danger:hover{filter:brightness(1.08)}',

      /* ===== 书库面板（底部抽屉，PC+手机统一） ===== */
      '#dm-dl-sheet-mask{position:fixed!important;inset:0!important;top:0!important;left:0!important;right:0!important;bottom:0!important;',
      'background:rgba(0,0,0,0.48)!important;z-index:2147483646!important;',
      'display:flex!important;align-items:flex-end!important;justify-content:center!important;overflow:hidden!important;',
      'opacity:0!important;visibility:hidden!important;pointer-events:none!important;will-change:opacity!important;',
      'transition:opacity .25s var(--dm-ease),visibility 0s linear .25s!important}',
      '#dm-dl-sheet-mask.open{opacity:1!important;visibility:visible!important;pointer-events:auto!important;',
      'transition:opacity .25s var(--dm-ease),visibility 0s linear 0s!important}',
      '#dm-dl-sheet{width:100%!important;max-width:460px!important;margin:0 auto!important;',
      'height:min(78vh, 620px)!important;background:#1a1a1f!important;',
      'border:1px solid var(--dm-glass-border)!important;border-radius:20px 20px 0 0!important;',
      'display:flex!important;flex-direction:column!important;overflow:hidden!important;',
      'box-shadow:0 -16px 48px rgba(0,0,0,0.5)!important;transform:translateY(110%)!important;',
      'transition:transform .3s var(--dm-ease)!important}',
      '#dm-dl-sheet-mask.open #dm-dl-sheet{transform:translateY(0)!important}',

      /* ===== PC（hover+fine pointer）：方案A 锚定气泡，无遮罩 ===== */
      '@media (hover:hover) and (pointer:fine){',
      '#dm-dl-modal-mask{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;transition:none!important}',
      '#dm-dl-dialog{position:fixed!important;width:280px!important;max-width:none!important;margin:0!important;',
      'border-radius:13px!important;padding:14px!important;box-shadow:0 16px 44px rgba(0,0,0,0.55)!important;',
      'transform:scale(0.9)!important;transform-origin:100% 100%!important;transition:transform .14s var(--dm-ease)!important}',
      '#dm-dl-modal-mask.open #dm-dl-dialog{transform:scale(1)!important}',
      '#dm-dl-dialog-title{font-size:14px!important;text-align:left!important;margin-bottom:6px!important}',
      '#dm-dl-dialog-body{font-size:12.5px!important;text-align:left!important;margin-bottom:12px!important}',
      '#dm-dl-dialog-acts{gap:8px!important}',
      '.dm-dl-dialog-btn{height:34px!important;font-size:12.5px!important;border-radius:8px!important}',
      '#dm-dl-sheet-mask{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;transition:none!important}',
      '#dm-dl-sheet{position:fixed!important;width:382px!important;max-width:82vw!important;height:auto!important;',
      'max-height:min(62vh, 540px)!important;margin:0!important;border-radius:16px!important;',
      'box-shadow:0 24px 64px rgba(0,0,0,0.6)!important;transform:scale(0.92) translateY(10px)!important;',
      'transform-origin:100% 100%!important;transition:transform .16s var(--dm-ease)!important}',
      '#dm-dl-sheet-mask.open #dm-dl-sheet{transform:scale(1) translateY(0)!important}',
      '}',

      '.dm-dl-hd{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 12px;border-bottom:1px solid rgba(255,255,255,0.06)}',
      '.dm-dl-hd h3{margin:0;font-size:15px;font-weight:700;color:#fff;display:flex;align-items:center;gap:6px}',
      '.dm-dl-hd-acts{display:flex;align-items:center;gap:6px}',
      '.dm-dl-hd-close{width:34px;height:34px;border-radius:var(--dm-r-sm);background:rgba(255,255,255,0.06);color:var(--dm-text-dim);display:flex;align-items:center;justify-content:center;font-size:15px;transition:background .15s,transform .12s}',
      '.dm-dl-hd-close:hover{background:rgba(255,255,255,0.12);color:#fff}',
      '.dm-dl-hd-close:active{transform:scale(0.92)}',
      '.dm-dl-tabs{display:flex;gap:6px;padding:10px 14px 0}',
      '.dm-dl-tab{flex:1;padding:9px 0;border-radius:var(--dm-r-sm);color:var(--dm-text-dim);font-size:13px;font-weight:600;text-align:center;transition:all .15s}',
      '.dm-dl-tab:hover{color:#fff;background:rgba(255,255,255,0.06)}',
      '.dm-dl-tab.on{color:#fff;background:var(--dm-accent-soft);box-shadow:inset 0 0 0 1px rgba(129,140,248,0.4)}',
      '.dm-dl-body{flex:1;overflow-y:auto;padding:12px 14px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.22) transparent}',
      '#dm-dl-root,#dm-dl-sheet,#dm-dl-tag-sheet,.dm-dl-body,.dm-dl-tag-sel,#dm-dl-tag-body{color-scheme:dark;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,0.22) transparent}',
      '#dm-dl-root *::-webkit-scrollbar{width:5px!important;height:5px!important;background:transparent!important}',
      '#dm-dl-root *::-webkit-scrollbar-track,#dm-dl-root *::-webkit-scrollbar-corner{background:transparent!important;border:none!important;box-shadow:none!important}',
      '#dm-dl-root *::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.22)!important;border-radius:99px!important;border:none!important}',
      '#dm-dl-root *::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.35)!important}',
      '.dm-dl-search{width:100%;padding:10px 12px;margin-bottom:10px;border-radius:var(--dm-r-sm);border:1px solid var(--dm-glass-border);background:rgba(0,0,0,0.25);color:var(--dm-text);font-size:13px}',
      '.dm-dl-item{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border-radius:var(--dm-r-md);background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.05);margin-bottom:8px;transition:background .15s}',
      '.dm-dl-item:hover{background:rgba(255,255,255,0.07)}',
      '.dm-dl-item-main{flex:1;min-width:0;cursor:pointer}',
      '.dm-dl-item-title{font-size:13.5px;font-weight:600;color:#f1f3f4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px}',
      '.dm-dl-item-meta{font-size:11.5px;color:var(--dm-text-mute);display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
      '.dm-dl-tag{padding:1px 6px;border-radius:var(--dm-r-pill);font-size:10px;font-weight:600}',
      '.dm-dl-tag.dl{background:rgba(52,211,153,0.16);color:var(--dm-success)}',
      '.dm-dl-tag.fav{background:rgba(251,113,133,0.16);color:var(--dm-fav)}',
      '.dm-dl-item-acts{display:flex;gap:6px}',
      '.dm-dl-mini{padding:7px 12px!important;border-radius:var(--dm-r-sm)!important;background:rgba(255,255,255,0.06)!important;color:var(--dm-text-dim)!important;font-size:12px!important;font-weight:500!important;transition:background .15s,color .15s,transform .12s!important}',
      '.dm-dl-mini:hover{background:rgba(255,255,255,0.12)!important;color:#fff!important}',
      '.dm-dl-mini:active{transform:scale(0.94)!important}',
      '.dm-dl-mini.danger:hover{background:rgba(239,68,68,0.22)!important;color:#fca5a5!important}',
      '.dm-dl-ft{padding:10px 14px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px}',
      '.dm-dl-ft button{flex:1;padding:9px 0;border-radius:var(--dm-r-sm);background:rgba(255,255,255,0.06);color:var(--dm-text-dim);font-size:12.5px;font-weight:500;transition:background .15s,color .15s,transform .12s}',
      '.dm-dl-ft button:hover{background:rgba(255,255,255,0.12);color:#fff}',
      '.dm-dl-ft button:active{transform:scale(0.96)}',
      '.dm-dl-empty{text-align:center;padding:50px 0;color:var(--dm-text-mute);font-size:13px}',

      /* 标签选择抽屉（替代站点 dx-middle-popup） */
      '#dm-dl-tag-mask{position:fixed!important;inset:0!important;background:rgba(0,0,0,0.48)!important;',
      'z-index:2147483646!important;',
      'display:flex!important;align-items:flex-end!important;justify-content:center!important;overflow:hidden!important;',
      'opacity:0!important;visibility:hidden!important;pointer-events:none!important;',
      'transition:opacity .25s var(--dm-ease),visibility 0s linear .25s!important}',
      '#dm-dl-tag-mask.open{opacity:1!important;visibility:visible!important;pointer-events:auto!important;',
      'transition:opacity .25s var(--dm-ease),visibility 0s linear 0s!important}',
      '#dm-dl-tag-sheet{width:100%!important;max-width:460px!important;margin:0 auto!important;',
      'height:min(84vh, 720px)!important;height:min(84dvh, 720px)!important;background:#1a1a1f!important;',
      'border:1px solid var(--dm-glass-border)!important;border-radius:20px 20px 0 0!important;',
      'display:flex!important;flex-direction:column!important;overflow:hidden!important;',
      'box-shadow:0 -16px 48px rgba(0,0,0,0.5)!important;transform:translateY(110%)!important;',
      'transition:transform .3s var(--dm-ease)!important;padding-bottom:env(safe-area-inset-bottom, 0px)!important}',
      '#dm-dl-tag-mask.open #dm-dl-tag-sheet{transform:translateY(0)!important}',
      '#dm-dl-tag-search{font-size:16px!important}',
      '.dm-dl-tag-sel{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px;max-height:76px;overflow-y:auto;-webkit-overflow-scrolling:touch}',
      '.dm-dl-tag-sel:empty{display:none}',
      '.dm-dl-tag-chip{padding:7px 11px;border-radius:var(--dm-r-pill);background:rgba(255,255,255,0.06);',
      'color:#d1d5db;font-size:12.5px;border:1px solid rgba(255,255,255,0.07);cursor:pointer;line-height:1.2;',
      'min-height:32px;transition:background .12s,color .12s,border-color .12s,transform .12s;-webkit-tap-highlight-color:transparent}',
      '.dm-dl-tag-chip:active{transform:scale(0.96)}',
      '.dm-dl-tag-chip.on{background:rgba(248,113,113,0.2);color:#fecaca;border-color:rgba(248,113,113,0.45)}',
      '.dm-dl-tag-chip.mini{padding:5px 9px;font-size:11.5px;min-height:28px}',
      '.dm-dl-tag-group{margin:12px 0 6px;font-size:11px;color:var(--dm-text-mute);font-weight:700;letter-spacing:.06em}',
      '.dm-dl-tag-grid{display:flex;flex-wrap:wrap;gap:6px}',
      '#dm-dl-tag-body{-webkit-overflow-scrolling:touch;overscroll-behavior:contain}',
      '#dm-dl-tag-count{font-size:12px;color:var(--dm-text-dim);display:flex;align-items:center;flex:0 0 auto;padding-right:6px}',
      '#dm-dl-tag-submit{background:#f43f5e!important;color:#fff!important;min-height:42px!important}',
      '#dm-dl-tag-clear{flex:0 0 auto!important;padding:9px 12px!important;min-height:42px!important}',
      '.dx-middle-popup,.dx-shield-tag-box{visibility:hidden!important;pointer-events:none!important;',
      'transform:translate(250%,-50%)!important}',

      /* Dock */
      '#dm-dl-dock-wrap{position:fixed!important;z-index:2147483645!important;display:flex!important;flex-direction:column!important;align-items:flex-end!important;touch-action:none!important}',
      '#dm-dl-latest-tip{margin-bottom:8px!important;padding:8px 12px!important;border-radius:var(--dm-r-md)!important;cursor:pointer!important;',
      'background:var(--dm-glass)!important;border:1px solid var(--dm-glass-border)!important;',
      'box-shadow:0 8px 24px rgba(0,0,0,0.4)!important;font-size:12.5px!important;color:var(--dm-text)!important;border-left:3.5px solid var(--dm-accent)!important;',
      'display:none;align-items:center;gap:6px;max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:transform .15s}',
      '#dm-dl-latest-tip.show{display:flex!important}',
      '#dm-dl-dock-wrap.collapsed #dm-dl-latest-tip{display:none!important}',
      '#dm-dl-latest-tip:active{transform:scale(0.98)}',

      '#dm-dl-dock{display:flex!important;align-items:center!important;gap:4px!important;height:48px!important;padding:5px!important;border-radius:var(--dm-r-lg)!important;',
      'background:var(--dm-glass)!important;',
      'border:1px solid var(--dm-glass-border)!important;box-shadow:0 12px 38px rgba(0,0,0,0.5)!important;user-select:none!important;-webkit-user-select:none!important;',
      'cursor:grab;transition:width .25s var(--dm-ease),height .25s var(--dm-ease),border-radius .25s var(--dm-ease),box-shadow .2s!important}',
      '#dm-dl-dock:active{cursor:grabbing}',

      '#dm-dl-dock.collapsed{width:44px!important;height:44px!important;min-width:44px!important;padding:0!important;border-radius:var(--dm-r-pill)!important;justify-content:center!important;gap:0!important}',
      '#dm-dl-dock.collapsed > *:not(#dm-dl-dot-btn){display:none!important}',
      '#dm-dl-dot-btn{display:none;width:100%;height:100%;align-items:center;justify-content:center;position:relative;cursor:pointer;color:#fff;transition:transform .15s}',
      '#dm-dl-dock.collapsed #dm-dl-dot-btn{display:flex!important}',
      '#dm-dl-dot-btn:active{transform:scale(0.9)}',
      '#dm-dl-dot-btn svg{width:18px;height:18px}',
      '#dm-dl-dot-badge{position:absolute;top:5px;right:5px;width:8px;height:8px;border-radius:50%;background:var(--dm-fav);display:none;box-shadow:0 0 0 2px rgba(22,23,32,0.9)}',
      '#dm-dl-dot-badge.show{display:block;animation:dm-pulse 1.6s infinite}',

      '@keyframes dm-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:0.7}}',
      '@keyframes dm-spin{to{transform:rotate(360deg)}}',
      '@keyframes dm-heart{0%,100%{transform:scale(1)}40%{transform:scale(1.25)}70%{transform:scale(0.95)}}',
      '@keyframes dm-glitch{0%,100%{clip-path:inset(0 0 0 0);transform:translate(0)}',
      '12%{clip-path:inset(12% 0 55% 0);transform:translate(-2px,1px)}',
      '24%{clip-path:inset(60% 0 10% 0);transform:translate(2px,-1px)}',
      '36%{clip-path:inset(28% 0 40% 0);transform:translate(-1px,0)}',
      '48%{clip-path:inset(0 0 0 0);transform:translate(0)}}',
      '.dm-dl-glitch{position:relative;animation:dm-glitch .42s steps(2,end)}',
      '.dm-dl-glitch::before,.dm-dl-glitch::after{content:attr(data-text);position:absolute;left:0;top:0;width:100%;pointer-events:none}',
      '.dm-dl-glitch::before{color:#67e8f9;transform:translate(1px,0);mix-blend-mode:screen}',
      '.dm-dl-glitch::after{color:#fb7185;transform:translate(-1px,0);mix-blend-mode:screen}',

      '.dm-dl-dock-btn{width:38px!important;height:38px!important;min-width:38px!important;border-radius:var(--dm-r-md)!important;color:var(--dm-text-dim)!important;',
      'display:inline-flex!important;align-items:center!important;justify-content:center!important;transition:all .15s!important;flex-shrink:0!important}',
      '.dm-dl-dock-btn:hover{background:rgba(255,255,255,0.1)!important;color:#fff!important}',
      '.dm-dl-dock-btn:active{transform:scale(0.9)!important}',
      '.dm-dl-dock-btn.fav-on{color:var(--dm-fav)!important}',
      '.dm-dl-dock-btn.fav-on:hover{background:rgba(251,113,133,0.15)!important}',
      '.dm-dl-dock-btn.fav-pulse{animation:dm-heart 0.4s ease}',
      '.dm-dl-dock-btn.ban-on{color:var(--dm-ban)!important}',
      '.dm-dl-dock-btn.ban-on:hover{background:rgba(161,161,170,0.18)!important}',
      '.dm-dl-dock-btn.fold{color:var(--dm-text-mute)!important}',
      '.dm-dl-dock-btn svg{display:block;pointer-events:none}',

      /* 主按钮 */
      '#dm-dl-main-btn{position:relative!important;flex:1 1 auto!important;min-width:128px!important;max-width:210px!important;',
      'height:38px!important;padding:0 12px!important;border-radius:var(--dm-r-md)!important;display:inline-flex!important;',
      'align-items:center!important;justify-content:center!important;font-size:13px!important;font-weight:650!important;',
      'color:#fff!important;background:#f43f5e!important;',
      'box-shadow:0 3px 10px rgba(244,63,94,0.28)!important;white-space:nowrap!important;overflow:hidden!important;',
      'transition:transform .12s,box-shadow .2s,filter .15s!important;flex-shrink:1!important}',
      '#dm-dl-main-btn:hover{filter:brightness(1.06);box-shadow:0 5px 14px rgba(244,63,94,0.38)!important}',
      '#dm-dl-main-btn:active{transform:scale(0.97)!important}',
      '#dm-dl-main-btn.done{background:#059669!important;box-shadow:0 3px 10px rgba(5,150,105,0.32)!important}',
      '#dm-dl-main-btn.done:hover{box-shadow:0 5px 14px rgba(5,150,105,0.42)!important}',
      '#dm-dl-main-btn.update{background:#3b82f6!important;box-shadow:0 3px 10px rgba(59,130,246,0.35)!important}',
      '#dm-dl-main-btn.update:hover{box-shadow:0 5px 14px rgba(59,130,246,0.45)!important}',
      '#dm-dl-main-btn.loading{background:rgba(40,42,54,0.95)!important;cursor:wait!important;box-shadow:none!important}',
      '#dm-dl-main-btn.loading:hover{filter:none;box-shadow:none!important}',
      '#dm-dl-main-btn .dm-dl-prog{position:absolute!important;left:0;bottom:0;height:3px;width:0;background:linear-gradient(90deg,#ff5f6d,#ff9a44);z-index:0;transition:width .25s ease;border-radius:0 0 var(--dm-r-md) var(--dm-r-md)}',
      '#dm-dl-main-btn.loading .dm-dl-prog{background:linear-gradient(90deg,#818cf8,#a78bfa)}',
      '#dm-dl-main-btn .dm-dl-btn-txt{position:relative;z-index:1;display:flex;align-items:center;gap:5px;overflow:hidden;text-overflow:ellipsis}',
      '#dm-dl-main-btn .dm-dl-btn-txt svg{flex-shrink:0}',
      '#dm-dl-main-btn .dm-dl-spinner{width:14px;height:14px;border:2px solid rgba(255,255,255,0.25);border-top-color:#fff;border-radius:50%;animation:dm-spin .7s linear infinite;flex-shrink:0}',

      /* 徽章 */
      '#dm-dl-title-badge,#dm-dl-fav-badge,#dm-dl-update-badge,#dm-dl-ban-badge{display:inline-flex!important;align-items:center!important;gap:3px!important;',
      'margin-left:6px!important;padding:2px 8px!important;border-radius:var(--dm-r-pill)!important;font-size:11.5px!important;font-weight:600!important;vertical-align:middle!important}',
      '#dm-dl-title-badge{background:rgba(52,211,153,0.15)!important;color:#2dd4a8!important;border:1px solid rgba(52,211,153,0.35)!important}',
      '#dm-dl-fav-badge{background:rgba(251,113,133,0.15)!important;color:var(--dm-fav)!important;border:1px solid rgba(251,113,133,0.35)!important}',
      '#dm-dl-update-badge{background:rgba(129,140,248,0.18)!important;color:#a5b4fc!important;border:1px solid rgba(129,140,248,0.4)!important}',
      '#dm-dl-ban-badge{background:rgba(161,161,170,0.18)!important;color:var(--dm-ban)!important;border:1px solid rgba(161,161,170,0.4)!important}',
      '.dm-dl-card-badge{display:inline-flex!important;margin-left:6px!important;padding:1px 6px!important;border-radius:4px!important;font-size:10px!important;font-weight:600!important;vertical-align:middle!important;color:#fff!important}',
      '.dm-dl-card-badge.dl{background:#059669!important}',
      '.dm-dl-card-badge.fav{background:#e11d48!important}',
      '.dm-dl-card-badge.both{background:#3b82f6!important}',
      '.dm-dl-card-badge.ban{background:#52525b!important}',
      '.dm-dl-tag.ban{background:rgba(161,161,170,0.18);color:var(--dm-ban)}',

      /* 移动端 */
      '@media screen and (max-width: 640px){',
      '#dm-dl-dock{height:44px!important;border-radius:var(--dm-r-md)!important;padding:4px!important;gap:3px!important}',
      '.dm-dl-dock-btn{width:36px!important;height:36px!important;min-width:36px!important}',
      '#dm-dl-main-btn{min-width:96px!important;max-width:160px!important;height:36px!important;padding:0 10px!important;font-size:12.5px!important}',
      '#dm-dl-dock.collapsed{width:42px!important;height:42px!important}',
      '#dm-dl-tag-sheet{max-width:100%!important;height:min(90vh, 100%)!important;height:min(90dvh, 100%)!important;',
      'border-radius:16px 16px 0 0!important}',
      '#dm-dl-tag-search{font-size:16px!important}',
      '}'
    ].join('');
    document.head.appendChild(css);
  }

  // ========== UI 基础设施 ==========
  function ensureDOM() {
    injectStyles();
    var root = document.getElementById('dm-dl-root');
    if (root) return;

    root = document.createElement('div');
    root.id = 'dm-dl-root';

    // Toast
    var toastBox = document.createElement('div');
    toastBox.id = 'dm-dl-toast-box';
    toastBox.innerHTML = '<div id="dm-dl-toast-title"></div><div id="dm-dl-toast-msg"></div><div id="dm-dl-toast-acts"></div>';
    root.appendChild(toastBox);

    // Modal
    var modalMask = document.createElement('div');
    modalMask.id = 'dm-dl-modal-mask';
    modalMask.innerHTML = '<div id="dm-dl-dialog"><div id="dm-dl-dialog-title"></div><div id="dm-dl-dialog-body"></div><div id="dm-dl-dialog-acts"></div></div>';
    root.appendChild(modalMask);

    // Sheet
    var sheetMask = document.createElement('div');
    sheetMask.id = 'dm-dl-sheet-mask';
    sheetMask.innerHTML =
      '<div id="dm-dl-sheet">' +
      '<div class="dm-dl-hd"><h3>我的书库</h3><div class="dm-dl-hd-acts"><button type="button" class="dm-dl-hd-close" id="dm-dl-webdav-btn" title="云同步"></button><button type="button" class="dm-dl-hd-close" id="dm-dl-sheet-close">✕</button></div></div>' +
      '<div class="dm-dl-tabs">' +
      '<button type="button" class="dm-dl-tab on" data-tab="dl">已下载</button>' +
      '<button type="button" class="dm-dl-tab" data-tab="fav">已收藏</button>' +
      '<button type="button" class="dm-dl-tab" data-tab="ban">已拉黑</button>' +
      '</div>' +
      '<div class="dm-dl-body" id="dm-dl-sheet-body"></div>' +
      '<div class="dm-dl-ft">' +
      '<button type="button" id="dm-dl-export">导出列表</button>' +
      '<button type="button" id="dm-dl-clear-tab">清空记录</button>' +
      '<button type="button" id="dm-dl-clear-cache">清空缓存</button>' +
      '</div></div>';
    root.appendChild(sheetMask);

    sheetMask.addEventListener('click', function (e) {
      if (e.target === sheetMask) closeSheet();
    });
    modalMask.addEventListener('click', function (e) {
      if (e.target === modalMask && typeof modalMask._resolve === 'function') {
        modalMask.classList.remove('open');
        modalMask._resolve(false);
        modalMask._resolve = null;
      }
    });

    // Dock
    var dockWrap = document.createElement('div');
    dockWrap.id = 'dm-dl-dock-wrap';
    dockWrap.innerHTML = '<div id="dm-dl-latest-tip"></div><div id="dm-dl-dock"></div>';
    root.appendChild(dockWrap);

    // 标签选择抽屉
    var tagMask = document.createElement('div');
    tagMask.id = 'dm-dl-tag-mask';
    tagMask.innerHTML =
      '<div id="dm-dl-tag-sheet">' +
      '<div class="dm-dl-hd"><h3 id="dm-dl-tag-title">选择标签</h3><button type="button" class="dm-dl-hd-close" id="dm-dl-tag-close">✕</button></div>' +
      '<div style="padding:10px 14px 0"><input type="search" class="dm-dl-search" id="dm-dl-tag-search" placeholder="搜索标签…" style="margin-bottom:8px"></div>' +
      '<div class="dm-dl-tag-sel" id="dm-dl-tag-sel"></div>' +
      '<div class="dm-dl-body" id="dm-dl-tag-body"></div>' +
      '<div class="dm-dl-ft">' +
      '<span id="dm-dl-tag-count">已选 0</span>' +
      '<button type="button" id="dm-dl-tag-clear">清空</button>' +
      '<button type="button" id="dm-dl-tag-submit">提交</button>' +
      '</div></div>';
    root.appendChild(tagMask);
    tagMask.addEventListener('click', function (e) {
      if (e.target === tagMask) closeTagSheet();
    });

    document.body.appendChild(root);

    // 把 toast 移到根节点末尾，保证提示条绘制在弹窗遮罩之上
    root.appendChild(toastBox);

    if (!escBound) {
      escBound = true;
      document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var mm = document.getElementById('dm-dl-modal-mask');
        if (mm && mm.classList.contains('open') && typeof mm._resolve === 'function') {
          mm.classList.remove('open');
          mm._resolve(false);
          mm._resolve = null;
          return;
        }
        var tm = document.getElementById('dm-dl-tag-mask');
        if (tm && tm.classList.contains('open')) {
          closeTagSheet();
          return;
        }
        var sm = document.getElementById('dm-dl-sheet-mask');
        if (sm && sm.classList.contains('open')) closeSheet();
      });
    }

    var closeBtn = document.getElementById('dm-dl-sheet-close');
    if (closeBtn) closeBtn.onclick = closeSheet;
    var webdavBtn = document.getElementById('dm-dl-webdav-btn');
    if (webdavBtn) {
      webdavBtn.innerHTML = ICONS.cloud;
      webdavBtn.onclick = function (e) {
        e.stopPropagation();
        openWebdavPanel();
      };
    }
    var tagClose = document.getElementById('dm-dl-tag-close');
    if (tagClose) tagClose.onclick = closeTagSheet;

    bindSheetTabs();
    bindTagSheetActions();
  }

  // Toast
  var toastTimer = null;
  function showToast(opts) {
    ensureDOM();
    var box = document.getElementById('dm-dl-toast-box');
    var titleEl = document.getElementById('dm-dl-toast-title');
    var msgEl = document.getElementById('dm-dl-toast-msg');
    var actsEl = document.getElementById('dm-dl-toast-acts');
    if (!box) return;

    clearTimeout(toastTimer);
    titleEl.textContent = opts.title || '提示';
    titleEl.setAttribute('data-text', titleEl.textContent);
    titleEl.classList.remove('dm-dl-glitch');
    void titleEl.offsetWidth;
    titleEl.classList.add('dm-dl-glitch');
    msgEl.textContent = opts.msg || '';
    actsEl.innerHTML = '';

    if (opts.buttons && opts.buttons.length) {
      opts.buttons.forEach(function (btn) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'dm-dl-toast-btn' + (btn.highlight ? ' highlight' : '');
        b.textContent = btn.text;
        b.onclick = function (e) {
          e.stopPropagation();
          if (btn.onClick) btn.onClick();
        };
        actsEl.appendChild(b);
      });
      actsEl.style.display = 'flex';
    } else {
      actsEl.style.display = 'none';
    }

    box.classList.add('show');
    var dur = opts.duration != null ? opts.duration : 4000;
    if (dur > 0) {
      toastTimer = setTimeout(function () { box.classList.remove('show'); }, dur);
    }
  }

  function hideToast() {
    var box = document.getElementById('dm-dl-toast-box');
    if (box) box.classList.remove('show');
  }

  // ========== PC 锚定气泡（方案A） ==========
  function isFinePointer() {
    try {
      return !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches);
    } catch (e) { return false; }
  }

  function anchorPopoverToDock(el, maxH) {
    var dock = document.getElementById('dm-dl-dock');
    if (!dock || !el) return;
    var r = dock.getBoundingClientRect();
    var W = window.innerWidth || document.documentElement.clientWidth;
    var H = window.innerHeight || document.documentElement.clientHeight;
    el.style.left = 'auto';
    el.style.top = 'auto';
    el.style.right = Math.max(8, Math.round(W - r.right)) + 'px';
    var elH = el.offsetHeight || 120;
    if (maxH) elH = Math.min(elH, maxH);
    if (r.top >= elH + 30) {
      // 上方空间足够：贴 Dock 顶部向上弹出
      el.style.bottom = Math.round(H - r.top + 10) + 'px';
      el.style.setProperty('transform-origin', '100% 100%', 'important');
      if (maxH) el.style.setProperty('max-height', Math.max(160, Math.min(maxH, r.top - 18)) + 'px', 'important');
    } else {
      // 上方不够：翻转到 Dock 下方弹出
      el.style.bottom = Math.round(H - r.bottom - 10) + 'px';
      el.style.setProperty('transform-origin', '100% 0', 'important');
      if (maxH) el.style.setProperty('max-height', Math.max(160, Math.min(maxH, H - r.bottom - 18)) + 'px', 'important');
    }
  }

  function clearPopoverAnchor(el) {
    if (!el) return;
    el.style.left = '';
    el.style.top = '';
    el.style.right = '';
    el.style.bottom = '';
    el.style.removeProperty('max-height');
    el.style.removeProperty('transform-origin');
  }

  // Confirm
  function showConfirm(opts) {
    ensureDOM();
    return new Promise(function (resolve) {
      var mask = document.getElementById('dm-dl-modal-mask');
      var title = document.getElementById('dm-dl-dialog-title');
      var body = document.getElementById('dm-dl-dialog-body');
      var acts = document.getElementById('dm-dl-dialog-acts');

      title.textContent = opts.title || '请确认';
      body.textContent = opts.content || '';
      acts.innerHTML = '';

      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'dm-dl-dialog-btn cancel';
      cancelBtn.textContent = opts.cancelText || '取消';
      cancelBtn.onclick = function () {
        mask.classList.remove('open');
        mask._resolve = null;
        resolve(false);
      };

      var confirmBtn = document.createElement('button');
      confirmBtn.className = 'dm-dl-dialog-btn ' + (opts.danger ? 'danger' : 'confirm');
      confirmBtn.textContent = opts.confirmText || '确定';
      confirmBtn.onclick = function () {
        mask.classList.remove('open');
        mask._resolve = null;
        resolve(true);
      };

      acts.appendChild(cancelBtn);
      acts.appendChild(confirmBtn);

      mask._resolve = resolve;
      // PC：确认气泡锚定到 Dock；手机：维持底部抽屉
      var dlg = document.getElementById('dm-dl-dialog');
      if (isFinePointer()) anchorPopoverToDock(dlg, 0);
      else clearPopoverAnchor(dlg);
      // 强制触发 reflow 再加 open，避免 PC 端偶发不显示
      void mask.offsetWidth;
      mask.classList.add('open');
    });
  }

  // Alert
  function showAlert(opts) {
    ensureDOM();
    return new Promise(function (resolve) {
      var mask = document.getElementById('dm-dl-modal-mask');
      var title = document.getElementById('dm-dl-dialog-title');
      var body = document.getElementById('dm-dl-dialog-body');
      var acts = document.getElementById('dm-dl-dialog-acts');

      title.textContent = opts.title || '提示';
      body.textContent = opts.content || '';
      acts.innerHTML = '';

      var confirmBtn = document.createElement('button');
      confirmBtn.className = 'dm-dl-dialog-btn confirm';
      confirmBtn.textContent = opts.confirmText || '我知道了';
      confirmBtn.onclick = function () {
        mask.classList.remove('open');
        mask._resolve = null;
        resolve(true);
      };

      acts.appendChild(confirmBtn);
      mask._resolve = resolve;
      var dlg = document.getElementById('dm-dl-dialog');
      if (isFinePointer()) anchorPopoverToDock(dlg, 0);
      else clearPopoverAnchor(dlg);
      void mask.offsetWidth;
      mask.classList.add('open');
    });
  }

  function openSheet() {
    ensureDOM();
    var mask = document.getElementById('dm-dl-sheet-mask');
    if (mask) {
      var sheet = document.getElementById('dm-dl-sheet');
      if (isFinePointer()) anchorPopoverToDock(sheet, 540);
      else clearPopoverAnchor(sheet);
      void mask.offsetWidth;
      mask.classList.add('open');
      renderSheetBody();
    }
  }

  function closeSheet() {
    var mask = document.getElementById('dm-dl-sheet-mask');
    if (mask) mask.classList.remove('open');
    clearPopoverAnchor(document.getElementById('dm-dl-sheet'));
  }

  function closeTagSheet() {
    var mask = document.getElementById('dm-dl-tag-mask');
    if (mask) mask.classList.remove('open');
    document.body.style.removeProperty('overflow');
  }

  // ========== 存储 ==========
  function loadJSON(key) {
    try {
      var raw = '';
      if (typeof GM_getValue === 'function') raw = GM_getValue(key, '');
      if (!raw) raw = localStorage.getItem(key) || '';
      if (!raw) return {};
      var obj = JSON.parse(raw);
      return obj && typeof obj === 'object' ? obj : {};
    } catch (e) { return {}; }
  }

  function saveJSON(key, map) {
    try {
      var raw = JSON.stringify(map);
      if (typeof GM_setValue === 'function') GM_setValue(key, raw);
      localStorage.setItem(key, raw);
    } catch (e) {}
  }

  function loadHistory() { return loadJSON(STORE_KEY); }
  function saveHistory(map) { saveJSON(STORE_KEY, map); }
  function loadFavs() { return loadJSON(FAV_KEY); }
  function saveFavs(map) { saveJSON(FAV_KEY, map); }
  function loadBans() { return loadJSON(BAN_KEY); }
  function saveBans(map) { saveJSON(BAN_KEY, map); }
  function loadContentCache() { return loadJSON(CONTENT_KEY); }

  function mapToItems(map) {
    var items = [];
    var src = map && typeof map === 'object' ? map : {};
    Object.keys(src).forEach(function (k) {
      var it = src[k];
      if (it && typeof it === 'object') items.push(it);
    });
    return items;
  }

  function normalizeRecord(it, fallbackUrl) {
    if (!it || typeof it !== 'object') return null;
    var id = String(it.id || '').trim();
    if (!id) return null;
    var t = it.time || Date.now();
    return {
      id: id,
      title: it.title || ('小说 ' + id),
      url: it.url || (typeof fallbackUrl === 'function' ? fallbackUrl(id) : ''),
      time: t,
      timeText: it.timeText || new Date(t).toLocaleString()
    };
  }

  function mergeItems(local, items, fallbackUrl) {
    var map = Object.assign({}, local && typeof local === 'object' ? local : {});
    var list = Array.isArray(items) ? items : [];
    var count = 0;
    list.forEach(function (it) {
      var rec = normalizeRecord(it, fallbackUrl);
      if (!rec) return;
      map[rec.id] = rec;
      count++;
    });
    return { map: map, count: count };
  }

  function stripFavsByBan(favs, bans) {
    var next = Object.assign({}, favs && typeof favs === 'object' ? favs : {});
    var src = bans && typeof bans === 'object' ? bans : {};
    Object.keys(src).forEach(function (id) { delete next[id]; });
    return next;
  }

  function exportLibraryPayload(favs, bans, exportedAt) {
    return JSON.stringify({
      app: '18mh',
      kind: 'favorites',
      v: 2,
      exportedAt: exportedAt || new Date().toISOString(),
      items: mapToItems(favs),
      blacklist: mapToItems(bans)
    }, null, 2);
  }

  function mergeLibraryFromPackData(pack, localFavs, localBans, fallbackUrl) {
    var data = pack && pack.data && typeof pack.data === 'object' ? pack.data : {};
    var favMerge = mergeItems(localFavs, data.items, fallbackUrl);
    var hasBan = Array.isArray(data.blacklist);
    var banMerge = hasBan
      ? mergeItems(localBans, data.blacklist, fallbackUrl)
      : { map: Object.assign({}, localBans && typeof localBans === 'object' ? localBans : {}), count: 0 };
    return {
      favs: stripFavsByBan(favMerge.map, banMerge.map),
      bans: banMerge.map,
      favCount: favMerge.count,
      banCount: banMerge.count
    };
  }

  function toggleBanState(favs, bans, id, rec) {
    var key = String(id || '').trim();
    var nextFavs = Object.assign({}, favs && typeof favs === 'object' ? favs : {});
    var nextBans = Object.assign({}, bans && typeof bans === 'object' ? bans : {});
    if (!key) return { on: false, favs: nextFavs, bans: nextBans };
    if (nextBans[key]) {
      delete nextBans[key];
      return { on: false, favs: nextFavs, bans: nextBans };
    }
    var row = normalizeRecord(rec || { id: key }, function (nid) {
      return absUrl('/novel/detail/' + nid);
    }) || { id: key, title: '小说 ' + key, url: '', time: Date.now(), timeText: new Date().toLocaleString() };
    nextBans[key] = row;
    delete nextFavs[key];
    return { on: true, favs: nextFavs, bans: nextBans };
  }

  function getNovelIdFromUrl(url) {
    url = url || location.href;
    var m = String(url).match(/\/novel\/detail\/(\d+)/i) || String(url).match(/\/novel_chapter\/(\d+)/i);
    return m ? m[1] : '';
  }

  function isDownloaded(id) { return !id ? false : !!loadHistory()[String(id)]; }
  function isFav(id) { return !id ? false : !!loadFavs()[String(id)]; }
  function isBan(id) { return !id ? false : !!loadBans()[String(id)]; }
  function getRecord(id) { return loadHistory()[String(id)] || null; }

  function getNewChapters(chapters, rec) {
    if (!rec || !chapters || !chapters.length) return [];
    var maxId = rec.maxId;
    if (maxId) return chapters.filter(function (c) { return c.id > maxId; });
    var n = chapters.length - (rec.chapters || 0);
    if (n <= 0) return [];
    return chapters.slice(chapters.length - n);
  }

  var latestCache = {};
  function cacheLatest(id, list) {
    latestCache[String(id)] = { count: list.length, ts: Date.now() };
  }

  function fetchChapterList(novelId) {
    var url = absUrl('/novel/detail/' + novelId);
    return requestText(url).then(function (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var list = parseChaptersIn(doc);
      if (!list.length) throw new Error('未解析到章节列表');
      cacheLatest(novelId, list);
      return list;
    });
  }

  var CACHE_MAX_NOVELS = 30;
  function getNovelCache(id) { return loadContentCache()[String(id)] || null; }

  function mergeNovelCache(id, title, items) {
    if (!id || !items || !items.length) return;
    var map = loadContentCache();
    var key = String(id);
    var entry = map[key] || { title: title || '', time: 0, chapters: {} };
    entry.title = title || entry.title;
    entry.time = Date.now();
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || it.text == null) continue;
      entry.chapters[String(it.id)] = { title: it.title || '', text: it.text };
    }
    var keys = Object.keys(map).sort(function (a, b) { return (map[b].time || 0) - (map[a].time || 0); });
    for (var k = keys.length - 1; k >= CACHE_MAX_NOVELS; k--) delete map[keys[k]];
    saveJSON(CONTENT_KEY, map);
  }

  function markDownloaded(id, title, chapters, okCount, failCount, url, maxId) {
    if (!id) return;
    var h = loadHistory();
    h[String(id)] = {
      id: String(id), title: title || '', chapters: chapters || 0,
      ok: okCount || 0, fail: failCount || 0, maxId: maxId || 0,
      time: Date.now(), timeText: new Date().toLocaleString(),
      url: url || absUrl('/novel/detail/' + id)
    };
    saveHistory(h);
  }

  function unmarkDownloaded(id) {
    if (!id) return;
    var h = loadHistory();
    delete h[String(id)];
    saveHistory(h);
  }

  function toggleFavorite(id, title, url) {
    if (!id) return false;
    var f = loadFavs();
    var key = String(id);
    if (f[key]) {
      delete f[key];
      saveFavs(f);
      return false;
    }
    f[key] = {
      id: key, title: title || ('小说 ' + key),
      url: url || absUrl('/novel/detail/' + key),
      time: Date.now(), timeText: new Date().toLocaleString()
    };
    saveFavs(f);
    return true;
  }

  function removeFavorite(id) {
    if (!id) return;
    var f = loadFavs();
    delete f[String(id)];
    saveFavs(f);
  }

  function toggleBan(id, title, url) {
    var result = toggleBanState(loadFavs(), loadBans(), id, {
      id: String(id || ''),
      title: title,
      url: url || absUrl('/novel/detail/' + id),
      time: Date.now(),
      timeText: new Date().toLocaleString()
    });
    saveFavs(result.favs);
    saveBans(result.bans);
    return result.on;
  }

  function removeBan(id) {
    if (!id) return;
    var b = loadBans();
    delete b[String(id)];
    saveBans(b);
  }

  function exportFavPayload() {
    return exportLibraryPayload(loadFavs(), loadBans());
  }

  function mergeFavsFromPack(pack) {
    var result = mergeLibraryFromPackData(pack, loadFavs(), loadBans(), function (id) {
      return absUrl('/novel/detail/' + id);
    });
    saveFavs(result.favs);
    saveBans(result.bans);
    return result;
  }

  function webdevRequest(o) {
    var gm = (typeof GM_xmlhttpRequest === 'function' && GM_xmlhttpRequest)
      || (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function' && GM.xmlHttpRequest)
      || null;
    if (!gm) return Promise.reject(new Error('当前环境不支持跨域请求'));
    return new Promise(function (resolve, reject) {
      var done = false;
      function finish(fn, arg) {
        if (done) return;
        done = true;
        fn(arg);
      }
      try {
        var req = {
          method: o.method || 'GET',
          url: o.url,
          timeout: o.timeout || 20000,
          headers: o.headers || {},
          onload: function (res) {
            var st = res && typeof res.status === 'number' ? res.status : 0;
            var okList = Array.isArray(o.acceptStatuses) ? o.acceptStatuses : null;
            var ok = okList
              ? (st === 0 || okList.indexOf(st) >= 0)
              : (st === 0 || (st >= 200 && st < 300));
            if (ok) finish(resolve, res);
            else finish(reject, new Error('HTTP ' + st + (res && res.statusText ? ' ' + res.statusText : '')));
          },
          onerror: function () { finish(reject, new Error('网络请求失败')); },
          ontimeout: function () { finish(reject, new Error('请求超时')); },
          onabort: function () { finish(reject, new Error('请求已中止')); }
        };
        if (o.data != null) req.data = o.data;
        gm(req);
      } catch (e) {
        finish(reject, e instanceof Error ? e : new Error('请求失败'));
      }
    });
  }

  var WEBDAV = null;
  function initWebdav() {
    if (WEBDAV) return WEBDAV;
    var WebdevComp = (typeof WebdevComponent !== 'undefined' && WebdevComponent) || null;
    if (!WebdevComp || typeof WebdevComp.createWebdev !== 'function') {
      console.error('18mh: webdev-component 未就绪');
      return null;
    }
    WEBDAV = WebdevComp.createWebdev({
      key: 'dm_dl_webdav_v1',
      defaultFile: '18mh-favorites.json',
      encMark: '18mh-aes-gcm-v1',
      menu: false,
      storage: {
        get: function (k, d) {
          try { return typeof GM_getValue === 'function' ? GM_getValue(k, d) : d; } catch (e) { return d; }
        },
        set: function (k, v) {
          try { if (typeof GM_setValue === 'function') GM_setValue(k, v); } catch (e) {}
        }
      },
      request: webdevRequest,
      exportPayload: exportFavPayload
    });
    return WEBDAV;
  }

  function openWebdavPanel() {
    var api = initWebdav();
    if (!api) {
      showToast({ title: '云同步不可用', msg: 'webdev-component 未加载' });
      return;
    }
    api.openPanel({
      description: '同步收藏和黑名单，不含下载记录。',
      onDownloaded: function (pack) {
        var n = mergeFavsFromPack(pack);
        renderSheetBody();
        injectTitleBadges(getNovelIdFromUrl());
        markListCards();
        showToast({
          title: '书库已同步',
          msg: '收藏 +' + n.favCount + ' · 黑名单 +' + n.banCount
        });
      },
      onUploaded: function (r) {
        showToast({ title: r.encrypted ? '已加密上传' : '书库已上传', msg: (r.bytes || 0) + ' 字节' });
      }
    });
  }

  function absUrl(href) {
    try { return new URL(href, location.href).href; } catch (e) { return href; }
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ========== Dock 拖拽 ==========
  function applyDockPos(x, y, collapsed, animate) {
    var wrap = document.getElementById('dm-dl-dock-wrap');
    var dock = document.getElementById('dm-dl-dock');
    if (!wrap || !dock) return;

    var winW = window.innerWidth;
    var winH = window.innerHeight;
    var dockW = dock.offsetWidth || (collapsed ? 44 : 278);
    var dockH = dock.offsetHeight || 48;

    var padX = 12, padY = 12;
    x = Math.max(padX, Math.min(x, winW - dockW - padX));
    y = Math.max(padY, Math.min(y, winH - dockH - padY));

    if (animate) {
      wrap.style.transition = 'left .22s var(--dm-ease), top .22s var(--dm-ease)';
      setTimeout(function () { wrap.style.transition = 'none'; }, 230);
    } else {
      wrap.style.transition = 'none';
    }

    wrap.style.left = x + 'px';
    wrap.style.top = y + 'px';

    if (collapsed !== undefined) {
      dock.classList.toggle('collapsed', !!collapsed);
      wrap.classList.toggle('collapsed', !!collapsed);
      isCollapsed = !!collapsed;
    }
  }

  function initDockDrag(dock) {
    var wrap = document.getElementById('dm-dl-dock-wrap');
    var isDragging = false;
    var hasMoved = false;
    var startX = 0, startY = 0, startL = 0, startT = 0;
    var justDragged = false;

    var saved = loadJSON(DOCK_POS_KEY) || {};
    var initCollapsed = !!saved.collapsed;
    isCollapsed = initCollapsed;

    setTimeout(function () {
      var winW = window.innerWidth;
      var winH = window.innerHeight;
      var initX = saved.x != null ? saved.x : (winW - (initCollapsed ? 44 : 278) - 14);
      var initY = saved.y != null ? saved.y : (winH - 80);
      applyDockPos(initX, initY, initCollapsed, false);
    }, 40);

    dock.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // 允许在整个 Dock（包括按钮上）开始拖拽；但不立即捕获指针，
      // 否则 PC 端 Chrome 会把后续 click 重定向到 dock，导致按钮点击失效
      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      var rect = wrap.getBoundingClientRect();
      startL = rect.left;
      startT = rect.top;
    });

    dock.addEventListener('pointermove', function (e) {
      if (!isDragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (!hasMoved && Math.hypot(dx, dy) > 6) {
        hasMoved = true;
        // 超过位移阈值才捕获指针：拖拽照常工作，原地点击不影响按钮 click
        try { dock.setPointerCapture(e.pointerId); } catch (err) {}
      }
      if (hasMoved) {
        if (e.cancelable) e.preventDefault();
        applyDockPos(startL + dx, startT + dy, isCollapsed, false);
      }
    });

    function endDrag(e) {
      if (!isDragging) return;
      isDragging = false;
      try { dock.releasePointerCapture(e.pointerId); } catch (err) {}

      if (hasMoved) {
        justDragged = true;
        // 短暂屏蔽后续 click，防止拖完后误触按钮
        setTimeout(function () { justDragged = false; }, 280);

        var rect = wrap.getBoundingClientRect();
        var winW = window.innerWidth;
        var dockW = dock.offsetWidth || 44;
        var isLeft = (rect.left + dockW / 2) < (winW / 2);
        var targetX = isLeft ? 12 : (winW - dockW - 12);
        applyDockPos(targetX, rect.top, isCollapsed, true);
        saveJSON(DOCK_POS_KEY, { x: targetX, y: rect.top, collapsed: isCollapsed });
      }
    }

    dock.addEventListener('pointerup', endDrag);
    dock.addEventListener('pointercancel', endDrag);

    // 捕获阶段拦截「拖拽后产生的 click」
    dock.addEventListener('click', function (e) {
      if (justDragged) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);

    window.addEventListener('resize', function () {
      var rect = wrap.getBoundingClientRect();
      var winW = window.innerWidth;
      var dockW = dock.offsetWidth || 44;
      var targetX = (rect.left + dockW / 2) < (winW / 2) ? 12 : (winW - dockW - 12);
      applyDockPos(targetX, rect.top, isCollapsed, true);
    });
  }

  // ========== 构建 Dock ==========
  function buildDockUI(opts) {
    ensureDOM();
    opts = opts || {};
    var dock = document.getElementById('dm-dl-dock');
    var novelId = opts.novelId || getNovelIdFromUrl();
    var chaptersCount = opts.chaptersCount || 0;
    var rec = novelId ? getRecord(novelId) : null;
    var fav = novelId ? isFav(novelId) : false;
    var mode = opts.mode || 'detail';

    // 非阅读页不保留「最新章提示」：清理从阅读页残留的提示内容
    if (mode !== 'chapter') {
      var staleTip = document.getElementById('dm-dl-latest-tip');
      if (staleTip) {
        staleTip.classList.remove('show');
        staleTip.innerHTML = '';
        staleTip.onclick = null;
      }
    }

    dock.innerHTML = '';

    // 折叠球
    var dotBtn = document.createElement('div');
    dotBtn.id = 'dm-dl-dot-btn';
    dotBtn.title = '展开';
    dotBtn.innerHTML = ICONS.download + '<span id="dm-dl-dot-badge"></span>';
    dotBtn.onclick = function (e) {
      e.stopPropagation();
      setCollapseState(false);
    };
    dock.appendChild(dotBtn);

    function setCollapseState(val) {
      isCollapsed = val;
      dock.classList.toggle('collapsed', isCollapsed);
      var wrap = document.getElementById('dm-dl-dock-wrap');
      var rect = wrap.getBoundingClientRect();
      var winW = window.innerWidth;
      var dockW = isCollapsed ? 44 : 278;
      var targetX = (rect.left + dockW / 2) < (winW / 2) ? 12 : (winW - dockW - 12);
      applyDockPos(targetX, rect.top, isCollapsed, true);
      saveJSON(DOCK_POS_KEY, { x: targetX, y: rect.top, collapsed: isCollapsed });
    }

    // 收藏
    if (mode !== 'list' && novelId) {
      var favBtn = document.createElement('button');
      favBtn.type = 'button';
      favBtn.className = 'dm-dl-dock-btn' + (fav ? ' fav-on' : '');
      favBtn.id = 'dm-dl-fav-btn';
      favBtn.title = fav ? '取消收藏' : '收藏本书';
      favBtn.innerHTML = fav ? ICONS.heartFill : ICONS.heart;
      favBtn.onclick = function (e) {
        e.stopPropagation();
        var title = getNovelTitle();
        var url = absUrl('/novel/detail/' + novelId);
        var on = toggleFavorite(novelId, title, url);
        favBtn.innerHTML = on ? ICONS.heartFill : ICONS.heart;
        favBtn.className = 'dm-dl-dock-btn' + (on ? ' fav-on fav-pulse' : '');
        favBtn.title = on ? '取消收藏' : '收藏本书';
        if (on) setTimeout(function () { favBtn.classList.remove('fav-pulse'); }, 450);
        injectTitleBadges(novelId);
        markListCards();
        showToast({ title: on ? '收藏成功' : '已取消收藏', msg: '「' + title + '」' });
      };
      dock.appendChild(favBtn);

      var banned = isBan(novelId);
      var banBtn = document.createElement('button');
      banBtn.type = 'button';
      banBtn.className = 'dm-dl-dock-btn' + (banned ? ' ban-on' : '');
      banBtn.id = 'dm-dl-ban-btn';
      banBtn.title = banned ? '取消拉黑' : '拉黑本书';
      banBtn.innerHTML = ICONS.ban;
      banBtn.onclick = function (e) {
        e.stopPropagation();
        var title = getNovelTitle();
        var url = absUrl('/novel/detail/' + novelId);
        var on = toggleBan(novelId, title, url);
        banBtn.className = 'dm-dl-dock-btn' + (on ? ' ban-on' : '');
        banBtn.title = on ? '取消拉黑' : '拉黑本书';
        var fb = document.getElementById('dm-dl-fav-btn');
        if (fb) {
          var favNow = isFav(novelId);
          fb.innerHTML = favNow ? ICONS.heartFill : ICONS.heart;
          fb.className = 'dm-dl-dock-btn' + (favNow ? ' fav-on' : '');
          fb.title = favNow ? '取消收藏' : '收藏本书';
        }
        injectTitleBadges(novelId);
        markListCards();
        showToast({ title: on ? '已拉黑' : '已取消拉黑', msg: '「' + title + '」' });
      };
      dock.appendChild(banBtn);
    }

    // 主按钮
    var mainBtn = document.createElement('button');
    mainBtn.type = 'button';
    mainBtn.id = 'dm-dl-main-btn';

    if (mode === 'chapter') {
      if (rec) {
        mainBtn.classList.add('done');
        mainBtn.innerHTML = '<span class="dm-dl-btn-txt">' + ICONS.check + ' 已下载 · 去详情</span>';
      } else {
        mainBtn.innerHTML = '<span class="dm-dl-btn-txt">' + ICONS.arrow + ' 去详情页下载</span>';
      }
      mainBtn.onclick = function () {
        location.href = absUrl('/novel/detail/' + novelId);
      };
    } else if (mode === 'list') {
      mainBtn.innerHTML = '<span class="dm-dl-btn-txt">' + ICONS.menu + ' 我的书库</span>';
      mainBtn.onclick = openSheet;
    } else {
      if (rec) {
        var newChs = getNewChapters(parseChapters(), rec);
        if (newChs.length) {
          mainBtn.classList.add('update');
          mainBtn.innerHTML = '<span class="dm-dl-btn-txt">' + ICONS.refresh + ' 更新最新 +' + newChs.length + '章</span>';
          var db = document.getElementById('dm-dl-dot-badge');
          if (db) db.classList.add('show');
        } else {
          mainBtn.classList.add('done');
          mainBtn.innerHTML = '<span class="dm-dl-btn-txt">' + ICONS.check + ' 重新下载 ' + (chaptersCount ? chaptersCount + '章' : '') + '</span>';
        }
      } else {
        mainBtn.innerHTML = '<span class="dm-dl-btn-txt">' + ICONS.download + ' 下载全部 ' + (chaptersCount ? chaptersCount + '章' : 'TXT') + '</span>';
      }
      mainBtn.onclick = function () {
        if (downloading) {
          showToast({ title: '任务进行中', msg: '当前小说正在下载，请稍候...' });
          return;
        }
        startDownload(mainBtn);
      };
    }
    dock.appendChild(mainBtn);

    // 书库按钮 —— 列表页已经有主按钮了，不再重复添加
    if (mode !== 'list') {
      var panelBtn = document.createElement('button');
      panelBtn.type = 'button';
      panelBtn.className = 'dm-dl-dock-btn';
      panelBtn.title = '书库管理';
      panelBtn.innerHTML = ICONS.menu;
      panelBtn.onclick = function (e) {
        e.stopPropagation();
        openSheet();
      };
      dock.appendChild(panelBtn);
    }

    // 折叠
    var foldBtn = document.createElement('button');
    foldBtn.type = 'button';
    foldBtn.className = 'dm-dl-dock-btn fold';
    foldBtn.title = '收起';
    foldBtn.innerHTML = ICONS.fold;
    foldBtn.onclick = function (e) {
      e.stopPropagation();
      setCollapseState(true);
    };
    dock.appendChild(foldBtn);

    if (!dockDragBound) {
      dockDragBound = true;
      initDockDrag(dock);
    }
    return mainBtn;
  }

  // ========== 书库逻辑 ==========
  var currentSheetTab = 'dl';
  function bindSheetTabs() {
    var tabs = document.querySelectorAll('.dm-dl-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].onclick = function () {
        currentSheetTab = this.getAttribute('data-tab');
        for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('on');
        this.classList.add('on');
        renderSheetBody();
      };
    }

    var exportBtn = document.getElementById('dm-dl-export');
    if (exportBtn) {
      exportBtn.onclick = function () {
        var map = currentSheetTab === 'fav' ? loadFavs() : (currentSheetTab === 'ban' ? loadBans() : loadHistory());
        var list = sortByTime(map);
        if (!list.length) {
          showToast({ title: '导出失败', msg: '当前列表暂无数据' });
          return;
        }
        var lines = list.map(function (item, idx) {
          return (idx + 1) + '. ' + (item.title || item.id) + '\n   ' + (item.url || absUrl('/novel/detail/' + item.id));
        });
        downloadTxt(currentSheetTab === 'fav' ? '我的收藏' : (currentSheetTab === 'ban' ? '我的黑名单' : '已下载列表'), lines.join('\n\n'));
      };
    }

    var clearBtn = document.getElementById('dm-dl-clear-tab');
    if (clearBtn) {
      clearBtn.onclick = function () {
        var name = currentSheetTab === 'fav' ? '收藏' : (currentSheetTab === 'ban' ? '拉黑' : '已下载');
        showConfirm({
          title: '清空' + name,
          content: '确定要清空所有的「' + name + '」记录吗？此操作不可恢复。',
          danger: true,
          confirmText: '确定清空'
        }).then(function (ok) {
          if (!ok) return;
          if (currentSheetTab === 'fav') saveFavs({});
          else if (currentSheetTab === 'ban') saveBans({});
          else saveHistory({});
          renderSheetBody();
          injectTitleBadges(getNovelIdFromUrl());
          markListCards();
          showToast({ title: '清空完成', msg: '已清空全部' + name + '记录' });
        });
      };
    }

    var cacheBtn = document.getElementById('dm-dl-clear-cache');
    if (cacheBtn) {
      cacheBtn.onclick = function () {
        showConfirm({
          title: '清空章节缓存',
          content: '清空后增量更新将无法拼合历史章节生成完整TXT（下载记录不受影响）。确定清空？',
          danger: true,
          confirmText: '清空缓存'
        }).then(function (ok) {
          if (!ok) return;
          saveJSON(CONTENT_KEY, {});
          renderSheetBody();
          showToast({ title: '已清空', msg: '章节正文缓存已全部释放' });
        });
      };
    }
  }

  function renderSheetBody() {
    var body = document.getElementById('dm-dl-sheet-body');
    if (!body) return;
    var map = currentSheetTab === 'fav' ? loadFavs() : (currentSheetTab === 'ban' ? loadBans() : loadHistory());
    var list = sortByTime(map);
    var hist = loadHistory();
    var favs = loadFavs();
    var bans = loadBans();

    body.innerHTML = '';
    var search = document.createElement('input');
    search.type = 'search';
    search.className = 'dm-dl-search';
    search.placeholder = currentSheetTab === 'fav' ? '搜索收藏书目…' : (currentSheetTab === 'ban' ? '搜索拉黑书目…' : '搜索已下载书目…');
    body.appendChild(search);

    var listWrap = document.createElement('div');
    body.appendChild(listWrap);

    function updateList(keyword) {
      listWrap.innerHTML = '';
      var q = (keyword || '').trim().toLowerCase();
      var items = list.filter(function (it) {
        if (!q) return true;
        return String(it.title || '').toLowerCase().indexOf(q) >= 0 || String(it.id).indexOf(q) >= 0;
      });

      if (!items.length) {
        listWrap.innerHTML = '<div class="dm-dl-empty">' + (q ? '未找到相关小说' : '暂无记录') + '</div>';
        return;
      }

      items.forEach(function (item) {
        var id = String(item.id);
        var row = document.createElement('div');
        row.className = 'dm-dl-item';

        var tags = '';
        if (hist[id]) tags += '<span class="dm-dl-tag dl">已下载</span>';
        if (favs[id]) tags += '<span class="dm-dl-tag fav">已收藏</span>';
        if (bans[id]) tags += '<span class="dm-dl-tag ban">已拉黑</span>';

        row.innerHTML =
          '<div class="dm-dl-item-main">' +
          '<div class="dm-dl-item-title">' + esc(item.title || '未知标题') + '</div>' +
          '<div class="dm-dl-item-meta">' + tags + '<span>' + (item.timeText || '') + '</span></div>' +
          '</div>' +
          '<div class="dm-dl-item-acts">' +
          '<button type="button" class="dm-dl-mini go">打开</button>' +
          '<button type="button" class="dm-dl-mini danger rm">删除</button>' +
          '</div>';

        row.querySelector('.dm-dl-item-main').onclick = function () {
          location.href = item.url || absUrl('/novel/detail/' + id);
        };
        row.querySelector('.go').onclick = function (e) {
          e.stopPropagation();
          location.href = item.url || absUrl('/novel/detail/' + id);
        };
        row.querySelector('.rm').onclick = function (e) {
          e.stopPropagation();
          showConfirm({
            title: '移除记录',
            content: '确定从列表中移除「' + (item.title || id) + '」吗？',
            danger: true,
            confirmText: '移除'
          }).then(function (ok) {
            if (!ok) return;
            if (currentSheetTab === 'fav') removeFavorite(id);
            else if (currentSheetTab === 'ban') removeBan(id);
            else unmarkDownloaded(id);
            renderSheetBody();
            injectTitleBadges(getNovelIdFromUrl());
            markListCards();
          });
        };
        listWrap.appendChild(row);
      });
    }

    search.oninput = function () { updateList(search.value); };
    updateList('');
  }

  function sortByTime(map) {
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) {
      return (b.time || 0) - (a.time || 0);
    });
  }

  // ========== 徽章 ==========
  function injectTitleBadges(novelId) {
    var h1 = document.querySelector('h1.detail-page__title, h1.dx-title, .detail-page__title, h1');
    var old1 = document.getElementById('dm-dl-title-badge');
    var old2 = document.getElementById('dm-dl-fav-badge');
    var old3 = document.getElementById('dm-dl-update-badge');
    var old4 = document.getElementById('dm-dl-ban-badge');
    if (old1) old1.remove();
    if (old2) old2.remove();
    if (old3) old3.remove();
    if (old4) old4.remove();
    if (!h1 || !novelId) return;

    var rec = getRecord(novelId);
    if (rec) {
      var badge = document.createElement('span');
      badge.id = 'dm-dl-title-badge';
      badge.textContent = '✓ 已下载';
      h1.appendChild(badge);

      var chs = parseChapters();
      var newN = getNewChapters(chs, rec).length;
      if (newN > 0) {
        var ub = document.createElement('span');
        ub.id = 'dm-dl-update-badge';
        ub.textContent = '🔄 有更新 ' + newN + ' 章';
        h1.appendChild(ub);
      }
    }

    if (isFav(novelId)) {
      var fb = document.createElement('span');
      fb.id = 'dm-dl-fav-badge';
      fb.textContent = '♥ 已收藏';
      h1.appendChild(fb);
    }

    if (isBan(novelId)) {
      var bb = document.createElement('span');
      bb.id = 'dm-dl-ban-badge';
      bb.textContent = '已拉黑';
      h1.appendChild(bb);
    }
  }

  function markListCards() {
    var hist = loadHistory();
    var favs = loadFavs();
    var bans = loadBans();

    // 列表卡片通常含 3 个 /novel/detail/ 链接（封面、标题、时间），
    // 旧逻辑对每个 <a> 各插一枚徽章，二次 boot / 列表重绘还会叠加。
    var leftovers = document.querySelectorAll('.dm-dl-card-badge');
    for (var i = 0; i < leftovers.length; i++) leftovers[i].remove();

    var links = document.querySelectorAll('a[href*="/novel/detail/"]');
    var seenCard = [];
    function cardSeen(el) {
      for (var k = 0; k < seenCard.length; k++) if (seenCard[k] === el) return true;
      return false;
    }

    for (var j = 0; j < links.length; j++) {
      var a = links[j];
      var m = (a.getAttribute('href') || '').match(/\/novel\/detail\/(\d+)/);
      if (!m) continue;
      var id = m[1];
      var card = a.closest('li') || a.closest('article') || a.parentElement;
      if (!card || cardSeen(card)) continue;
      seenCard.push(card);

      var hasDl = !!hist[id];
      var hasFav = !!favs[id];
      var hasBan = !!bans[id];
      if (!hasDl && !hasFav && !hasBan) continue;

      var host;
      var titleEl = card.querySelector('h2, h3');
      if (titleEl && titleEl.parentNode) host = titleEl.parentNode;
      else {
        var titleLink = card.querySelector('a[href*="/novel/detail/"] h2, a[href*="/novel/detail/"] h3');
        host = titleLink ? titleLink.parentNode : a;
      }

      function addCardBadge(cls, text, afterEl) {
        var badge = document.createElement('span');
        badge.className = 'dm-dl-card-badge ' + cls;
        badge.textContent = text;
        if (afterEl && afterEl.parentNode === host) host.insertBefore(badge, afterEl.nextSibling);
        else if (titleEl && titleEl.parentNode === host) host.insertBefore(badge, titleEl.nextSibling);
        else host.appendChild(badge);
        return badge;
      }

      var last = titleEl;
      if (hasDl || hasFav) {
        last = addCardBadge(
          hasDl && hasFav ? 'both' : hasDl ? 'dl' : 'fav',
          hasDl && hasFav ? '藏·下' : hasDl ? '已下载' : '已收藏',
          last
        );
      }
      if (hasBan) addCardBadge('ban', '已拉黑', last);
    }
  }

  // ========== 解析下载核心 ==========
  function parseChaptersIn(doc) {
    var selectors = [
      'a.detail-page__catalog-item',
      '.detail-page__catalog a[href*="novel_chapter"]',
      'a[href*="/novel_chapter/"]'
    ];
    var nodes = [];
    for (var s = 0; s < selectors.length; s++) {
      var found = doc.querySelectorAll(selectors[s]);
      if (found.length) { nodes = found; break; }
    }

    var chapters = [];
    var seen = {};
    for (var i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      var href = a.getAttribute('href') || '';
      var m = href.match(/\/novel_chapter\/(\d+)\/(\d+)\.html/i);
      if (!m) continue;
      var cid = parseInt(m[2], 10);
      if (seen[cid]) continue;
      seen[cid] = true;

      var badge = a.querySelector('.detail-page__chapter-badge');
      var titleEl = a.querySelector('.detail-page__chapter-title');
      var title = '';
      if (badge) title += (badge.textContent || '').trim() + ' ';
      if (titleEl) title += (titleEl.textContent || '').trim();
      if (!title) title = (a.textContent || '').replace(/\s+/g, ' ').replace(/NEW/gi, '').trim();

      chapters.push({
        id: cid,
        novelId: parseInt(m[1], 10),
        title: title || '第' + cid + '章',
        url: absUrl(href)
      });
    }
    chapters.sort(function (a, b) { return a.id - b.id; });
    return chapters;
  }

  function parseChapters() { return parseChaptersIn(document); }

  function getNovelTitle() {
    var el = document.querySelector('h1.detail-page__title, h1.dx-title, .detail-page__title, h1');
    if (el) {
      var clone = el.cloneNode(true);
      var b1 = clone.querySelector('#dm-dl-title-badge');
      var b2 = clone.querySelector('#dm-dl-fav-badge');
      var b3 = clone.querySelector('#dm-dl-update-badge');
      var b4 = clone.querySelector('#dm-dl-ban-badge');
      if (b1) b1.remove();
      if (b2) b2.remove();
      if (b3) b3.remove();
      if (b4) b4.remove();
      var t = (clone.textContent || '').trim();
      if (t) return t;
    }
    return (document.title || '小说').split('|')[0].trim();
  }

  function extractContent(html) {
    var lines = [];
    try {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var nodes = doc.querySelectorAll('.article .line, div.line, .article p');
      for (var i = 0; i < nodes.length; i++) {
        var t = (nodes[i].textContent || '').replace(/\s+/g, ' ').trim();
        if (t) lines.push(t);
      }
    } catch (e) {}
    return lines.join('\n');
  }

  function gmGet(url) {
    return new Promise(function (resolve, reject) {
      if (typeof GM_xmlhttpRequest !== 'function') {
        reject(new Error('GM_xmlhttpRequest 不可用'));
        return;
      }
      GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        timeout: 20000,
        headers: { Accept: 'text/html', Referer: location.href },
        onload: function (res) {
          if (res.status >= 200 && res.status < 300) resolve(res.responseText || '');
          else reject(new Error('HTTP ' + res.status));
        },
        onerror: function () { reject(new Error('网络连接异常')); },
        ontimeout: function () { reject(new Error('请求超时')); }
      });
    });
  }

  function requestText(url) {
    if (typeof fetch === 'function') {
      return fetch(url, { method: 'GET', credentials: 'include', cache: 'default', headers: { Accept: 'text/html' } })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.text();
        })
        .catch(function () { return gmGet(url); });
    }
    return gmGet(url);
  }

  function fetchChapter(chapter, retry) {
    retry = retry || 0;
    return requestText(chapter.url)
      .then(function (html) {
        var content = extractContent(html);
        if (!content || content.length < 5) throw new Error('正文为空');
        return content;
      })
      .catch(function (err) {
        if (retry < MAX_RETRY) {
          return sleep(300 * (retry + 1)).then(function () { return fetchChapter(chapter, retry + 1); });
        }
        throw err;
      });
  }

  function mapPool(list, limit, worker, onProgress) {
    return new Promise(function (resolve) {
      var results = new Array(list.length);
      var next = 0, done = 0, running = 0;
      function runOne(i) {
        running++;
        Promise.resolve().then(function () { return worker(list[i], i); })
          .then(function (val) { results[i] = { ok: true, value: val }; })
          .catch(function (err) { results[i] = { ok: false, error: err }; })
          .then(function () {
            running--; done++;
            if (onProgress) {
              try { onProgress(done, list.length, list[i]); } catch (e) {}
            }
            if (done >= list.length) resolve(results);
            else startMore();
          });
      }
      function startMore() {
        while (running < limit && next < list.length) runOne(next++);
      }
      if (!list.length) resolve(results);
      else startMore();
    });
  }

  function triggerDownload(url, filename) {
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { try { document.body.removeChild(a); } catch (e) {} }, 4000);
  }

  function downloadTxt(filename, text) {
    var safeName = String(filename || 'novel').replace(/[\/\\?*:|"<>]/g, '_').slice(0, 120) + '.txt';
    var blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });

    if (currentBlobUrl) {
      try { URL.revokeObjectURL(currentBlobUrl); } catch (e) {}
    }
    currentBlobUrl = URL.createObjectURL(blob);
    try {
      currentFileObj = new File([blob], safeName, { type: 'text/plain;charset=utf-8' });
    } catch (e) {
      currentFileObj = null;
    }

    // iOS 不自动触发浏览器原生下载（会进 Safari 自带下载列表），
    // 改为弹提示由用户点「存至文件/分享」按钮；PC / Android 保持自动保存
    if (!isIOS()) {
      triggerDownload(currentBlobUrl, safeName);
    }

    var btns = [];
    var isPC = isFinePointer();
    if (!isPC) {
      var canShare = !!(currentFileObj && navigator.canShare && navigator.canShare({ files: [currentFileObj] }));
      if (canShare || isIOS()) {
        btns.push({
          text: '📤 存至“文件”/分享',
          highlight: true,
          onClick: function () {
            if (canShare && navigator.share) {
              // 不传 title：iOS 会把 title 额外存成一个内容为文件名的 txt，产生多余文件
              navigator.share({ files: [currentFileObj] }).catch(function (err) {
                // 用户取消分享（AbortError）不兜底，避免误触发原生下载
                if (err && err.name === 'AbortError') return;
                triggerDownload(currentBlobUrl, safeName);
              });
            } else {
              triggerDownload(currentBlobUrl, safeName);
            }
          }
        });
      }
      btns.push({
        text: '⬇ 重新保存',
        onClick: function () { triggerDownload(currentBlobUrl, safeName); }
      });
    }

    showToast({
      title: '🎉 下载成功！',
      msg: isPC
        ? '《' + safeName + '》已生成，正在自动保存。'
        : (isIOS()
          ? '《' + safeName + '》已生成。请点击下方按钮，存储到“文件”或分享：'
          : '《' + safeName + '》已生成。\n若未弹出保存，可点击下方按钮手动保存：'),
      duration: isPC ? 4000 : (isIOS() ? 0 : 16000),
      buttons: btns
    });
  }

  function startDownload(btn) {
    var chapters = parseChapters();
    if (!chapters.length) {
      showAlert({ title: '无法获取章节', content: '未找到章节列表，请确认当前处于小说详情页并已展开目录。' });
      return;
    }

    var novelId = getNovelIdFromUrl() || (chapters[0] && String(chapters[0].novelId)) || '';
    var fullChapters = chapters;
    var rec = getRecord(novelId);
    var incremental = false;

    function proceed() {
      downloading = true;
      var fetchedTexts = [];
      if (btn) {
        btn.disabled = true;
        btn.classList.add('loading');
        btn.classList.remove('done', 'update');
      }

      var title = getNovelTitle();
      var total = chapters.length;
      var t0 = Date.now();

      showToast({
        title: '开始下载…',
        msg: '《' + title + '》\n准备下载 ' + (incremental ? '新增 ' : '共 ') + total + ' 章',
        duration: 0
      });

      mapPool(
        chapters,
        CONCURRENCY,
        function (ch) {
          return fetchChapter(ch).then(function (text) {
            fetchedTexts.push({ id: ch.id, title: ch.title, text: text });
            return text;
          });
        },
        function (done, all) {
          var pct = Math.round((done / all) * 100);
          var sec = ((Date.now() - t0) / 1000).toFixed(1);
          var speed = done > 0 ? (done / ((Date.now() - t0) / 1000)).toFixed(1) : '0';

          if (btn) {
            btn.innerHTML =
              '<span class="dm-dl-prog" style="width:' + pct + '%"></span>' +
              '<span class="dm-dl-btn-txt"><span class="dm-dl-spinner"></span> ' + pct + '%</span>';
          }
          var dotIcon = document.querySelector('#dm-dl-dot-btn svg');
          if (dotIcon) {
            // 折叠状态下显示进度数字更实用
            var parent = document.getElementById('dm-dl-dot-btn');
            if (parent) parent.innerHTML = '<span style="font-size:12px;font-weight:700">' + pct + '%</span><span id="dm-dl-dot-badge" class="' + (document.getElementById('dm-dl-dot-badge') && document.getElementById('dm-dl-dot-badge').classList.contains('show') ? 'show' : '') + '"></span>';
          }

          showToast({
            title: '正在下载 (' + pct + '%)',
            msg: '已完成: ' + done + ' / ' + all + ' 章\n速度: ' + speed + ' 章/秒 · 用时 ' + sec + 's',
            duration: 0
          });
        }
      )
        .then(function (results) {
          var parts = [
            title,
            '下载时间: ' + new Date().toLocaleString(),
            '────────────────────────────',
            ''
          ];
          var errors = [];
          var okCount = 0;
          var maxOkId = 0;
          var merged = incremental && getNovelCache(novelId);

          if (merged) {
            var cacheChs = merged.chapters || {};
            var byId = {};
            for (var i = 0; i < results.length; i++) {
              var ch = chapters[i];
              var r = results[i];
              if (r && r.ok) {
                okCount++;
                byId[ch.id] = r.value;
                if (ch.id > maxOkId) maxOkId = ch.id;
              } else {
                errors.push(ch.title);
              }
            }
            for (var fi = 0; fi < fullChapters.length; fi++) {
              var fc = fullChapters[fi];
              parts.push(fc.title, '--------------------');
              var t = byId[fc.id] != null ? byId[fc.id] : (cacheChs[fc.id] ? cacheChs[fc.id].text : null);
              parts.push(t != null ? t : '[本章内容缺失]');
              parts.push('', '');
            }
          } else {
            for (var j = 0; j < results.length; j++) {
              var ch2 = chapters[j];
              var r2 = results[j];
              parts.push(ch2.title, '--------------------');
              if (r2 && r2.ok) {
                okCount++;
                parts.push(r2.value);
              } else {
                errors.push(ch2.title);
                parts.push('[本章下载失败]');
              }
              parts.push('', '');
            }
          }

          if (fetchedTexts.length) mergeNovelCache(novelId, title, fetchedTexts);

          if (okCount > 0) {
            // 增量更新：maxId 只推进到成功抓取的最新章，失败章节下次仍会重试
            var maxId = incremental
              ? (maxOkId || (rec && rec.maxId) || 0)
              : (fullChapters.length ? fullChapters[fullChapters.length - 1].id : 0);
            markDownloaded(
              novelId, title, fullChapters.length,
              (incremental && rec ? (rec.ok || 0) : 0) + okCount,
              errors.length, location.href, maxId
            );
          }

          downloadTxt(title, parts.join('\n'));
          injectTitleBadges(novelId);
          markListCards();
        })
        .catch(function (err) {
          showAlert({ title: '下载失败', content: err.message || String(err) });
          hideToast();
        })
        .then(function () {
          downloading = false;
          var dotBtn = document.getElementById('dm-dl-dot-btn');
          if (dotBtn) dotBtn.innerHTML = ICONS.download + '<span id="dm-dl-dot-badge"></span>';

          if (btn) {
            btn.disabled = false;
            btn.classList.remove('loading');
            btn.classList.add('done');
            btn.innerHTML = '<span class="dm-dl-btn-txt">' + ICONS.check + ' 重新下载</span>';
          }
        });
    }

    if (rec) {
      var newChs = getNewChapters(fullChapters, rec);
      if (newChs.length) {
        showConfirm({
          title: '发现更新章节',
          content: '「' + (rec.title || getNovelTitle()) + '」已下载过 ' + (rec.chapters || 0) + ' 章，现检测到新增 ' + newChs.length + ' 章。\n\n是否仅下载新增的最新章节？',
          confirmText: '只下新增',
          cancelText: '全部重下'
        }).then(function (onlyNew) {
          if (onlyNew) {
            chapters = newChs;
            incremental = true;
            proceed();
          } else {
            showConfirm({
              title: '确认重下',
              content: '是否确认重新下载全部 ' + fullChapters.length + ' 章？',
              confirmText: '全部重下'
            }).then(function (ok) {
              if (ok) proceed();
            });
          }
        });
      } else {
        showConfirm({
          title: '重新下载',
          content: '本书已在 ' + (rec.timeText || '') + ' 下载完成。\n是否全部重新下载？',
          confirmText: '确定重下'
        }).then(function (ok) {
          if (ok) proceed();
        });
      }
    } else {
      proceed();
    }
  }

  // ========== 标签选择抽屉（替代站点超长弹窗） ==========
  var tagPicker = {
    mode: 'multi',
    source: null,
    items: [],
    selected: {},
    keyword: '',
    bound: false
  };

  function hideSiteTagPopups() {
    var nodes = document.querySelectorAll('.dx-middle-popup, .dx-shield-tag-box');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('is-open');
  }

  function parsePageUrlStore() {
    try {
      var raw = localStorage.getItem('page_url');
      if (!raw) return {};
      var obj = JSON.parse(raw);
      return obj && typeof obj === 'object' ? obj : {};
    } catch (e) { return {}; }
  }

  function selectedIdsFromContext(mode) {
    var key = mode === 'shield' ? 'filter_tag' : 'tags';
    var ids = {};
    var qs = '';
    try { qs = new URLSearchParams(location.search).get(key) || ''; } catch (e) { qs = ''; }
    var stored = parsePageUrlStore()[key] || '';
    var raw = qs || stored || '';
    String(raw).split(',').forEach(function (id) {
      id = String(id || '').trim();
      if (id) ids[id] = true;
    });
    return ids;
  }

  function collectSiteTags(root) {
    if (!root) return [];
    var spans = root.querySelectorAll('.dx-tag-list span[data-value]');
    var list = [];
    var seen = {};
    for (var i = 0; i < spans.length; i++) {
      var span = spans[i];
      var id = String(span.getAttribute('data-value') || '').trim();
      if (!id || seen[id]) continue;
      seen[id] = true;
      list.push({
        id: id,
        name: (span.textContent || '').replace(/\s+/g, ' ').trim(),
        el: span
      });
    }
    return list;
  }

  var TAG_GROUP_ORDER = ['人物关系', '角色身份', '玩法性癖', '题材风格', '字母数字'];

  function tagGroupKey(name) {
    var n = String(name || '');
    if (/^[0-9A-Za-z]/.test(n)) return '字母数字';
    if (/父|母|女|子|公|翁|骨|姐|妹|兄|弟|姑|姨|舅|奶|婆|妻|妾|媳|家庭|乱伦|绿|叔|婶|嫂|情侣|师生|同学|邻居|岳母|丈|同居|婚/.test(n)) return '人物关系';
    if (/百合|耽美|扶他|人妻|熟女|萝莉|御姐|少女|少妇|妓女|明星|老师|护士|警|媚|伪娘|人兽|雌|男娘/.test(n)) return '角色身份';
    if (/调教|捆绑|催眠|凌辱|露出|道具|扩张|监禁|虐|奴|轮|兽|触手|产奶|榨|射|潮吹|肛|足|恋|强制|痴|睡|药|孕|公开|野战/.test(n)) return '玩法性癖';
    return '题材风格';
  }

  function bindTagSheetActions() {
    var search = document.getElementById('dm-dl-tag-search');
    var clearBtn = document.getElementById('dm-dl-tag-clear');
    var submitBtn = document.getElementById('dm-dl-tag-submit');
    var body = document.getElementById('dm-dl-tag-body');
    var sel = document.getElementById('dm-dl-tag-sel');
    if (search) {
      search.oninput = function () {
        tagPicker.keyword = search.value || '';
        renderTagSheetBody();
      };
    }
    if (clearBtn) {
      clearBtn.onclick = function () {
        tagPicker.selected = {};
        var ons = document.querySelectorAll('#dm-dl-tag-body .dm-dl-tag-chip.on');
        for (var i = 0; i < ons.length; i++) ons[i].classList.remove('on');
        renderTagSelected();
      };
    }
    if (submitBtn) submitBtn.onclick = submitTagPicker;
    if (body && !body._dmBound) {
      body._dmBound = true;
      body.addEventListener('click', function (e) {
        var chip = e.target.closest('.dm-dl-tag-chip');
        if (!chip) return;
        toggleTagById(chip.getAttribute('data-id'));
      });
    }
    if (sel && !sel._dmBound) {
      sel._dmBound = true;
      sel.addEventListener('click', function (e) {
        var chip = e.target.closest('.dm-dl-tag-chip');
        if (!chip) return;
        toggleTagById(chip.getAttribute('data-id'));
      });
    }
  }

  function toggleTagById(id) {
    if (!id) return;
    if (tagPicker.selected[id]) delete tagPicker.selected[id];
    else tagPicker.selected[id] = true;
    var on = !!tagPicker.selected[id];
    var nodes = document.querySelectorAll('#dm-dl-tag-sheet .dm-dl-tag-chip[data-id="' + id + '"]');
    for (var i = 0; i < nodes.length; i++) nodes[i].classList.toggle('on', on);
    renderTagSelected();
  }

  function renderTagSelected() {
    var wrap = document.getElementById('dm-dl-tag-sel');
    var count = document.getElementById('dm-dl-tag-count');
    if (!wrap) return;
    var html = '';
    var n = 0;
    for (var i = 0; i < tagPicker.items.length; i++) {
      var it = tagPicker.items[i];
      if (!tagPicker.selected[it.id]) continue;
      n++;
      html += '<button type="button" class="dm-dl-tag-chip on mini" data-id="' + esc(it.id) + '">' + esc(it.name) + ' ×</button>';
    }
    wrap.innerHTML = html;
    if (count) count.textContent = '已选 ' + n;
  }

  function renderTagSheetBody() {
    var body = document.getElementById('dm-dl-tag-body');
    if (!body) return;
    var q = String(tagPicker.keyword || '').trim().toLowerCase();
    var groups = {};
    var order = [];
    for (var i = 0; i < tagPicker.items.length; i++) {
      var it = tagPicker.items[i];
      if (q && String(it.name).toLowerCase().indexOf(q) < 0 && String(it.id).indexOf(q) < 0) continue;
      var key = tagGroupKey(it.name);
      if (!groups[key]) {
        groups[key] = [];
        order.push(key);
      }
      groups[key].push(it);
    }
    order.sort(function (a, b) {
      var ia = TAG_GROUP_ORDER.indexOf(a);
      var ib = TAG_GROUP_ORDER.indexOf(b);
      if (ia < 0) ia = 99;
      if (ib < 0) ib = 99;
      return ia - ib;
    });

    if (!order.length) {
      body.innerHTML = '<div class="dm-dl-empty">' + (q ? '没有匹配的标签' : '没有可选项') + '</div>';
      return;
    }

    var html = '';
    for (var g = 0; g < order.length; g++) {
      var gk = order[g];
      var list = groups[gk];
      html += '<div class="dm-dl-tag-group">' + esc(gk) + ' · ' + list.length + '</div><div class="dm-dl-tag-grid">';
      for (var j = 0; j < list.length; j++) {
        var item = list[j];
        html += '<button type="button" class="dm-dl-tag-chip' + (tagPicker.selected[item.id] ? ' on' : '') + '" data-id="' + esc(item.id) + '">' + esc(item.name) + '</button>';
      }
      html += '</div>';
    }
    body.innerHTML = html;
  }

  function openTagPicker(mode) {
    ensureDOM();
    hideSiteTagPopups();
    closeSheet();
    tagPicker.mode = mode === 'shield' ? 'shield' : 'multi';
    tagPicker.source = tagPicker.mode === 'shield'
      ? document.querySelector('.dx-shield-tag-box')
      : document.querySelector('.dx-middle-popup');
    tagPicker.items = collectSiteTags(tagPicker.source);
    if (!tagPicker.items.length) {
      showToast({ title: '打不开标签', msg: '页面上还没有加载到标签列表' });
      return;
    }

    tagPicker.selected = selectedIdsFromContext(tagPicker.mode);
    tagPicker.items.forEach(function (it) {
      if (it.el && it.el.classList.contains('selected')) tagPicker.selected[it.id] = true;
    });
    tagPicker.keyword = '';

    var title = document.getElementById('dm-dl-tag-title');
    var search = document.getElementById('dm-dl-tag-search');
    if (title) title.textContent = tagPicker.mode === 'shield' ? '屏蔽标签' : '多选标签';
    if (search) search.value = '';

    var mask = document.getElementById('dm-dl-tag-mask');
    if (mask) {
      void mask.offsetWidth;
      mask.classList.add('open');
    }
    document.body.style.overflow = 'hidden';
    renderTagSelected();
    var body = document.getElementById('dm-dl-tag-body');
    if (body) body.innerHTML = '<div class="dm-dl-empty">加载标签…</div>';
    setTimeout(renderTagSheetBody, 0);
  }

  function syncSelectedToSite() {
    if (!tagPicker.source) return;
    var spans = tagPicker.source.querySelectorAll('.dx-tag-list span[data-value]');
    for (var i = 0; i < spans.length; i++) {
      var span = spans[i];
      var id = String(span.getAttribute('data-value') || '');
      var on = !!tagPicker.selected[id];
      span.classList.toggle('selected', on);
      span.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  function submitTagPicker() {
    syncSelectedToSite();
    hideSiteTagPopups();
    var submit = tagPicker.source && tagPicker.source.querySelector('.btn-submit');
    closeTagSheet();
    if (submit) {
      submit.click();
      return;
    }
    showToast({ title: '提交失败', msg: '没有找到站点原来的提交按钮' });
  }

  function isTagTrigger(target, mode) {
    if (!target || !target.closest) return false;
    if (target.closest('#dm-dl-root')) return false;
    if (mode === 'multi') {
      if (target.closest('.multi-select-btn')) return true;
      var btn = target.closest('button');
      if (btn && (btn.textContent || '').replace(/\s+/g, '') === '多选标签') return true;
    } else {
      if (target.closest('.shield-select-btn')) return true;
      var btn2 = target.closest('button');
      if (btn2 && (btn2.textContent || '').replace(/\s+/g, '') === '屏蔽标签') return true;
    }
    return false;
  }

  function bindTagPicker() {
    if (tagPicker.bound) return;
    if (!document.querySelector('.dx-middle-popup, .dx-shield-tag-box, .multi-select-btn, .shield-select-btn')) return;
    tagPicker.bound = true;

    document.addEventListener('click', function (e) {
      if (isTagTrigger(e.target, 'multi')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        hideSiteTagPopups();
        openTagPicker('multi');
        return;
      }
      if (isTagTrigger(e.target, 'shield')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        hideSiteTagPopups();
        openTagPicker('shield');
      }
    }, true);

    hideSiteTagPopups();
  }

  function updateLatestTip(novelId, currentId) {
    if (tipFetched) return;
    tipFetched = true;
    var tip = document.getElementById('dm-dl-latest-tip');
    if (!tip) return;
    fetchChapterList(novelId)
      .then(function (list) {
        if (!list || !list.length) return;
        var latest = list[list.length - 1];
        var isLatest = !!(currentId && latest.id === currentId);
        tip.classList.add('show');
        if (isLatest) {
          tip.innerHTML = '✓ 已是最新章节：' + esc(latest.title);
          tip.onclick = null;
        } else {
          tip.innerHTML = '📘 最新: ' + esc(latest.title) + ' <span style="color:var(--dm-accent);font-weight:600">阅读 →</span>';
          tip.onclick = function () { location.href = latest.url; };
        }
      })
      .catch(function () {});
  }

  function boot() {
    ensureDOM();
    // 二次 boot（800ms 兜底）时若正在下载，不重建 Dock，避免进度按钮被顶掉
    if (downloading) {
      markListCards();
      return;
    }
    var path = location.pathname;
    var novelId = getNovelIdFromUrl();

    if (/\/novel\/detail\//.test(path)) {
      var chs = parseChapters();
      injectTitleBadges(novelId);
      buildDockUI({ mode: 'detail', novelId: novelId, chaptersCount: chs.length });
    } else if (/\/novel_chapter\//.test(path)) {
      var cm = path.match(/\/novel_chapter\/(\d+)\/(\d+)/);
      var chapterId = cm ? parseInt(cm[2], 10) : 0;
      buildDockUI({ mode: 'chapter', novelId: novelId, chaptersCount: 0 });
      updateLatestTip(novelId, chapterId);
    } else {
      buildDockUI({ mode: 'list' });
    }

    markListCards();
    bindTagPicker();
  }

  initWebdav();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  setTimeout(boot, 800);
})();