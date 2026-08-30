// ==UserScript==
// @name         WebdevComponent
// @namespace    cdn.bootcss.com
// @version      1.0.0
// @description  WebDAV 云端备份共享组件库（createWebdev 工厂；Enhanced_Media_Helper / jav-code-scanner 等脚本可 @require 使用）
// @author       cores
// @license      MPL
// @grant        none
// ==/UserScript==
/**
 * 共享 WebDAV 客户端组件 v1.0.0（发布名 WebdevComponent · Greasy Fork 库 593538）
 * 真源 = 本文件 webdev-library.user.js（元数据头 + 组件体一体）；先供 Enhanced_Media_Helper 使用，后续可给 jav-code-scanner。
 *
 * 设计原则：
 * - 纯逻辑组件：不引用 GM_*、不引用任何脚本全局对象；浏览器 UMD + CommonJS（Node 测试）双出口。
 * - 实例化 `createWebdev(env)`，依赖全部由消费方注入：
 *     storage        { get(key, fallback), set(key, value) }  设置持久化（每个脚本各自的 GM 存储）
 *     request        (opts) => Promise<res>                   网络适配器（GM_xmlhttpRequest 等）
 *     exportPayload  () => string                             备份载荷生成器（如番号库全量 JSON）
 *     以及 key / defaultFile / encMark 三套命名空间常量
 * - 凭据安全：账号/密码只经注入的 storage 按脚本隔离保存；加密备份采用 AES-256-GCM + PBKDF2-SHA256（120k 迭代）。
 * - 备份协议与 jav-code-scanner 同构（PUT/GET JSON 文件；加密包为信封格式），ENC_MARK 按消费方独立。
 *
 * 同步说明（真源 = 本文件，即 Greasy Fork 库页面源码）：
 * - 修改流程：① 编辑本文件 → ② 回填 Greasy Fork 库页面（https://greasyfork.org/scripts/593538）→ ③ 运行 `node tools/sync-webdev.js` 同步嵌入 Enhanced_Media_Helper.js 标记块（勿手改嵌入副本）
 * - UMD 幂等：同名全局已存在时不再覆盖，保证「@require 库 + 内嵌副本」同时存在时无冲突
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        if (!root.WebdevComponent) root.WebdevComponent = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const VERSION = '1.0.0';

    /**
     * 创建 WebDAV 客户端实例。
     * @param {object} env
     * @param {string} [env.key='webdev_opts_v1']        设置存储键名
     * @param {string} [env.defaultFile='webdev-backup.json'] 默认备份文件名
     * @param {string} [env.encMark='webdev-aes-gcm-v1'] 加密备份信封标记
     * @param {{get:Function, set:Function}} [env.storage]     设置持久化适配器
     * @param {Function} [env.request]     网络适配器；opts={method,url,headers,data,timeout,acceptStatuses}，resolve 原始响应 / reject Error
     * @param {Function} [env.exportPayload] 备份载荷生成器，返回明文 JSON 字符串
     */
    function createWebdev(env) {
        const o = env || {};
        const cfg = {
            key: String(o.key || 'webdev_opts_v1'),
            defaultFile: String(o.defaultFile || 'webdev-backup.json'),
            encMark: String(o.encMark || 'webdev-aes-gcm-v1')
        };
        const storage = o.storage || { get: () => null, set: () => {} };
        const request = typeof o.request === 'function' ? o.request : null;
        const exportPayload = typeof o.exportPayload === 'function' ? o.exportPayload : null;

        // ===== 设置 =====

        // 归一化设置对象：URL/用户名/密码/文件名/加密开关/加密密码
        function normalize(raw) {
            const s = raw && typeof raw === 'object' ? raw : {};
            return {
                url: String(s.url || '').trim(),
                user: String(s.user || '').trim(),
                pass: String(s.pass || ''),
                file: String(s.file || cfg.defaultFile).trim() || cfg.defaultFile,
                encrypt: s.encrypt === true || s.encrypt === '1' || s.encrypt === 1,
                secret: String(s.secret || '')
            };
        }

        function load() {
            let raw = null;
            try { raw = storage.get(cfg.key, null); } catch (e) { raw = null; }
            return normalize(raw);
        }

        function save(partial) {
            const next = normalize(Object.assign({}, load(), partial || {}));
            try { storage.set(cfg.key, next); } catch (e) { /* ignore */ }
            return next;
        }

        // ===== base64 工具（UTF-8 安全） =====

        function b64EncodeUtf8(str) {
            try {
                return btoa(unescape(encodeURIComponent(String(str || ''))));
            } catch (e) {
                try { return btoa(String(str || '')); } catch (e2) { return ''; }
            }
        }

        function bytesToB64(bytes) {
            const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
            let s = '';
            const chunk = 0x8000;
            for (let i = 0; i < u8.length; i += chunk) {
                s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
            }
            return btoa(s);
        }

        function b64ToBytes(b64) {
            const bin = atob(String(b64 || ''));
            const out = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
            return out;
        }

        // ===== AES-256-GCM（PBKDF2-SHA256，120k 迭代，与 jav-code-scanner 同参数） =====

        function hasSubtleCrypto() {
            try {
                const cryptoObj = (typeof window !== 'undefined' && window.crypto)
                    || (typeof globalThis !== 'undefined' && globalThis.crypto)
                    || null;
                return !!(cryptoObj && cryptoObj.subtle && typeof cryptoObj.getRandomValues === 'function');
            } catch (e) {
                return false;
            }
        }

        function deriveAesKey(password, saltBytes) {
            const enc = new TextEncoder();
            return crypto.subtle.importKey('raw', enc.encode(String(password || '')), 'PBKDF2', false, ['deriveKey'])
                .then((base) => crypto.subtle.deriveKey(
                    {
                        name: 'PBKDF2',
                        salt: saltBytes,
                        iterations: 120000,
                        hash: 'SHA-256'
                    },
                    base,
                    { name: 'AES-GCM', length: 256 },
                    false,
                    ['encrypt', 'decrypt']
                ));
        }

        // 明文 → 加密 JSON 包（AES-256-GCM + PBKDF2）
        function encryptPayload(plainText, password) {
            if (!hasSubtleCrypto()) return Promise.reject(new Error('当前浏览器不支持 WebCrypto 加密'));
            const pwd = String(password || '');
            if (pwd.length < 4) return Promise.reject(new Error('加密密码至少 4 位'));
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const data = new TextEncoder().encode(String(plainText || ''));
            return deriveAesKey(pwd, salt).then((key) => crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                data
            )).then((cipherBuf) => JSON.stringify({
                app: 'webdev-component',
                enc: cfg.encMark,
                v: 1,
                kdf: 'PBKDF2-SHA256',
                iter: 120000,
                salt: bytesToB64(salt),
                iv: bytesToB64(iv),
                ct: bytesToB64(new Uint8Array(cipherBuf)),
                createdAt: new Date().toISOString()
            }, null, 2));
        }

        function isEncryptedPayload(text) {
            try {
                const p = typeof text === 'string' ? JSON.parse(text) : text;
                return !!(p && typeof p === 'object' && p.enc === cfg.encMark && p.ct && p.salt && p.iv);
            } catch (e) {
                return false;
            }
        }

        // 加密包 → 明文 JSON 字符串
        function decryptPayload(encText, password) {
            if (!hasSubtleCrypto()) return Promise.reject(new Error('当前浏览器不支持 WebCrypto 解密'));
            let p;
            try {
                p = typeof encText === 'string' ? JSON.parse(encText) : encText;
            } catch (e) {
                return Promise.reject(new Error('加密包无法解析'));
            }
            if (!p || p.enc !== cfg.encMark || !p.ct || !p.salt || !p.iv) {
                return Promise.reject(new Error('不是本脚本的加密备份'));
            }
            const pwd = String(password || '');
            if (!pwd) return Promise.reject(new Error('请填写加密密码'));
            let salt; let iv; let ct;
            try {
                salt = b64ToBytes(p.salt);
                iv = b64ToBytes(p.iv);
                ct = b64ToBytes(p.ct);
            } catch (e) {
                return Promise.reject(new Error('加密包数据损坏'));
            }
            return deriveAesKey(pwd, salt).then((key) => crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                ct
            )).then((buf) => new TextDecoder().decode(buf)).catch(() => {
                throw new Error('解密失败，请检查加密密码');
            });
        }

        // 若是加密包则解密，否则原样返回
        function maybeDecryptText(text, password) {
            if (!isEncryptedPayload(text)) return Promise.resolve(String(text || ''));
            return decryptPayload(text, password);
        }

        // ===== URL / 认证 =====

        // base 允许为目录或完整文件 URL；以 .json 结尾且未指定 file 时视为完整文件 URL
        function joinUrl(base, file) {
            let b = String(base || '').trim();
            if (!b) return '';
            if (/\.json(\?|#|$)/i.test(b) && !file) return b;
            b = b.replace(/\/+$/, '');
            const f = String(file || cfg.defaultFile).trim().replace(/^\/+/, '') || cfg.defaultFile;
            // base 已以文件名结尾时不再追加
            if (b.toLowerCase().endsWith('/' + f.toLowerCase()) || b.toLowerCase().endsWith(f.toLowerCase())) {
                return b;
            }
            return b + '/' + f;
        }

        function authHeader(opts) {
            const s = normalize(opts);
            if (!s.user && !s.pass) return {};
            return { Authorization: 'Basic ' + b64EncodeUtf8(s.user + ':' + s.pass) };
        }

        function targetUrl(opts) {
            const s = normalize(opts || load());
            return joinUrl(s.url, s.file);
        }

        // ===== 网络 =====

        function _request(opts) {
            if (!request) return Promise.reject(new Error('未注入 request 适配器'));
            return request(opts);
        }

        // ===== 业务动作 =====

        // 测试连通性：先 PROPFIND，失败再 GET（部分盘只开了文件读写）
        function testConnection(opts) {
            const s = normalize(opts || load());
            const url = joinUrl(s.url, s.file);
            if (!url) return Promise.reject(new Error('请填写 WebDAV 地址'));
            if (!/^https?:\/\//i.test(url)) return Promise.reject(new Error('WebDAV 地址需以 http(s):// 开头'));
            const headers = Object.assign({ 'Accept': '*/*', 'Depth': '0' }, authHeader(s));
            return _request({
                method: 'PROPFIND',
                url: url,
                headers: headers,
                timeout: 15000,
                acceptStatuses: [200, 207, 404]
            }).then((res) => {
                return { ok: true, status: res && res.status, url: url, mode: 'PROPFIND' };
            }).catch(() => _request({
                method: 'GET',
                url: url,
                headers: Object.assign({ 'Accept': '*/*' }, authHeader(s)),
                timeout: 15000,
                acceptStatuses: [200, 404]
            }).then((res) => ({
                ok: true,
                status: res && res.status,
                url: url,
                mode: 'GET',
                exists: !!(res && res.status === 200)
            })));
        }

        // 上传备份（exportPayload() 生成载荷；加密时为加密 JSON 包）
        function uploadLibrary(opts) {
            const s = normalize(opts || load());
            const url = joinUrl(s.url, s.file);
            if (!url) return Promise.reject(new Error('请填写 WebDAV 地址'));
            if (!/^https?:\/\//i.test(url)) return Promise.reject(new Error('WebDAV 地址需以 http(s):// 开头'));
            if (!exportPayload) return Promise.reject(new Error('未注入 exportPayload 适配器'));
            const plain = String(exportPayload());
            const bodyP = s.encrypt
                ? encryptPayload(plain, s.secret)
                : Promise.resolve(plain);
            return bodyP.then((body) => {
                const headers = Object.assign({
                    'Content-Type': 'application/json; charset=utf-8',
                    'Accept': '*/*'
                }, authHeader(s));
                return _request({
                    method: 'PUT',
                    url: url,
                    headers: headers,
                    data: body,
                    timeout: 30000,
                    acceptStatuses: [200, 201, 204, 207]
                }).then(() => ({
                    url: url,
                    bytes: body.length,
                    encrypted: !!s.encrypt
                }));
            });
        }

        // 下载并解析远端备份（加密包按设置的加密密码解密；返回 data 供消费方 importData 合并/覆盖）
        function downloadLibrary(opts) {
            const s = normalize(opts || load());
            const url = joinUrl(s.url, s.file);
            if (!url) return Promise.reject(new Error('请填写 WebDAV 地址'));
            if (!/^https?:\/\//i.test(url)) return Promise.reject(new Error('WebDAV 地址需以 http(s):// 开头'));
            const headers = Object.assign({
                'Accept': 'application/json, text/plain, */*'
            }, authHeader(s));
            return _request({
                method: 'GET',
                url: url,
                headers: headers,
                timeout: 30000,
                acceptStatuses: [200]
            }).then((res) => {
                const text = res && (res.responseText != null ? res.responseText : res.response);
                if (text == null || String(text).trim() === '') throw new Error('远端文件为空');
                const raw = String(text);
                // 加密包必须解密；明文直接解析
                return maybeDecryptText(raw, s.secret).then((plain) => {
                    let data;
                    try {
                        data = JSON.parse(plain);
                    } catch (e) {
                        throw new Error('远端文件不是有效的 JSON 备份');
                    }
                    if (!data || !Array.isArray(data.items)) {
                        throw new Error('远端备份格式不正确（缺少 items 数组）');
                    }
                    return {
                        text: plain,
                        encrypted: isEncryptedPayload(raw),
                        url: url,
                        data: data,
                        items: data.items.length
                    };
                });
            });
        }

        return {
            VERSION: VERSION,
            KEY: cfg.key,
            DEFAULT_FILE: cfg.defaultFile,
            ENC_MARK: cfg.encMark,
            normalize: normalize,
            load: load,
            save: save,
            b64EncodeUtf8: b64EncodeUtf8,
            bytesToB64: bytesToB64,
            b64ToBytes: b64ToBytes,
            hasSubtleCrypto: hasSubtleCrypto,
            deriveAesKey: deriveAesKey,
            encryptPayload: encryptPayload,
            isEncryptedPayload: isEncryptedPayload,
            decryptPayload: decryptPayload,
            maybeDecryptText: maybeDecryptText,
            joinUrl: joinUrl,
            authHeader: authHeader,
            targetUrl: targetUrl,
            testConnection: testConnection,
            uploadLibrary: uploadLibrary,
            downloadLibrary: downloadLibrary
        };
    }

    return { VERSION: VERSION, createWebdev: createWebdev };
}));
