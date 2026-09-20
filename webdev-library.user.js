// ==UserScript==
// @name         WebdevComponent
// @namespace    cdn.bootcss.com
// @version      1.3.0
// @description  WebDAV 云端备份共享组件库（createWebdev + mount 自带设置 UI；接入方不必写表单）
// @author       cores
// @license      MPL
// @grant        none
// ==/UserScript==
/**
 * webdev-component.js — 共享 WebDAV 客户端组件 v1.3.0
 *
 * 接入方只做三件事：
 *   1. @require 本库
 *   2. createWebdev({ storage, request, exportPayload })
 *   3. webdev.mount(容器)
 *
 * 设计原则：
 * - 协议层纯逻辑；UI 由实例 mount / unmount / openEditor 画进传入的 el。
 * - 禁止 alert / prompt / confirm；编辑字段用库内底栏卡片。
 * - 不引用 GM_*、不引用任何脚本全局对象；浏览器 UMD + CommonJS（Node 测试）双出口。
 * - 实例化 `createWebdev(env)`，依赖全部由消费方注入：
 *     storage        { get(key, fallback), set(key, value) }  设置持久化（每个脚本各自的 GM 存储）
 *     request        (opts) => Promise<res>                   网络适配器（GM_xmlhttpRequest 等）
 *     exportPayload  () => string                             备份载荷生成器（如番号库全量 JSON）
 *     以及 key / defaultFile / encMark 三套命名空间常量
 * - 凭据安全：账号/密码只经注入的 storage 按脚本隔离保存；加密备份采用 AES-256-GCM + PBKDF2-SHA256（120k 迭代）。
 * - 备份协议与 jav-code-scanner 同构（PUT/GET JSON 文件；加密包为信封格式），ENC_MARK 按消费方独立。
 * - v1.1.0：账号配置导出/导入（含密码、加密口令）；可选再包一层 AES 信封。
 *
 * 同步说明：
 * - Enhanced_Media_Helper.js 内嵌本文件（修改后运行 `node tools/sync-webdev.js` 同步嵌入，勿手改嵌入副本）
 * - `node tools/sync-webdev.js` 还会生成 Greasy Fork 库文件 `webdev-library.user.js`（上传即用）
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
    const VERSION = '1.3.0';
    /**
     * 创建 WebDAV 客户端实例。
     * @param {object} env
     * @param {string} [env.key='webdev_opts_v1']        设置存储键名
     * @param {string} [env.defaultFile='webdev-backup.json'] 默认备份文件名
     * @param {string} [env.encMark='webdev-aes-gcm-v1'] 加密备份信封标记
     * @param {string} [env.accountMark='webdev-account-v1'] 账号导出信封标记
     * @param {string[]} [env.legacyKeys=[]]             旧存储键，load() 时迁移一次
     * @param {{get:Function, set:Function}} [env.storage]     设置持久化适配器
     * @param {Function} [env.request]     网络适配器；opts={method,url,headers,data,timeout,acceptStatuses}，resolve 原始响应 / reject Error
     * @param {Function} [env.exportPayload] 备份载荷生成器，返回明文 JSON 字符串
     */
    function createWebdev(env) {
        const o = env || {};
        const cfg = {
            key: String(o.key || 'webdev_opts_v1'),
            defaultFile: String(o.defaultFile || 'webdev-backup.json'),
            encMark: String(o.encMark || 'webdev-aes-gcm-v1'),
            accountMark: String(o.accountMark || 'webdev-account-v1'),
            legacyKeys: Array.isArray(o.legacyKeys) ? o.legacyKeys.map(String) : []
        };
        const storage = o.storage || { get: () => null, set: () => {} };
        const request = typeof o.request === 'function' ? o.request : null;
        const exportPayload = typeof o.exportPayload === 'function' ? o.exportPayload : null;
        // ===== 设置 =====
        // 归一化设置对象：URL/用户名/密码/文件名/加密开关/加密密码
        function normalize(raw) {
            const s = raw && typeof raw === 'object' ? raw : {};
            return {
                url: String(s.url || s.address || s.host || '').trim(),
                user: String(s.user || s.username || s.account || '').trim(),
                pass: String(s.pass || s.password || ''),
                file: String(s.file || s.filename || cfg.defaultFile).trim() || cfg.defaultFile,
                encrypt: s.encrypt === true || s.encrypt === '1' || s.encrypt === 1,
                secret: String(s.secret || s.encryptPassword || s.encPass || '')
            };
        }
        function load() {
            let raw = null;
            try { raw = storage.get(cfg.key, null); } catch (e) { raw = null; }
            if (!raw && cfg.legacyKeys.length) {
                for (let i = 0; i < cfg.legacyKeys.length; i++) {
                    try { raw = storage.get(cfg.legacyKeys[i], null); } catch (e) { raw = null; }
                    if (raw && typeof raw === 'object' && (raw.url || raw.user || raw.pass || raw.username)) {
                        const migrated = normalize(raw);
                        try { storage.set(cfg.key, migrated); } catch (e) { /* ignore */ }
                        raw = migrated;
                        break;
                    }
                    raw = null;
                }
            }
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
        function triggerDownload(filename, text, mime) {
            const name = String(filename || 'download.json');
            const body = String(text || '');
            try {
                const blob = new Blob([body], { type: mime || 'application/json;charset=utf-8' });
                const a = document.createElement('a');
                const href = URL.createObjectURL(blob);
                a.href = href;
                a.download = name;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(function () { try { URL.revokeObjectURL(href); } catch (e) { /* ignore */ } }, 1000);
            } catch (e) {
                throw new Error('浏览器无法触发文件下载');
            }
            return { file: name, bytes: body.length };
        }
        function pickTextFile(accept) {
            return new Promise(function (resolve, reject) {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = accept || 'application/json,.json,text/plain';
                input.style.display = 'none';
                input.onchange = function () {
                    const file = input.files && input.files[0];
                    try { input.remove(); } catch (e) { /* ignore */ }
                    if (!file) return reject(new Error('未选择文件'));
                    const reader = new FileReader();
                    reader.onerror = function () { reject(new Error('读取文件失败')); };
                    reader.onload = function () { resolve(String(reader.result || '')); };
                    reader.readAsText(file, 'utf-8');
                };
                document.body.appendChild(input);
                input.click();
            });
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
        // ===== 账号导出 / 导入（含 WebDAV 密码 + 备份加密口令） =====
        function isAccountPayload(text) {
            try {
                const p = typeof text === 'string' ? JSON.parse(String(text || '')) : text;
                if (!p || typeof p !== 'object') return false;
                if (p.kind === cfg.accountMark && p.settings && typeof p.settings === 'object') return true;
                const s = p.settings && typeof p.settings === 'object' ? p.settings : p;
                return !!(s && (s.url || s.user || s.pass || s.username || s.password || s.address));
            } catch (e) {
                return false;
            }
        }
        function exportAccount(opts) {
            const s = normalize(opts || load());
            return JSON.stringify({
                app: 'webdev-component',
                kind: cfg.accountMark,
                v: 1,
                exportedAt: new Date().toISOString(),
                settings: {
                    url: s.url,
                    user: s.user,
                    pass: s.pass,
                    file: s.file,
                    encrypt: !!s.encrypt,
                    secret: s.secret
                }
            }, null, 2);
        }
        function parseAccountPayload(raw) {
            let p;
            try {
                p = typeof raw === 'string' ? JSON.parse(String(raw || '').trim()) : raw;
            } catch (e) {
                throw new Error('账号文件不是有效 JSON');
            }
            if (!p || typeof p !== 'object') throw new Error('账号文件格式不正确');
            const s = (p.settings && typeof p.settings === 'object') ? p.settings : p;
            const next = normalize(s);
            if (!next.url && !next.user && !next.pass) {
                throw new Error('账号文件里没有地址/账号/密码');
            }
            return next;
        }
        function importAccount(raw, doSave) {
            const next = parseAccountPayload(raw);
            if (doSave !== false) save(next);
            return next;
        }
        function downloadAccountFile(opts) {
            const text = exportAccount(opts);
            const info = triggerDownload('webdev-account.json', text, 'application/json;charset=utf-8');
            const s = normalize(opts || load());
            return Object.assign(info, { url: s.url, user: s.user, encrypted: false });
        }
        function pickAndImportAccount() {
            return pickTextFile().then(function (text) {
                if (isEncryptedPayload(text)) {
                    throw new Error('这是加密账号文件，请用 pickAndImportAccountEncrypted(口令)');
                }
                return importAccount(text, true);
            });
        }
        function exportAccountEncrypted(password, opts) {
            return encryptPayload(exportAccount(opts), password);
        }
        function importAccountEncrypted(raw, password, doSave) {
            return maybeDecryptText(raw, password).then(function (plain) {
                return importAccount(plain, doSave !== false);
            });
        }
        function downloadAccountFileEncrypted(password, opts) {
            return exportAccountEncrypted(password, opts).then(function (text) {
                const info = triggerDownload('webdev-account.enc.json', text, 'application/json;charset=utf-8');
                const s = normalize(opts || load());
                return Object.assign(info, { url: s.url, user: s.user, encrypted: true });
            });
        }
        function pickAndImportAccountEncrypted(password) {
            return pickTextFile().then(function (text) {
                return importAccountEncrypted(text, password, true);
            });
        }
        function copyAccount(opts) {
            const text = exportAccount(opts);
            if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                return navigator.clipboard.writeText(text).then(function () {
                    return { ok: true, bytes: text.length, mode: 'clipboard' };
                });
            }
            return Promise.reject(new Error('当前环境不支持剪贴板'));
        }

        const api = {
            VERSION: VERSION,
            KEY: cfg.key,
            DEFAULT_FILE: cfg.defaultFile,
            ENC_MARK: cfg.encMark,
            ACCOUNT_MARK: cfg.accountMark,
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
            downloadLibrary: downloadLibrary,
            isAccountPayload: isAccountPayload,
            exportAccount: exportAccount,
            parseAccountPayload: parseAccountPayload,
            importAccount: importAccount,
            downloadAccountFile: downloadAccountFile,
            pickAndImportAccount: pickAndImportAccount,
            exportAccountEncrypted: exportAccountEncrypted,
            importAccountEncrypted: importAccountEncrypted,
            downloadAccountFileEncrypted: downloadAccountFileEncrypted,
            pickAndImportAccountEncrypted: pickAndImportAccountEncrypted,
            copyAccount: copyAccount,
            mount: function () { throw new Error('UI 未初始化'); },
            unmount: function () {},
            openEditor: function () { throw new Error('请先 mount'); },
            openPanel: function () { throw new Error('UI 未初始化'); },
            closePanel: function () {},
            registerButton: function () { throw new Error('UI 未初始化'); },
            registerMenu: function () { throw new Error('UI 未初始化'); },
            bindButton: function () { throw new Error('UI 未初始化'); }
        };
        attachPanel(api, o);
        return api;
    }
    const UI_CSS = [
        ':host, .wdc-reset{all:initial;display:block;box-sizing:border-box;font:13.5px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;color:#1c1917}',
        '.wdc-reset *,.wdc-reset *::before,.wdc-reset *::after{box-sizing:border-box}',
        '.wdc-win{display:grid;grid-template-columns:168px 1fr;min-height:420px;max-width:720px;width:100%;background:#f4f1ec;border:1px solid #d7d0c6;border-radius:14px;overflow:hidden;color:#1c1917}',
        '.wdc-nav{background:#ece7df;padding:16px 10px;border-right:1px solid #ddd6cc}',
        '.wdc-brand{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8a8176;padding:4px 10px 14px}',
        '.wdc-tab{display:block;width:100%;text-align:left;border:0;background:transparent;color:#44403c;padding:8px 10px;border-radius:8px;font:inherit;margin:0 0 2px;cursor:pointer}',
        '.wdc-tab[data-on="1"]{background:#1c1917;color:#fafaf9}',
        '.wdc-main{padding:20px 24px 16px;display:flex;flex-direction:column;min-width:0;background:#f4f1ec}',
        '.wdc-h{margin:0 0 4px;font-size:22px;font-weight:650;letter-spacing:-.03em}',
        '.wdc-desc{margin:0 0 14px;color:#78716c;font-size:13px}',
        '.wdc-saved{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;background:#fff;border:1px solid #e7e0d6;border-radius:6px;padding:6px 8px;color:#57534e;margin:0 0 14px;word-break:break-all}',
        '.wdc-pane{display:none}',
        '.wdc-pane[data-on="1"]{display:block}',
        '.wdc-field{display:block;margin:0 0 12px}',
        '.wdc-field>span{display:block;font-size:11px;font-weight:650;color:#57534e;margin:0 0 5px}',
        '.wdc-field input[type=text],.wdc-field input[type=password]{width:100%;height:36px;border:1px solid #e4ddd3;background:#fff;border-radius:8px;padding:0 10px;font:inherit;color:#1c1917}',
        '.wdc-field input:focus{outline:2px solid #ff5c4d;outline-offset:1px;border-color:#ff5c4d}',
        '.wdc-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
        '.wdc-check{display:flex;align-items:center;gap:8px;height:36px;color:#1c1917;font-size:13px}',
        '.wdc-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}',
        '.wdc-btn{height:32px;padding:0 11px;border-radius:8px;border:1px solid #ddd6cc;background:#fff;color:#1c1917;cursor:pointer;font:inherit}',
        '.wdc-btn:hover{background:#faf8f4}',
        '.wdc-btn:disabled{opacity:.5;cursor:not-allowed}',
        '.wdc-btn-pri{background:#ff5c4d;border-color:#ff5c4d;color:#fff}',
        '.wdc-btn-pri:hover{filter:brightness(.96)}',
        '.wdc-status{min-height:18px;margin-top:10px;font-size:12px;white-space:pre-wrap}',
        '.wdc-status.ok{color:#3f7a4a}',
        '.wdc-status.err{color:#b42318}',
        '.wdc-status.info{color:#1d4ed8}',
        '.wdc-sheet{position:absolute;left:12px;right:12px;bottom:12px;background:#fff;border:1px solid #e7e0d6;border-radius:12px;box-shadow:0 -8px 24px rgba(40,28,16,.08);padding:14px;z-index:3}',
        '.wdc-sheet h4{margin:0 0 8px;font-size:13px}',
        '.wdc-sheet textarea,.wdc-sheet input{width:100%;min-height:36px;padding:8px 10px;border:1px solid #e4ddd3;border-radius:8px;font:inherit}',
        '.wdc-sheet textarea{min-height:88px;resize:vertical}',
        '.wdc-sheet-actions{display:flex;gap:8px;margin-top:10px;justify-content:flex-end}',
        '.wdc-mask{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(40,28,16,.38)}',
        '.wdc-dialog{position:relative;width:min(720px,100%);max-height:90vh;overflow:auto;border-radius:14px}',
        '.wdc-close{position:absolute;top:10px;right:10px;z-index:4;width:28px;height:28px;border:0;border-radius:8px;background:#ece7df;color:#57534e;cursor:pointer;font:16px/1 ui-sans-serif,system-ui,sans-serif}',
        '.wdc-fab{position:fixed;z-index:2147483645;min-width:44px;min-height:36px;padding:6px 12px;border:0;border-radius:999px;background:#1c1917;color:#fff;cursor:pointer;font:13px/1 ui-sans-serif,system-ui,sans-serif}',
        '.wdc-fab.br{right:16px;bottom:16px}',
        '.wdc-fab.bl{left:16px;bottom:16px}',
        '.wdc-fab.tr{right:16px;top:16px}',
        '.wdc-fab.tl{left:16px;top:16px}'
    ].join('');

    const HOST_CSS = [
        '#webdev-component-host, [data-webdev-component="1"]{',
        'all:initial;',
        'display:block;',
        'box-sizing:border-box;',
        '}',
        'dialog[data-webdev-component="1"]{',
        'all:revert;',
        'position:fixed;',
        'inset:0;',
        'width:100vw;',
        'height:100vh;',
        'max-width:none;',
        'max-height:none;',
        'margin:0;',
        'padding:0;',
        'border:0;',
        'background:transparent;',
        'z-index:2147483647;',
        '}',
        'dialog[data-webdev-component="1"]::backdrop{',
        'background:rgba(28,25,23,.48);',
        '}'
    ].join('');

    function injectHostCss(doc) {
        const d = doc || (typeof document !== 'undefined' ? document : null);
        if (!d || !d.documentElement) return;
        if (d.getElementById('webdev-component-host-css')) return;
        const style = d.createElement('style');
        style.id = 'webdev-component-host-css';
        style.textContent = HOST_CSS;
        d.documentElement.appendChild(style);
    }

    function openShadow(rootEl) {
        if (rootEl.shadowRoot) return rootEl.shadowRoot;
        try {
            return rootEl.attachShadow({ mode: 'open' });
        } catch (e) {
            const wrap = (rootEl.ownerDocument || document).createElement('div');
            wrap.setAttribute('data-webdev-shadow-host', '1');
            wrap.style.cssText = 'display:block;width:100%;height:100%;';
            rootEl.appendChild(wrap);
            return wrap.attachShadow({ mode: 'open' });
        }
    }

    function styleInto(shadow) {
        if (shadow.querySelector('style[data-wdc="1"]')) return;
        const style = el('style');
        style.setAttribute('data-wdc', '1');
        style.textContent = UI_CSS;
        shadow.appendChild(style);
    }

    function el(tag, attrs, children) {
        const node = document.createElement(tag);
        const a = attrs || {};
        Object.keys(a).forEach(function (k) {
            if (k === 'className') node.className = a[k];
            else if (k === 'text') node.textContent = a[k];
            else if (k.indexOf('on') === 0 && typeof a[k] === 'function') node.addEventListener(k.slice(2).toLowerCase(), a[k]);
            else if (a[k] === false || a[k] == null) { /* skip */ }
            else if (a[k] === true) node.setAttribute(k, k);
            else node.setAttribute(k, String(a[k]));
        });
        (children || []).forEach(function (c) {
            if (c == null || c === false) return;
            node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        });
        return node;
    }

    function wrapMenuApi(fn) {
        return function (title, handler) {
            try { return fn.call(typeof GM !== 'undefined' ? GM : null, title, handler); }
            catch (e1) {
                try { return fn(title, handler, { id: 'wdc:' + title, title: title }); }
                catch (e2) { return fn(title, handler, 'w'); }
            }
        };
    }

    function resolveRegisterMenu(injected) {
        if (typeof injected === 'function') return wrapMenuApi(injected);
        const cands = [];
        try { if (typeof GM_registerMenuCommand === 'function') cands.push(GM_registerMenuCommand); } catch (e) { /* ignore */ }
        try { if (typeof GM !== 'undefined' && GM && typeof GM.registerMenuCommand === 'function') cands.push(GM.registerMenuCommand.bind(GM)); } catch (e2) { /* ignore */ }
        try { if (typeof globalThis !== 'undefined' && typeof globalThis.GM_registerMenuCommand === 'function') cands.push(globalThis.GM_registerMenuCommand); } catch (e3) { /* ignore */ }
        return cands.length ? wrapMenuApi(cands[0]) : null;
    }

    function fieldLabel(name) {
        return ({
            url: '服务器地址',
            user: '账号',
            pass: '密码',
            file: '备份文件名',
            secret: '加密密码'
        })[name] || name;
    }

    function attachPanel(api, envOpts) {
        let host = null;
        let wrap = null;
        let opts = {};
        let inputs = {};
        let statusNode = null;
        let sheetNode = null;
        let busy = false;

        function setStatus(text, type) {
            if (!statusNode) return;
            statusNode.className = 'wdc-status' + (type ? ' ' + type : '');
            statusNode.textContent = text || '';
        }
        function setBusy(on) {
            busy = !!on;
            if (!wrap) return;
            const list = wrap.querySelectorAll('.wdc-btn, .wdc-editbtn');
            for (let i = 0; i < list.length; i++) list[i].disabled = busy;
        }
        function readForm() {
            return api.normalize({
                url: inputs.url ? inputs.url.value : '',
                user: inputs.user ? inputs.user.value : '',
                pass: inputs.pass ? inputs.pass.value : '',
                file: inputs.file ? inputs.file.value : api.DEFAULT_FILE,
                encrypt: !!(inputs.encrypt && inputs.encrypt.checked),
                secret: inputs.secret ? inputs.secret.value : ''
            });
        }
        function fillForm(s) {
            if (inputs.url) inputs.url.value = s.url || '';
            if (inputs.user) inputs.user.value = s.user || '';
            if (inputs.pass) inputs.pass.value = s.pass || '';
            if (inputs.file) inputs.file.value = s.file || api.DEFAULT_FILE;
            if (inputs.encrypt) inputs.encrypt.checked = !!s.encrypt;
            if (inputs.secret) inputs.secret.value = s.secret || '';
        }
        function closeSheet() {
            if (sheetNode && sheetNode.parentNode) sheetNode.parentNode.removeChild(sheetNode);
            sheetNode = null;
        }
        function openEditor(field, extra) {
            if (!wrap) throw new Error('请先 mount');
            closeSheet();
            const spec = extra || {};
            const title = spec.title || ('编辑' + fieldLabel(field));
            const isMultiline = spec.multiline === true;
            const current = spec.value != null
                ? String(spec.value)
                : (field && inputs[field] ? String(inputs[field].value || '') : '');
            sheetNode = el('div', { className: 'wdc-sheet' });
            sheetNode.appendChild(el('h4', { text: title }));
            const box = isMultiline
                ? el('textarea')
                : el('input', { type: spec.password ? 'password' : 'text' });
            box.value = current;
            if (spec.placeholder) box.setAttribute('placeholder', spec.placeholder);
            sheetNode.appendChild(box);
            const row = el('div', { className: 'wdc-sheet-actions' });
            const cancel = el('button', { type: 'button', className: 'wdc-btn', text: '取消' });
            const ok = el('button', { type: 'button', className: 'wdc-btn wdc-btn-pri', text: spec.okText || '确定' });
            cancel.addEventListener('click', closeSheet);
            ok.addEventListener('click', function () {
                const val = box.value;
                closeSheet();
                if (typeof spec.onOk === 'function') spec.onOk(val);
                else if (field && inputs[field]) inputs[field].value = val;
            });
            row.appendChild(cancel);
            row.appendChild(ok);
            sheetNode.appendChild(row);
            wrap.appendChild(sheetNode);
            try { box.focus(); } catch (e) { /* ignore */ }
            return sheetNode;
        }
        function addBtn(label, cls, handler) {
            const b = el('button', { type: 'button', className: 'wdc-btn' + (cls ? ' ' + cls : ''), text: label });
            b.addEventListener('click', handler);
            return b;
        }
        function fieldBox(label, input) {
            return el('label', { className: 'wdc-field' }, [
                el('span', { text: label }),
                input
            ]);
        }

        function mount(target, options) {
            const o = options || {};
            if (!o._inner) return openPanel(o);
            opts = o;
            wrap = el('div', { className: 'wdc-reset' });
            wrap.style.position = 'relative';

            const saved = api.load();
            const savedLine = el('div', { className: 'wdc-saved' });
            function paintSaved(s) {
                savedLine.textContent = s && s.url
                    ? (s.url + '  ·  ' + (s.user || '—'))
                    : '尚未保存服务器账号';
            }
            paintSaved(saved);

            inputs.url = el('input', { type: 'text', value: saved.url, placeholder: 'https://dav.example.com/dav/' });
            inputs.user = el('input', { type: 'text', value: saved.user, placeholder: '用户名', autocomplete: 'off' });
            inputs.pass = el('input', { type: 'password', value: saved.pass, placeholder: '密码或应用密码', autocomplete: 'off' });
            inputs.file = el('input', { type: 'text', value: saved.file || api.DEFAULT_FILE });
            inputs.encrypt = el('input', { type: 'checkbox' });
            inputs.encrypt.checked = !!saved.encrypt;
            inputs.secret = el('input', { type: 'password', value: saved.secret, placeholder: '至少 4 位', autocomplete: 'off' });

            const title = el('h3', { className: 'wdc-h', text: '账号' });
            const desc = el('p', {
                className: 'wdc-desc',
                text: opts.description || '导出的是服务器、账号、密码。不是备份文件。'
            });
            const paneAcc = el('div', { className: 'wdc-pane' });
            paneAcc.setAttribute('data-on', '1');
            paneAcc.appendChild(fieldBox('服务器', inputs.url));
            paneAcc.appendChild(fieldBox('账号', inputs.user));
            paneAcc.appendChild(fieldBox('密码', inputs.pass));
            const paneBak = el('div', { className: 'wdc-pane' });
            paneBak.appendChild(fieldBox('备份文件名', inputs.file));
            const paneEnc = el('div', { className: 'wdc-pane' });
            paneEnc.appendChild(el('label', { className: 'wdc-field' }, [
                el('span', { text: '加密备份' }),
                el('label', { className: 'wdc-check' }, [inputs.encrypt, document.createTextNode('AES-256-GCM')])
            ]));
            paneEnc.appendChild(fieldBox('加密密码', inputs.secret));

            const accBtns = el('div', { className: 'wdc-actions' }, [
                addBtn('导入账号密码', 'wdc-btn-pri', function () {
                    setBusy(true);
                    api.pickAndImportAccount().then(function (s) {
                        fillForm(s);
                        paintSaved(s);
                        setStatus('已导入服务器、账号、密码', 'ok');
                        if (typeof opts.onSave === 'function') opts.onSave(s);
                    }).catch(function (e) {
                        setStatus('导入失败：' + ((e && e.message) || e), 'err');
                    }).then(function () { setBusy(false); });
                }),
                addBtn('导出账号密码', 'wdc-btn-pri', function () {
                    const s = api.save(readForm());
                    fillForm(s);
                    paintSaved(s);
                    try {
                        api.downloadAccountFile(s);
                        setStatus('已导出账号文件（含服务器、账号、密码）', 'ok');
                    } catch (e) {
                        setStatus('导出失败：' + ((e && e.message) || e), 'err');
                    }
                }),
                addBtn('保存', '', function () {
                    const s = api.save(readForm());
                    fillForm(s);
                    paintSaved(s);
                    setStatus('已保存服务器、账号、密码', 'ok');
                    if (typeof opts.onSave === 'function') opts.onSave(s);
                })
            ]);
            const bakBtns = el('div', { className: 'wdc-actions' }, [
                addBtn('测试连接', '', function () {
                    const s = readForm();
                    if (!s.url) { setStatus('请先填写服务器地址', 'err'); return; }
                    setBusy(true);
                    setStatus('正在测试连接…', 'info');
                    api.testConnection(s).then(function (r) {
                        setStatus('连接成功：' + r.mode + '  ' + r.url, 'ok');
                    }).catch(function (e) {
                        setStatus('连接失败：' + ((e && e.message) || e), 'err');
                    }).then(function () { setBusy(false); });
                }),
                addBtn('上传备份', '', function () {
                    const s = readForm();
                    if (!s.url) { setStatus('请先填写服务器地址', 'err'); return; }
                    if (s.encrypt && String(s.secret || '').length < 4) {
                        setStatus('开启加密需填写至少 4 位加密密码', 'err');
                        return;
                    }
                    setBusy(true);
                    api.save(s);
                    setStatus(s.encrypt ? '正在加密并上传…' : '正在上传…', 'info');
                    api.uploadLibrary(s).then(function (r) {
                        setStatus((r.encrypted ? '已加密上传' : '已上传') + '（' + r.bytes + ' 字节）', 'ok');
                        if (typeof opts.onUploaded === 'function') opts.onUploaded(r);
                    }).catch(function (e) {
                        setStatus('上传失败：' + ((e && e.message) || e), 'err');
                    }).then(function () { setBusy(false); });
                }),
                addBtn('下载备份', '', function () {
                    const s = readForm();
                    if (!s.url) { setStatus('请先填写服务器地址', 'err'); return; }
                    setBusy(true);
                    api.save(s);
                    setStatus('正在下载…', 'info');
                    api.downloadLibrary(s).then(function (pack) {
                        setStatus((pack.encrypted ? '已解密下载' : '已下载') + ' ' + pack.items + ' 条', 'ok');
                        if (typeof opts.onDownloaded === 'function') opts.onDownloaded(pack);
                    }).catch(function (e) {
                        setStatus('下载失败：' + ((e && e.message) || e), 'err');
                    }).then(function () { setBusy(false); });
                })
            ]);
            paneAcc.appendChild(accBtns);
            paneBak.appendChild(bakBtns);

            const tabs = [
                { id: 'acc', label: '账号', pane: paneAcc, heading: '账号' },
                { id: 'bak', label: '备份', pane: paneBak, heading: '备份' },
                { id: 'enc', label: '加密', pane: paneEnc, heading: '加密' }
            ];
            const nav = el('div', { className: 'wdc-nav' }, [el('div', { className: 'wdc-brand', text: 'WebDAV' })]);
            const tabBtns = [];
            tabs.forEach(function (tab, idx) {
                const b = el('button', { type: 'button', className: 'wdc-tab', text: tab.label });
                if (idx === 0) b.setAttribute('data-on', '1');
                b.addEventListener('click', function () {
                    tabBtns.forEach(function (x) { x.removeAttribute('data-on'); });
                    tabs.forEach(function (t) { t.pane.removeAttribute('data-on'); });
                    b.setAttribute('data-on', '1');
                    tab.pane.setAttribute('data-on', '1');
                    title.textContent = tab.heading;
                });
                tabBtns.push(b);
                nav.appendChild(b);
            });

            statusNode = el('div', { className: 'wdc-status' });
            const main = el('div', { className: 'wdc-main' }, [
                title, desc, savedLine, paneAcc, paneBak, paneEnc, statusNode
            ]);
            const win = el('div', { className: 'wdc-win' }, [nav, main]);
            wrap.appendChild(win);
            target.appendChild(wrap);
            return api;
        }

        function unmount() {
            closeSheet();
            if (host && host.parentNode) host.parentNode.removeChild(host);
            host = null;
            wrap = null;
            inputs = {};
            statusNode = null;
            return api;
        }

        let overlay = null;
        let fab = null;

        function closePanel() {
            unmount();
            if (overlay) {
                try { if (typeof overlay.close === 'function' && overlay.open) overlay.close(); } catch (e) { /* ignore */ }
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }
            overlay = null;
            return api;
        }

        function openPanel(options) {
            const o = Object.assign({}, opts, options || {});
            const doc = (typeof document !== 'undefined') ? document : null;
            if (!doc || !doc.body) throw new Error('openPanel 需要浏览器环境');
            injectHostCss(doc);
            if (overlay && overlay.parentNode) {
                doc.body.appendChild(overlay);
                try { if (typeof overlay.showModal === 'function' && !overlay.open) overlay.showModal(); } catch (e) { overlay.style.display = 'block'; }
                return api;
            }
            overlay = doc.createElement('dialog');
            overlay.setAttribute('data-webdev-component', '1');
            overlay.setAttribute('id', 'webdev-component-host');
            const shadowHost = doc.createElement('div');
            shadowHost.setAttribute('data-webdev-shadow-host', '1');
            shadowHost.style.cssText = 'display:block;width:100%;height:100%;';
            overlay.appendChild(shadowHost);
            const osh = openShadow(shadowHost);
            styleInto(osh);
            const mask = el('div', { className: 'wdc-mask wdc-reset' });
            const dialog = el('div', { className: 'wdc-dialog' });
            const closeBtn = el('button', { type: 'button', className: 'wdc-close', text: '×' });
            closeBtn.addEventListener('click', closePanel);
            mask.addEventListener('click', function (e) {
                if (e.target === mask) closePanel();
            });
            overlay.addEventListener('cancel', function (e) {
                e.preventDefault();
                closePanel();
            });
            dialog.addEventListener('click', function (e) { e.stopPropagation(); });
            dialog.appendChild(closeBtn);
            mask.appendChild(dialog);
            osh.appendChild(mask);
            doc.body.appendChild(overlay);
            host = overlay;
            mount(dialog, Object.assign({}, o, { _inner: true }));
            try {
                if (typeof overlay.showModal === 'function') overlay.showModal();
            } catch (e2) {
                overlay.setAttribute('open', 'open');
                overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;width:100vw;height:100vh;border:0;padding:0;margin:0;background:transparent;';
            }
            return api;
        }

        let menuBound = false;
        function registerMenu(options) {
            const o = Object.assign({}, opts, envOpts || {}, options || {});
            const add = resolveRegisterMenu(o.registerMenu);
            if (!add) {
                throw new Error('当前环境没有 GM_registerMenuCommand，请在脚本头加 @grant GM_registerMenuCommand');
            }
            if (menuBound && o.force !== true) return api;
            const prefix = o.menuPrefix != null ? String(o.menuPrefix) : '';
            add(prefix + (o.menuOpen || '打开 WebDAV 设置'), function () { openPanel(o); });
            add(prefix + (o.menuExport || '导出 WebDAV 账号密码'), function () {
                try { api.downloadAccountFile(api.load()); }
                catch (e) { openPanel(o); }
            });
            add(prefix + (o.menuImport || '导入 WebDAV 账号密码'), function () {
                api.pickAndImportAccount().then(function () { openPanel(o); }).catch(function () { openPanel(o); });
            });
            menuBound = true;
            return api;
        }

        function registerButton(options) {
            const o = options || {};
            if (o.menu !== false) {
                try { registerMenu(o); } catch (e) { /* 无 GM 菜单时忽略 */ }
            }
            if (o.fab === true) {
                const doc = (typeof document !== 'undefined') ? document : null;
                if (!doc) throw new Error('悬浮按钮需要浏览器环境');
                injectHostCss(doc);
                const pos = String(o.position || 'br').toLowerCase();
                if (!fab) {
                    fab = el('button', {
                        type: 'button',
                        className: 'wdc-fab ' + (['br', 'bl', 'tr', 'tl'].indexOf(pos) >= 0 ? pos : 'br'),
                        text: o.text || 'WebDAV'
                    });
                    fab.addEventListener('click', function () { openPanel(o); });
                    doc.body.appendChild(fab);
                }
            }
            return api;
        }

        function bindButton(target, options) {
            const o = options || {};
            const node = typeof target === 'string'
                ? (typeof document !== 'undefined' ? document.querySelector(target) : null)
                : target;
            if (!node || typeof node.addEventListener !== 'function') {
                throw new Error('bindButton 需要页面上的按钮或节点');
            }
            node.addEventListener('click', function (e) {
                if (e && typeof e.preventDefault === 'function') e.preventDefault();
                openPanel(o);
            });
            return api;
        }

        api.mount = mount;
        api.unmount = unmount;
        api.openEditor = openEditor;
        api.openPanel = openPanel;
        api.closePanel = closePanel;
        api.registerButton = registerButton;
        api.registerMenu = registerMenu;
        api.bindButton = bindButton;
        if (!envOpts || envOpts.menu !== false) {
            const tryMenu = function () {
                try { registerMenu(envOpts || {}); return true; } catch (e) { return false; }
            };
            if (!tryMenu()) {
                setTimeout(tryMenu, 0);
                setTimeout(tryMenu, 200);
                setTimeout(tryMenu, 1000);
            }
        }
        return api;
    }

    function mountUI(target, opts) {
        const o = opts || {};
        const inst = o.webdev || createWebdev(o);
        inst.mount(target, o);
        return inst;
    }

    return {
        VERSION: VERSION,
        createWebdev: createWebdev,
        mountUI: mountUI
    };
}));