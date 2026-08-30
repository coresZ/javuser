#!/usr/bin/env node
/**
 * tools/sync-webdev.js — 共享 WebDAV 组件（Greasy Fork 库）与 Enhanced_Media_Helper.js 的同步工具
 *
 * 用法：node tools/sync-webdev.js
 * 产出：把 Greasy Fork 库文件 webdev-library.user.js 的组件体嵌入 Enhanced_Media_Helper.js 的标记块
 *       （/*__WEBDEV_COMPONENT_BEGIN__*\/ … END，作为 @require 失败时的内嵌兜底副本）
 *
 * 真源约定：
 * - 唯一真源 = 仓库根 webdev-library.user.js（Greasy Fork 库 593538 的源码，元数据头 + 组件体一体）
 * - 修改组件流程：① 编辑 webdev-library.user.js → ② 回填 Greasy Fork 库页面 → ③ 运行本脚本同步 EMH 内嵌
 * - 勿手改 Enhanced_Media_Helper.js 标记块之间的内容；本脚本负责嵌入并跑 node --check 校验
 *
 * Greasy Fork 库地址：https://update.greasyfork.org/scripts/593538/1916639/webdev-component.js
 * 升级组件 VERSION 后：回填库页面 → 核对 EMH 元信息里的库 @require URL（版本化路径可能随 greasyfork 变化）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const LIB_PATH = path.join(ROOT, 'webdev-library.user.js'); // 唯一真源（Greasy Fork 库源码）
const EMH_PATH = path.join(ROOT, 'Enhanced_Media_Helper.js');

const BEGIN = '/*__WEBDEV_COMPONENT_BEGIN__*/';
const END = '/*__WEBDEV_COMPONENT_END__*/';
// 迁移锚点（仅历史版本需要）：旧内联实现的首尾行
const OLD_START = '    // ===== WebDAV 云端备份（番号库上传/下载 + AES-256-GCM 加密，对齐 jav-code-scanner 的 WebDAV 模式） =====';
const OLD_END = '    // avwikidb 作品页宫格截图预览';

// 组件嵌入后的 EMH 侧接线（新块；标记块之间的内容由库文件组件体填充）
const NEW_BLOCK = [
    '    // ===== WebDAV 云端备份（内核为 Greasy Fork 库 webdev-library.user.js，先供 EMH 使用） =====',
    '    // 设置存 GM key `emh_webdav_v1`（账号密码仅本机脚本存储，不随备份导出）；',
    '    // 上传 = CODE_LIBRARY.exportData(\'all\') 全量，下载后经 CODE_LIBRARY.importData 合并/覆盖恢复；',
    '    // 任意用户自定义 WebDAV 主机需要 @connect *，油猴首次访问会弹一次放行确认。',
    '    // 组件源码由 tools/sync-webdev.js 从 webdev-library.user.js 同步，请勿手改标记块之间的内容。',
    '',
    '    // webdevRequest：Promise 化 GM_xmlhttpRequest（acceptStatuses 白名单判定成功，status 0 兜底）',
    '    function webdevRequest(o) {',
    '        const gm = (typeof GM_xmlhttpRequest === \'function\' && GM_xmlhttpRequest)',
    '            || (typeof GM !== \'undefined\' && GM && typeof GM.xmlHttpRequest === \'function\' && GM.xmlHttpRequest)',
    '            || null;',
    '        if (!gm) return Promise.reject(new Error(\'当前环境不支持跨域请求\'));',
    '        return new Promise((resolve, reject) => {',
    '            let done = false;',
    '            const finish = (fn, arg) => {',
    '                if (done) return;',
    '                done = true;',
    '                fn(arg);',
    '            };',
    '            try {',
    '                const req = {',
    '                    method: o.method || \'GET\',',
    '                    url: o.url,',
    '                    timeout: o.timeout || 20000,',
    '                    headers: o.headers || {},',
    '                    onload: (res) => {',
    '                        const st = res && typeof res.status === \'number\' ? res.status : 0;',
    '                        const okList = Array.isArray(o.acceptStatuses) ? o.acceptStatuses : null;',
    '                        // 部分环境成功时 status 为 0；WebDAV PUT 常见 201/204',
    '                        const ok = okList',
    '                            ? (st === 0 || okList.indexOf(st) >= 0)',
    '                            : (st === 0 || (st >= 200 && st < 300));',
    '                        if (ok) finish(resolve, res);',
    '                        else finish(reject, new Error(\'HTTP \' + st + (res && res.statusText ? \' \' + res.statusText : \'\')));',
    '                    },',
    '                    onerror: () => finish(reject, new Error(\'网络请求失败\')),',
    '                    ontimeout: () => finish(reject, new Error(\'请求超时\')),',
    '                    onabort: () => finish(reject, new Error(\'请求已中止\'))',
    '                };',
    '                if (o.data != null) req.data = o.data;',
    '                gm(req);',
    '            } catch (e) {',
    '                finish(reject, e instanceof Error ? e : new Error(\'请求失败\'));',
    '            }',
    '        });',
    '    }',
    '',
    '    /*__WEBDEV_COMPONENT_BEGIN__*/',
    '    /*__WEBDEV_COMPONENT_END__*/',
    '',
    '    // EMH 实例化共享 WebDAV 组件：注入 GM 存储 / GM 请求 / 番号库载荷。',
    '    // 组件来源：@require 的 Greasy Fork 库 → 沙箱全局（内嵌副本）→ 页面主 world；UMD 幂等保证不重复定义',
    '    const WebdevComp = (typeof WebdevComponent !== \'undefined\' && WebdevComponent)',
    '        || (typeof unsafeWindow !== \'undefined\' && unsafeWindow && unsafeWindow.WebdevComponent)',
    '        || null;',
    '    const WEBDAV = (WebdevComp && typeof WebdevComp.createWebdev === \'function\')',
    '        ? WebdevComp.createWebdev({',
    '            key: \'emh_webdav_v1\',',
    '            defaultFile: \'emh-library.json\',',
    '            encMark: \'emh-aes-gcm-v1\',',
    '            storage: {',
    '                get: (k, d) => { try { return typeof GM_getValue === \'function\' ? GM_getValue(k, d) : d; } catch (e) { return d; } },',
    '                set: (k, v) => { try { if (typeof GM_setValue === \'function\') GM_setValue(k, v); } catch (e) {} }',
    '            },',
    '            request: webdevRequest,',
    '            exportPayload: () => JSON.stringify(CODE_LIBRARY.exportData(\'all\'), null, 2)',
    '        })',
    '        : null;',
    '    if (!WEBDAV) console.error(\'EMH: webdev-component 未就绪（@require 失败且内嵌副本缺失）\');'
].join('\n');

