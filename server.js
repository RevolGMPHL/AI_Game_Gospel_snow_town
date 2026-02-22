/**
 * 福音镇 - 开发服务器
 * 功能：静态文件服务 + Debug Log 保存 API
 * 启动：node server.js
 * 默认端口：8080
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT_DIR = __dirname;
const LOG_DIR = path.join(ROOT_DIR, 'log', 'debug_log');

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// MIME类型映射
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.wav':  'audio/wav',
    '.mp3':  'audio/mpeg',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.ttf':  'font/ttf',
};

const server = http.createServer((req, res) => {
    // CORS 头（允许 Ollama 跨域）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ========== API: 保存 Debug Log ==========
    if (req.method === 'POST' && req.url === '/api/save-debug-log') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const filename = data.filename || `debug_${timestamp}.log`;
                const filepath = path.join(LOG_DIR, filename);

                // 安全检查：防止路径穿越
                if (!filepath.startsWith(LOG_DIR)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '非法文件路径' }));
                    return;
                }

                fs.writeFileSync(filepath, data.content || '', 'utf-8');
                console.log(`📝 Debug log 已保存: ${filename} (${(data.content || '').length} 字符)`);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, filename, path: filepath }));
            } catch (err) {
                console.error('❌ 保存debug log出错:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // ========== API: 追加 Debug Log（增量写入） ==========
    if (req.method === 'POST' && req.url === '/api/append-debug-log') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const filename = data.filename || 'current_session.log';
                const filepath = path.join(LOG_DIR, filename);

                if (!filepath.startsWith(LOG_DIR)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '非法文件路径' }));
                    return;
                }

                fs.appendFileSync(filepath, (data.content || '') + '\n', 'utf-8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, filename }));
            } catch (err) {
                console.error('❌ 追加debug log出错:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // ========== API: 列出 Debug Log 文件 ==========
    if (req.method === 'GET' && req.url === '/api/list-debug-logs') {
        try {
            const files = fs.readdirSync(LOG_DIR)
                .filter(f => f.endsWith('.log'))
                .map(f => {
                    const stat = fs.statSync(path.join(LOG_DIR, f));
                    return { name: f, size: stat.size, modified: stat.mtime };
                })
                .sort((a, b) => b.modified - a.modified);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ files }));
        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
        }
        return;
    }

    // ========== 静态文件服务 ==========
    let filePath = path.join(ROOT_DIR, decodeURIComponent(req.url.split('?')[0]));
    if (filePath === ROOT_DIR + '/' || filePath === ROOT_DIR) {
        filePath = path.join(ROOT_DIR, 'index.html');
    }

    // 安全检查
    if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stat) => {
        if (err || !stat.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`404 Not Found: ${req.url}`);
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🎮 福音镇开发服务器已启动！`);
    console.log(`📡 地址: http://localhost:${PORT}`);
    console.log(`📂 根目录: ${ROOT_DIR}`);
    console.log(`📝 Debug Log: ${LOG_DIR}`);
    console.log(`\n可用 API:`);
    console.log(`  POST /api/save-debug-log    - 保存完整debug log`);
    console.log(`  POST /api/append-debug-log  - 追加debug log`);
    console.log(`  GET  /api/list-debug-logs   - 列出所有debug log文件`);
    console.log(`\n按 Ctrl+C 停止服务器\n`);
});
