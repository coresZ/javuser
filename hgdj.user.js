// ==UserScript==
// @name         黄果短剧 去广告 + 自动过年龄验证
// @namespace    https://huangguoai.com/
// @version      1.2
// @description  自动点击年龄验证、移除广告 iframe/悬浮层/弹窗，适配详情页与播放页
// @author       Grok
// @match        *://huangguoai.com/*
// @match        *://*.huangguoai.com/*
// @match        *://huangguo1.com/*
// @match        *://huangguo2.com/*
// @match        *://huangguoai.pages.dev/*
// @match        *://acm0.kepzhlhni.cc/*
// @match        *://ubg6k.kepzhlhni.cc/*
// @match        *://gkuxk1.kepzhlhni.cc/*
// @match        *://*.kepzhlhni.cc/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // ========== 1. 自动过年龄验证 ==========
    function passAgeGate() {
        // 常见存储键
        try {
            localStorage.setItem('ageVerified', 'true');
            localStorage.setItem('age_verified', '1');
            localStorage.setItem('adult_confirmed', '1');
            localStorage.setItem('isAdult', 'true');
            sessionStorage.setItem('ageVerified', 'true');
        } catch (e) {}

        // 点击黄色按钮
        const keywords = ['我已年满', '进入网站', '18', '进入'];
        const candidates = document.querySelectorAll('button, a, div[role="button"], .btn, [class*="btn"], [class*="button"]');
        for (const el of candidates) {
            const text = (el.textContent || '').trim();
            if (keywords.some(k => text.includes(k)) && text.length < 30) {
                el.click();
                // 再强制隐藏遮罩
                const overlay = el.closest('div[style*="position"], .modal, .overlay, [class*="mask"], [class*="gate"]');
                if (overlay) overlay.style.display = 'none';
                break;
            }
        }

        // 兜底：隐藏整页年龄遮罩
        document.querySelectorAll('body > div').forEach(div => {
            const t = (div.textContent || '');
            if (t.includes('本站含有成人内容') || t.includes('仅限年满 18')) {
                div.style.display = 'none';
                div.remove();
            }
        });
    }

    // ========== 2. 去广告核心 ==========
    const AD_SELECTORS = [
        // 通用广告
        'iframe[src*="ad"]',
        'iframe[src*="ads"]',
        'iframe[src*="advert"]',
        'iframe[src*="banner"]',
        'iframe[src*="pop"]',
        'iframe[src*="promo"]',
        'iframe[id*="ad"]',
        'iframe[class*="ad"]',
        // 悬浮 / 弹层
        '[class*="float-ad"]',
        '[class*="floating-ad"]',
        '[class*="popup-ad"]',
        '[class*="ad-popup"]',
        '[class*="ad-banner"]',
        '[class*="ad-box"]',
        '[class*="ad-wrap"]',
        '[id*="ad-"]',
        '[id*="ads-"]',
        '[id*="banner"]',
        // 常见中文站广告类名
        '.gg', '.guanggao', '.adbox', '.ad_box', '.ads',
        // 遮罩广告
        '[class*="mask-ad"]',
        '[class*="overlay-ad"]',
        // 底部固定条
        'div[style*="position: fixed"][style*="bottom"]',
        'div[style*="position:fixed"][style*="bottom"]'
    ];

    function removeAds() {
        // 选择器移除
        AD_SELECTORS.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                // 避免误伤播放器
                if (el.closest('video, .player, .video-player, #player, [class*="player"]')) return;
                el.remove();
            });
        });

        // 尺寸异常的 iframe（常见广告尺寸）
        document.querySelectorAll('iframe').forEach(iframe => {
            const src = (iframe.src || '').toLowerCase();
            const w = iframe.offsetWidth || parseInt(iframe.width) || 0;
            const h = iframe.offsetHeight || parseInt(iframe.height) || 0;
            if (
                src.includes('ad') || src.includes('ads') || src.includes('doubleclick') ||
                src.includes('google') || src.includes('pop') ||
                (w > 0 && h > 0 && (w <= 300 || h <= 250) && !src.includes('huangguo') && !src.includes('kepzhlhni'))
            ) {
                if (!iframe.closest('video, .player, .video-player')) {
                    iframe.remove();
                }
            }
        });

        // 关闭弹窗按钮自动点
        document.querySelectorAll('[class*="close"], [class*="btn-close"], .close-btn, [aria-label*="关闭"]').forEach(btn => {
            const parentText = (btn.parentElement?.textContent || '').toLowerCase();
            if (parentText.includes('广告') || parentText.includes('ad') || parentText.includes('推广')) {
                btn.click();
            }
        });
    }

    // ========== 3. 持续监听 ==========
    function startObserver() {
        const observer = new MutationObserver(() => {
            passAgeGate();
            removeAds();
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    // ========== 启动 ==========
    function init() {
        passAgeGate();
        removeAds();
        startObserver();

        // 延迟再清几次，防止动态加载广告
        [800, 2000, 4000, 8000].forEach(t => {
            setTimeout(() => {
                passAgeGate();
                removeAds();
            }, t);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 最早期再跑一次
    passAgeGate();
})();