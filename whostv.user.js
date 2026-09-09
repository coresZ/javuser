// ==UserScript==
// @name         whosTv收藏/加专题/扩展
// @namespace    https://whos.tv/
// @version      3.4
// @description  列表页卡片注入 + JCS pickButtons 二级按钮组（收藏 / 加专题）
// @author       you
// @match        https://whos.tv/topics/details/*
// @match        https://whos.tv/topics/*
// @match        https://whos.tv/videos
// @match        https://whos.tv/actresses/*
// @match        https://whos.tv/ranking/video
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @grant        GM.addStyle
// @grant        unsafeWindow
// @connect      whos.tv
// @license      MIT
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // ========== GM 安全探测 ==========
    var gmXhr = null;
    if (typeof GM_xmlhttpRequest === 'function') {
        gmXhr = GM_xmlhttpRequest;
    } else if (typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function') {
        gmXhr = function (opts) {
            var p = GM.xmlHttpRequest(opts);
            if (p && typeof p.then === 'function') {
                p.then(function (res) { if (opts.onload) opts.onload(res); })
                 .catch(function (err) { if (opts.onerror) opts.onerror(err); });
            }
            return p;
        };
    }

    var gmAddStyle = null;
    if (typeof GM_addStyle === 'function') {
        gmAddStyle = GM_addStyle;
    } else if (typeof GM !== 'undefined' && typeof GM.addStyle === 'function') {
        gmAddStyle = GM.addStyle;
    }

    function safeAddStyle(css) {
        if (gmAddStyle) {
            try { gmAddStyle(css); return; } catch (e) {}
        }
        var style = document.createElement('style');
        style.type = 'text/css';
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }

    function safeXhr(opts) {
        if (gmXhr) {
            return new Promise(function (resolve, reject) {
                var o = {};
                for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
                o.onload = function (res) { resolve(res); };
                o.onerror = function (err) { reject(err || new Error('network error')); };
                o.ontimeout = function () { reject(new Error('timeout')); };
                try { gmXhr(o); } catch (e) { reject(e); }
            });
        }
        var url = opts.url;
        var method = (opts.method || 'GET').toUpperCase();
        var init = { method: method, credentials: 'include', headers: opts.headers || {} };
        if (opts.data && method !== 'GET' && method !== 'HEAD') init.body = opts.data;
        return fetch(url, init).then(function (r) {
            return r.text().then(function (text) {
                return { status: r.status, responseText: text, response: text };
            });
        });
    }

    // ========== 样式 ==========
    safeAddStyle(
        '.whos-btn-row{display:flex;gap:6px;margin-top:8px;padding:0 1px 2px}' +
        '.whos-btn{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:5px;height:30px;padding:0 8px;font-size:12px;font-weight:500;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.55);cursor:pointer;transition:color .15s ease,background .15s ease,border-color .15s ease;white-space:nowrap;line-height:1;-webkit-tap-highlight-color:transparent;touch-action:manipulation}' +
        '.whos-btn:hover{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.92);border-color:rgba(255,255,255,0.18)}' +
        '.whos-btn:disabled{opacity:.5;cursor:not-allowed}' +
        '.whos-btn.success{border-color:rgba(245,158,11,0.45);color:rgb(251,191,36);background:rgba(245,158,11,0.12)}' +
        '.whos-toast-wrap{position:fixed;top:72px;right:20px;z-index:100060;display:flex;flex-direction:column;gap:8px;align-items:flex-end;pointer-events:none}' +
        '.whos-toast{padding:10px 16px;border-radius:12px;color:#fff;font-size:13px;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,.35);max-width:min(320px,calc(100vw - 40px));opacity:0;transform:translateX(120%);transition:opacity .25s ease,transform .25s ease;pointer-events:auto}' +
        '.whos-toast.show{opacity:1;transform:translateX(0)}' +
        '.whos-toast.ok{background:#059669}' +
        '.whos-toast.err{background:#dc2626}' +
        '.whos-mask{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:99998;overflow-y:auto;padding:16px 0}' +
        '.whos-topic-panel{position:relative;margin:0 auto;width:min(512px,calc(100vw - 24px));max-height:min(90vh,640px);background:#16162a;border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 24px 48px rgba(0,0,0,.5);z-index:99999;overflow:hidden;display:flex;flex-direction:column;color:#e4e4e7;font-size:14px}' +
        '.whos-topic-panel .hd{padding:16px 20px 12px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0;position:relative}' +
        '.whos-topic-panel .hd-title{font-size:16px;font-weight:600;color:#fff;padding-right:36px}' +
        '.whos-topic-panel .hd-sub{margin-top:6px;font-size:13px;color:rgba(255,255,255,.7);word-break:break-all}' +
        '.whos-topic-panel .close{position:absolute;right:12px;top:12px;width:28px;height:28px;border-radius:999px;border:none;background:rgba(255,255,255,.06);color:rgba(255,255,255,.7);cursor:pointer;display:flex;align-items:center;justify-content:center}' +
        '.whos-topic-panel .close:hover{background:rgba(255,255,255,.12);color:#fff}' +
        '.whos-topic-panel .search-wrap{padding:12px 20px 0;flex-shrink:0}' +
        '.whos-topic-panel .search-box input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:13px;outline:none}' +
        '.whos-topic-panel .search-box input:focus{border-color:rgba(251,146,60,.5)}' +
        '.whos-topic-panel .total{padding:8px 20px 0;font-size:12px;color:rgba(255,255,255,.4);flex-shrink:0}' +
        '.whos-topic-panel .list{flex:1;min-height:0;overflow-y:auto;padding:8px 20px;display:flex;flex-direction:column;gap:8px}' +
        '.whos-topic-panel .item{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);cursor:pointer;min-height:68px}' +
        '.whos-topic-panel .item:hover{background:rgba(255,255,255,.06)}' +
        '.whos-topic-panel .item.exists{border-color:rgba(251,146,60,.25);background:rgba(251,146,60,.06)}' +
        '.whos-topic-panel .item.loading{opacity:.55;pointer-events:none}' +
        '.whos-topic-panel .item-cover{width:48px;height:48px;border-radius:8px;object-fit:cover;background:rgba(255,255,255,.06);flex-shrink:0}' +
        '.whos-topic-panel .item-body{flex:1;min-width:0}' +
        '.whos-topic-panel .item-title{font-size:13.5px;font-weight:500;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.whos-topic-panel .item-meta{font-size:12px;color:rgba(255,255,255,.4)}' +
        '.whos-topic-panel .item-action{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:rgba(255,255,255,.55);flex-shrink:0}' +
        '.whos-topic-panel .item.exists .item-action{border-color:rgba(251,146,60,.4);background:rgba(251,146,60,.15);color:#fb923c}' +
        '.whos-topic-panel .empty,.whos-topic-panel .loading-tip,.whos-topic-panel .error{padding:40px 16px;text-align:center;color:rgba(255,255,255,.4);font-size:13px}' +
        '.whos-topic-panel .error{color:#f87171}' +
        '.whos-topic-panel .ft{padding:14px 20px;border-top:1px solid rgba(255,255,255,.08);flex-shrink:0}' +
        '.whos-topic-panel .create{display:flex;align-items:center;justify-content:center;width:100%;padding:10px;border-radius:12px;border:1px dashed rgba(255,255,255,.15);color:rgba(255,255,255,.45);font-size:13px;text-decoration:none}' +
        '.whos-topic-panel .create:hover{color:#fff;border-color:rgba(255,255,255,.3)}'
    );

    // ========== Toast ==========
    function ensureToastWrap() {
        var wrap = document.querySelector('.whos-toast-wrap');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.className = 'whos-toast-wrap';
            document.body.appendChild(wrap);
        }
        return wrap;
    }
    function toast(msg, type) {
        type = type || 'ok';
        var wrap = ensureToastWrap();
        var el = document.createElement('div');
        el.className = 'whos-toast ' + type;
        el.textContent = msg;
        wrap.appendChild(el);
        requestAnimationFrame(function () { el.classList.add('show'); });
        setTimeout(function () {
            el.classList.remove('show');
            setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 280);
        }, 2200);
    }

    // ========== API ==========
    function getSlugFromHref(href) {
        if (!href) return null;
        var m = href.match(/\/videos\/([a-zA-Z0-9\-_]+)/i);
        return m ? m[1] : null;
    }

    function request(opts) {
        var method = opts.method || 'GET';
        var url = opts.url;
        var body = opts.body;
        var fullUrl = (url.indexOf('http') === 0) ? url : ('https://whos.tv' + url);
        return safeXhr({
            method: method,
            url: fullUrl,
            headers: { 'Content-Type': 'application/json' },
            data: body ? JSON.stringify(body) : undefined,
            withCredentials: true
        }).then(function (res) {
            var data;
            try { data = JSON.parse(res.responseText || '{}'); } catch (e) {
                throw new Error(res.responseText || '解析失败');
            }
            if (res.status >= 200 && res.status < 300 &&
                (data.code === 200000 || data.message === 'success' || !data.code)) {
                return data;
            }
            throw new Error(data.message || ('HTTP ' + res.status));
        });
    }

    function extractNumericId(html) {
        var m = html.match(/data-id=["'](\d{3,})["'][^>]*(?:favorite|收藏)|(?:favorite|收藏)[^>]*data-id=["'](\d{3,})["']/i);
        if (m) return m[1] || m[2];
        m = html.match(/data-(?:video-)?id=["'](\d{4,})["']/i);
        if (m) return m[1];
        m = html.match(/\/api\/videos\/(\d+)\/(?:favorite|rating)/);
        if (m) return m[1];
        m = html.match(/"(?:id|video_id)"\s*:\s*(\d{4,})/);
        if (m) return m[1];
        m = html.match(/(?:toggleFavorite|showRating)\([^)]*['"](\d{4,})['"]/);
        if (m) return m[1];
        return null;
    }

    var idCache = {};
    function getNumericId(slug) {
        if (idCache[slug]) return Promise.resolve(idCache[slug]);
        return safeXhr({
            method: 'GET',
            url: 'https://whos.tv/videos/' + slug,
            withCredentials: true
        }).then(function (res) {
            if (res.status !== 200) throw new Error('获取详情页失败');
            var id = extractNumericId(res.responseText);
            if (!id) throw new Error('无法解析影片数字 ID');
            idCache[slug] = id;
            return id;
        });
    }

    function doFavorite(slug) {
        return getNumericId(slug).then(function (numericId) {
            return request({
                method: 'POST',
                url: '/api/videos/' + numericId + '/favorite'
            }).then(function () { return numericId; });
        });
    }

    function fetchTopics(slug) {
        return request({
            method: 'GET',
            url: '/api/topics?type=video&id=' + encodeURIComponent(slug) + '&per_page=50&page=1'
        }).then(function (data) {
            var list = (data && data.data && data.data.data) || [];
            var total = (data && data.data && data.data.total != null) ? data.data.total : list.length;
            return { list: list, total: total };
        });
    }

    function addToTopic(topicId, slug) {
        return request({ method: 'PUT', url: '/api/topics/' + topicId + '/video', body: { fh: slug } });
    }
    function removeFromTopic(topicId, slug) {
        return request({ method: 'DELETE', url: '/api/topics/' + topicId + '/video', body: { fh: slug } });
    }

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function bindTap(el, handler) {
        var touched = false;
        el.addEventListener('touchstart', function () { touched = true; }, false);
        el.addEventListener('click', function (e) {
            if (e.preventDefault) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            handler(e);
            touched = false;
        }, true);
        el.addEventListener('touchend', function (e) {
            if (!touched) return;
            if (e.preventDefault) e.preventDefault();
            if (e.stopPropagation) e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            handler(e);
            touched = false;
        }, false);
    }

    // ========== 专题弹窗 ==========
    function showTopicPanel(slug) {
        var mask = document.createElement('div');
        mask.className = 'whos-mask';
        var panel = document.createElement('div');
        panel.className = 'whos-topic-panel';
        panel.innerHTML =
            '<div class="hd"><div class="hd-title">加入专题</div><div class="hd-sub">' + escapeHtml(slug) + '</div>' +
            '<button type="button" class="close">✕</button></div>' +
            '<div class="search-wrap"><div class="search-box"><input type="search" placeholder="搜索我的专题..." /></div></div>' +
            '<div class="total">加载中...</div><div class="list"><div class="loading-tip">加载中...</div></div>' +
            '<div class="ft"><a class="create" href="https://whos.tv/topics/create" target="_blank">+ 创建新专题</a></div>';

        var center = document.createElement('div');
        center.style.cssText = 'min-height:100%;display:flex;align-items:center;justify-content:center;';
        center.appendChild(panel);
        mask.appendChild(center);
        document.body.appendChild(mask);

        function close() {
            document.removeEventListener('keydown', onKey);
            if (mask.parentNode) mask.parentNode.removeChild(mask);
        }
        function onKey(e) { if (e.key === 'Escape' || e.keyCode === 27) close(); }
        document.addEventListener('keydown', onKey);
        mask.addEventListener('click', function (e) {
            if (e.target === mask || e.target === center) close();
        });
        bindTap(panel.querySelector('.close'), close);

        var listEl = panel.querySelector('.list');
        var totalEl = panel.querySelector('.total');
        var searchInput = panel.querySelector('input');
        var allList = [];

        function render(list) {
            if (!list || !list.length) {
                listEl.innerHTML = '<div class="empty">暂无专题</div>';
                return;
            }
            var html = '';
            for (var i = 0; i < list.length; i++) {
                var t = list[i];
                html += '<div class="item ' + (t.is_exists ? 'exists' : '') + '" data-id="' + t.id + '">' +
                    (t.cover_image ? '<img class="item-cover" src="' + escapeHtml(t.cover_image) + '" loading="lazy">' : '<div class="item-cover"></div>') +
                    '<div class="item-body"><div class="item-title">' + escapeHtml(t.title) + '</div>' +
                    '<div class="item-meta">' + (t.video_count || 0) + ' 个内容</div></div>' +
                    '<div class="item-action">' + (t.is_exists ? '✓' : '+') + '</div></div>';
            }
            listEl.innerHTML = html;

            var items = listEl.querySelectorAll('.item');
            for (var j = 0; j < items.length; j++) {
                (function (el) {
                    bindTap(el, function () {
                        if (el.classList.contains('loading')) return;
                        var topicId = el.getAttribute('data-id');
                        var exists = el.classList.contains('exists');
                        el.classList.add('loading');
                        var p = exists ? removeFromTopic(topicId, slug) : addToTopic(topicId, slug);
                        p.then(function () {
                            if (exists) {
                                el.classList.remove('exists');
                                el.querySelector('.item-action').textContent = '+';
                                toast('已从专题移除');
                            } else {
                                el.classList.add('exists');
                                el.querySelector('.item-action').textContent = '✓';
                                toast('已加入专题');
                            }
                        }).catch(function (err) {
                            toast((exists ? '移除' : '加入') + '失败：' + (err.message || err), 'err');
                        }).then(function () { el.classList.remove('loading'); });
                    });
                })(items[j]);
            }
        }

        searchInput.addEventListener('input', function () {
            var q = searchInput.value.trim().toLowerCase();
            if (!q) { render(allList); return; }
            render(allList.filter(function (t) {
                return (t.title || '').toLowerCase().indexOf(q) !== -1;
            }));
        });

        fetchTopics(slug).then(function (result) {
            allList = result.list;
            totalEl.textContent = '共 ' + result.total + ' 个专题';
            render(result.list);
        }).catch(function (err) {
            totalEl.textContent = '';
            listEl.innerHTML = '<div class="error">加载失败：' + escapeHtml(err.message || err) + '</div>';
        });
    }

    // ========== 页面卡片注入（原功能） ==========
    function createButtons(slug) {
        var collectBtn = document.createElement('button');
        collectBtn.className = 'whos-btn';
        collectBtn.type = 'button';
        collectBtn.innerHTML = '<span>♥</span><span class="whos-label">收藏</span>';

        var topicBtn = document.createElement('button');
        topicBtn.className = 'whos-btn';
        topicBtn.type = 'button';
        topicBtn.innerHTML = '<span>+</span><span class="whos-label">加专题</span>';

        bindTap(collectBtn, function () {
            if (collectBtn.disabled) return;
            collectBtn.disabled = true;
            var label = collectBtn.querySelector('.whos-label');
            label.textContent = '...';
            doFavorite(slug).then(function () {
                label.textContent = '已收藏';
                collectBtn.classList.add('success');
                toast(slug + ' 收藏成功');
            }).catch(function (err) {
                label.textContent = '失败';
                collectBtn.disabled = false;
                toast('收藏失败：' + (err.message || err), 'err');
            });
        });

        bindTap(topicBtn, function () {
            showTopicPanel(slug);
        });

        return [collectBtn, topicBtn];
    }

    function findInfoArea(cardLink) {
        var infoArea = cardLink.querySelector('.flex.flex-1.flex-col.gap-1.px-1.pb-1');
        if (infoArea) return infoArea;
        var candidates = cardLink.querySelectorAll('.flex.flex-col, .flex-1.flex-col, [class*="flex-col"]');
        for (var i = 0; i < candidates.length; i++) {
            var el = candidates[i];
            if (el.querySelector('h2, h3, .text-sm, .line-clamp-1, .line-clamp-2') ||
                (el.children.length >= 1 && !el.querySelector('img'))) {
                return el;
            }
        }
        var all = cardLink.querySelectorAll('[class*="flex"]');
        for (var j = all.length - 1; j >= 0; j--) {
            var cls = all[j].className || '';
            if (cls.indexOf('flex-col') !== -1 || cls.indexOf('gap-') !== -1) {
                return all[j];
            }
        }
        return null;
    }

    function injectCard(cardLink) {
        if (cardLink.getAttribute('data-whos-injected')) return;
        cardLink.setAttribute('data-whos-injected', '1');
        var href = cardLink.getAttribute('href');
        var slug = getSlugFromHref(href);
        if (!slug) return;
        var infoArea = findInfoArea(cardLink);
        if (!infoArea || infoArea.querySelector('.whos-btn-row')) return;
        var buttons = createButtons(slug);
        var row = document.createElement('div');
        row.className = 'whos-btn-row';
        row.appendChild(buttons[0]);
        row.appendChild(buttons[1]);
        infoArea.appendChild(row);
    }

    function scan(root) {
        if (!root) root = document;
        var links = root.querySelectorAll('#topic-videos-list a.group.block[href*="/videos/"], a.group.block[href*="/videos/"]');
        for (var i = 0; i < links.length; i++) injectCard(links[i]);
    }

    function isVideoLink(node) {
        if (!node || node.nodeType !== 1 || node.tagName !== 'A') return false;
        var href = node.getAttribute('href') || '';
        if (href.indexOf('/videos/') === -1) return false;
        var cls = node.className || '';
        return cls.indexOf('group') !== -1 && cls.indexOf('block') !== -1;
    }

    function startPageInject() {
        if (location.hostname.indexOf('whos.tv') === -1) return;
        var observer = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var added = mutations[i].addedNodes;
                for (var j = 0; j < added.length; j++) {
                    var node = added[j];
                    if (node.nodeType !== 1) continue;
                    if (isVideoLink(node)) injectCard(node);
                    else if (node.querySelectorAll) scan(node);
                }
            }
        });
        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
            scan();
        }
        setTimeout(scan, 500);
        setTimeout(scan, 1500);
        setTimeout(scan, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startPageInject);
    } else {
        startPageInject();
    }
    setTimeout(startPageInject, 1500);

    // ========== JCS 扩展：二级按钮组（契约 v1.1 ≥1.5.80） ==========
    var MANIFEST = {
        id: 'whos-tv-favorite-topic',
        name: 'wtv',
        version: '3.4',
        pickButtons: [
            {
                id: 'whos-tv',
                label: 'whosTv',
                title: 'whosTv',
                order: 10,
                // 二级按钮组：点击组名展开
                items: [
                    {
                        id: 'favorite',
                        label: '收藏',
                        onClick: function (code, ctx) {
                            if (!code) {
                                if (ctx && ctx.showToast) ctx.showToast('无有效番号');
                                return;
                            }
                            var slug = String(code).trim().toLowerCase();
                            return doFavorite(slug).then(function () {
                                toast(slug + ' 收藏成功');
                                if (ctx && ctx.showToast) ctx.showToast(slug + ' 收藏成功');
                                return { ok: true, close: true };
                            }).catch(function (err) {
                                toast('收藏失败：' + (err.message || err), 'err');
                                if (ctx && ctx.showToast) ctx.showToast('收藏失败');
                                return { ok: false };
                            });
                        }
                    },
                    {
                        id: 'add-topic',
                        label: '加专题',
                        onClick: function (code, ctx) {
                            if (!code) {
                                if (ctx && ctx.showToast) ctx.showToast('无有效番号');
                                return;
                            }
                            var slug = String(code).trim().toLowerCase();
                            showTopicPanel(slug);
                            return { ok: true, close: true };
                        }
                    }
                ]
            }
        ]
    };

    function getKit() {
        if (typeof unsafeWindow !== 'undefined' && unsafeWindow.JavCodeKit) {
            return unsafeWindow.JavCodeKit;
        }
        if (window.JavCodeKit) return window.JavCodeKit;
        return null;
    }

    function tryRegister() {
        var kit = getKit();
        if (kit && kit.__ready && kit.extensions && typeof kit.extensions.register === 'function') {
            try {
                kit.extensions.register(MANIFEST);
                console.log('[whos-tv-ext] 二级按钮组注册成功');
            } catch (e) {
                console.warn('[whos-tv-ext] 注册失败', e);
            }
            return true;
        }
        return false;
    }

    if (!tryRegister()) {
        window.addEventListener('jcs:kit-ready', tryRegister, { once: true });
        if (typeof unsafeWindow !== 'undefined' && unsafeWindow !== window) {
            try {
                unsafeWindow.addEventListener('jcs:kit-ready', tryRegister, { once: true });
            } catch (e) {}
        }
        var n = 0;
        var t = setInterval(function () {
            if (tryRegister() || ++n > 120) clearInterval(t);
        }, 500);
    }
})();