// ==UserScript==
// @name         U3C3 & 1cili Magnet Buttons
// @namespace    http://tampermonkey.net/
// @version      0.8
// @description  Add buttons to copy magnet links and preview screenshots via whatslink.info
// @author       You
// @match        *://*.u3c3.com/*
// @match        *://hjd2048.com/*
// @match        *://*.u3c3.in/*
// @match        *://*.cctv10.cc/*
// @match        *://*.cctv12.cc/*
// @match        *://*.1cili.com/*
// @grant        GM_setClipboard
// @grant        GM_xmlhttpRequest
// @connect      whatslink.info
// @license MIT
// ==/UserScript==

(function() {
    'use strict';

    const WHATSLINK_API = 'https://whatslink.info/api/v1/link';
    const REQUEST_TIMEOUT_MS = 20000;
    const MAX_SCREENSHOTS = 48;

    const style = document.createElement('style');
    style.textContent = `
        .magnet-btn {
            cursor: pointer;
            color: #337ab7;
            margin-left: 5px;
            display: inline-block;
        }
        .magnet-btn:hover { color: #23527c; }
        .copy-success { color: #5cb85c; }
        .preview-btn { color: #f0ad4e; }
        .preview-btn:hover { color: #ec971f; }
        .preview-btn.is-loading { opacity: 0.55; pointer-events: none; }

        #preview-overlay {
            position: fixed;
            top: 0;
            right: -480px;
            width: 480px;
            max-width: 100vw;
            height: 100%;
            background-color: #fff;
            z-index: 9999;
            box-shadow: -2px 0 10px rgba(0,0,0,0.3);
            transition: right 0.3s ease;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #222;
        }
        #preview-overlay.active { right: 0; }
        #preview-header {
            height: 44px;
            flex-shrink: 0;
            background-color: #f8f8f8;
            border-bottom: 1px solid #ddd;
            display: flex;
            align-items: center;
            padding: 0 12px;
            justify-content: space-between;
            gap: 8px;
        }
        #preview-title {
            font-weight: 700;
            font-size: 13px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex: 1;
            min-width: 0;
        }
        #preview-close {
            cursor: pointer;
            font-size: 20px;
            color: #666;
            border: none;
            background: transparent;
            width: 28px;
            height: 28px;
            flex-shrink: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            border-radius: 50%;
            line-height: 1;
        }
        #preview-close:hover { background-color: #eee; color: #333; }
        #preview-container {
            flex: 1;
            position: relative;
            overflow: auto;
            background: #fafafa;
            scrollbar-width: thin;
        }
        #preview-loading {
            position: absolute;
            inset: 0;
            color: #333;
            font-size: 15px;
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 10px;
            background: #fafafa;
            z-index: 2;
        }
        #preview-loading.visible { display: flex; }
        #preview-spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: emh-preview-spin 1s linear infinite;
        }
        @keyframes emh-preview-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        #preview-body {
            display: none;
            padding: 14px 14px 24px;
            box-sizing: border-box;
        }
        #preview-body.visible { display: block; }
        .preview-meta {
            background: #fff;
            border: 1px solid #e5e5e5;
            border-radius: 10px;
            padding: 12px 14px;
            margin-bottom: 12px;
        }
        .preview-meta-name {
            font-size: 14px;
            font-weight: 600;
            line-height: 1.45;
            word-break: break-word;
            margin-bottom: 8px;
        }
        .preview-meta-row {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            font-size: 12px;
            color: #666;
        }
        .preview-chip {
            display: inline-flex;
            align-items: center;
            padding: 3px 8px;
            border-radius: 999px;
            background: #f0f0f0;
            color: #444;
            font-weight: 500;
        }
        .preview-error {
            padding: 28px 16px;
            text-align: center;
            color: #c0392b;
            font-size: 13px;
            line-height: 1.5;
        }
        .preview-empty {
            padding: 28px 16px;
            text-align: center;
            color: #888;
            font-size: 13px;
            line-height: 1.5;
        }
        .preview-shots {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
        }
        .preview-shot {
            display: block;
            width: 100%;
            border: none;
            padding: 0;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #e5e5e5;
            background: #fff;
            cursor: zoom-in;
            text-align: left;
            font: inherit;
            color: inherit;
        }
        .preview-shot img {
            display: block;
            width: 100%;
            height: auto;
            vertical-align: middle;
            background: #eee;
            min-height: 80px;
            pointer-events: none;
        }
        .preview-shot-fail {
            padding: 24px 12px;
            text-align: center;
            color: #999;
            font-size: 12px;
        }
        .preview-shot-cap {
            padding: 6px 10px;
            font-size: 11px;
            color: #888;
            border-top: 1px solid #f0f0f0;
            background: #fff;
        }

        /* Fullscreen lightbox layer */
        #preview-lightbox {
            position: fixed;
            inset: 0;
            z-index: 10050;
            display: none;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.88);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            user-select: none;
        }
        #preview-lightbox.open { display: flex; }
        #preview-lightbox-stage {
            position: relative;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 48px 64px 56px;
            box-sizing: border-box;
        }
        #preview-lightbox-img {
            max-width: 100%;
            max-height: 100%;
            object-fit: contain;
            border-radius: 4px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.45);
            background: #111;
        }
        #preview-lightbox-img.is-loading { opacity: 0.35; }
        .preview-lb-btn {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            width: 44px;
            height: 44px;
            border: none;
            border-radius: 50%;
            background: rgba(255,255,255,0.12);
            color: #fff;
            font-size: 28px;
            line-height: 1;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.15s ease, opacity 0.15s ease;
            z-index: 2;
        }
        .preview-lb-btn:hover { background: rgba(255,255,255,0.22); }
        .preview-lb-btn:disabled {
            opacity: 0.25;
            cursor: default;
        }
        #preview-lightbox-prev { left: 12px; }
        #preview-lightbox-next { right: 12px; }
        #preview-lightbox-close {
            position: absolute;
            top: 12px;
            right: 12px;
            width: 40px;
            height: 40px;
            border: none;
            border-radius: 50%;
            background: rgba(255,255,255,0.12);
            color: #fff;
            font-size: 24px;
            cursor: pointer;
            z-index: 3;
            line-height: 1;
        }
        #preview-lightbox-close:hover { background: rgba(255,255,255,0.22); }
        #preview-lightbox-counter {
            position: absolute;
            bottom: 14px;
            left: 50%;
            transform: translateX(-50%);
            color: rgba(255,255,255,0.9);
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.3px;
            padding: 6px 12px;
            border-radius: 999px;
            background: rgba(0,0,0,0.45);
            z-index: 2;
            pointer-events: none;
        }
        #preview-lightbox-hint {
            position: absolute;
            bottom: 14px;
            right: 16px;
            color: rgba(255,255,255,0.45);
            font-size: 11px;
            z-index: 2;
            pointer-events: none;
        }
        #preview-toggle {
            position: fixed;
            top: 50%;
            right: 0;
            transform: translateY(-50%);
            width: 20px;
            height: 60px;
            background-color: #f0ad4e;
            border-radius: 5px 0 0 5px;
            cursor: pointer;
            display: none;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            writing-mode: vertical-rl;
            text-orientation: mixed;
            z-index: 9998;
            box-shadow: -2px 0 5px rgba(0,0,0,0.2);
            font-size: 11px;
            letter-spacing: 1px;
        }
        #preview-toggle.visible { display: flex; }

        .preview-button-1cili {
            background-color: #5bc0de;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            margin-left: 5px;
        }
        .preview-button-1cili:hover { background-color: #46b8da; }
        .preview-button-1cili.is-loading { opacity: 0.55; pointer-events: none; }
        .input-group-btn .preview-button-1cili {
            height: 34px;
            border-top-left-radius: 0;
            border-bottom-left-radius: 0;
        }

        @media (prefers-reduced-motion: reduce) {
            #preview-overlay { transition: none; }
            #preview-spinner { animation: none; border-top-color: #3498db; }
        }
        @media (max-width: 640px) {
            #preview-lightbox-stage { padding: 44px 52px 52px; }
            .preview-lb-btn { width: 38px; height: 38px; font-size: 24px; }
            #preview-lightbox-prev { left: 6px; }
            #preview-lightbox-next { right: 6px; }
            #preview-lightbox-hint { display: none; }
        }
    `;
    document.head.appendChild(style);

    const previewToggle = document.createElement('div');
    previewToggle.id = 'preview-toggle';
    previewToggle.textContent = 'PREVIEW';
    document.body.appendChild(previewToggle);

    const previewOverlay = document.createElement('div');
    previewOverlay.id = 'preview-overlay';

    const previewHeader = document.createElement('div');
    previewHeader.id = 'preview-header';

    const previewTitle = document.createElement('div');
    previewTitle.id = 'preview-title';
    previewTitle.textContent = 'Magnet Preview';

    const previewClose = document.createElement('button');
    previewClose.id = 'preview-close';
    previewClose.type = 'button';
    previewClose.setAttribute('aria-label', 'Close preview');
    previewClose.textContent = '×';

    previewHeader.appendChild(previewTitle);
    previewHeader.appendChild(previewClose);

    const previewContainer = document.createElement('div');
    previewContainer.id = 'preview-container';

    const previewLoading = document.createElement('div');
    previewLoading.id = 'preview-loading';
    previewLoading.innerHTML = '<div id="preview-spinner"></div><div class="loading-text">Loading preview...</div>';

    const previewBody = document.createElement('div');
    previewBody.id = 'preview-body';

    previewContainer.appendChild(previewLoading);
    previewContainer.appendChild(previewBody);
    previewOverlay.appendChild(previewHeader);
    previewOverlay.appendChild(previewContainer);
    document.body.appendChild(previewOverlay);

    // Lightbox layer (above side panel)
    const lightbox = document.createElement('div');
    lightbox.id = 'preview-lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Screenshot viewer');
    lightbox.innerHTML = `
        <div id="preview-lightbox-stage">
            <button type="button" id="preview-lightbox-close" aria-label="关闭">×</button>
            <button type="button" class="preview-lb-btn" id="preview-lightbox-prev" aria-label="上一张">‹</button>
            <img id="preview-lightbox-img" alt="Screenshot" referrerpolicy="no-referrer" />
            <button type="button" class="preview-lb-btn" id="preview-lightbox-next" aria-label="下一张">›</button>
            <div id="preview-lightbox-counter"></div>
            <div id="preview-lightbox-hint">← → 切换 · Esc 关闭</div>
        </div>
    `;
    document.body.appendChild(lightbox);

    const lbImg = lightbox.querySelector('#preview-lightbox-img');
    const lbPrev = lightbox.querySelector('#preview-lightbox-prev');
    const lbNext = lightbox.querySelector('#preview-lightbox-next');
    const lbClose = lightbox.querySelector('#preview-lightbox-close');
    const lbCounter = lightbox.querySelector('#preview-lightbox-counter');

    let isPreviewOpen = false;
    let activeRequestId = 0;
    let lastPreviewPayload = null;
    let lightboxUrls = [];
    let lightboxIndex = 0;
    let isLightboxOpen = false;
    let lbTouchStartX = null;

    function safeText(value, fallback) {
        if (value == null) return fallback || '';
        const s = String(value).trim();
        return s || (fallback || '');
    }

    function formatBytes(bytes) {
        const n = Number(bytes);
        if (!Number.isFinite(n) || n < 0) return '';
        if (n < 1024) return n + ' B';
        const units = ['KB', 'MB', 'GB', 'TB'];
        let v = n;
        let i = -1;
        do {
            v /= 1024;
            i += 1;
        } while (v >= 1024 && i < units.length - 1);
        return v.toFixed(v >= 100 || i === 0 ? 0 : 1) + ' ' + units[i];
    }

    function extractHashFromMagnet(magnetUrl) {
        if (typeof magnetUrl !== 'string' || !magnetUrl) return '';
        const btihMatch = magnetUrl.match(/urn:btih:([a-zA-Z0-9]+)/i);
        if (btihMatch && btihMatch[1]) return btihMatch[1].toLowerCase();
        return '';
    }

    function buildMagnetFromHash(hash) {
        const h = safeText(hash).toLowerCase();
        if (!/^[a-f0-9]{40}$|^[a-z2-7]{32}$/i.test(h)) return '';
        return 'magnet:?xt=urn:btih:' + h;
    }

    function isSafeHttpUrl(url) {
        if (typeof url !== 'string') return false;
        try {
            const u = new URL(url.trim());
            return u.protocol === 'https:' || u.protocol === 'http:';
        } catch (_) {
            return false;
        }
    }

    function normalizeScreenshots(raw) {
        if (!Array.isArray(raw)) return [];
        const out = [];
        const seen = new Set();
        for (let i = 0; i < raw.length && out.length < MAX_SCREENSHOTS; i++) {
            const item = raw[i];
            if (item == null) continue;
            let url = '';
            let time = null;
            if (typeof item === 'string') {
                url = item;
            } else if (typeof item === 'object') {
                url = item.screenshot || item.url || item.src || item.image || '';
                if (item.time != null && Number.isFinite(Number(item.time))) time = Number(item.time);
            }
            url = safeText(url);
            if (!isSafeHttpUrl(url)) continue;
            if (seen.has(url)) continue;
            seen.add(url);
            out.push({ url, time });
        }
        return out;
    }

    function parseWhatslinkResponse(rawText) {
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (_) {
            return { ok: false, error: '接口返回非 JSON' };
        }
        if (data == null || typeof data !== 'object' || Array.isArray(data)) {
            return { ok: false, error: '接口数据结构异常' };
        }
        const apiError = safeText(data.error);
        if (apiError) {
            return { ok: false, error: apiError };
        }
        const screenshots = normalizeScreenshots(data.screenshots);
        return {
            ok: true,
            name: safeText(data.name || data.title, ''),
            type: safeText(data.type || data.file_type, ''),
            fileType: safeText(data.file_type || data.type, ''),
            size: Number.isFinite(Number(data.size)) ? Number(data.size) : null,
            count: Number.isFinite(Number(data.count)) ? Number(data.count) : null,
            screenshots,
            error: ''
        };
    }

    function setLoading(visible, text) {
        if (visible) {
            previewLoading.classList.add('visible');
            const t = previewLoading.querySelector('.loading-text');
            if (t) t.textContent = text || 'Loading preview...';
            previewBody.classList.remove('visible');
        } else {
            previewLoading.classList.remove('visible');
        }
    }

    function renderError(message) {
        previewBody.innerHTML = '';
        const el = document.createElement('div');
        el.className = 'preview-error';
        el.textContent = message || '预览失败';
        previewBody.appendChild(el);
        previewBody.classList.add('visible');
        setLoading(false);
    }

    function renderPreviewData(data, fallbackTitle) {
        previewBody.innerHTML = '';

        const meta = document.createElement('div');
        meta.className = 'preview-meta';

        const nameEl = document.createElement('div');
        nameEl.className = 'preview-meta-name';
        nameEl.textContent = data.name || fallbackTitle || 'Magnet Preview';
        meta.appendChild(nameEl);

        const row = document.createElement('div');
        row.className = 'preview-meta-row';
        const chips = [];
        if (data.fileType || data.type) chips.push(data.fileType || data.type);
        if (data.size != null) {
            const sizeText = formatBytes(data.size);
            if (sizeText) chips.push(sizeText);
        }
        if (data.count != null) chips.push(data.count + ' files');
        chips.forEach(label => {
            const chip = document.createElement('span');
            chip.className = 'preview-chip';
            chip.textContent = label;
            row.appendChild(chip);
        });
        if (row.childNodes.length) meta.appendChild(row);
        previewBody.appendChild(meta);

        if (!data.screenshots.length) {
            const empty = document.createElement('div');
            empty.className = 'preview-empty';
            empty.textContent = '暂无截图预览（接口未返回 screenshots）';
            previewBody.appendChild(empty);
        } else {
            const grid = document.createElement('div');
            grid.className = 'preview-shots';
            const shotUrls = data.screenshots.map(s => s.url).filter(Boolean);
            data.screenshots.forEach((shot, idx) => {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'preview-shot';
                card.title = '点击放大预览';
                card.setAttribute('data-idx', String(idx));

                const img = document.createElement('img');
                img.loading = 'lazy';
                img.decoding = 'async';
                img.alt = 'Screenshot ' + (idx + 1);
                img.referrerPolicy = 'no-referrer';
                img.src = shot.url;
                img.addEventListener('error', function onImgErr() {
                    img.removeEventListener('error', onImgErr);
                    card.innerHTML = '';
                    const fail = document.createElement('div');
                    fail.className = 'preview-shot-fail';
                    fail.textContent = '图片加载失败 #' + (idx + 1);
                    card.appendChild(fail);
                    card.disabled = true;
                    card.style.cursor = 'default';
                    card.title = '';
                });
                card.appendChild(img);

                if (shot.time != null && shot.time > 0) {
                    const cap = document.createElement('div');
                    cap.className = 'preview-shot-cap';
                    cap.textContent = 't=' + shot.time + 's';
                    card.appendChild(cap);
                }

                card.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (card.disabled) return;
                    openLightbox(shotUrls, idx);
                });

                grid.appendChild(card);
            });
            previewBody.appendChild(grid);
        }

        previewBody.classList.add('visible');
        setLoading(false);
        lastPreviewPayload = data;
    }

    function updateLightboxUi() {
        const total = lightboxUrls.length;
        const idx = lightboxIndex;
        if (!total || idx < 0 || idx >= total) {
            lbCounter.textContent = '';
            lbPrev.disabled = true;
            lbNext.disabled = true;
            return;
        }
        const url = lightboxUrls[idx];
        lbCounter.textContent = (idx + 1) + ' / ' + total;
        lbPrev.disabled = total <= 1;
        lbNext.disabled = total <= 1;

        if (lbImg.getAttribute('src') === url) {
            lbImg.classList.remove('is-loading');
            return;
        }
        lbImg.classList.add('is-loading');
        lbImg.onload = function() { lbImg.classList.remove('is-loading'); };
        lbImg.onerror = function() {
            lbImg.classList.remove('is-loading');
            lbImg.removeAttribute('src');
            lbImg.alt = '图片加载失败';
        };
        lbImg.alt = 'Screenshot ' + (idx + 1);
        lbImg.src = url;
    }

    function openLightbox(urls, startIndex) {
        const list = Array.isArray(urls) ? urls.filter(isSafeHttpUrl) : [];
        if (!list.length) return;
        let idx = Number(startIndex);
        if (!Number.isFinite(idx) || idx < 0) idx = 0;
        if (idx >= list.length) idx = list.length - 1;
        lightboxUrls = list;
        lightboxIndex = idx;
        isLightboxOpen = true;
        lightbox.classList.add('open');
        updateLightboxUi();
        // Prefetch neighbors
        [idx - 1, idx + 1].forEach(function(n) {
            if (n >= 0 && n < list.length) {
                const pre = new Image();
                pre.referrerPolicy = 'no-referrer';
                pre.src = list[n];
            }
        });
    }

    function closeLightbox() {
        if (!isLightboxOpen) return;
        isLightboxOpen = false;
        lightbox.classList.remove('open');
        lightboxUrls = [];
        lightboxIndex = 0;
        lbImg.removeAttribute('src');
        lbImg.alt = 'Screenshot';
        lbImg.classList.remove('is-loading');
        lbCounter.textContent = '';
    }

    function lightboxStep(delta) {
        if (!isLightboxOpen || !lightboxUrls.length) return;
        const total = lightboxUrls.length;
        // wrap around
        lightboxIndex = (lightboxIndex + delta + total) % total;
        updateLightboxUi();
        const prefIdx = (lightboxIndex + (delta >= 0 ? 1 : -1) + total) % total;
        if (lightboxUrls[prefIdx]) {
            const pre = new Image();
            pre.referrerPolicy = 'no-referrer';
            pre.src = lightboxUrls[prefIdx];
        }
    }

    lbPrev.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        lightboxStep(-1);
    });
    lbNext.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        lightboxStep(1);
    });
    lbClose.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        closeLightbox();
    });
    lightbox.addEventListener('click', function(e) {
        // click dimmed backdrop (not image / buttons)
        if (e.target === lightbox || e.target.id === 'preview-lightbox-stage') {
            closeLightbox();
        }
    });
    // swipe left/right on touch
    lightbox.addEventListener('touchstart', function(e) {
        if (!e.touches || !e.touches[0]) return;
        lbTouchStartX = e.touches[0].clientX;
    }, { passive: true });
    lightbox.addEventListener('touchend', function(e) {
        if (lbTouchStartX == null || !e.changedTouches || !e.changedTouches[0]) {
            lbTouchStartX = null;
            return;
        }
        const dx = e.changedTouches[0].clientX - lbTouchStartX;
        lbTouchStartX = null;
        if (Math.abs(dx) < 40) return;
        if (dx < 0) lightboxStep(1);
        else lightboxStep(-1);
    }, { passive: true });

    function closePreview() {
        closeLightbox();
        previewOverlay.classList.remove('active');
        isPreviewOpen = false;
        activeRequestId += 1;
        setTimeout(() => {
            if (!isPreviewOpen) {
                previewBody.innerHTML = '';
                previewBody.classList.remove('visible');
                setLoading(false);
                previewTitle.textContent = 'Magnet Preview';
            }
        }, 300);
    }

    function openPanel() {
        if (!isPreviewOpen) {
            previewOverlay.classList.add('active');
            isPreviewOpen = true;
        }
        previewToggle.classList.remove('visible');
    }

    function showToggle() {
        previewToggle.classList.add('visible');
    }

    function togglePreview() {
        if (isPreviewOpen) {
            closePreview();
            showToggle();
        } else if (lastPreviewPayload) {
            openPanel();
            renderPreviewData(lastPreviewPayload, previewTitle.textContent);
        } else {
            openPanel();
        }
    }

    previewToggle.addEventListener('click', togglePreview);
    previewClose.addEventListener('click', () => {
        closePreview();
        showToggle();
    });
    document.addEventListener('keydown', function(e) {
        if (isLightboxOpen) {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeLightbox();
                return;
            }
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                lightboxStep(-1);
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                lightboxStep(1);
                return;
            }
            return;
        }
        if (e.key === 'Escape' && isPreviewOpen) {
            closePreview();
            showToggle();
        }
    });

    function fetchWhatslink(magnetOrHash, title, triggerBtn) {
        const hash = extractHashFromMagnet(magnetOrHash) || safeText(magnetOrHash).toLowerCase();
        const magnet = magnetOrHash && String(magnetOrHash).indexOf('magnet:') === 0
            ? String(magnetOrHash)
            : buildMagnetFromHash(hash);

        if (!magnet) {
            openPanel();
            previewTitle.textContent = title || 'Magnet Preview';
            renderError('无效的磁力链接 / hash');
            showToggle();
            return;
        }

        const requestId = ++activeRequestId;
        openPanel();
        previewTitle.textContent = title || 'Magnet Preview';
        setLoading(true, 'Loading preview...');
        previewBody.innerHTML = '';
        previewBody.classList.remove('visible');
        showToggle();

        if (triggerBtn) triggerBtn.classList.add('is-loading');

        const url = WHATSLINK_API + '?url=' + encodeURIComponent(magnet);

        const finishBtn = () => {
            if (triggerBtn) triggerBtn.classList.remove('is-loading');
        };

        if (typeof GM_xmlhttpRequest !== 'function') {
            finishBtn();
            renderError('当前环境不支持 GM_xmlhttpRequest');
            return;
        }

        GM_xmlhttpRequest({
            method: 'GET',
            url,
            timeout: REQUEST_TIMEOUT_MS,
            headers: {
                'Accept': 'application/json, text/plain, */*'
            },
            onload: function(res) {
                if (requestId !== activeRequestId) { finishBtn(); return; }
                finishBtn();
                const status = res && typeof res.status === 'number' ? res.status : 0;
                if (status < 200 || status >= 300) {
                    renderError('接口 HTTP ' + status);
                    return;
                }
                const parsed = parseWhatslinkResponse(res.responseText || '');
                if (!parsed.ok) {
                    renderError(parsed.error || '预览失败');
                    return;
                }
                if (parsed.name) previewTitle.textContent = parsed.name;
                else if (title) previewTitle.textContent = title;
                renderPreviewData(parsed, title);
            },
            onerror: function() {
                if (requestId !== activeRequestId) { finishBtn(); return; }
                finishBtn();
                renderError('网络请求失败');
            },
            ontimeout: function() {
                if (requestId !== activeRequestId) { finishBtn(); return; }
                finishBtn();
                renderError('请求超时');
            }
        });
    }

    function handle1CiliSite() {
        const magnetBoxes = document.querySelectorAll('.magnet-box');
        magnetBoxes.forEach(box => {
            try {
                const inputField = box.querySelector('#input-magnet');
                if (!inputField) return;
                const magnetUrl = safeText(inputField.value);
                const hash = extractHashFromMagnet(magnetUrl);
                if (!hash) return;

                const pageTitle = safeText(
                    document.querySelector('.magnet-title') && document.querySelector('.magnet-title').textContent,
                    'Magnet Preview'
                );
                const btnGroup = box.querySelector('.input-group-btn');
                if (!btnGroup || btnGroup.querySelector('.preview-button-1cili')) return;

                const previewBtn = document.createElement('a');
                previewBtn.className = 'btn preview-button-1cili';
                previewBtn.innerHTML = '<svg class="svg-icon"><use xlink:href="/assets/icons.svg#icon-search"></use></svg>';
                previewBtn.title = '预览 Preview';
                previewBtn.href = 'javascript:void(0);';
                previewBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const latest = safeText(inputField.value) || magnetUrl;
                    fetchWhatslink(latest, pageTitle, previewBtn);
                });
                btnGroup.appendChild(previewBtn);
            } catch (err) {
                console.warn('[Magnet Buttons] 1cili preview inject failed', err);
            }
        });
    }

    function handleRegularSites() {
        const magnetLinks = document.querySelectorAll('a[href^="magnet:"]');
        magnetLinks.forEach(magnetLink => {
            try {
                if (magnetLink.dataset.emhMagnetBtns === '1') return;
                magnetLink.dataset.emhMagnetBtns = '1';

                const magnetUrl = magnetLink.getAttribute('href') || '';
                const hashPart = extractHashFromMagnet(magnetUrl);
                if (!hashPart) return;

                let title = '';
                const parentRow = magnetLink.closest('tr') || magnetLink.closest('.row') || magnetLink.closest('li');
                if (parentRow) {
                    const possibleTitleElement = parentRow.querySelector('h3, h4, .title, strong') ||
                        parentRow.querySelector('a[title]');
                    if (possibleTitleElement) {
                        title = safeText(possibleTitleElement.textContent) ||
                            safeText(possibleTitleElement.getAttribute('title'));
                    }
                }
                if (!title) {
                    const titleMatch = magnetUrl.match(/[?&]dn=([^&]+)/i);
                    if (titleMatch && titleMatch[1]) {
                        try {
                            title = decodeURIComponent(titleMatch[1].replace(/\+/g, ' '));
                        } catch (_) {
                            title = titleMatch[1];
                        }
                    } else {
                        title = 'Magnet: ' + hashPart.substring(0, 8) + '...';
                    }
                }

                const copyBtn = document.createElement('a');
                copyBtn.href = 'javascript:void(0);';
                copyBtn.innerHTML = '<i class="fa fa-fw fa-copy"></i>';
                copyBtn.className = 'magnet-btn';
                copyBtn.title = 'Copy Magnet Link';
                copyBtn.setAttribute('data-magnet', magnetUrl);
                copyBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const m = this.getAttribute('data-magnet') || '';
                    try {
                        GM_setClipboard(m);
                    } catch (_) {
                        try { navigator.clipboard.writeText(m); } catch (err2) { /* ignore */ }
                    }
                    this.classList.add('copy-success');
                    this.title = 'Copied!';
                    setTimeout(() => {
                        this.classList.remove('copy-success');
                        this.title = 'Copy Magnet Link';
                    }, 1500);
                });

                const previewBtn = document.createElement('a');
                previewBtn.href = 'javascript:void(0);';
                previewBtn.innerHTML = '<i class="fa fa-fw fa-eye"></i>';
                previewBtn.className = 'magnet-btn preview-btn';
                previewBtn.title = 'Preview screenshots';
                previewBtn.setAttribute('data-hash', hashPart);
                previewBtn.setAttribute('data-title', title);
                previewBtn.setAttribute('data-magnet', magnetUrl);
                previewBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const m = this.getAttribute('data-magnet') || this.getAttribute('data-hash') || '';
                    const t = this.getAttribute('data-title') || '';
                    fetchWhatslink(m, t, previewBtn);
                });

                magnetLink.insertAdjacentElement('afterend', previewBtn);
                magnetLink.insertAdjacentElement('afterend', copyBtn);
            } catch (err) {
                console.warn('[Magnet Buttons] regular site inject failed', err);
            }
        });
    }

    const hostname = window.location.hostname || '';
    try {
        if (hostname.indexOf('1cili.com') !== -1) handle1CiliSite();
        else handleRegularSites();
    } catch (err) {
        console.error('[Magnet Buttons] init failed', err);
    }
})();