// 剥离库文件元数据头（==/UserScript== 之后的组件体）
function libBodyOf(libText) {
    const idx = libText.indexOf('// ==/UserScript==');
    if (idx < 0) {
        console.error('库文件缺少 ==/UserScript== 元数据块，无法提取组件体');
        process.exit(1);
    }
    return libText.slice(idx + '// ==/UserScript=='.length).replace(/^\s+/, '').replace(/\s+$/, '');
}

function main() {
    if (!fs.existsSync(LIB_PATH)) {
        console.error('缺少真源库文件：' + LIB_PATH);
        process.exit(1);
    }
    if (!fs.existsSync(EMH_PATH)) {
        console.error('缺少目标脚本：' + EMH_PATH);
        process.exit(1);
    }
    const lib = fs.readFileSync(LIB_PATH, 'utf8');
    const comp = libBodyOf(lib);
    let emh = fs.readFileSync(EMH_PATH, 'utf8');
    const hasMarkers = emh.includes(BEGIN) && emh.includes(END);

    if (!hasMarkers) {
        // 历史版本迁移：旧内联实现 → 组件嵌入
        const si = emh.indexOf(OLD_START);
        const ei = emh.indexOf(OLD_END, si);
        if (si < 0 || ei < 0) {
            console.error('未找到旧 WEBDAV 实现块或标记块，已中止（请人工确认当前脚本状态）');
            process.exit(1);
        }
        emh = emh.slice(0, si) + NEW_BLOCK + '\n\n' + emh.slice(ei);
        console.log('迁移：旧内联 WEBDAV 实现已替换为组件嵌入（随后嵌入组件体）');
    }

    // 统一嵌入组件体（迁移后或已有标记块两种路径都走到这里）
    const block = BEGIN + '\n' + comp + '\n' + END;
    // 标记含 * / 等正则元字符，需转义后再构造匹配
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(esc(BEGIN) + '[\\s\\S]*?' + esc(END));
    if (!re.test(emh)) {
        console.error('标记块缺失，嵌入失败');
        process.exit(1);
    }
    emh = emh.replace(re, block);

    fs.writeFileSync(EMH_PATH, emh);
    execSync('node --check "' + EMH_PATH + '"', { stdio: 'inherit' });
    execSync('node --check "' + LIB_PATH + '"', { stdio: 'inherit' });
    console.log('OK：Enhanced_Media_Helper.js 内嵌副本已同步为 webdev-library.user.js 组件体（' + comp.split('\n').length + ' 行）');
    console.log('提示：改组件流程 = 编辑 webdev-library.user.js → 回填 Greasy Fork 库页面（593538）→ 运行本脚本');
}

main();