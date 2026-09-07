// ==UserScript==
// @name         3年前视频也支持时间条实时预览 · JCS 扩展
// @namespace    https://jable.tv/
// @version      0.3.0
// @description  JCS 扩展：给没有官方 VTT 缩略图的 Jable 老视频增加进度条悬浮实时预览（契约 v1 mounts 型）
// @author       Codex
// @match        https://jable.tv/*
// @run-at       document-idle
// @grant        none
// @license      MIT 
// ==/UserScript==

(function () {
    'use strict';

    var MANIFEST = {
        id: 'jable-live-preview',
        name: 'Jable 实时预览',
        version: '0.3.0',
        mounts: [{
            match: ['*.jable.tv'],
            mount: function (ctx) { mountLivePreview(ctx); }
        }]
    };

    // 注册握手（形态 A 三保险；形态 B 注入时 JavCodeKit 必已就绪，直走 tryRegister）
    function tryRegister() {
        var kit = window.JavCodeKit;
        if (kit && kit.__ready && kit.extensions) {
            try { kit.extensions.register(MANIFEST); } catch (e) { console.warn('[jable-live-preview]', e); }
            return true;
        }
        return false;
    }
    if (tryRegister()) return;
    window.addEventListener('jcs:kit-ready', tryRegister, { once: true });
    var regN = 0;
    var regT = setInterval(function () { if (tryRegister() || ++regN > 120) clearInterval(regT); }, 500);

    // ─── 扩展主体：全部状态在 mount 闭包内，宿主每次重放都是全新实例 ───
    function mountLivePreview(ctx) {
        // 宿主 match 只到 host；本扩展只在视频详情页工作
        if (!/^\/videos\/[^/]+\/?$/i.test(window.location.pathname)) return;

        var CONFIG = {
            skipWhenOfficialPreviewExists: true, // 新视频自带 thumbvtt.ts + thumb.ts，官方预览更省流量，默认不接管
            previewWidth: 232,
            previewHeight: 131,
            margin: 10,
            seekThrottleMs: 260,
            minSeekDiffSeconds: 1,
            bootRetryLimit: 80,
            bootRetryIntervalMs: 500
        };

        var UI_ID = 'jcs-ext-jable-live-preview';          // 契约约定：jcs-ext-{id} 前缀
        var STYLE_ID = 'jcs-ext-jable-live-preview-style';

        var state = {
            mainVideo: null, previewVideo: null, playerRoot: null,
            seekInput: null, progressRoot: null,
            box: null, timeText: null, statusText: null,
            hls: null, hlsReadyPromise: null,
            visible: false, lastSeekAt: 0, seekTimer: 0, wantedTime: 0,
            installed: false, bootCount: 0, retryTimer: 0, sourceUrl: ''
        };
        var cleanupFns = [];

        function debug() {
            if (!window.console || !window.console.debug) return;
            var args = Array.prototype.slice.call(arguments);
            args.unshift('[JableLivePreview]');
            window.console.debug.apply(window.console, args);
        }

        function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
        function isFiniteNumber(v) { return typeof v === 'number' && isFinite(v); }

        function formatTime(seconds) {
            var safe = Math.max(0, Math.floor(seconds || 0));
            var h = Math.floor(safe / 3600);
            var m = Math.floor((safe % 3600) / 60);
            var s = safe % 60;
            if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
            return m + ':' + String(s).padStart(2, '0');
        }

        function addStyle() {
            if (document.getElementById(STYLE_ID)) return;
            var style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = [
                '#' + UI_ID + ' {',
                '  position: fixed !important; left: 0 !important; top: 0 !important;',
                '  width: ' + CONFIG.previewWidth + 'px !important; padding: 6px !important;',
                '  border-radius: 18px !important; background: rgba(20,20,24,.76) !important;',
                '  border: 1px solid rgba(255,255,255,.18) !important;',
                '  box-shadow: 0 20px 50px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.16) !important;',
                '  backdrop-filter: blur(18px) saturate(1.45) !important;',
                '  -webkit-backdrop-filter: blur(18px) saturate(1.45) !important;',
                '  pointer-events: none !important; z-index: 2147483647 !important;',
                '  opacity: 0 !important; visibility: hidden !important;',
                '  transform: translate3d(0,8px,0) scale(.985) !important;',
                '  transition: opacity .12s ease, transform .12s ease, visibility .12s ease !important;',
                '  overflow: hidden !important; box-sizing: border-box !important; color: #fff !important;',
                '  font: 600 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif !important;',
                '}',
                '#' + UI_ID + '.is-visible { opacity: 1 !important; visibility: visible !important; transform: translate3d(0,0,0) scale(1) !important; }',
                '#' + UI_ID + ' .jlp-video-shell { position: relative !important; width: 100% !important; height: ' + CONFIG.previewHeight + 'px !important; border-radius: 13px !important; overflow: hidden !important; background: linear-gradient(145deg,#050507,#18181b) !important; }',
                '#' + UI_ID + ' video { display: block !important; width: 100% !important; height: 100% !important; object-fit: cover !important; background: #050507 !important; }',
                '#' + UI_ID + ' .jlp-loading { position: absolute !important; inset: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; color: rgba(255,255,255,.88) !important; font-size: 12px !important; background: radial-gradient(circle at center, rgba(0,0,0,.16), rgba(0,0,0,.50)) !important; opacity: 0 !important; transition: opacity .12s ease !important; }',
                '#' + UI_ID + '.is-loading .jlp-loading { opacity: 1 !important; }',
                '#' + UI_ID + ' .jlp-footer { display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 8px !important; height: 24px !important; padding: 5px 4px 0 !important; box-sizing: border-box !important; }',
                '#' + UI_ID + ' .jlp-time { color: #fff !important; font-variant-numeric: tabular-nums !important; text-shadow: 0 1px 10px rgba(0,0,0,.55) !important; }',
                '#' + UI_ID + ' .jlp-status { min-width: 0 !important; overflow: hidden !important; white-space: nowrap !important; text-overflow: ellipsis !important; color: rgba(255,255,255,.68) !important; font-size: 11px !important; font-weight: 500 !important; }'
            ].join('\n');
            (document.head || document.documentElement).appendChild(style);
            cleanupFns.push(function () {
                var el = document.getElementById(STYLE_ID);
                if (el && el.parentNode) el.parentNode.removeChild(el);
            });
        }

        function mountBoxToBestParent() {
            var parent = document.fullscreenElement || document.body || document.documentElement;
            if (state.box && state.box.parentElement !== parent) parent.appendChild(state.box);
        }

        function createPreviewBox() {
            addStyle();

            var box = document.getElementById(UI_ID);
            if (box) {
                state.box = box;
                state.previewVideo = box.querySelector('video');
                state.timeText = box.querySelector('.jlp-time');
                state.statusText = box.querySelector('.jlp-status');
                mountBoxToBestParent();
                return;
            }

            box = document.createElement('div');
            box.id = UI_ID;

            var shell = document.createElement('div');
            shell.className = 'jlp-video-shell';

            var video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            video.preload = 'auto';
            video.disablePictureInPicture = true;
            video.controls = false;
            video.setAttribute('aria-hidden', 'true');

            var loading = document.createElement('div');
            loading.className = 'jlp-loading';
            loading.textContent = '取帧中…';

            var footer = document.createElement('div');
            footer.className = 'jlp-footer';

            var time = document.createElement('div');
            time.className = 'jlp-time';
            time.textContent = '0:00';

            var status = document.createElement('div');
            status.className = 'jlp-status';
            status.textContent = '实时帧';

            shell.appendChild(video);
            shell.appendChild(loading);
            footer.appendChild(time);
            footer.appendChild(status);
            box.appendChild(shell);
            box.appendChild(footer);

            state.box = box;
            state.previewVideo = video;
            state.timeText = time;
            state.statusText = status;

            mountBoxToBestParent();
            cleanupFns.push(function () {
                if (state.box && state.box.parentNode) state.box.parentNode.removeChild(state.box);
                state.box = null;
                state.previewVideo = null;
            });

            video.addEventListener('seeking', function () {
                if (state.visible) setLoading(true, '取帧中…');
            });
            video.addEventListener('seeked', function () {
                if (state.visible) setLoading(false, '实时帧');
                try { video.pause(); } catch (ignore) { /* 保持静态帧即可 */ }
            });
            video.addEventListener('canplay', function () {
                if (state.visible) setLoading(false, '实时帧');
                try { video.pause(); } catch (ignore) { /* 部分浏览器会拒绝 pause */ }
            });
            video.addEventListener('error', function () {
                if (state.visible) setLoading(true, '预览源异常');
            });
        }

        function setLoading(enabled, text) {
            if (!state.box) return;
            state.box.classList.toggle('is-loading', !!enabled);
            if (text && state.statusText) state.statusText.textContent = text;
        }

        function showBox() {
            state.visible = true;
            mountBoxToBestParent();
            if (state.box) state.box.classList.add('is-visible');
        }

        function hideBox() {
            state.visible = false;
            window.clearTimeout(state.seekTimer);
            state.seekTimer = 0;
            if (state.box) {
                state.box.classList.remove('is-visible');
                state.box.classList.remove('is-loading');
            }
            if (state.previewVideo) {
                try { state.previewVideo.pause(); } catch (ignore) { /* 离开进度条时停掉预览 */ }
            }
        }

        function placeBox(clientX, progressRect) {
            var boxHeight = CONFIG.previewHeight + 36;
            var left = clientX - CONFIG.previewWidth / 2;
            var top = progressRect.top - boxHeight - 16;
            left = clamp(left, CONFIG.margin, window.innerWidth - CONFIG.previewWidth - CONFIG.margin);
            if (top < CONFIG.margin) top = progressRect.bottom + 14;
            top = clamp(top, CONFIG.margin, window.innerHeight - boxHeight - CONFIG.margin);
            state.box.style.setProperty('left', Math.round(left) + 'px', 'important');
            state.box.style.setProperty('top', Math.round(top) + 'px', 'important');
        }

        function officialPreviewExists() {
            var hasVtt = window.hasVtt === true || Number(window.hasVtt) === 1;
            var vttUrl = typeof window.vttUrl === 'string' ? window.vttUrl.trim() : '';
            if (hasVtt && vttUrl) return true;
            return Array.prototype.some.call(document.scripts || [], function (script) {
                var code = script.textContent || '';
                return /var\s+hasVtt\s*=\s*(?:1|true)\s*;/i.test(code) &&
                    /var\s+vttUrl\s*=\s*['"][^'"]+['"]\s*;/i.test(code);
            });
        }

        function getHlsUrlFromScripts() {
            var scripts = document.scripts || [];
            for (var i = 0; i < scripts.length; i += 1) {
                var code = scripts[i].textContent || '';
                var match = code.match(/var\s+hlsUrl\s*=\s*['"]([^'"]+\.m3u8[^'"]*)['"]\s*;/i);
                if (match && match[1]) return match[1];
            }
            return '';
        }

        function getHlsUrl() {
            var source;
            var video = state.mainVideo;
            if (state.sourceUrl) return state.sourceUrl;
            if (typeof window.hlsUrl === 'string' && window.hlsUrl.indexOf('.m3u8') !== -1) {
                state.sourceUrl = window.hlsUrl;
                return state.sourceUrl;
            }
            state.sourceUrl = getHlsUrlFromScripts();
            if (state.sourceUrl) return state.sourceUrl;
            if (video) {
                source = video.querySelector('source[src*=".m3u8"]');
                if (source && source.src) return (state.sourceUrl = source.src);
                if (video.currentSrc && video.currentSrc.indexOf('.m3u8') !== -1) return (state.sourceUrl = video.currentSrc);
                if (video.src && video.src.indexOf('.m3u8') !== -1) return (state.sourceUrl = video.src);
            }
            return '';
        }

        function waitForNativeMetadata(video) {
            return new Promise(function (resolve, reject) {
                var timer;
                if (video.readyState >= 1 && isFiniteNumber(video.duration)) { resolve(); return; }
                function cleanup() {
                    window.clearTimeout(timer);
                    video.removeEventListener('loadedmetadata', onReady);
                    video.removeEventListener('error', onError);
                }
                function onReady() { cleanup(); resolve(); }
                function onError() { cleanup(); reject(new Error('preview video error')); }
                timer = window.setTimeout(function () { cleanup(); reject(new Error('metadata timeout')); }, 8000);
                video.addEventListener('loadedmetadata', onReady);
                video.addEventListener('error', onError);
            });
        }

        function ensurePreviewSource() {
            var src;
            var HlsCtor;
            if (state.hlsReadyPromise) return state.hlsReadyPromise;

            src = getHlsUrl();
            if (!src) {
                state.hlsReadyPromise = Promise.reject(new Error('missing hlsUrl'));
                setLoading(true, '取不到 m3u8');
                return state.hlsReadyPromise;
            }

            HlsCtor = window.Hls;
            if (HlsCtor && typeof HlsCtor.isSupported === 'function' && HlsCtor.isSupported()) {
                state.hlsReadyPromise = new Promise(function (resolve, reject) {
                    var settled = false;
                    var timeoutId;
                    function settle(ok, error) {
                        if (settled) return;
                        settled = true;
                        window.clearTimeout(timeoutId);
                        if (ok) resolve();
                        else reject(error || new Error('hls init failed'));
                    }
                    try {
                        // 降级实时预览只取一小段，避免占太多内存
                        state.hls = new HlsCtor({
                            maxBufferLength: 4,
                            maxMaxBufferLength: 8,
                            maxBufferSize: 2 * 1000 * 1000,
                            backBufferLength: 0,
                            enableWorker: true,
                            lowLatencyMode: false
                        });
                        state.hls.on(HlsCtor.Events.MEDIA_ATTACHED, function () { state.hls.loadSource(src); });
                        state.hls.on(HlsCtor.Events.MANIFEST_PARSED, function () { settle(true); });
                        state.hls.on(HlsCtor.Events.ERROR, function (_, data) {
                            if (!data || !data.fatal) return;
                            try {
                                if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR) { state.hls.startLoad(); return; }
                                if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR) { state.hls.recoverMediaError(); return; }
                            } catch (ignore) { /* 失败交给 settle */ }
                            settle(false, new Error(data.details || 'hls fatal error'));
                        });
                        timeoutId = window.setTimeout(function () { settle(false, new Error('hls manifest timeout')); }, 10000);
                        state.hls.attachMedia(state.previewVideo);
                    } catch (error) {
                        settle(false, error);
                    }
                });
            } else {
                state.previewVideo.src = src;
                state.previewVideo.load();
                state.hlsReadyPromise = waitForNativeMetadata(state.previewVideo);
            }

            state.hlsReadyPromise.catch(function (error) {
                debug('预览源初始化失败', error);
                setLoading(true, '初始化失败');
            });
            return state.hlsReadyPromise;
        }

        function getDuration() {
            var video = state.mainVideo;
            if (video && isFiniteNumber(video.duration) && video.duration > 0) return video.duration;
            return 0;
        }

        function performSeek(targetTime) {
            var video = state.previewVideo;
            var duration = getDuration();
            if (!video || !isFiniteNumber(targetTime)) return;
            state.lastSeekAt = Date.now();
            setLoading(true, '取帧中…');
            try {
                targetTime = clamp(targetTime, 0, duration || targetTime);
                if (Math.abs((video.currentTime || 0) - targetTime) < CONFIG.minSeekDiffSeconds && video.readyState >= 2) {
                    setLoading(false, '实时帧');
                    return;
                }
                video.pause();
                video.currentTime = targetTime;
            } catch (error) {
                debug('设置预览时间失败', error);
                setLoading(true, '取帧失败');
            }
        }

        function seekPreview(targetTime) {
            var now = Date.now();
            var delay;
            state.wantedTime = targetTime;
            ensurePreviewSource().then(function () {
                delay = CONFIG.seekThrottleMs - (now - state.lastSeekAt);
                if (delay > 0) {
                    window.clearTimeout(state.seekTimer);
                    state.seekTimer = window.setTimeout(function () { performSeek(state.wantedTime); }, delay);
                    return;
                }
                performSeek(targetTime);
            }).catch(function () { setLoading(true, '无法预览'); });
        }

        function getProgressRect() {
            var target = state.progressRoot || state.seekInput;
            if (!target) return null;
            return target.getBoundingClientRect();
        }

        function updateFromPointer(event) {
            var rect = getProgressRect();
            var duration = getDuration();
            if (!rect || rect.width <= 0 || !duration) return;
            var ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
            var targetTime = ratio * duration;
            placeBox(event.clientX, rect);
            if (state.timeText) state.timeText.textContent = formatTime(targetTime);
            showBox();
            seekPreview(targetTime);
        }

        function findMainVideo() {
            return document.querySelector('video#player') ||
                document.querySelector('.plyr video') ||
                document.querySelector('video');
        }

        function findPlayerRoot(video) {
            return (video && video.closest && video.closest('.plyr')) ||
                document.querySelector('.plyr') ||
                (video && video.parentElement) ||
                document.body || document.documentElement;
        }

        function findSeekInput(root) {
            return (root && root.querySelector('input[data-plyr="seek"]')) ||
                (root && root.querySelector('.plyr__progress input[type="range"]')) ||
                document.querySelector('input[data-plyr="seek"]') ||
                document.querySelector('.plyr__progress input[type="range"]') ||
                document.querySelector('input[type="range"][aria-label*="Seek"]') ||
                document.querySelector('input[type="range"][aria-label*="搜尋"]');
        }

        function findProgressRoot(seekInput) {
            if (!seekInput) return null;
            return seekInput.closest('.plyr__progress') ||
                seekInput.closest('.plyr__progress__container') ||
                seekInput.parentElement;
        }

        function bindProgressEvents() {
            var root = state.progressRoot || state.seekInput;
            if (!root) return false;

            root.addEventListener('mouseenter', updateFromPointer, true);
            root.addEventListener('mousemove', updateFromPointer, true);
            root.addEventListener('mouseleave', hideBox, true);
            cleanupFns.push(function () {
                root.removeEventListener('mouseenter', updateFromPointer, true);
                root.removeEventListener('mousemove', updateFromPointer, true);
                root.removeEventListener('mouseleave', hideBox, true);
            });

            if (state.seekInput && state.seekInput !== root) {
                state.seekInput.addEventListener('mouseenter', updateFromPointer, true);
                state.seekInput.addEventListener('mousemove', updateFromPointer, true);
                state.seekInput.addEventListener('mouseleave', hideBox, true);
                var si = state.seekInput;
                cleanupFns.push(function () {
                    si.removeEventListener('mouseenter', updateFromPointer, true);
                    si.removeEventListener('mousemove', updateFromPointer, true);
                    si.removeEventListener('mouseleave', hideBox, true);
                });
            }

            // 兜底：有些 Plyr 版本事件落在整个 controls 层
            if (state.playerRoot) {
                var onPlayerMove = function (event) {
                    var rect = getProgressRect();
                    if (!rect) return;
                    if (event.clientX >= rect.left && event.clientX <= rect.right &&
                        event.clientY >= rect.top - 12 && event.clientY <= rect.bottom + 12) {
                        updateFromPointer(event);
                    }
                };
                var pr = state.playerRoot;
                pr.addEventListener('mousemove', onPlayerMove, true);
                pr.addEventListener('mouseleave', hideBox, true);
                cleanupFns.push(function () {
                    pr.removeEventListener('mousemove', onPlayerMove, true);
                    pr.removeEventListener('mouseleave', hideBox, true);
                });
            }
            return true;
        }

        function install() {
            if (state.installed) return true;
            if (CONFIG.skipWhenOfficialPreviewExists && officialPreviewExists()) {
                debug('检测到官方 VTT 缩略图，跳过降级预览');
                return true;
            }
            state.mainVideo = findMainVideo();
            if (!state.mainVideo) return false;
            state.playerRoot = findPlayerRoot(state.mainVideo);
            state.seekInput = findSeekInput(state.playerRoot);
            state.progressRoot = findProgressRoot(state.seekInput);
            if (!state.seekInput || !state.progressRoot) return false;
            createPreviewBox();
            if (!bindProgressEvents()) return false;
            state.installed = true;
            debug('已启用降级实时预览', { hlsUrl: getHlsUrl() });
            return true;
        }

        function boot() {
            if (install()) return;
            state.bootCount += 1;
            if (state.bootCount > CONFIG.bootRetryLimit) {
                debug('没有找到播放器进度条，停止重试');
                return;
            }
            state.retryTimer = window.setTimeout(boot, CONFIG.bootRetryIntervalMs);
        }

        // 全局事件：具名引用，cleanup 可解绑
        var onFullscreenChange = function () { mountBoxToBestParent(); };
        var onBeforeUnload = function () {
            if (state.hls && typeof state.hls.destroy === 'function') {
                try { state.hls.destroy(); } catch (ignore) { /* 页面卸载时释放 HLS 实例 */ }
            }
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);
        window.addEventListener('beforeunload', onBeforeUnload);
        cleanupFns.push(function () {
            document.removeEventListener('fullscreenchange', onFullscreenChange);
            window.removeEventListener('beforeunload', onBeforeUnload);
        });

        // 总清理：boot 轮询 timer + seek throttle + HLS 实例 + 事件 + DOM + 样式
        ctx.onCleanup(function () {
            window.clearTimeout(state.retryTimer);
            window.clearTimeout(state.seekTimer);
            if (state.hls && typeof state.hls.destroy === 'function') {
                try { state.hls.destroy(); } catch (ignore) { /* 已销毁 */ }
                state.hls = null;
            }
            cleanupFns.slice().reverse().forEach(function (fn) { try { fn(); } catch (e) { /* ignore */ } });
            cleanupFns.length = 0;
        });

        boot();
    }
})();
