// ==UserScript==
// @name         JCS 扩展测试样例（契约 v1）
// @namespace    jcs.test
// @version      1.0.0
// @description  验证 JCS 扩展宿主：action 按钮 + 页面挂载 + 样式注入 三类扩展点
// @match        *://*/*
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    var MANIFEST = {
        id: 'jcs-test-ext',
        name: '测试扩展',
        version: '1.0.0',
        actions: [{
            act: 'hello',
            title: '测试操作',
            onClick: function (code, ctx) {
                ctx.showToast('测试扩展收到番号：' + code + '（点击 ⋯ 后的按钮）', 'info');
                return 'done';
            }
        }, {
            act: 'async-test',
            title: '异步操作',
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
            onClick: function (code, ctx) {
                return new Promise(function (resolve) {
                    setTimeout(function () { resolve('done'); }, 1200);
                });
            }
        }],
        styles: [{
            css: 'html[data-jcs-test-ext="1"]::after{content:"✅ JCS 测试扩展样式已生效";position:fixed;right:12px;bottom:84px;z-index:2147483000;background:#5e6ad2;color:#fff;font:12px/1.4 monospace;padding:6px 10px;border-radius:8px;pointer-events:none;opacity:.92}'
        }],
        mounts: [{
            match: ['*'],
            mount: function (ctx) {
                var box = document.createElement('div');
                box.id = 'jcs-ext-jcs-test-ext-banner';
                box.style.cssText = 'position:fixed;left:12px;bottom:84px;z-index:2147483000;background:#1a1a1a;color:#3fb950;border:1px dashed #555;border-radius:8px;padding:6px 10px;font:12px/1.4 monospace;';
                box.textContent = '🧩 测试扩展挂载中（禁用扩展后此横幅应消失）';
                document.body.appendChild(box);
                ctx.onCleanup(function () { box.remove(); });
            }
        }]
    };

    // 把样式生效开关也交给扩展自身（宿主只管注入/移除）
    try { document.documentElement.setAttribute('data-jcs-test-ext', '1'); } catch (e) {}
    var prevOnCleanup = null;

    function tryRegister() {
        var kit = window.JavCodeKit;
        if (kit && kit.__ready && kit.extensions) {
            try { kit.extensions.register(MANIFEST); } catch (e) { console.warn('[jcs-test-ext]', e); }
            return true;
        }
        return false;
    }
    if (tryRegister()) return;
    window.addEventListener('jcs:kit-ready', tryRegister, { once: true });
    var n = 0;
    var t = setInterval(function () { if (tryRegister() || ++n > 120) clearInterval(t); }, 500);
})();
