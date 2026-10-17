// ==UserScript==
// @name Missav & Jable自动中文字幕 (交互优化版-ios修复)
// @namespace http://tampermonkey.net/
// @version 5.8
// @description 搜索按钮提级至首页，修复 Missav 番号识别，新增下载功能，让字幕列表常驻显示当前选中项，并优化首页设置布局，支持首页滑杆在 0%-100% 范围调整字幕垂直位置与横向位置，控制台与 CC 可拖动并记住位置，界面改为紧凑控制台，修复返回后重新搜索丢失当前选中标记的问题，并将 CC 悬浮图标恢复为低存在感透明样式，修复 Jable 评论区“求中文字幕”导致误判已有内置字幕的问题。
// @author ron
// @match *://missav*.com/*
// @match *://missav.ws/*
// @match *://missav.ai/*
// @match *://missav.live/*
// @match *://jable.tv/videos/*
// @match *://*.jable.tv/videos/*
// @grant GM_xmlhttpRequest
// @grant GM_addStyle
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
    const CONFIG = {
        autoSearch: true,
        pauseOnSearch: true,
        defaultFontSize: 24, // 默认字号加大
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
    const POS_KEY = 'msv-subtitle-pos-v1';
    const readSavedPos = () => {
        try {
            const saved = JSON.parse(localStorage.getItem(POS_KEY) || '{}');
            const bottom = Number(saved.bottom);
            const x = Number(saved.x);
            return {
                bottom: Number.isFinite(bottom) ? Math.min(100, Math.max(0, bottom)) : 8,
                x: Number.isFinite(x) ? Math.min(100, Math.max(0, x)) : 50
            };
        } catch {
            return { bottom: 8, x: 50 };
        }
    };
    const savedPos = readSavedPos();
    const STATE = {
        offset: window.location.hostname.includes('jable.tv') ? -6.0 : 0.0,
        bottom: savedPos.bottom,
        x: savedPos.x,
        visible: !initialBuiltInSub,
        hasBuiltInSub: initialBuiltInSub,
        code: null,
        subs: [],
        fontSize: CONFIG.defaultFontSize,
        nativeTrackUrl: null,
        rawSubtitleText: '',
        currentSubtitleName: '',
        currentSubtitleKey: ''
    };
    const savePos = () => {
        try {
            localStorage.setItem(POS_KEY, JSON.stringify({ bottom: STATE.bottom, x: STATE.x }));
        } catch {}
    };
    let subLayer = null;
    // ======================
    // 样式重构
    // ======================
    GM_addStyle(`
        #msv-dock {
            position: fixed; z-index: 2147483647; width: 36px; height: 36px;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
            color: rgba(255,255,255,0.92); touch-action: none;
        }
        #msv-fab {
            position: absolute; right: 0; bottom: 0; width: 36px; height: 36px; border-radius: 12px;
            background: rgba(18,18,20,0.42); color: rgba(255,255,255,0.38);
            border: 0;
            display: flex; align-items: center; justify-content: center;
            font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            cursor: grab; user-select: none; box-shadow: 0 8px 22px rgba(0,0,0,0.28);
        }
        #msv-fab:active { cursor: grabbing; }
        #msv-fab:hover { background: rgba(255,255,255,0.16); color: #fff; }
        #msv-fab.ok { color: rgba(255,255,255,0.88); }
        #msv-dock.is-mini #msv-panel { display: none !important; }
        #msv-panel {
            position: absolute; right: 0; bottom: 44px; width: min(292px, calc(100vw - 24px)); display: none; flex-direction: column; gap: 0;
            background: rgba(22,22,24,0.78);
            border: 1px solid rgba(255,255,255,0.16); border-radius: 16px;
            box-shadow: 0 18px 48px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.16);
            backdrop-filter: blur(22px) saturate(160%); -webkit-backdrop-filter: blur(22px) saturate(160%);
            overflow: hidden;
        }
        #msv-panel.show { display: flex; animation: msv-pop 0.16s cubic-bezier(.2,.8,.2,1); }
        @keyframes msv-pop { from { opacity:0; transform: translateY(6px); } to { opacity:1; transform: none; } }
        .msv-head {
            display: flex; align-items: center; gap: 8px; padding: 10px 12px 8px; cursor: grab; user-select: none;
            border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .msv-head:active { cursor: grabbing; }
        .msv-grip { width: 18px; height: 10px; opacity: 0.45; flex: none; }
        .msv-head-title { font-size: 12px; font-weight: 650; letter-spacing: 0.01em; }
        .msv-head-code { margin-left: auto; font-size: 11px; color: rgba(255,214,102,0.92); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .msv-body { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px 12px; }
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
        .msv-list-container { max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
        .msv-list-container::-webkit-scrollbar { width: 6px; }
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
            padding: 7px 9px; text-align: center; border-radius: 9px; font-size: 12px; width: 100%; box-sizing: border-box; outline: none;
        }
        .msv-input:focus { border-color: rgba(10,132,255,0.8); }
        .msv-slider { width: 100%; height: 18px; margin: 0; accent-color: #0a84ff; cursor: pointer; }
        .msv-btn-blue, .msv-btn-gray, .msv-btn-red {
            border: 1px solid rgba(255,255,255,0.12); padding: 7px 8px; border-radius: 9px; font-size: 12px; font-weight: 650; cursor: pointer;
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
        }
        .msv-toast.show { opacity: 1; }
        .msv-subtitle-overlay {
            position: fixed !important; transform: translateX(-50%) !important;
            width: min(92vw, 1100px) !important; text-align: center !important; pointer-events: none !important;
            color: #fff !important; font-weight: 600 !important;
            text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 0 6px #000 !important;
            z-index: 2147483646 !important; line-height: 1.4 !important; white-space: pre-line !important; display: block !important;
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
            GM_xmlhttpRequest({
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
            GM_xmlhttpRequest({
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
            GM_xmlhttpRequest({
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
            GM_xmlhttpRequest({
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
            GM_xmlhttpRequest({
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
                        if(fab) fab.className = 'ok';
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
        forceDomSubtitleLayer: () => {
            Renderer.removeNativeTrack();
            Renderer.forceInlineVideo();
            if (!subLayer) {
                subLayer = document.querySelector('.msv-subtitle-overlay') || document.createElement('div');
                subLayer.className = 'msv-subtitle-overlay';
                if (subLayer.parentNode !== document.body) document.body.appendChild(subLayer);
            }
            subLayer.removeAttribute('hidden');
            subLayer.removeAttribute('data-jp-hidden-by-miss-player');
            subLayer.removeAttribute('data-jp-old-display');
            subLayer.removeAttribute('data-jp-old-visibility');
            subLayer.removeAttribute('data-jp-old-pointer-events');
            subLayer.className = 'msv-subtitle-overlay';
            subLayer.style.setProperty('position', 'fixed', 'important');
            subLayer.style.setProperty('left', STATE.x + '%', 'important');
            subLayer.style.setProperty('transform', 'translate3d(-50%, 0, 0)', 'important');
            subLayer.style.setProperty('width', '95%', 'important');
            subLayer.style.setProperty('max-width', '95vw', 'important');
            subLayer.style.setProperty('text-align', 'center', 'important');
            subLayer.style.setProperty('pointer-events', 'none', 'important');
            subLayer.style.setProperty('visibility', STATE.visible ? 'visible' : 'hidden', 'important');
            subLayer.style.setProperty('opacity', STATE.visible ? '1' : '0', 'important');
            subLayer.style.setProperty('display', STATE.visible ? 'block' : 'none', 'important');
            subLayer.style.setProperty('z-index', '2147483647', 'important');
            subLayer.style.setProperty('font-size', STATE.fontSize + 'px', 'important');
            subLayer.style.setProperty('bottom', STATE.bottom + '%', 'important');
            subLayer.style.setProperty('line-height', '1.4', 'important');
            subLayer.style.setProperty('white-space', 'pre-line', 'important');
            subLayer.style.setProperty('color', '#fff', 'important');
            subLayer.style.setProperty('font-weight', '600', 'important');
            subLayer.style.setProperty('text-shadow', '0 1px 2px rgba(0,0,0,0.95), 0 0 8px #000, 0 0 16px #000', 'important');
            subLayer.style.setProperty('contain', 'layout style paint', 'important');
            subLayer.style.setProperty('will-change', 'contents, transform', 'important');
            if (subLayer.parentNode !== document.body || document.body.lastElementChild !== subLayer) {
                document.body.appendChild(subLayer);
            }
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

            if(document.body) {
                document.body.appendChild(d);
            } else {
                document.addEventListener('DOMContentLoaded', () => document.body.appendChild(d));
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

            const clampDock = (x, y) => {
                const w = dock.offsetWidth || 36;
                const h = dock.offsetHeight || 36;
                const maxX = Math.max(8, window.innerWidth - w - 8);
                const maxY = Math.max(8, window.innerHeight - h - 8);
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
                    try { localStorage.setItem(DOCK_POS_KEY, JSON.stringify(next)); } catch {}
                }
            };
            const point = (e) => e.touches ? e.touches[0] : e;
            const dragStart = (e) => {
                if (e.target.closest('button, input, label, a, .msv-list-item')) return;
                const p = point(e);
                isDragging = true;
                dragMoved = false;
                initialX = p.clientX - currentX;
                initialY = p.clientY - currentY;
            };
            const dragMove = (e) => {
                if (!isDragging) return;
                const p = point(e);
                const nextX = p.clientX - initialX;
                const nextY = p.clientY - initialY;
                if (Math.abs(nextX - currentX) + Math.abs(nextY - currentY) > 4) dragMoved = true;
                if (dragMoved && e.cancelable) e.preventDefault();
                placeDock(nextX, nextY, false);
            };
            const dragEnd = () => {
                if (!isDragging) return;
                isDragging = false;
                if (dragMoved) placeDock(currentX, currentY, true);
            };

            try {
                const savedDock = JSON.parse(localStorage.getItem(DOCK_POS_KEY) || 'null');
                if (savedDock && Number.isFinite(savedDock.x) && Number.isFinite(savedDock.y)) {
                    placeDock(savedDock.x, savedDock.y, false);
                } else {
                    placeDock(window.innerWidth - 64, window.innerHeight - 220, false);
                }
            } catch {
                placeDock(window.innerWidth - 64, window.innerHeight - 220, false);
            }
            window.addEventListener('resize', () => placeDock(currentX, currentY, false), { passive: true });
            fab.addEventListener('mousedown', dragStart);
            dragHandle.addEventListener('mousedown', dragStart);
            document.addEventListener('mousemove', dragMove);
            document.addEventListener('mouseup', dragEnd);
            fab.addEventListener('touchstart', dragStart, { passive: true });
            dragHandle.addEventListener('touchstart', dragStart, { passive: true });
            document.addEventListener('touchmove', dragMove, { passive: false });
            document.addEventListener('touchend', dragEnd);

            const visCheck = document.getElementById('msv-check-vis');
            if (visCheck) visCheck.onchange = () => {
                STATE.visible = visCheck.checked;
                UI.toast(STATE.visible ? "字幕已开启" : "字幕已隐藏", 800);
            };
            if (fab) fab.onclick = (e) => {
                if (dragMoved) {
                    dragMoved = false;
                    e.stopPropagation();
                    return;
                }
                dock.classList.remove('is-mini');
                panel.classList.toggle('show');
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
                panel.classList.remove('show');
                dock.classList.add('is-mini');
            };
            const backBtn = document.getElementById('msv-back');
            if (backBtn) backBtn.onclick = () => UI.switchView(false);
            const tVal = document.getElementById('msv-t-val');
            const decT = document.getElementById('msv-dec-t');
            const incT = document.getElementById('msv-inc-t');
            if(decT) decT.onclick = () => { STATE.offset -= 0.5; tVal.textContent = (STATE.offset>=0?'+':'')+STATE.offset.toFixed(1)+'s'; };
            if(incT) incT.onclick = () => { STATE.offset += 0.5; tVal.textContent = (STATE.offset>=0?'+':'')+STATE.offset.toFixed(1)+'s'; };
            const pVal = document.getElementById('msv-p-val');
            const posRange = document.getElementById('msv-pos-range');
            if(posRange) posRange.oninput = function() {
                STATE.bottom = Number(this.value);
                if (pVal) pVal.textContent = STATE.bottom + '%';
                savePos();
                Renderer.renderNow('position');
            };
            const xVal = document.getElementById('msv-x-val');
            const xRange = document.getElementById('msv-x-range');
            if(xRange) xRange.oninput = function() {
                STATE.x = Number(this.value);
                if (xVal) xVal.textContent = STATE.x + '%';
                savePos();
                Renderer.renderNow('position-x');
            };
            const fontRange = document.getElementById('msv-font-range');
            if(fontRange) fontRange.oninput = function() {
                STATE.fontSize = this.value;
                const fontVal = document.getElementById('msv-font-val');
                if (fontVal) fontVal.textContent = STATE.fontSize;
                Renderer.renderNow('font');
            };
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
                        if(fab) fab.className = 'ok';
                        Renderer.init();
                        panel.classList.remove('show');
                    });
                };
                inp.click();
            };
            document.addEventListener('click', (e) => {
                if (panel && !dock.contains(e.target)) panel.classList.remove('show');
            });
            if (CONFIG.autoSearch && STATE.code) setTimeout(() => {
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
    }
})();