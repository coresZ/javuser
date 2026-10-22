// ==UserScript==
// @name Missav & Jable自动中文字幕&评论时间跳转 (悬浮)
// @namespace http://tampermonkey.net/
// @version 6.4
// @description 搜索按钮提级至首页，修复 Missav 番号识别，新增下载功能，让字幕列表常驻显示当前选中项，并优化首页设置布局，支持首页滑杆在 0%-100% 范围调整字幕垂直位置与横向位置，控制台与 CC 可拖动并记住位置，界面改为紧凑控制台，修复返回后重新搜索丢失当前选中标记的问题，并将 CC 悬浮图标恢复为低存在感透明样式，修复 Jable 评论区“求中文字幕”导致误判已有内置字幕的问题。
// @author cores
// @match *://missav*.com/*
// @match *://missav.ws/*
// @match *://missav.ai/*
// @match *://missav.live/*
// @match *://jable.tv/videos/*
// @match *://*.jable.tv/videos/*
// @require https://update.greasyfork.org/scripts/600709/PageDock.js
// @grant GM_xmlhttpRequest
// @grant GM.xmlHttpRequest
// @grant GM_addStyle
// @grant GM.addStyle
// @grant unsafeWindow
// @connect api-shoulei-ssl.xunlei.com
// @connect xunlei.com
// @connect shoulei.com
// @connect subtitlecat.com
// @connect *.subtitlecat.com
// @connect subtitle.v.geilijiasu.com
// @connect *.geilijiasu.com 
// @run-at document-end
// @license MIT 
// ==/UserScript==
(function () {
    'use strict';
    // ======================
    // GM API 兼容层
    // 各脚本管理器暴露的名字不一致：Tampermonkey/Violentmonkey 有 GM_addStyle，
    // iOS 的 Userscripts 只注册 GM.addStyle（见 quoid/userscripts 的 grant 映射），
    // 直接调用 GM_addStyle 会在 iOS 上抛 ReferenceError 并中断整个脚本。
    // 注意：这里刻意不声明名为 GM / GM_xmlhttpRequest 的局部变量，避免遮蔽管理器注入的同名 API 造成自递归。
    // ======================
    const MsvGM = {
        addStyle: (css) => {
            try {
                if (typeof GM_addStyle === 'function') {
                    GM_addStyle(css);
                    return true;
                }
            } catch {}
            try {
                if (typeof GM !== 'undefined' && GM && typeof GM.addStyle === 'function') {
                    const result = GM.addStyle(css);
                    if (result && typeof result.catch === 'function') result.catch(() => {});
                    return true;
                }
            } catch {}
            try {
                const style = document.createElement('style');
                style.textContent = css;
                (document.head || document.documentElement).appendChild(style);
                return true;
            } catch {
                return false;
            }
        },
        // 统一请求入口：优先旧式 GM_xmlhttpRequest，其次 GM.xmlHttpRequest，
        // 都没有时回退到页面 XMLHttpRequest，保证 iOS 上搜索链路不至于整体哑掉。
        request: (details) => {
            try {
                if (typeof GM_xmlhttpRequest === 'function') return GM_xmlhttpRequest(details);
            } catch {}
            try {
                if (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function') {
                    const req = GM.xmlHttpRequest(details);
                    if (req && typeof req.then === 'function') {
                        req.then((res) => { if (details.onload) details.onload(res); })
                            .catch(() => { if (details.onerror) details.onerror({ status: 0 }); });
                        return { abort: () => {} };
                    }
                    return req;
                }
            } catch {}
            try {
                const req = new XMLHttpRequest();
                req.open(details.method || 'GET', details.url, true);
                if (details.timeout) req.timeout = details.timeout;
                if (details.responseType) req.responseType = details.responseType;
                req.onload = () => {
                    if (details.onload) details.onload({ status: req.status, response: req.response, responseText: req.responseText });
                };
                req.onerror = () => { if (details.onerror) details.onerror({ status: 0 }); };
                req.ontimeout = () => { if (details.ontimeout) details.ontimeout({ status: 0 }); };
                req.send(details.data != null ? details.data : null);
                return req;
            } catch {
                if (details.onerror) details.onerror({ status: 0 });
                return { abort: () => {} };
            }
        }
    };
    // 字幕默认字号按视口宽度分档：桌面 24px 在 402px 宽的手机上会占掉近半行宽，
    // 移动端按「一行能放下约 18~20 个汉字」取值。
    const defaultSubtitleFontSize = () => {
        const vw = window.innerWidth || 1024;
        if (vw <= 480) return 17;   // iPhone 竖屏（402/430）
        if (vw <= 820) return 19;   // 小平板 / 手机横屏
        return 24;
    };
    const CONFIG = {
        autoSearch: true,
        pauseOnSearch: true,
        defaultFontSize: defaultSubtitleFontSize(),
    };
    const normalizeCode = (value) => {
        const match = String(value || '').toUpperCase().replace(/MISSAV/g, '').match(/([A-Z]{2,8})[-_\s]?(\d{2,6})/);
        return match ? `${match[1]}-${match[2]}` : '';
    };
    const extractCodeFromText = (value) => normalizeCode(value);
    const extractMissavCodeFromPath = (pathname) => {
        const segments = String(pathname || '')
            .split('/')
            .map(segment => {
                try { return decodeURIComponent(segment); } catch { return segment; }
            })
            .filter(Boolean);

        // Missav 可能出现 /dm68/cawd-629-uncensored-leak 这种多级路径，必须优先取带分隔符的真实番号段，避免把分类 dm68 当番号。
        const separatedCandidate = segments.map(segment => {
            const match = segment.toUpperCase().replace(/MISSAV/g, '').match(/(^|[^A-Z0-9])([A-Z]{2,8})[-_\s]+(\d{2,6})(?=[^A-Z0-9]|$)/);
            return match ? `${match[2]}-${match[3]}` : '';
        }).find(Boolean);
        if (separatedCandidate) return separatedCandidate;

        // 兼容少数无分隔符番号，但排除 Missav 常见 dm 数字分类页。
        return segments.slice().reverse().map(normalizeCode).find(code => code && !/^DM-\d{1,4}$/i.test(code)) || '';
    };
    const extractCurrentPageCode = () => {
        const host = window.location.hostname || '';
        if (host.includes('missav')) {
            return extractMissavCodeFromPath(window.location.pathname) || extractCodeFromText(document.title);
        }
        // Jable 当前识别正常，保持原有“路径 + 标题”策略，避免引入新回归。
        return extractCodeFromText(`${window.location.pathname} ${document.title}`);
    };
    const textContainsCode = (text, code) => {
        const normalizedCode = normalizeCode(code);
        if (!normalizedCode) return false;
        const [prefix, number] = normalizedCode.split('-');
        const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedNumber = number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|[^A-Z0-9])${escapedPrefix}[-_\\s]?${escapedNumber}([^A-Z0-9]|$)`, 'i').test(String(text || ''));
    };
    // --- 智能检测函数 ---
    const BUILT_IN_SUB_RE = /中文字幕|中文\s*字幕|CHINESE\s*(SUB|SUBTITLE)/i;
    const isIgnoredSubtitleSignalNode = (element) => {
        if (!element) return true;
        const ignoredSelector = [
            '#comments', '.comments', '.comment', '.comment-list', '.reply', '.reviews', '.review',
            '.message', '.forum', '.discussion', '.original-text', '.translated-text',
            '.related', '.recommend', '.recommendations', '.video-list', '.playlist'
        ].join(',');
        if (element.closest?.(ignoredSelector)) return true;
        return /comment|review|reply|discussion|forum|message|related|recommend/i.test(`${element.id || ''} ${element.className || ''}`);
    };
    const collectBuiltInSubtitleSignalText = () => {
        const parts = [document.title || ''];
        document.querySelectorAll('meta[property="og:title"],meta[name="title"],meta[property="og:description"],meta[name="description"]').forEach(meta => {
            parts.push(meta.getAttribute('content') || '');
        });
        // 只读取当前影片标题、详情、标签等区域，避免把评论区“求中文字幕”当成影片自带中文字幕。
        const selectors = [
            'h1', 'h2', 'h3', 'h4', '.video-title', '.post-title', '.single-title',
            '.info-header', '.video-info', '.video-detail', '.movie-info', '.detail', '.tags', '.tag', '.label', '.badge',
            'a[href*="/tags/"]', 'a[href*="/categories/"]'
        ].join(',');
        document.querySelectorAll(selectors).forEach(element => {
            if (!isIgnoredSubtitleSignalNode(element)) parts.push(element.innerText || element.textContent || '');
        });
        return parts.join('\n');
    };
    const checkBuiltInSub = () => {
        const url = window.location.pathname.toUpperCase();
        const host = window.location.hostname;
        const signalText = collectBuiltInSubtitleSignalText();
        const missavCheck = host.includes('missav') && (/-C(\b|[/?#_-])/i.test(url) || BUILT_IN_SUB_RE.test(signalText));
        const jableCheck = host.includes('jable') && BUILT_IN_SUB_RE.test(signalText);
        return missavCheck || jableCheck;
    };
    const initialBuiltInSub = checkBuiltInSub();
    // ======================
    // 设置持久化
    // 字号 / 垂直 / 横向三项共用一份记录。原实现只存了 bottom+x，字号完全没存，
    // 所以字号每次刷新都回到默认值。这里统一成 VIEW_KEY，并且：
    //   1. 读写全部包 try/catch —— iOS 无痕模式或「阻止所有 Cookie」下访问
    //      localStorage 会直接抛 SecurityError，不能让一个存储异常拖垮整个脚本。
    //   2. 兼容旧的 POS_KEY（老用户已存的 bottom/x 不会丢）。
    //   3. 存进内存副本，存储不可用时本次会话内仍能记住设置。
    // ======================
    const VIEW_KEY = 'msv-subtitle-view-v2';
    const LEGACY_POS_KEY = 'msv-subtitle-pos-v1';
    const memoryStore = Object.create(null);

    const storageGet = (key) => {
        try {
            const value = window.localStorage.getItem(key);
            if (value !== null) return value;
        } catch {}
        return key in memoryStore ? memoryStore[key] : null;
    };
    const storageSet = (key, value) => {
        memoryStore[key] = value;
        try { window.localStorage.setItem(key, value); } catch {}
    };
    const clampPercent = (value, fallback) => {
        const num = Number(value);
        return Number.isFinite(num) ? Math.min(100, Math.max(0, num)) : fallback;
    };

    const readSavedView = () => {
        const result = {
            bottom: 8,
            x: 50,
            fontSize: CONFIG.defaultFontSize
        };
        // 先读旧键，保证老用户已保存的位置不丢
        try {
            const legacy = JSON.parse(storageGet(LEGACY_POS_KEY) || 'null');
            if (legacy && typeof legacy === 'object') {
                result.bottom = clampPercent(legacy.bottom, result.bottom);
                result.x = clampPercent(legacy.x, result.x);
            }
        } catch {}
        try {
            const saved = JSON.parse(storageGet(VIEW_KEY) || 'null');
            if (saved && typeof saved === 'object') {
                result.bottom = clampPercent(saved.bottom, result.bottom);
                result.x = clampPercent(saved.x, result.x);
                const size = Number(saved.fontSize);
                // 与滑杆 min/max 一致；越界值直接丢弃，避免脏数据把字号顶到不可读
                if (Number.isFinite(size) && size >= 12 && size <= 60) result.fontSize = Math.round(size);
            }
        } catch {}
        return result;
    };
    const savedView = readSavedView();
    const STATE = {
        offset: window.location.hostname.includes('jable.tv') ? -6.0 : 0.0,
        bottom: savedView.bottom,
        x: savedView.x,
        visible: !initialBuiltInSub,
        hasBuiltInSub: initialBuiltInSub,
        code: null,
        subs: [],
        fontSize: savedView.fontSize,
        nativeTrackUrl: null,
        rawSubtitleText: '',
        currentSubtitleName: '',
        currentSubtitleKey: '',
        enabled: storageGet('msv-script-enabled') !== '0'
    };
    // 三项一起写，避免只存一半导致「有的记住有的没记住」
    const saveView = () => {
        storageSet(VIEW_KEY, JSON.stringify({
            bottom: STATE.bottom,
            x: STATE.x,
            fontSize: STATE.fontSize
        }));
    };
    let subLayer = null;
    // ======================
    // 样式重构
    // ======================
    MsvGM.addStyle(`
        #msv-dock {
            position: fixed; z-index: 2147483646; width: 36px; height: 36px;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
            color: rgba(255,255,255,0.92); touch-action: manipulation;
        }
        #msv-fab {
            position: absolute; right: 0; bottom: 0; width: 36px; height: 36px; border-radius: 12px;
            background: rgba(18,18,20,0.42); color: rgba(255,255,255,0.38);
            border: 0;
            display: flex; align-items: center; justify-content: center;
            font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            cursor: grab; user-select: none; -webkit-user-select: none;
            -webkit-tap-highlight-color: transparent; touch-action: none;
            box-shadow: 0 8px 22px rgba(0,0,0,0.28);
        }
        #msv-fab:active { cursor: grabbing; }
        #msv-fab:hover { background: rgba(255,255,255,0.16); color: #fff; }
        #msv-fab.ok { color: rgba(255,255,255,0.88); }
        #msv-fab.is-docked { display: none !important; }
        #msv-dock.is-mini #msv-panel { display: none !important; }
        #msv-panel {
            position: absolute; right: 0; bottom: 44px; width: min(292px, calc(100vw - 24px));
            max-height: calc(100vh - 80px);
            max-height: calc(100dvh - 80px); display: none; flex-direction: column; gap: 0;
            background: rgba(22,22,24,0.78);
            border: 1px solid rgba(255,255,255,0.16); border-radius: 16px;
            box-shadow: 0 18px 48px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.16);
            backdrop-filter: blur(22px) saturate(160%); -webkit-backdrop-filter: blur(22px) saturate(160%);
            overflow: hidden;
        }
        #msv-panel.show { display: flex; animation: msv-pop 0.16s cubic-bezier(.2,.8,.2,1); }
        /* 用独立的 translate 属性做入场动画，把 transform 留给 placePanel() 的视口夹取 */
        @keyframes msv-pop { from { opacity:0; translate: 0 6px; } to { opacity:1; translate: 0 0; } }
        .msv-head {
            display: flex; align-items: center; gap: 8px; padding: 10px 12px 8px; cursor: grab; user-select: none;
            -webkit-user-select: none; touch-action: none;
            border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .msv-head:active { cursor: grabbing; }
        .msv-grip { width: 18px; height: 10px; opacity: 0.45; flex: none; }
        .msv-head-title { font-size: 12px; font-weight: 650; letter-spacing: 0.01em; }
        .msv-head-code { margin-left: auto; font-size: 11px; color: rgba(255,214,102,0.92); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .msv-body { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 12px; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
        .msv-mini-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .msv-val-box {
            flex: 1; text-align: center; color: #ffd166; font-weight: 700; font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
            border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; padding: 5px 0; background: rgba(255,255,255,0.06);
        }
        .msv-mini-btn {
            background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.92); border: 1px solid rgba(255,255,255,0.12);
            width: 34px; height: 28px; border-radius: 8px; font-size: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .msv-mini-btn:hover { background: rgba(255,255,255,0.16); }
        .msv-switch { position: relative; display: inline-block; width: 42px; height: 24px; flex-shrink: 0; }
        .msv-switch input { opacity: 0; width: 0; height: 0; }
        .msv-slider-round {
            position: absolute; cursor: pointer; inset: 0; background: rgba(120,120,128,0.42); transition: .2s; border-radius: 24px;
        }
        .msv-slider-round:before {
            position: absolute; content: ""; height: 20px; width: 20px; left: 2px; bottom: 2px;
            background: #fff; transition: .2s; border-radius: 50%; box-shadow: 0 1px 4px rgba(0,0,0,0.35);
        }
        input:checked + .msv-slider-round { background: #0a84ff; }
        input:checked + .msv-slider-round:before { transform: translateX(18px); }
        .msv-list-container { max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
        .msv-list-container::-webkit-scrollbar { width: 6px; }
        .msv-list-container::-webkit-scrollbar-track { background: transparent; }
        .msv-list-container::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.22); border-radius: 999px; }
        .msv-list-item {
            background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.86); border: 1px solid rgba(255,255,255,0.10);
            padding: 8px 9px; font-size: 11px; border-radius: 10px; text-align: left; line-height: 1.4;
            white-space: normal; word-break: break-all; cursor: pointer;
        }
        .msv-list-item:hover { background: rgba(255,255,255,0.12); color: #fff; }
        .msv-list-item.is-selected { background: rgba(52,199,89,0.16); border-color: rgba(52,199,89,0.7); color: #fff; }
        .msv-subtitle-name { flex: 1; min-width: 0; }
        .msv-field { display: flex; flex-direction: column; gap: 4px; }
        .msv-label { display: flex; justify-content: space-between; font-size: 10px; color: rgba(255,255,255,0.58); letter-spacing: 0.02em; }
        .msv-label b { color: rgba(255,255,255,0.92); font-weight: 650; font-variant-numeric: tabular-nums; }
        .msv-input {
            background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.94); border: 1px solid rgba(255,255,255,0.12);
            padding: 7px 9px; text-align: center; border-radius: 9px;
            /* 16px：低于此值 iOS Safari 聚焦输入框会自动放大整页 */
            font-size: 16px; width: 100%; box-sizing: border-box; outline: none;
        }
        .msv-input:focus { border-color: rgba(10,132,255,0.8); }
        .msv-slider {
            width: 100%; height: 22px; margin: 0; cursor: pointer;
            /* 触屏滑杆：交给浏览器原生手势，不要被拖动逻辑吞掉 */
            touch-action: pan-y;
            /* 自绘轨道：-webkit-appearance:none 会去掉原生轨道，必须显式画，否则只剩一个圆点 */
            -webkit-appearance: none; appearance: none; background: transparent;
            /* --msv-fill 由 syncSliderFill() 按当前值写入，用来画已填充段 */
            --msv-fill: 50%;
        }
        .msv-slider::-webkit-slider-runnable-track {
            height: 6px; border-radius: 999px;
            background: linear-gradient(to right,
                #0a84ff 0%, #0a84ff var(--msv-fill),
                rgba(255,255,255,0.22) var(--msv-fill), rgba(255,255,255,0.22) 100%);
        }
        .msv-slider::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%;
            background: #fff; border: 0; box-shadow: 0 1px 4px rgba(0,0,0,0.45);
            /* 让 18px 圆点在 6px 轨道上垂直居中 */
            margin-top: -6px;
        }
        .msv-slider::-moz-range-track {
            height: 6px; border-radius: 999px; background: rgba(255,255,255,0.22);
        }
        .msv-slider::-moz-range-progress {
            height: 6px; border-radius: 999px; background: #0a84ff;
        }
        .msv-slider::-moz-range-thumb {
            width: 18px; height: 18px; border-radius: 50%; background: #fff; border: 0;
            box-shadow: 0 1px 4px rgba(0,0,0,0.45);
        }
        .msv-btn-blue, .msv-btn-gray, .msv-btn-red {
            border: 1px solid rgba(255,255,255,0.12); padding: 7px 8px; border-radius: 9px; font-size: 12px; font-weight: 650; cursor: pointer;
            -webkit-tap-highlight-color: transparent; touch-action: manipulation;
        }
        .msv-btn-blue { background: #0a84ff; color: #fff; flex: 1; border-color: transparent; }
        .msv-btn-gray { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.9); flex: 1; }
        .msv-btn-red { background: transparent; color: rgba(255,120,110,0.9); font-size: 11px; font-weight: 550; }
        .msv-btn-blue:hover, .msv-btn-gray:hover { filter: brightness(1.08); }
        .msv-toast {
            position: fixed; top: 40%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(28,28,30,0.82); color: #fff; padding: 12px 18px;
            border: 1px solid rgba(255,255,255,0.16); border-radius: 14px; font-size: 14px; z-index: 2147483648; pointer-events: none;
            opacity: 0; transition: opacity 0.2s ease; text-align: center;
            white-space: pre-line; line-height: 1.5; box-shadow: 0 16px 40px rgba(0,0,0,0.36);
            backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px);
            max-width: calc(100vw - 32px); box-sizing: border-box;
        }
        .msv-toast.show { opacity: 1; }
        .msv-subtitle-overlay {
            position: absolute !important; transform: translateX(-50%) !important;
            width: min(92vw, 1100px) !important; text-align: center !important; pointer-events: none !important;
            color: #fff !important; font-weight: 600 !important;
            text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 0 6px #000 !important;
            z-index: 2147483646 !important; line-height: 1.4 !important; white-space: pre-line !important; display: block !important;
        }
        /* 移动端：固定宽度贴底面板，不再拉满整屏（402px 屏上全宽显得过大） */
        @media (max-width: 820px), (pointer: coarse) {
            #msv-panel {
                position: fixed; top: auto;
                left: auto; right: 8px;
                width: min(320px, calc(100vw - 24px));
                bottom: calc(52px + env(safe-area-inset-bottom, 0px));
                max-height: calc(100vh - 84px);
                max-height: calc(100dvh - 84px);
                border-radius: 14px;
            }
            /* 内部间距与字级整体收一档，让 320px 宽的卡片不显臃肿 */
            .msv-head { cursor: default; padding: 8px 10px 7px; gap: 6px; }
            .msv-head-title { font-size: 11.5px; }
            .msv-head-code { max-width: 88px; font-size: 10.5px; }
            .msv-grip { width: 15px; height: 9px; }
            .msv-body { padding: 8px 10px calc(10px + env(safe-area-inset-bottom, 0px)); gap: 7px; }
            .msv-label { font-size: 9.5px; }
            .msv-val-box { font-size: 11.5px; padding: 4px 0; }
            /* 输入框必须保留 16px，否则 iOS 聚焦时会自动放大整页；靠 padding 收高度 */
            .msv-input { padding: 5px 8px; border-radius: 8px; }
            .msv-slider { height: 20px; }
            .msv-btn-blue, .msv-btn-gray { padding: 6px 8px; font-size: 11.5px; border-radius: 8px; }
            .msv-btn-red { font-size: 10.5px; }
            .msv-mini-btn { width: 38px; height: 30px; border-radius: 7px; }
            .msv-switch { width: 38px; height: 22px; }
            .msv-slider-round:before { height: 18px; width: 18px; }
            input:checked + .msv-slider-round:before { transform: translateX(16px); }
            .msv-list-container { max-height: 34dvh; gap: 5px; }
            .msv-list-item { padding: 8px 9px; font-size: 11.5px; border-radius: 9px; }
            .msv-subtitle-name { line-height: 1.35; }
            .msv-toast { font-size: 13px; padding: 10px 14px; }
            /* 触屏没有 hover，改用 :active 反馈，避免点击看起来「没反应」 */
            .msv-fab:hover, .msv-list-item:hover, .msv-btn-blue:hover, .msv-btn-gray:hover { filter: none; }
            .msv-list-item:active { background: rgba(255,255,255,0.16); }
            #msv-fab { -webkit-tap-highlight-color: transparent; }
        }
    `);
    // ======================
    // 逻辑部分
    // ======================
    const UI = {
        toast: (msg, time = 1000) => {
            const t = document.getElementById('msv-toast');
            if (t) { t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), time); }
        },
        switchView: (isSearch) => {
            const main = document.getElementById('msv-main-ui');
            const list = document.getElementById('msv-list-ui');
            if(main) main.style.display = isSearch ? 'none' : 'flex';
            if(list) list.style.display = isSearch ? 'flex' : 'none';
        }
    };
    const Utils = {
        decode: (b) => {
            const u = new Uint8Array(b); if (u[0] === 0xEF) return new TextDecoder('utf-8').decode(u.slice(3));
            try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch { return new TextDecoder('gb18030').decode(b); }
        },
        parse: (t) => t.replace(/\r/g,'').split(/\n\n+/).map(b => {
            const l = b.split('\n'); if (l.length < 2) return null;
            const i = l.findIndex(x => x.includes('-->')); if (i < 0) return null;
            const p = (s) => {
                const m = s.match(/(\d+):(\d+):(\d+)[,.](\d+)/);
                return m ? (parseInt(m[1])*3600 + parseInt(m[2])*60 + parseInt(m[3]) + parseInt(m[4])/1000) : 0;
            };
            const [ss, ee] = l[i].split(' --> ').map(p);
            return { start: ss, end: ee, text: l.slice(i+1).join('\n') };
        }).filter(Boolean),
        normalizeCode,
        extractCodeFromText,
        extractMissavCodeFromPath,
        extractCurrentPageCode,
        textContainsCode,
        safeFileName: (value) => String(value || 'subtitle').replace(/[\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'subtitle',
        absoluteUrl: (href, baseUrl) => {
            try { return new URL(href, baseUrl).href; } catch { return href; }
        },
        formatVttTime: (seconds) => {
            const safeSeconds = Math.max(0, Number(seconds) || 0);
            const h = Math.floor(safeSeconds / 3600);
            const m = Math.floor((safeSeconds % 3600) / 60);
            const s = Math.floor(safeSeconds % 60);
            const ms = Math.round((safeSeconds - Math.floor(safeSeconds)) * 1000);
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
        },
        toWebVtt: (subs, offset = 0) => {
            const lines = ['WEBVTT', ''];
            subs.forEach((cue, index) => {
                const start = cue.start + offset;
                const end = cue.end + offset;
                if (end <= 0 || end <= start) return;
                const text = String(cue.text || '').replace(/-->/g, '→').trim();
                lines.push(String(index + 1));
                lines.push(`${Utils.formatVttTime(start)} --> ${Utils.formatVttTime(end)}`);
                lines.push(text || ' ');
                lines.push('');
            });
            return lines.join('\n');
        }
    };
    const Engine = {
        clearLoadedSubs: () => {
            STATE.subs = [];
            STATE.rawSubtitleText = '';
            STATE.currentSubtitleName = '';
            STATE.currentSubtitleKey = '';
            if (subLayer) subLayer.textContent = '';
            document.querySelectorAll('track[data-msv-native-track="1"]').forEach(track => track.remove());
            if (STATE.nativeTrackUrl) URL.revokeObjectURL(STATE.nativeTrackUrl);
            STATE.nativeTrackUrl = null;
            document.querySelectorAll('video[data-msv-native-track-key]').forEach(video => delete video.dataset.msvNativeTrackKey);
        },
        search: (code, isAuto = false) => {
            const normalizedCode = Utils.normalizeCode(code);
            if (!normalizedCode) {
                if (!isAuto) UI.toast('❌ 未识别到有效番号', 1500);
                return;
            }
            STATE.hasBuiltInSub = checkBuiltInSub();
            if (isAuto && STATE.hasBuiltInSub) {
                STATE.visible = false;
                Engine.clearLoadedSubs();
                const visCheck = document.getElementById('msv-check-vis');
                if (visCheck) visCheck.checked = false;
                return;
            }
            const shouldKeepCurrentSubtitle = !isAuto && STATE.code === normalizedCode && Boolean(STATE.currentSubtitleKey);
            // 手动重复搜索当前番号时保留已加载字幕与选中 key，返回后再次打开列表才能继续显示当前行的小勾。
            if (!shouldKeepCurrentSubtitle) Engine.clearLoadedSubs();
            STATE.code = normalizedCode;
            if (!isAuto) UI.switchView(true);
            const listContainer = document.getElementById('msv-results');
            if (listContainer) listContainer.innerHTML = '<div style="color:#666;text-align:center;font-size:11px;padding:20px">正在云端检索版本...</div>';
            MsvGM.request({
                method: 'GET', url: `https://api-shoulei-ssl.xunlei.com/oracle/subtitle?name=${encodeURIComponent(normalizedCode)}`,
                timeout: 15000,
                onload: (res) => {
                    try {
                        const d = JSON.parse(res.responseText);
                        const items = d.data?.filter(i => {
                            const haystack = `${i.name || ''} ${i.extra_name || ''} ${i.url || ''}`;
                            return i.url && /\.srt(\?|$)/i.test(i.url) && Utils.textContainsCode(haystack, normalizedCode);
                        }) || [];
                        if (items.length > 0) {
                            if (isAuto) Engine.dl(items[0].url);
                            else Engine.renderList(items.map(i => ({ name: `[迅雷] ${i.name}`, url: i.url })));
                        } else { Engine.scraper(normalizedCode, isAuto); }
                    } catch { Engine.scraper(normalizedCode, isAuto); }
                },
                onerror: () => Engine.scraper(normalizedCode, isAuto),
                ontimeout: () => Engine.scraper(normalizedCode, isAuto)
            });
        },
        scraper: (code, isAuto) => {
            MsvGM.request({
                method: 'GET', url: `https://subtitlecat.com/index.php?search=${encodeURIComponent(code)}`,
                timeout: 15000,
                onload: (res) => {
                    const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
                    const rows = Array.from(doc.querySelectorAll('table tbody tr'));
                    if (rows.length === 0) {
                        if (!isAuto) document.getElementById('msv-results').innerHTML = '<div style="color:#991b1b;text-align:center;padding:10px">无任何匹配版本</div>';
                        return;
                    }
                    const normalizedCode = Utils.normalizeCode(code);
                    const allList = rows.map(tr => {
                        const a = tr.querySelector('td a');
                        if (!a) return null;
                        const lang = tr.querySelector('td:nth-child(2)')?.textContent || '未知';
                        const detailUrl = Utils.absoluteUrl(a.getAttribute('href'), 'https://subtitlecat.com/');
                        const name = `[猫] ${a.textContent} (${lang})`;
                        return { name, isScraper: true, detailUrl };
                    }).filter(Boolean).slice(0, 10);
                    const exactList = allList.filter(item => Utils.textContainsCode(`${item.name} ${item.detailUrl}`, normalizedCode));
                    if (exactList.length > 0) {
                        if (isAuto) Engine.getScraperDlUrl(exactList[0].detailUrl);
                        else Engine.renderList(exactList);
                        return;
                    }
                    if (allList.length === 0) {
                        if (!isAuto) document.getElementById('msv-results').innerHTML = '<div style="color:#991b1b;text-align:center;padding:10px">没有当前番号的精确字幕匹配</div>';
                        return;
                    }
                    if (isAuto) return;
                    Engine.renderList(allList, '⚠️ 没有当前番号的精确字幕匹配，以下是搜索到的疑似结果，请手动确认后再加载');
                },
                onerror: () => {
                    if (!isAuto) document.getElementById('msv-results').innerHTML = '<div style="color:#991b1b;text-align:center;padding:10px">字幕站请求失败，请稍后重试</div>';
                },
                ontimeout: () => {
                    if (!isAuto) document.getElementById('msv-results').innerHTML = '<div style="color:#991b1b;text-align:center;padding:10px">字幕站请求超时，请稍后重试</div>';
                }
            });
        },
        getItemKey: (item) => String(item?.key || item?.url || item?.detailUrl || item?.name || ''),
        refreshSelectedMarks: () => {
            document.querySelectorAll('.msv-list-item[data-msv-subtitle-key]').forEach(row => {
                const isSelected = Boolean(STATE.currentSubtitleKey && row.dataset.msvSubtitleKey === STATE.currentSubtitleKey);
                row.classList.toggle('is-selected', isSelected);
                const name = row.querySelector('.msv-subtitle-name');
                if (name && row.dataset.msvSubtitleName && !row.dataset.msvLoading) {
                    // 只给当前选中的字幕行加小勾；未选中行不预留空白，列表更紧凑。
                    name.textContent = `${isSelected ? '✓ ' : ''}${row.dataset.msvSubtitleName}`;
                }
            });
        },
        renderList: (items, notice = '') => {
            const container = document.getElementById('msv-results');
            if (!container) return;
            container.innerHTML = '';
            if (notice) {
                const noticeDiv = document.createElement('div');
                noticeDiv.style.cssText = 'color:#f59e0b;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);border-radius:8px;padding:8px;font-size:11px;line-height:1.4;margin-bottom:4px';
                noticeDiv.textContent = notice;
                container.appendChild(noticeDiv);
            }
            items.forEach(item => {
                const itemKey = Engine.getItemKey(item);
                const div = document.createElement('div');
                div.className = 'msv-list-item';
                div.dataset.msvSubtitleKey = itemKey;
                div.dataset.msvSubtitleName = item.name || '';
                div.style.display = 'flex';
                div.style.alignItems = 'center';
                div.style.justifyContent = 'space-between';
                div.style.gap = '8px';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'msv-subtitle-name';
                nameSpan.textContent = item.name;

                const downloadBtn = document.createElement('button');
                downloadBtn.textContent = '↓';
                downloadBtn.title = '只下载此字幕，不自动启用';
                downloadBtn.setAttribute('aria-label', '下载字幕');
                downloadBtn.style.cssText = 'flex:none;width:22px;height:20px;background:#14532d;color:#bbf7d0;border:1px solid #166534;border-radius:5px;padding:0;font-size:11px;line-height:1;cursor:pointer';

                div.onclick = () => {
                    div.style.opacity = "0.5";
                    div.dataset.msvLoading = '1';
                    nameSpan.textContent = "正在加载数据...";
                    if (item.isScraper) Engine.getScraperDlUrl(item.detailUrl, div, 'load', item.name, null, itemKey);
                    else Engine.dl(item.url, div, item.name, itemKey);
                };
                downloadBtn.onclick = (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
                    downloadBtn.textContent = '…';
                    downloadBtn.disabled = true;
                    const done = () => { downloadBtn.textContent = '↓'; downloadBtn.disabled = false; };
                    if (item.isScraper) Engine.getScraperDlUrl(item.detailUrl, div, 'download', item.name, done, itemKey);
                    else Engine.downloadUrl(item.url, item.name, done);
                };

                div.appendChild(nameSpan);
                div.appendChild(downloadBtn);
                container.appendChild(div);
            });
            Engine.refreshSelectedMarks();
        },
        getScraperDlUrl: (url, targetEl = null, mode = 'load', fileName = '', done = null, itemKey = '') => {
            const fail = (msg) => {
                if (targetEl && mode === 'load') {
                    targetEl.style.opacity = "1";
                    delete targetEl.dataset.msvLoading;
                    const name = targetEl.querySelector('.msv-subtitle-name');
                    if (name) name.textContent = `❌ ${msg}`;
                }
                if (done) done();
                UI.toast(`❌ ${msg}`, 2000);
            };
            MsvGM.request({
                method: 'GET', url,
                timeout: 15000,
                onload: (res) => {
                    if (res.status && (res.status < 200 || res.status >= 400)) {
                        fail(`详情页请求失败(${res.status})`);
                        return;
                    }
                    const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
                    const links = Array.from(doc.querySelectorAll('a[href]'))
                        .map(a => ({ href: a.getAttribute('href'), text: a.textContent.trim() }))
                        .filter(i => i.href && (/\.srt(\?|$)/i.test(i.href) || /download\.php/i.test(i.href)));
                    const preferred = links.find(i => /zh-CN|zh_CN|simplified|简体/i.test(`${i.href} ${i.text}`))
                        || links.find(i => /zh|cn|chinese|中文/i.test(`${i.href} ${i.text}`))
                        || links[0];
                    if (!preferred) {
                        fail('未找到字幕下载链接');
                        return;
                    }
                    const subtitleUrl = Utils.absoluteUrl(preferred.href, url);
                    if (mode === 'download') Engine.downloadUrl(subtitleUrl, fileName, done);
                    else Engine.dl(subtitleUrl, targetEl, fileName, itemKey || url);
                },
                onerror: () => fail('详情页请求失败'),
                ontimeout: () => fail('详情页请求超时')
            });
        },
        saveTextAsFile: (text, fileName) => {
            if (!text) {
                UI.toast('❌ 没有可下载的字幕内容', 1500);
                return false;
            }
            const safeName = Utils.safeFileName(fileName || STATE.currentSubtitleName || STATE.code || 'subtitle');
            const finalName = /\.srt$/i.test(safeName) ? safeName : `${safeName}.srt`;
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = finalName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
            UI.toast(`💾 已触发下载：${finalName}`, 1600);
            return true;
        },
        downloadUrl: (url, fileName = '', done = null) => {
            const fail = (msg, err = null) => {
                if (err) console.error('Sub Download Error', err);
                if (done) done();
                UI.toast(`❌ ${msg}`, 2000);
            };
            MsvGM.request({
                method: 'GET', url, responseType: 'arraybuffer', timeout: 20000,
                onload: (r) => {
                    try {
                        if (r.status && (r.status < 200 || r.status >= 400)) {
                            fail(`字幕下载失败(${r.status})`);
                            return;
                        }
                        const text = Utils.decode(r.response);
                        if (!Utils.parse(text).length) {
                            fail('字幕文件解析失败或为空');
                            return;
                        }
                        Engine.saveTextAsFile(text, fileName || STATE.code || 'subtitle');
                        if (done) done();
                    } catch (e) {
                        fail('字幕下载解析出错', e);
                    }
                },
                onerror: () => fail('字幕下载网络错误'),
                ontimeout: () => fail('字幕下载超时')
            });
        },
        downloadCurrent: () => {
            Engine.saveTextAsFile(STATE.rawSubtitleText, STATE.currentSubtitleName || STATE.code || 'subtitle');
        },
        dl: (url, targetEl = null, fileName = '', itemKey = '') => {
            const fail = (msg, err = null) => {
                if (err) console.error('Sub Load Error', err);
                if (targetEl) {
                    targetEl.style.opacity = "1";
                    delete targetEl.dataset.msvLoading;
                    const name = targetEl.querySelector('.msv-subtitle-name');
                    if (name) name.textContent = `❌ ${msg}`;
                    else targetEl.textContent = `❌ ${msg}`;
                }
                UI.toast(`❌ ${msg}`, 2000);
            };
            MsvGM.request({
                method: 'GET', url, responseType: 'arraybuffer', timeout: 20000,
                onload: (r) => {
                    try {
                        if (r.status && (r.status < 200 || r.status >= 400)) {
                            fail(`字幕下载失败(${r.status})`);
                            return;
                        }
                        const subtitleText = Utils.decode(r.response);
                        STATE.subs = Utils.parse(subtitleText);
                        if (!STATE.subs || STATE.subs.length === 0) {
                            fail("字幕文件解析失败或为空");
                            return;
                        }
                        STATE.rawSubtitleText = subtitleText;
                        STATE.currentSubtitleName = fileName || STATE.code || 'subtitle';
                        STATE.currentSubtitleKey = itemKey || url || STATE.currentSubtitleName;
                        const subStatus = STATE.visible ? '✅开启字幕' : '⚠️关闭字幕';
                        const msg = `💝字幕就绪，共 ${STATE.subs.length} 条\n${subStatus}`;
                        UI.toast(msg, 3000);
                        const fab = document.getElementById('msv-fab');
                        if (fab) fab.classList.add('ok');
                        if (targetEl) {
                            targetEl.style.opacity = "1";
                            delete targetEl.dataset.msvLoading;
                        }
                        Engine.refreshSelectedMarks();
                        Renderer.init();
                        // 保持搜索结果列表常驻，方便连续切换字幕；需要回主界面时手动点“返回”。
                    } catch (e) {
                        fail("字幕解析出错", e);
                    }
                },
                onerror: () => fail('字幕下载网络错误'),
                ontimeout: () => fail('字幕下载超时')
            });
        }
    };
    // ======================
    // 渲染核心：DOM Only 硬刚模式，多驱动刷新防止 iOS 影院模式卡住。
    // ======================
    const Renderer = {
        activeVideo: null,
        lastVideoBind: null,
        lastRenderedSecond: -1,
        intervalId: null,
        removeNativeTrack: () => {
            document.querySelectorAll('track[data-msv-native-track="1"]').forEach(track => track.remove());
            document.querySelectorAll('video[data-msv-native-track-key]').forEach(video => delete video.dataset.msvNativeTrackKey);
            if (STATE.nativeTrackUrl) {
                URL.revokeObjectURL(STATE.nativeTrackUrl);
                STATE.nativeTrackUrl = null;
            }
        },
        getActiveVideo: () => {
            const videos = Array.from(document.querySelectorAll('video'));
            if (!videos.length) return null;
            const scoreVideo = (video) => {
                const rect = video.getBoundingClientRect?.() || { width: 0, height: 0 };
                let score = 0;
                if (video.closest?.('.tm-player-container, .tm-video-overlay, .tm-video-wrapper, .tm-video-container')) score += 1000;
                if (!video.paused) score += 200;
                if (video.readyState >= 2) score += 100;
                if (rect.width > 0 && rect.height > 0) score += 50;
                score += Math.min(40, Math.round((rect.width * rect.height) / 10000));
                score += Math.min(20, Math.round((video.currentTime || 0) / 60));
                return score;
            };
            return videos.sort((a, b) => scoreVideo(b) - scoreVideo(a))[0];
        },
        bindVideoEvents: (video) => {
            if (!video || Renderer.lastVideoBind === video) return;
            Renderer.lastVideoBind = video;
            const refresh = () => Renderer.renderNow('video-event');
            ['timeupdate', 'seeking', 'seeked', 'play', 'playing', 'ratechange', 'loadedmetadata', 'durationchange'].forEach(eventName => {
                video.addEventListener(eventName, refresh, { passive: true });
            });
        },
        forceInlineVideo: () => {
            document.querySelectorAll('video').forEach(video => {
                video.setAttribute('playsinline', '');
                video.setAttribute('webkit-playsinline', '');
                video.playsInline = true;
            });
        },
        subtitleHost: () => {
            const fullscreen = document.fullscreenElement || document.webkitFullscreenElement;
            if (fullscreen && fullscreen.nodeType === 1) return fullscreen;
            return document.body;
        },
        placeSubtitle: (host) => {
            const video = Renderer.activeVideo;
            const hostRect = host.getBoundingClientRect();
            const videoRect = video && video.getBoundingClientRect ? video.getBoundingClientRect() : hostRect;
            const width = Math.max(1, videoRect.width || hostRect.width);
            const height = Math.max(1, videoRect.height || hostRect.height);
            const left = videoRect.left - hostRect.left + width * STATE.x / 100;
            const top = videoRect.top - hostRect.top + height * (100 - STATE.bottom) / 100;
            subLayer.style.setProperty('left', left + 'px', 'important');
            subLayer.style.setProperty('top', top + 'px', 'important');
            subLayer.style.setProperty('bottom', 'auto', 'important');
            subLayer.style.setProperty('width', Math.max(160, width * 0.92) + 'px', 'important');
            subLayer.style.setProperty('max-width', Math.max(160, width * 0.92) + 'px', 'important');
            subLayer.style.setProperty('transform', 'translate(-50%, -100%)', 'important');
        },
        forceDomSubtitleLayer: () => {
            Renderer.removeNativeTrack();
            Renderer.forceInlineVideo();
            const host = Renderer.subtitleHost();
            if (host !== document.body && getComputedStyle(host).position === 'static') host.style.position = 'relative';
            if (!subLayer) {
                subLayer = document.querySelector('.msv-subtitle-overlay') || document.createElement('div');
                subLayer.className = 'msv-subtitle-overlay';
            }
            if (subLayer.parentNode !== host) host.appendChild(subLayer);
            subLayer.removeAttribute('hidden');
            subLayer.removeAttribute('data-jp-hidden-by-miss-player');
            subLayer.removeAttribute('data-jp-old-display');
            subLayer.removeAttribute('data-jp-old-visibility');
            subLayer.removeAttribute('data-jp-old-pointer-events');
            subLayer.className = 'msv-subtitle-overlay';
            subLayer.style.setProperty('position', host === document.body ? 'fixed' : 'absolute', 'important');
            Renderer.placeSubtitle(host);
            subLayer.style.setProperty('text-align', 'center', 'important');
            subLayer.style.setProperty('pointer-events', 'none', 'important');
            subLayer.style.setProperty('visibility', STATE.visible ? 'visible' : 'hidden', 'important');
            subLayer.style.setProperty('opacity', STATE.visible ? '1' : '0', 'important');
            subLayer.style.setProperty('display', STATE.visible ? 'block' : 'none', 'important');
            subLayer.style.setProperty('z-index', '2147483647', 'important');
            subLayer.style.setProperty('font-size', STATE.fontSize + 'px', 'important');
            subLayer.style.setProperty('line-height', '1.4', 'important');
            subLayer.style.setProperty('white-space', 'pre-line', 'important');
            subLayer.style.setProperty('color', '#fff', 'important');
            subLayer.style.setProperty('font-weight', '600', 'important');
            subLayer.style.setProperty('text-shadow', '0 1px 2px rgba(0,0,0,0.95), 0 0 8px #000, 0 0 16px #000', 'important');
            subLayer.style.setProperty('contain', 'layout style paint', 'important');
            subLayer.style.setProperty('will-change', 'contents, transform', 'important');
        },
        getCurrentTime: () => {
            Renderer.activeVideo = Renderer.getActiveVideo();
            if (Renderer.activeVideo) {
                Renderer.bindVideoEvents(Renderer.activeVideo);
                return Renderer.activeVideo.currentTime || 0;
            }
            const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            const p = win.player || win.plyr;
            if (p && typeof p.currentTime === 'number') return p.currentTime;
            return 0;
        },
        renderDomSubtitleText: () => {
            if (!STATE.subs.length || !STATE.visible || !subLayer) {
                if (subLayer) subLayer.textContent = '';
                return;
            }
            const currentTime = Renderer.getCurrentTime();
            const now = currentTime - STATE.offset;
            let lo = 0, hi = STATE.subs.length - 1, cue = null;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                if (now < STATE.subs[mid].start) hi = mid - 1;
                else if (now > STATE.subs[mid].end) lo = mid + 1;
                else { cue = STATE.subs[mid]; break; }
            }
            const text = cue ? cue.text : '';
            if (subLayer.textContent !== text) subLayer.textContent = text;
        },
        renderNow: () => {
            if (!STATE.enabled) {
                if (subLayer) subLayer.textContent = '';
                return;
            }
            Renderer.forceDomSubtitleLayer();
            Renderer.renderDomSubtitleText();
        },
        init: () => {
            if (window._msvLoopStarted) return;
            window._msvLoopStarted = true;
            const loop = () => {
                Renderer.renderNow('raf');
                requestAnimationFrame(loop);
            };
            requestAnimationFrame(loop);
            Renderer.intervalId = window.setInterval(() => Renderer.renderNow('interval'), 250);
            document.addEventListener('visibilitychange', () => Renderer.renderNow('visibility'), { passive: true });
            window.addEventListener('resize', () => Renderer.renderNow('resize'), { passive: true });
            window.addEventListener('orientationchange', () => Renderer.renderNow('orientation'), { passive: true });
            document.addEventListener('fullscreenchange', () => Renderer.renderNow('fullscreen'));
            document.addEventListener('webkitfullscreenchange', () => Renderer.renderNow('fullscreen'));
        }
    };
    const UIBuilder = {
        build: () => {
            const d = document.createElement('div');
            STATE.code = Utils.extractCurrentPageCode();
            STATE.hasBuiltInSub = checkBuiltInSub();
            STATE.visible = !STATE.hasBuiltInSub;
            d.innerHTML = `
                <div id="msv-dock">
                    <div id="msv-panel">
                        <div class="msv-head" id="msv-drag-handle" title="拖动控制台">
                            <svg class="msv-grip" viewBox="0 0 18 10" aria-hidden="true"><path fill="currentColor" d="M1 1h16v2H1zm0 6h16v2H1z"/></svg>
                            <span class="msv-head-title">字幕</span>
                            <span class="msv-head-code">${STATE.code || '未识别'}</span>
                        </div>
                        <div class="msv-body">
                            <div id="msv-main-ui" style="display:flex;flex-direction:column;gap:8px">
                                <input id="msv-code" class="msv-input" value="${STATE.code || ''}" aria-label="当前番号">
                                <div class="msv-field">
                                    <div class="msv-label"><span>字号</span><b id="msv-font-val">${STATE.fontSize}</b></div>
                                    <input id="msv-font-range" type="range" min="12" max="60" value="${STATE.fontSize}" class="msv-slider">
                                </div>
                                <div class="msv-field">
                                    <div class="msv-label"><span>垂直</span><b id="msv-p-val">${STATE.bottom}%</b></div>
                                    <input id="msv-pos-range" type="range" min="0" max="100" step="1" value="${STATE.bottom}" class="msv-slider" aria-label="垂直位置">
                                </div>
                                <div class="msv-field">
                                    <div class="msv-label"><span>横向</span><b id="msv-x-val">${STATE.x}%</b></div>
                                    <input id="msv-x-range" type="range" min="0" max="100" step="1" value="${STATE.x}" class="msv-slider" aria-label="横向位置">
                                </div>
                                <div class="msv-mini-row">
                                    <button id="msv-go-main" class="msv-btn-blue">搜索字幕</button>
                                    <label class="msv-switch" title="显示字幕">
                                        <input type="checkbox" id="msv-check-vis" ${STATE.visible?'checked':''}>
                                        <span class="msv-slider-round"></span>
                                    </label>
                                </div>
                                <div id="msv-more-toggle" style="text-align:center;color:rgba(255,255,255,0.42);font-size:11px;cursor:pointer;padding:2px">更多</div>
                                <div id="msv-more-part" style="display:none;flex-direction:column;gap:8px">
                                    <div class="msv-label"><span>时间偏移</span></div>
                                    <div class="msv-mini-row">
                                        <button id="msv-dec-t" class="msv-mini-btn">-0.5</button>
                                        <div id="msv-t-val" class="msv-val-box">${(STATE.offset>=0?'+':'')+STATE.offset.toFixed(1)}s</div>
                                        <button id="msv-inc-t" class="msv-mini-btn">+0.5</button>
                                    </div>
                                    <div class="msv-mini-row">
                                        <button id="msv-local" class="msv-btn-gray">本地字幕</button>
                                        <button id="msv-download-current" class="msv-btn-gray">下载当前</button>
                                    </div>
                                    <button id="msv-hide-fab" class="msv-btn-red">收成小图标</button>
                                </div>
                            </div>
                            <div id="msv-list-ui" style="display:none;flex-direction:column;gap:8px">
                                <div class="msv-mini-row">
                                    <span style="font-size:12px;font-weight:650">选择版本</span>
                                    <button id="msv-back" class="msv-btn-gray" style="flex:none;padding:4px 10px">返回</button>
                                </div>
                                <div id="msv-results" class="msv-list-container"></div>
                            </div>
                        </div>
                    </div>
                    <div id="msv-fab" title="拖动或打开字幕面板">CC</div>
                </div>
                <div id="msv-toast" class="msv-toast"></div>
            `;

            // 挂到 documentElement 而不是 body：站点若给 body 加了 transform/filter，
            // 会让内部 position:fixed 退化成相对 body 定位，iOS 上表现为控件跑到屏幕外。
            const mountTarget = document.documentElement || document.body;
            if (mountTarget) {
                mountTarget.appendChild(d);
            } else {
                document.addEventListener('DOMContentLoaded', () => (document.documentElement || document.body).appendChild(d));
            }

            const panel = document.getElementById('msv-panel');
            const fab = document.getElementById('msv-fab');
            const dock = document.getElementById('msv-dock');
            const dragHandle = document.getElementById('msv-drag-handle');

            let isDragging = false;
            let dragMoved = false;
            let currentX = 0;
            let currentY = 0;
            let initialX = 0;
            let initialY = 0;
            const DOCK_POS_KEY = 'msv-dock-pos-v1';

            // iOS Safari 的 window.innerHeight 会随工具栏收缩变化，也可能比真实可视区更大。
            // 优先用 visualViewport 的尺寸与偏移来夹取悬浮坞位置。
            const viewportSize = () => {
                const vv = window.visualViewport;
                const width = (vv && vv.width) ? vv.width : window.innerWidth;
                const height = (vv && vv.height) ? vv.height : window.innerHeight;
                return { width: Math.max(1, width), height: Math.max(1, height) };
            };
            const clampDock = (x, y) => {
                const w = dock.offsetWidth || 36;
                const h = dock.offsetHeight || 36;
                const vp = viewportSize();
                const maxX = Math.max(8, vp.width - w - 8);
                const maxY = Math.max(8, vp.height - h - 8);
                return {
                    x: Math.min(maxX, Math.max(8, x)),
                    y: Math.min(maxY, Math.max(8, y))
                };
            };
            const placeDock = (x, y, persist) => {
                const next = clampDock(x, y);
                currentX = next.x;
                currentY = next.y;
                dock.style.left = currentX + 'px';
                dock.style.top = currentY + 'px';
                dock.style.right = 'auto';
                dock.style.bottom = 'auto';
                if (persist) {
                    storageSet(DOCK_POS_KEY, JSON.stringify(next));
                }
            };
            // 面板默认贴在悬浮坞上方；iOS 上悬浮坞可能被拖到任意位置，
            // 这里用可视区把面板夹回屏幕内，否则窄屏上会整块溢出到屏幕外。
            // 位移走 transform，避免改 left/top 与 bottom 混用后在 iOS 上跳位。
            // 与 CSS 的 @media (max-width:820px),(pointer:coarse) 保持同一判定，
            // 不用 getComputedStyle 反推（依赖样式解析结果，环境差异下不可靠）。
            const isMobilePanel = () => {
                try {
                    if (window.matchMedia && window.matchMedia('(max-width: 820px), (pointer: coarse)').matches) return true;
                } catch {}
                return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
            };
            const placePanel = () => {
                if (!panel || !panel.classList.contains('show')) return;
                panel.style.transform = '';
                const vp = viewportSize();
                const margin = 8;
                if (isMobilePanel()) {
                    // 窄屏：固定宽度贴底，靠向悬浮坞所在的一侧，避免全宽拉伸
                    const width = Math.min(320, Math.max(240, vp.width - 24));
                    panel.style.width = width + 'px';
                    panel.style.left = 'auto';
                    panel.style.right = 'auto';
                    const dockCenter = currentX + (dock.offsetWidth || 36) / 2;
                    if (dockCenter < vp.width / 2) panel.style.left = margin + 'px';
                    else panel.style.right = margin + 'px';
                    return;
                }
                const rect = panel.getBoundingClientRect();
                let dx = 0;
                let dy = 0;
                if (rect.right > vp.width - margin) dx = (vp.width - margin) - rect.right;
                if (rect.left + dx < margin) dx = margin - rect.left;
                if (rect.top < margin) {
                    // 上方放不下就翻到悬浮坞下方
                    const dockRect = dock.getBoundingClientRect();
                    dy = Math.min((dockRect.bottom + 8) - rect.top, 0);
                } else if (rect.bottom > vp.height - margin) {
                    dy = (vp.height - margin) - rect.bottom;
                }
                if (dx || dy) panel.style.transform = `translate(${Math.round(dx)}px, ${Math.round(dy)}px)`;
            };
            const point = (e) => (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
            const dragStart = (e) => {
                if (e.target.closest('button, input, label, a, .msv-list-item')) return;
                if (e.type === 'mousedown' && e.button) return;
                const p = point(e);
                if (!p) return;
                isDragging = true;
                dragMoved = false;
                initialX = p.clientX - currentX;
                initialY = p.clientY - currentY;
                // 此处不 preventDefault：触屏上会让后续 click/tap 彻底不触发
            };
            const dragMove = (e) => {
                if (!isDragging) return;
                const p = point(e);
                if (!p) return;
                const nextX = p.clientX - initialX;
                const nextY = p.clientY - initialY;
                if (Math.abs(nextX - currentX) + Math.abs(nextY - currentY) > 4) dragMoved = true;
                if (dragMoved && e.cancelable) e.preventDefault();
                placeDock(nextX, nextY, false);
            };
            const dragEnd = () => {
                if (!isDragging) return;
                isDragging = false;
                if (!dragMoved) return;
                placeDock(currentX, currentY, true);
                // 触屏拖动后 click 有可能不触发（touchmove 已 preventDefault），
                // 这里定时复位，避免下一次点按被残留的 dragMoved 吞掉。
                setTimeout(() => { dragMoved = false; }, 400);
            };

            try {
                const savedDock = JSON.parse(storageGet(DOCK_POS_KEY) || 'null');
                if (savedDock && Number.isFinite(savedDock.x) && Number.isFinite(savedDock.y)) {
                    placeDock(savedDock.x, savedDock.y, false);
                } else {
                    const vp = viewportSize();
                    placeDock(vp.width - 64, vp.height - 220, false);
                }
            } catch {
                const vp = viewportSize();
                placeDock(vp.width - 64, vp.height - 220, false);
            }
            const replantDock = () => placeDock(currentX, currentY, false);
            const relayout = () => {
                replantDock();
                placePanel();
            };
            window.addEventListener('resize', relayout, { passive: true });
            window.addEventListener('orientationchange', () => setTimeout(relayout, 120), { passive: true });
            // iOS 地址栏收起/展开时只触发 visualViewport 事件，不一定会触发 window.resize
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', relayout, { passive: true });
                window.visualViewport.addEventListener('scroll', relayout, { passive: true });
            }
            fab.addEventListener('mousedown', dragStart);
            dragHandle.addEventListener('mousedown', dragStart);
            document.addEventListener('mousemove', dragMove);
            document.addEventListener('mouseup', dragEnd);
            fab.addEventListener('touchstart', dragStart, { passive: true });
            dragHandle.addEventListener('touchstart', dragStart, { passive: true });
            document.addEventListener('touchmove', dragMove, { passive: false });
            document.addEventListener('touchend', dragEnd);
            // iOS 页面滚动时浏览器会中止触摸序列，只有 touchcancel；不接会卡在 isDragging
            document.addEventListener('touchcancel', dragEnd);

            const visCheck = document.getElementById('msv-check-vis');
            const pageRoot = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
            const setScriptEnabled = (enabled) => {
                STATE.enabled = Boolean(enabled);
                try { storageSet('msv-script-enabled', STATE.enabled ? '1' : '0'); } catch {}
                if (!STATE.enabled && panel) panel.classList.remove('show');
                if (!STATE.enabled && subLayer) subLayer.textContent = '';
                if (location.hostname.includes('jable')) window.dispatchEvent(new CustomEvent('msv-script-enabled', { detail: STATE.enabled }));
                const dockApi = pageRoot.PageDock || (typeof PageDock !== 'undefined' ? PageDock : null);
                if (dockApi && typeof dockApi.setChecked === 'function') dockApi.setChecked('msv-subtitle', STATE.enabled);
                UI.toast(STATE.enabled ? '字幕脚本已开启' : '字幕脚本已关闭', 800);
                Renderer.renderNow('enabled');
            };
            if (visCheck) visCheck.onchange = () => {
                STATE.visible = visCheck.checked;
                UI.toast(STATE.visible ? '字幕已开启' : '字幕已隐藏', 800);
                Renderer.renderNow('visibility');
            };
            const openPanel = () => {
                dock.classList.remove('is-mini');
                const pageDock = document.getElementById('page-dock');
                if (pageDock && fab.classList.contains('is-docked')) {
                    const rect = pageDock.getBoundingClientRect();
                    placeDock(rect.left, rect.top, false);
                }
                if (!STATE.enabled) return;
                panel.classList.add('show');
                placePanel();
                const dockApi = pageRoot.PageDock || (typeof PageDock !== 'undefined' ? PageDock : null);
                if (dockApi && typeof dockApi.setActive === 'function') dockApi.setActive('msv-subtitle', true);
            };
            const syncDockPanel = (active) => {
                const dockApi = pageRoot.PageDock || (typeof PageDock !== 'undefined' ? PageDock : null);
                if (dockApi && typeof dockApi.setActive === 'function') dockApi.setActive('msv-subtitle', active);
            };
            const closePanel = () => {
                panel.classList.remove('show');
                syncDockPanel(false);
            };
            const setPanelActive = (active) => {
                if (!STATE.enabled) return;
                if (active) openPanel();
                else closePanel();
            };
            const joinPageDock = () => {
                const dockApi = pageRoot.PageDock || (typeof PageDock !== 'undefined' ? PageDock : null);
                if (dockApi && typeof dockApi.mount === 'function') dockApi.mount();
                if (!dockApi || typeof dockApi.register !== 'function' || fab.dataset.msvDocked === '1') return false;
                fab.dataset.msvDocked = '1';
                fab.classList.add('is-docked');
                dockApi.register({
                    id: 'msv-subtitle',
                    label: 'CC',
                    title: '打开或关闭字幕面板',
                    enabled: STATE.enabled,
                    active: panel.classList.contains('show'),
                    onActive: setPanelActive,
                    onToggle: setScriptEnabled,
                    onClick: openPanel
                });
                return true;
            };
            if (!joinPageDock()) {
                let tries = 0;
                const timer = setInterval(() => {
                    if (joinPageDock() || ++tries > 20) clearInterval(timer);
                }, 250);
            }
            if (fab) fab.onclick = (e) => {
                if (dragMoved) {
                    dragMoved = false;
                    e.stopPropagation();
                    return;
                }
                dock.classList.remove('is-mini');
                const open = !panel.classList.contains('show');
                panel.classList.toggle('show', open);
                if (open) placePanel();
                syncDockPanel(open);
                e.stopPropagation();
            };

            const moreToggle = document.getElementById('msv-more-toggle');
            if (moreToggle) moreToggle.onclick = function() {
                const more = document.getElementById('msv-more-part');
                const isOpen = more.style.display === 'flex';
                more.style.display = isOpen ? 'none' : 'flex';
                this.textContent = isOpen ? '更多' : '收起';
            };
            const hideBtn = document.getElementById('msv-hide-fab');
            if (hideBtn) hideBtn.onclick = () => {
                closePanel();
                dock.classList.add('is-mini');
            };
            const backBtn = document.getElementById('msv-back');
            if (backBtn) backBtn.onclick = () => UI.switchView(false);
            const tVal = document.getElementById('msv-t-val');
            const decT = document.getElementById('msv-dec-t');
            const incT = document.getElementById('msv-inc-t');
            if(decT) decT.onclick = () => { STATE.offset -= 0.5; tVal.textContent = (STATE.offset>=0?'+':'')+STATE.offset.toFixed(1)+'s'; };
            if(incT) incT.onclick = () => { STATE.offset += 0.5; tVal.textContent = (STATE.offset>=0?'+':'')+STATE.offset.toFixed(1)+'s'; };
            // 滑杆轨道用 CSS 变量画已填充段，值变化时必须同步，否则轨道一直是初始比例。
            const syncSliderFill = (input) => {
                if (!input) return;
                const min = Number(input.min) || 0;
                const max = Number(input.max) || 100;
                const value = Number(input.value);
                const span = max - min;
                const percent = span > 0 ? ((value - min) / span) * 100 : 0;
                input.style.setProperty('--msv-fill', `${Math.min(100, Math.max(0, percent)).toFixed(2)}%`);
            };
            const pVal = document.getElementById('msv-p-val');
            const posRange = document.getElementById('msv-pos-range');
            if(posRange) {
                posRange.oninput = function() {
                    STATE.bottom = Number(this.value);
                    if (pVal) pVal.textContent = STATE.bottom + '%';
                    syncSliderFill(this);
                    saveView();
                    Renderer.renderNow('position');
                };
                // change 兜底：部分触屏环境拖动结束后才派发 change，input 可能被手势吞掉
                posRange.onchange = posRange.oninput;
            }
            const xVal = document.getElementById('msv-x-val');
            const xRange = document.getElementById('msv-x-range');
            if(xRange) {
                xRange.oninput = function() {
                    STATE.x = Number(this.value);
                    if (xVal) xVal.textContent = STATE.x + '%';
                    syncSliderFill(this);
                    saveView();
                    Renderer.renderNow('position-x');
                };
                xRange.onchange = xRange.oninput;
            }
            const fontRange = document.getElementById('msv-font-range');
            if(fontRange) {
                fontRange.oninput = function() {
                    STATE.fontSize = Number(this.value);
                    const fontVal = document.getElementById('msv-font-val');
                    if (fontVal) fontVal.textContent = STATE.fontSize;
                    syncSliderFill(this);
                    saveView();
                    Renderer.renderNow('font');
                };
                fontRange.onchange = fontRange.oninput;
            }
            // 初始比例（含从存储恢复的值）
            [posRange, xRange, fontRange].forEach(syncSliderFill);
            const goMain = document.getElementById('msv-go-main');
            if(goMain) goMain.onclick = () => Engine.search(document.getElementById('msv-code').value.trim(), false);
            const downloadCurrentBtn = document.getElementById('msv-download-current');
            if(downloadCurrentBtn) downloadCurrentBtn.onclick = () => Engine.downloadCurrent();

            const localBtn = document.getElementById('msv-local');
            if(localBtn) localBtn.onclick = () => {
                const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.srt';
                inp.onchange = (e) => {
                    const f = e.target.files[0];
                    if(!f) return;
                    f.arrayBuffer().then(b => {
                        const subtitleText = Utils.decode(b);
                        STATE.subs = Utils.parse(subtitleText);
                        STATE.rawSubtitleText = subtitleText;
                        STATE.currentSubtitleName = f.name || STATE.code || 'subtitle';
                        STATE.currentSubtitleKey = `local:${STATE.currentSubtitleName}`;
                        Engine.refreshSelectedMarks();
                        const msg = `💝字幕就绪，共 ${STATE.subs.length} 条\n${STATE.visible ? '✅开启字幕' : '⚠️关闭字幕'}`;
                        UI.toast(msg, 3000);
                        if (fab) fab.classList.add('ok');
                        Renderer.init();
                        closePanel();
                    });
                };
                inp.click();
            };
            document.addEventListener('click', (e) => {
                if (panel && !dock.contains(e.target)) closePanel();
            });
            if (STATE.enabled && CONFIG.autoSearch && STATE.code) setTimeout(() => {
                STATE.hasBuiltInSub = checkBuiltInSub();
                if (STATE.hasBuiltInSub) {
                    STATE.visible = false;
                    const check = document.getElementById('msv-check-vis');
                    if (check) check.checked = false;
                    Engine.clearLoadedSubs();
                    return;
                }
                Engine.search(STATE.code, true);
            }, 1500);
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', UIBuilder.build);
    } else {
        UIBuilder.build();
        const JableTimeJump = (() => {
        const COMMENT_BLOCK_ID = 'video_comments_video_comments';
        const MAX_AUTO_COMMENTS = 100;
        const COMMENT_PAGE_SIZE = 5;
        const LINK_CLASS = 'jable-comment-time-link';
        const STYLE_ID = 'jable-comment-time-style';
        const TOAST_ID = 'jable-comment-time-toast';
        const SIDEBAR_ID = 'jable-comment-time-sidebar';
        const RAIL_ID = 'jable-comment-time-rail';
        const SIDEBAR_VIEWPORT_MARGIN = 8;
        const DRAG_START_THRESHOLD = 3;
        const CLOSE_BUTTON_VISIBLE_MS = 5000;

        // 触屏判定：移动端不适合「贴视频左侧 128px 竖排 + 小标题拖动 + hover 高亮」这套 PC 交互，
        // 改成底部横向面板，点条目即跳转。
        const isTouchLayout = () => {
          try {
            if (window.matchMedia && window.matchMedia('(max-width: 820px), (pointer: coarse)').matches) return true;
          } catch {}
          return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
        };

        // 单个时间
        const TIME_PATTERN = /([\-−－]?\d{1,3})\s*[:：]\s*(\d{1,2})(?:\s*[:：]\s*(\d{1,2}))?/g;
        // 区间：A ~ B / A ↝ B / A → B / A - B / A 到 B 等
        const RANGE_SEP = String.raw`[~～〜↝→\-–—到至]`;
        const RANGE_PATTERN = new RegExp(
          `([\\-−－]?\\d{1,3}\\s*[:：]\\s*\\d{1,2}(?:\\s*[:：]\\s*\\d{1,2})?)\\s*${RANGE_SEP}\\s*([\\-−－]?\\d{1,3}\\s*[:：]\\s*\\d{1,2}(?:\\s*[:：]\\s*\\d{1,2})?)`,
          'g'
        );

        let toastTimer = null;
        let refreshTimer = null;
        let isAutoLoadingComments = false;
        let selectedTimePoint = '';
        let sidebarManualPosition = null;
        let sidebarCloseTimer = null;
        let sidebarCloseVisibleUntil = 0;
        let timeEnabled = false;

        function injectStyle() {
          if (document.getElementById(STYLE_ID)) return;
          const style = document.createElement('style');
          style.id = STYLE_ID;
          style.textContent = `
            .${LINK_CLASS} {
              color: #0a84ff !important;
              cursor: pointer;
              font-weight: 800;
              text-decoration: none;
              border-radius: 5px;
              padding: 0 2px;
            }
            .${LINK_CLASS}:hover {
              color: #5ac8fa !important;
              background: rgba(10, 132, 255, .14);
            }
            #${SIDEBAR_ID} {
              position: fixed;
              z-index: 999998;
              width: 128px;
              max-height: 440px;
              padding: 9px 8px;
              border: 0;
              background: transparent;
              box-shadow: none;
              box-sizing: border-box;
              overflow: hidden;
            }
            #${SIDEBAR_ID} .jcts-title {
              margin-bottom: 7px;
              color: rgba(255,255,255,.72);
              cursor: grab;
              font-size: 11px;
              font-weight: 800;
              text-align: center;
              touch-action: none;
              user-select: none;
              -webkit-user-select: none;
            }
            #${SIDEBAR_ID}.jcts-dragging .jcts-title {
              cursor: grabbing;
            }
            #${SIDEBAR_ID} .jcts-close {
              position: absolute;
              top: 1px;
              left: 1px;
              z-index: 2;
              display: flex;
              width: 20px;
              height: 20px;
              padding: 0;
              align-items: center;
              justify-content: center;
              border: 0;
              border-radius: 50%;
              background: rgba(15, 23, 42, .78);
              color: #fff;
              cursor: pointer;
              font-size: 15px;
              font-weight: 800;
              line-height: 1;
              opacity: 0;
              pointer-events: none;
              transform: scale(.8);
              transition: opacity .15s ease, transform .15s ease;
            }
            #${SIDEBAR_ID} .jcts-close.jcts-visible {
              opacity: 1;
              pointer-events: auto;
              transform: scale(1);
            }
            #${SIDEBAR_ID} .jcts-close:hover {
              background: #ff453a;
            }
            #${SIDEBAR_ID} .jcts-list {
              display: flex;
              flex-direction: column;
              gap: 5px;
              max-height: 398px;
              overflow-y: auto;
              scrollbar-width: thin;
            }
            #${SIDEBAR_ID} .jcts-list::-webkit-scrollbar {
              width: 4px;
            }
            #${SIDEBAR_ID} .jcts-list::-webkit-scrollbar-thumb {
              border-radius: 999px;
              background: rgba(255,255,255,.22);
            }
            #${SIDEBAR_ID} .jcts-item {
              width: 100%;
              min-height: 26px;
              padding: 0 4px;
              border: 0;
              border-radius: 999px;
              background: transparent;
              color: #0a84ff;
              cursor: pointer;
              font-size: 11px;
              font-weight: 900;
              text-align: center;
              white-space: nowrap;
              transition: background .16s ease, color .16s ease, transform .12s ease, box-shadow .16s ease;
            }
            #${SIDEBAR_ID} .jcts-item.jcts-range {
              font-size: 10px;
              color: #30d158;
            }
            #${SIDEBAR_ID} .jcts-item:hover {
              background: rgba(10, 132, 255, .14);
              color: #0a84ff;
            }
            #${SIDEBAR_ID} .jcts-item.jcts-range:hover {
              background: rgba(48, 209, 88, .18);
              color: #30d158;
            }
            #${SIDEBAR_ID} .jcts-item.jcts-selected,
            #${SIDEBAR_ID} .jcts-item.jcts-selected:hover {
              background: #0a84ff;
              color: #fff;
              box-shadow: 0 6px 16px rgba(10,132,255,.28);
            }
            #${SIDEBAR_ID} .jcts-item.jcts-range.jcts-selected,
            #${SIDEBAR_ID} .jcts-item.jcts-range.jcts-selected:hover {
              background: #30d158;
              color: #fff;
              box-shadow: 0 6px 16px rgba(48,209,88,.28);
            }
            #${SIDEBAR_ID} .jcts-item:active {
              transform: scale(.95);
            }
            #${TOAST_ID} {
              position: fixed;
              left: 50%;
              bottom: 88px;
              z-index: 999999;
              padding: 8px 13px;
              border-radius: 999px;
              background: rgba(15, 23, 42, .86);
              color: #fff;
              box-shadow: 0 10px 28px rgba(0,0,0,.28);
              font-size: 13px;
              font-weight: 700;
              opacity: 0;
              pointer-events: none;
              transform: translate(-50%, 8px) scale(.96);
              transition: opacity .26s ease, transform .26s ease;
            }
            #${TOAST_ID}.show {
              opacity: 1;
              transform: translate(-50%, 0) scale(1);
            }
            #${RAIL_ID} {
              position: absolute; top: 50%; right: 0; width: 64px; max-height: 70%; z-index: 40;
              display: none; overflow-y: auto; pointer-events: auto; transform: translateY(-50%);
            }
            .plyr:-webkit-full-screen #${RAIL_ID}, .plyr:fullscreen #${RAIL_ID} { display: block; }
            #${RAIL_ID} .jcts-mark, #${RAIL_ID} .jcts-span {
              position: relative; display: block; width: 100%; height: 16px; margin-left: auto; border: 0; padding: 0;
              pointer-events: auto; cursor: pointer; background: transparent;
            }
            #${RAIL_ID} .jcts-mark::before, #${RAIL_ID} .jcts-span::before {
              content: ""; position: absolute; right: 0; top: 5px; width: 18px; height: 2px; background: rgba(255,255,255,.72);
            }
            #${RAIL_ID} .jcts-span::before { width: 28px; background: rgba(255,255,255,.9); }
            #${RAIL_ID} .jcts-mark:hover::before, #${RAIL_ID} .jcts-span:hover::before,
            #${RAIL_ID} .jcts-selected::before { width: 36px; background: #fff; }
            /* ── 移动端时间面板：底部横向滚动条，替代贴视频左侧的 128px 竖栏 ── */
            #${SIDEBAR_ID}.jcts-touch {
              left: 8px !important;
              right: 8px;
              width: auto !important;
              max-height: none !important;
              top: auto !important;
              bottom: calc(6px + env(safe-area-inset-bottom, 0px)) !important;
              padding: 6px 8px calc(6px + env(safe-area-inset-bottom, 0px));
              border-radius: 12px;
              background: rgba(15, 23, 42, .82);
              -webkit-backdrop-filter: blur(12px);
              backdrop-filter: blur(12px);
              box-shadow: 0 8px 22px rgba(0,0,0,.38);
              z-index: 2147483645;
            }
            #${SIDEBAR_ID}.jcts-touch .jcts-title {
              display: flex;
              align-items: center;
              gap: 6px;
              margin: 0 0 4px;
              font-size: 10.5px;
              line-height: 1.2;
              cursor: default;
              touch-action: auto;
              text-align: left;
              color: rgba(255,255,255,.62);
            }
            #${SIDEBAR_ID}.jcts-touch .jcts-list {
              flex-direction: row;
              gap: 5px;
              max-height: none;
              overflow-x: auto;
              overflow-y: hidden;
              -webkit-overflow-scrolling: touch;
              overscroll-behavior-x: contain;
              scrollbar-width: none;
              padding-bottom: 1px;
            }
            #${SIDEBAR_ID}.jcts-touch .jcts-list::-webkit-scrollbar { display: none; }
            #${SIDEBAR_ID}.jcts-touch .jcts-item {
              /* 36px 高：仍高于 iOS 最小点按区下限，但比首版 40px 收一档 */
              flex: 0 0 auto;
              width: auto;
              min-width: 50px;
              min-height: 36px;
              padding: 0 11px;
              font-size: 12.5px;
              border-radius: 9px;
              background: rgba(255,255,255,.08);
              color: rgba(255,255,255,.92);
              -webkit-tap-highlight-color: transparent;
            }
            #${SIDEBAR_ID}.jcts-touch .jcts-item.jcts-range {
              font-size: 11.5px;
              color: #30d158;
            }
            #${SIDEBAR_ID}.jcts-touch .jcts-item.jcts-selected,
            #${SIDEBAR_ID}.jcts-touch .jcts-item.jcts-range.jcts-selected {
              background: #0a84ff;
              color: #fff;
              box-shadow: none;
            }
            #${SIDEBAR_ID}.jcts-touch .jcts-item.jcts-range.jcts-selected {
              background: #30d158;
            }
            #${SIDEBAR_ID}.jcts-touch .jcts-close {
              /* 触屏常显，不再靠 pointerdown 才浮现 */
              position: static;
              opacity: 1;
              pointer-events: auto;
              transform: none;
              margin-left: auto;
              width: 22px;
              height: 22px;
              flex: none;
              font-size: 14px;
            }
            /* 移动端右侧刻度：热区比桌面大，但整体比首版收一档 */
            #${RAIL_ID}.jcts-touch {
              width: 66px;
              max-height: 52%;
              -webkit-overflow-scrolling: touch;
              overscroll-behavior-y: contain;
            }
            #${RAIL_ID}.jcts-touch .jcts-mark,
            #${RAIL_ID}.jcts-touch .jcts-span {
              height: 22px;
            }
            #${RAIL_ID}.jcts-touch .jcts-mark::before,
            #${RAIL_ID}.jcts-touch .jcts-span::before {
              top: 8px;
              width: 24px;
              height: 3px;
            }
            #${RAIL_ID}.jcts-touch .jcts-span::before { width: 34px; }
            #${RAIL_ID}.jcts-touch .jcts-selected::before { width: 42px; }
          `;
          document.head.appendChild(style);
        }

        function showToast(message) {
          let toast = document.getElementById(TOAST_ID);
          if (!toast) {
            toast = document.createElement('div');
            toast.id = TOAST_ID;
            document.body.appendChild(toast);
          }
          if (toastTimer) clearTimeout(toastTimer);
          toast.textContent = message;
          toast.classList.add('show');
          toastTimer = setTimeout(() => {
            toast.classList.remove('show');
          }, 2000);
        }

        function normalizeRawTime(rawText) {
          return String(rawText || '')
            .replace(/[−－]/g, '-')
            .replace(/[：]/g, ':')
            .replace(/\s+/g, '');
        }

        function parseTimeToSeconds(rawText) {
          const normalized = normalizeRawTime(rawText);
          const isNegative = normalized.startsWith('-');
          const cleanText = normalized.replace(/^-/, '');
          const parts = cleanText.split(':').map(Number);
          if (parts.some((item) => !Number.isFinite(item))) return null;
          if (parts.length === 2) {
            return { isNegative, seconds: parts[0] * 60 + parts[1] };
          }
          if (parts.length === 3) {
            return { isNegative, seconds: parts[0] * 3600 + parts[1] * 60 + parts[2] };
          }
          return null;
        }

        function getVideoDuration() {
          const video = getVideo();
          if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return null;
          return video.duration;
        }

        function getTimePointVariants(rawText) {
          const normalized = normalizeRawTime(rawText);
          const points = [];
          const match = normalized.match(/^([12]):(\d{1,2})$/);

          if (!match) {
            const sec = parseTimeToSeconds(normalized)?.seconds ?? 0;
            points.push({
              normalized,
              raw: rawText,
              display: normalized,
              title: '点击跳转到这个时间并播放',
              seconds: sec,
              isRange: false
            });
            return points;
          }

          const firstPart = Number(match[1]);
          const secondPart = Number(match[2]);
          if (secondPart > 59) {
            const sec = parseTimeToSeconds(normalized)?.seconds ?? 0;
            points.push({
              normalized,
              raw: rawText,
              display: normalized,
              title: '点击跳转到这个时间并播放',
              seconds: sec,
              isRange: false
            });
            return points;
          }

          const paddedFirst = String(firstPart).padStart(2, '0');
          const paddedSecond = String(secondPart).padStart(2, '0');
          const minuteSecond = `00:${paddedFirst}:${paddedSecond}`;
          const hourMinute = `${paddedFirst}:${paddedSecond}:00`;
          const msSec = firstPart * 60 + secondPart;
          const hmSec = firstPart * 3600 + secondPart * 60;
          const duration = getVideoDuration();

          let preferHour = false;
          if (duration != null) {
            if (hmSec < duration - 1 && (msSec < 180 || duration > 3600)) {
              preferHour = true;
            }
          }

          if (preferHour) {
            points.push({
              normalized: hourMinute,
              raw: hourMinute,
              display: hourMinute,
              title: `${hourMinute}（按时:分解析）`,
              seconds: hmSec,
              isRange: false
            });
            points.push({
              normalized: minuteSecond,
              raw: minuteSecond,
              display: minuteSecond,
              title: `${minuteSecond}（按分:秒解析）`,
              seconds: msSec,
              isRange: false
            });
          } else {
            points.push({
              normalized: minuteSecond,
              raw: minuteSecond,
              display: minuteSecond,
              title: `${minuteSecond}（按分:秒解析）`,
              seconds: msSec,
              isRange: false
            });
            points.push({
              normalized: hourMinute,
              raw: hourMinute,
              display: hourMinute,
              title: `${hourMinute}（按时:分解析）`,
              seconds: hmSec,
              isRange: false
            });
          }
          return points;
        }

        function getVideo() {
          return document.querySelector('video');
        }

        function getVideoBox() {
          const video = getVideo();
          if (!video) return null;
          return video.closest('.plyr, .video-js, .jwplayer, .dplayer, .embed-responsive, .video-player, .player, .container')
            || video.parentElement
            || video;
        }

        function clamp(value, min, max) {
          return Math.min(Math.max(value, min), max);
        }

        async function waitForVideoMetadata(video) {
          if (Number.isFinite(video.duration) && video.duration > 0) return;
          await new Promise((resolve) => {
            const timer = setTimeout(resolve, 3000);
            video.addEventListener('loadedmetadata', () => {
              clearTimeout(timer);
              resolve();
            }, { once: true });
          });
        }

        function currentRailPoint() {
          const video = getVideo();
          const rail = document.getElementById(RAIL_ID);
          if (!video || !rail) return '';
          const marks = Array.from(rail.querySelectorAll('.jcts-mark, .jcts-span'));
          let current = '';
          marks.forEach((mark) => {
            const start = Number(mark.dataset.seconds);
            const end = Number(mark.dataset.endSeconds || mark.dataset.seconds);
            if (video.currentTime + 0.25 >= start && video.currentTime < end) current = mark.dataset.normalizedTime;
          });
          return current;
        }
        function updateSelectedSidebarItem() {
          const active = currentRailPoint() || selectedTimePoint;
          document.querySelectorAll(`#${RAIL_ID} .jcts-mark, #${RAIL_ID} .jcts-span`).forEach((mark) => {
            mark.classList.toggle('jcts-selected', mark.dataset.normalizedTime === active);
          });
          document.querySelectorAll(`#${SIDEBAR_ID} .jcts-item`).forEach((button) => {
            button.classList.toggle(
              'jcts-selected',
              button.dataset.normalizedTime === selectedTimePoint
            );
          });
        }

        async function jumpToTime(rawText) {
          const video = getVideo();
          if (!video) {
            showToast('没有找到视频');
            return;
          }

          const variants = getTimePointVariants(rawText);
          let chosen = variants[0];
          if (variants.length > 1) {
            const duration = getVideoDuration();
            if (duration != null) {
              const valid = variants.filter(v => v.seconds < duration - 0.5);
              if (valid.length) {
                chosen = valid.sort((a, b) => b.seconds - a.seconds)[0];
              }
            }
          }

          const parsed = parseTimeToSeconds(chosen.raw);
          if (!parsed) {
            showToast('时间格式不正确');
            return;
          }

          selectedTimePoint = chosen.normalized;
          updateSelectedSidebarItem();

          await waitForVideoMetadata(video);
          if (!Number.isFinite(video.duration) || video.duration <= 0) {
            showToast('视频时长还没加载');
            return;
          }

          const targetTime = parsed.isNegative
            ? video.duration - parsed.seconds
            : parsed.seconds;
          video.currentTime = clamp(targetTime, 0, Math.max(0, video.duration - 0.2));

          try {
            await video.play();
          } catch {}
          showToast(`已跳转 ${chosen.display}`);
        }

        function shouldSkipTextNode(textNode) {
          const parent = textNode.parentElement;
          if (!parent) return true;
          return Boolean(parent.closest([
            'script', 'style', 'textarea', 'input', 'video', 'audio', 'button', 'a',
            `.${LINK_CLASS}`, `#${SIDEBAR_ID}`,
            '.plyr', '.video-js', '.jwplayer', '.dplayer', '.vjs-control-bar'
          ].join(',')));
        }

        function linkifyTextNode(textNode) {
          if (shouldSkipTextNode(textNode)) return;
          const text = textNode.nodeValue;
          if (!text) return;

          TIME_PATTERN.lastIndex = 0;
          if (!TIME_PATTERN.test(text)) {
            TIME_PATTERN.lastIndex = 0;
            return;
          }
          TIME_PATTERN.lastIndex = 0;

          const fragment = document.createDocumentFragment();
          let lastIndex = 0;
          let match;
          while ((match = TIME_PATTERN.exec(text)) !== null) {
            const raw = match[0];
            const start = match.index;
            const end = start + raw.length;
            if (start > lastIndex) {
              fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
            }
            const link = document.createElement('span');
            link.className = LINK_CLASS;
            link.textContent = raw;
            const variants = getTimePointVariants(raw);
            link.title = variants.length > 1
              ? '点击优先跳合理时间；侧边栏可选手动切换'
              : '点击跳转到这个时间并播放';
            link.dataset.rawTime = raw;
            link.dataset.normalizedTime = normalizeRawTime(raw);
            link.addEventListener('click', (event) => {
              event.preventDefault();
              event.stopPropagation();
              jumpToTime(raw);
            });
            fragment.appendChild(link);
            lastIndex = end;
          }
          if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
          }
          textNode.parentNode.replaceChild(fragment, textNode);
        }

        function scanNode(root) {
          const walker = document.createTreeWalker(
            root,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode(node) {
                if (shouldSkipTextNode(node)) return NodeFilter.FILTER_REJECT;
                TIME_PATTERN.lastIndex = 0;
                return TIME_PATTERN.test(node.nodeValue || '')
                  ? NodeFilter.FILTER_ACCEPT
                  : NodeFilter.FILTER_REJECT;
              }
            }
          );
          const nodes = [];
          let node;
          while ((node = walker.nextNode())) {
            nodes.push(node);
          }
          nodes.forEach(linkifyTextNode);
        }

        /** 从评论原文中提取区间（A~B） */
        function collectRangesFromText(text) {
          const ranges = [];
          RANGE_PATTERN.lastIndex = 0;
          let match;
          while ((match = RANGE_PATTERN.exec(text)) !== null) {
            const startRaw = match[1];
            const endRaw = match[2];
            const startNorm = normalizeRawTime(startRaw);
            const endNorm = normalizeRawTime(endRaw);
            const startSec = parseTimeToSeconds(startNorm)?.seconds ?? 0;
            const endSec = parseTimeToSeconds(endNorm)?.seconds ?? 0;
            // 用起点作为排序键，显示完整区间
            const display = `${startNorm}~${endNorm}`;
            const key = `range:${startNorm}~${endNorm}`;
            ranges.push({
              normalized: key,
              raw: startRaw,          // 跳转用起点
              display,
              title: `区间 ${display}（点击跳到起点）`,
              seconds: Math.min(startSec, endSec),
              endSeconds: Math.max(startSec, endSec),
              isRange: true
            });
          }
          return ranges;
        }

        function collectTimePoints() {
          const uniqueMap = new Map();

          // 1. 单个时间点（来自已 linkify 的 span）
          const links = Array.from(document.querySelectorAll(`.${LINK_CLASS}`))
            .filter((link) => !link.closest(`#${SIDEBAR_ID}`));
          for (const link of links) {
            const raw = link.dataset.rawTime || link.textContent || '';
            for (const point of getTimePointVariants(raw)) {
              if (!point.normalized || uniqueMap.has(point.normalized)) continue;
              uniqueMap.set(point.normalized, point);
            }
          }

          // 2. 区间（从评论块原文扫描，避免被 linkify 拆散后丢失）
          const commentBlock = document.getElementById(COMMENT_BLOCK_ID) || document.body;
          const commentTexts = [];
          // 收集所有评论文本（尽量还原）
          commentBlock.querySelectorAll('.comment, .comments-item, .item, .row, [class*="comment"]').forEach(el => {
            commentTexts.push(el.innerText || el.textContent || '');
          });
          // 兜底：整块
          if (commentTexts.length === 0) {
            commentTexts.push(commentBlock.innerText || '');
          }

          for (const text of commentTexts) {
            for (const range of collectRangesFromText(text)) {
              if (!uniqueMap.has(range.normalized)) {
                uniqueMap.set(range.normalized, range);
              }
            }
          }

          // 按真实秒数排序（区间按起点）
          return Array.from(uniqueMap.values()).sort((a, b) => a.seconds - b.seconds);
        }

        function renderProgressMarks(points) {
          const old = document.getElementById(RAIL_ID);
          if (!timeEnabled) {
            if (old) old.remove();
            return;
          }
          const video = getVideo();
          const duration = getVideoDuration();
          const player = video && video.closest('.plyr');
          if (!video || !duration || !player) {
            if (old) old.remove();
            return;
          }
          if (getComputedStyle(player).position === 'static') player.style.position = 'relative';
          let rail = old;
          if (!rail) {
            rail = document.createElement('div');
            rail.id = RAIL_ID;
          }
          if (rail.parentNode !== player) player.appendChild(rail);
          rail.classList.toggle('jcts-touch', isTouchLayout());
          if (!rail.dataset.bound) {
            rail.dataset.bound = '1';
            const stop = (event) => {
              event.preventDefault();
              event.stopPropagation();
            };
            ['pointerdown', 'pointerup', 'click', 'mousedown', 'mouseup'].forEach((name) => rail.addEventListener(name, stop));
          }
          const signature = points.map((point) => point.normalized).join('|');
          if (rail.dataset.signature === signature) return;
          rail.dataset.signature = signature;
          rail.replaceChildren();
          points.forEach((point) => {
            const mark = document.createElement('button');
            mark.type = 'button';
            mark.className = point.isRange ? 'jcts-span' : 'jcts-mark';
            mark.title = point.display || point.normalized;
            mark.dataset.normalizedTime = point.normalized;
            mark.dataset.seconds = String(point.seconds || 0);
            mark.dataset.endSeconds = String(point.isRange ? (point.endSeconds || point.seconds || 0) : (point.seconds || 0) + 1);
            mark.addEventListener('click', (event) => {
              event.preventDefault();
              event.stopPropagation();
              jumpToTime(point.raw);
            });
            rail.appendChild(mark);
          });
        }

        function clampSidebarPosition(sidebar, left, top) {
          const width = sidebar.offsetWidth || 128;
          const height = sidebar.offsetHeight || 0;
          // 用 visualViewport 而不是 innerHeight：iOS 工具栏收缩后 innerHeight 偏大，
          // 会把面板夹到屏幕外。
          const vv = window.visualViewport;
          const vpWidth = (vv && vv.width) ? vv.width : window.innerWidth;
          const vpHeight = (vv && vv.height) ? vv.height : window.innerHeight;
          const maxLeft = Math.max(SIDEBAR_VIEWPORT_MARGIN, vpWidth - width - SIDEBAR_VIEWPORT_MARGIN);
          const maxTop = Math.max(SIDEBAR_VIEWPORT_MARGIN, vpHeight - height - SIDEBAR_VIEWPORT_MARGIN);
          return {
            left: clamp(left, SIDEBAR_VIEWPORT_MARGIN, maxLeft),
            top: clamp(top, SIDEBAR_VIEWPORT_MARGIN, maxTop)
          };
        }

        function applySidebarPosition(sidebar, position) {
          sidebar.style.left = `${position.left}px`;
          sidebar.style.top = `${position.top}px`;
        }

        function positionSidebar(sidebar) {
          if (sidebar.classList.contains('jcts-touch')) {
            // 移动端：由 CSS 固定在底部横条，不跟随视频矩形，也不接受手动拖动
            sidebar.style.left = '';
            sidebar.style.top = '';
            return;
          }
          if (sidebarManualPosition) {
            sidebarManualPosition = clampSidebarPosition(
              sidebar,
              sidebarManualPosition.left,
              sidebarManualPosition.top
            );
            applySidebarPosition(sidebar, sidebarManualPosition);
            return;
          }
          const videoBox = getVideoBox();
          if (!videoBox) return;
          const rect = videoBox.getBoundingClientRect();
          const width = sidebar.offsetWidth || 128;
          const gap = 14;
          sidebar.style.left = `${Math.max(8, rect.left - width - gap)}px`;
          sidebar.style.top = `${Math.max(72, rect.top + 12)}px`;
        }

        function bindSidebarDragging(sidebar, title) {
          // 触屏走底部固定面板，不需要拖动；标题拖动反而会抢走横向滚动的手势
          if (sidebar.classList.contains('jcts-touch')) return;
          let dragState = null;
          function stopDragging(event) {
            if (!dragState || event.pointerId !== dragState.pointerId) return;
            if (title.hasPointerCapture?.(dragState.pointerId)) {
              title.releasePointerCapture(dragState.pointerId);
            }
            dragState = null;
            sidebar.classList.remove('jcts-dragging');
          }
          title.addEventListener('pointerdown', (event) => {
            if (event.isPrimary === false) return;
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            const rect = sidebar.getBoundingClientRect();
            dragState = {
              pointerId: event.pointerId,
              startClientX: event.clientX,
              startClientY: event.clientY,
              startLeft: rect.left,
              startTop: rect.top,
              hasMoved: false
            };
            title.setPointerCapture?.(event.pointerId);
            sidebar.classList.add('jcts-dragging');
            event.preventDefault();
          });
          title.addEventListener('pointermove', (event) => {
            if (!dragState || event.pointerId !== dragState.pointerId) return;
            const deltaX = event.clientX - dragState.startClientX;
            const deltaY = event.clientY - dragState.startClientY;
            if (!dragState.hasMoved && Math.hypot(deltaX, deltaY) < DRAG_START_THRESHOLD) return;
            dragState.hasMoved = true;
            sidebarManualPosition = clampSidebarPosition(
              sidebar,
              dragState.startLeft + deltaX,
              dragState.startTop + deltaY
            );
            applySidebarPosition(sidebar, sidebarManualPosition);
            event.preventDefault();
          });
          title.addEventListener('pointerup', stopDragging);
          title.addEventListener('pointercancel', stopDragging);
          title.addEventListener('lostpointercapture', () => {
            dragState = null;
            sidebar.classList.remove('jcts-dragging');
          });
        }

        function showSidebarCloseButton(sidebar, resetTimer = true) {
          const closeButton = sidebar.querySelector('.jcts-close');
          if (!closeButton) return;
          if (sidebarCloseTimer) clearTimeout(sidebarCloseTimer);
          if (resetTimer) {
            sidebarCloseVisibleUntil = Date.now() + CLOSE_BUTTON_VISIBLE_MS;
          }
          const remainingTime = sidebarCloseVisibleUntil - Date.now();
          if (remainingTime <= 0) {
            closeButton.classList.remove('jcts-visible');
            sidebarCloseVisibleUntil = 0;
            sidebarCloseTimer = null;
            return;
          }
          closeButton.classList.add('jcts-visible');
          sidebarCloseTimer = setTimeout(() => {
            closeButton.classList.remove('jcts-visible');
            sidebarCloseVisibleUntil = 0;
            sidebarCloseTimer = null;
          }, remainingTime);
        }

        function createSidebarCloseButton(sidebar) {
          const closeButton = document.createElement('button');
          closeButton.type = 'button';
          closeButton.className = 'jcts-close';
          closeButton.textContent = '×';
          closeButton.title = '关闭时间列表';
          closeButton.setAttribute('aria-label', '关闭时间列表');
          closeButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (sidebarCloseTimer) {
              clearTimeout(sidebarCloseTimer);
              sidebarCloseTimer = null;
            }
            sidebarCloseVisibleUntil = 0;
            timeEnabled = false;
            sidebar.remove();
          });
          sidebar.appendChild(closeButton);
        }

        function renderSidebar() {
          const points = collectTimePoints();
          renderProgressMarks(points);
          let sidebar = document.getElementById(SIDEBAR_ID);
          if (!timeEnabled) {
            if (sidebar) sidebar.remove();
            return;
          }
          if (points.length === 0) {
            if (sidebar) sidebar.remove();
            return;
          }
          if (!sidebar) {
            sidebar = document.createElement('div');
            sidebar.id = SIDEBAR_ID;
            sidebar.addEventListener('pointerdown', () => showSidebarCloseButton(sidebar));
            document.body.appendChild(sidebar);
          }
          // 每次渲染都对齐当前布局模式，避免旋转屏幕或改窗口宽度后停在旧模式
          sidebar.classList.toggle('jcts-touch', isTouchLayout());
          const signature = points.map((point) => point.normalized).join('|');
          if (sidebar.dataset.signature === signature) {
            updateSelectedSidebarItem();
            positionSidebar(sidebar);
            return;
          }
          sidebar.dataset.signature = signature;
          sidebar.classList.remove('jcts-dragging');
          sidebar.innerHTML = '';
          createSidebarCloseButton(sidebar);
          showSidebarCloseButton(sidebar, false);

          const title = document.createElement('div');
          title.className = 'jcts-title';
          title.textContent = `时间点 ${points.length}`;
          title.title = isTouchLayout() ? '' : '按住并拖动时间列表';
          sidebar.appendChild(title);
          bindSidebarDragging(sidebar, title);

          const list = document.createElement('div');
          list.className = 'jcts-list';
          for (const point of points) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'jcts-item' + (point.isRange ? ' jcts-range' : '');
            button.dataset.normalizedTime = point.normalized;
            button.textContent = point.display;
            button.title = point.title;
            button.addEventListener('click', () => {
              selectedTimePoint = point.normalized;
              updateSelectedSidebarItem();
              jumpToTime(point.raw);   // 区间跳起点，单点跳自身
            });
            list.appendChild(button);
          }
          sidebar.appendChild(list);
          updateSelectedSidebarItem();
          positionSidebar(sidebar);
        }

        function scheduleRefreshSidebar() {
          if (refreshTimer) clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => {
            renderSidebar();
          }, 150);
        }

        function getCommentCountFromPage() {
          const text = document.body.innerText || '';
          const match = text.match(/留言\s*[（(]\s*(\d+)\s*[）)]/);
          return match ? Number(match[1]) : null;
        }

        function getLoadedCommentCount() {
          const block = document.getElementById(COMMENT_BLOCK_ID);
          if (!block) return 0;
          const avatars = block.querySelectorAll('img.avatar, .avatar img, .avatar, .user-avatar, .comment-avatar');
          if (avatars.length > 0) return avatars.length;
          const commentLikeNodes = block.querySelectorAll('.comment, .comments-item, .item, .row');
          return Math.max(commentLikeNodes.length, 0);
        }

        function getLoadMoreLink() {
          const block = document.getElementById(COMMENT_BLOCK_ID) || document.body;
          return Array.from(block.querySelectorAll('a[data-action="ajax"][data-block-id], button[data-action="ajax"][data-block-id]'))
            .find((el) => {
              const text = String(el.textContent || '').trim();
              const blockId = el.dataset.blockId || '';
              return blockId === COMMENT_BLOCK_ID
                && /載入更多|载入更多|加载更多|更多|Load more/i.test(text);
            }) || null;
        }

        function waitForCommentDomChange(oldCount, timeout = 5000) {
          return new Promise((resolve) => {
            const block = document.getElementById(COMMENT_BLOCK_ID);
            if (!block) {
              resolve(false);
              return;
            }
            const observer = new MutationObserver(() => {
              const newCount = getLoadedCommentCount();
              if (newCount > oldCount || !getLoadMoreLink()) {
                clearTimeout(timer);
                observer.disconnect();
                resolve(true);
              }
            });
            const timer = setTimeout(() => {
              observer.disconnect();
              resolve(getLoadedCommentCount() > oldCount);
            }, timeout);
            observer.observe(block, {
              childList: true,
              subtree: true
            });
          });
        }

        async function autoClickLoadMoreComments() {
          if (isAutoLoadingComments) return;
          isAutoLoadingComments = true;
          const totalCount = getCommentCountFromPage();
          const targetCount = Math.min(totalCount || MAX_AUTO_COMMENTS, MAX_AUTO_COMMENTS);
          try {
            let guard = Math.ceil(targetCount / COMMENT_PAGE_SIZE) + 4;
            while (guard-- > 0) {
              const loadedCount = getLoadedCommentCount();
              if (loadedCount >= targetCount) break;
              const loadMore = getLoadMoreLink();
              if (!loadMore) break;
              loadMore.style.display = 'none';
              loadMore.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              }));
              await waitForCommentDomChange(loadedCount);
              scanNode(document.getElementById(COMMENT_BLOCK_ID) || document.body);
              renderSidebar();
              await new Promise((resolve) => setTimeout(resolve, 350));
            }
            const finalCount = getLoadedCommentCount();
            if (finalCount > COMMENT_PAGE_SIZE) {
              showToast(`已加载 ${finalCount} 条评论`);
            }
          } catch (error) {
            console.warn('[Jable comment time helper] 自动加载评论失败', error);
            showToast('自动加载评论失败');
          } finally {
            isAutoLoadingComments = false;
          }
        }

        function observeComments() {
          const observer = new MutationObserver((mutations) => {
            let changed = false;
            for (const mutation of mutations) {
              for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.TEXT_NODE) {
                  linkifyTextNode(node);
                  changed = true;
                }
                if (node.nodeType === Node.ELEMENT_NODE) {
                  if (node.id === SIDEBAR_ID || node.closest?.(`#${SIDEBAR_ID}`)) continue;
                  scanNode(node);
                  changed = true;
                }
              }
            }
            if (changed) scheduleRefreshSidebar();
          });
          observer.observe(document.body, {
            childList: true,
            subtree: true
          });
        }

        function bindLayoutUpdates() {
          const reposition = () => {
            const sidebar = document.getElementById(SIDEBAR_ID);
            if (sidebar) positionSidebar(sidebar);
          };
          window.addEventListener('resize', reposition, { passive: true });
          window.addEventListener('scroll', reposition, { passive: true });
          // iOS 旋转与地址栏收放不一定触发 window.resize
          window.addEventListener('orientationchange', () => setTimeout(reposition, 120), { passive: true });
          if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', reposition, { passive: true });
          }
        }

        let started = false;
        window.addEventListener('msv-script-enabled', (event) => setEnabled(event.detail));
        setInterval(updateSelectedSidebarItem, 400);
        function setEnabled(enabled) {
          timeEnabled = Boolean(enabled);
          if (!timeEnabled) {
            const sidebar = document.getElementById(SIDEBAR_ID);
            if (sidebar) sidebar.remove();
            const rail = document.getElementById(RAIL_ID);
            if (rail) rail.remove();
            return;
          }
          if (started) {
            renderSidebar();
            return;
          }
          started = true;
          injectStyle();
          scanNode(document.body);
          renderSidebar();
          observeComments();
          bindLayoutUpdates();
          setTimeout(autoClickLoadMoreComments, 800);
        }

        return { setEnabled };
        })();
        if (location.hostname.includes('jable')) JableTimeJump.setEnabled(STATE.enabled);
    }
})();