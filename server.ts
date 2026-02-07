/**
 * Development Server for Mars Inc.
 * Simple static file server using Bun
 */

const server = Bun.serve({
    port: 3000,
    async fetch(req) {
        const url = new URL(req.url);
        let filePath = url.pathname;

        // Serve index.html for root
        if (filePath === '/') {
            filePath = '/index.html';
        }

        // Remove leading slash for file system
        const path = `.${filePath}`;

        try {
            const file = Bun.file(path);
            
            // Check if file exists
            const exists = await file.exists();
            if (!exists) {
                return new Response('404 Not Found', { status: 404 });
            }

            // Determine content type
            const ext = path.split('.').pop()?.toLowerCase();
            const contentTypes: Record<string, string> = {
                'html': 'text/html',
                'css': 'text/css',
                'js': 'application/javascript',
                'ts': 'application/typescript',
                'json': 'application/json',
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'gif': 'image/gif',
                'svg': 'image/svg+xml',
                'ico': 'image/x-icon',
                'woff': 'font/woff',
                'woff2': 'font/woff2',
                'ttf': 'font/ttf',
                'eot': 'application/vnd.ms-fontobject'
            };

            const contentType = contentTypes[ext || ''] || 'application/octet-stream';

            return new Response(file, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'no-cache'
                }
            });
        } catch (error) {
            console.error('Error serving file:', error);
            return new Response('500 Internal Server Error', { status: 500 });
        }
    }
});

console.log(`🚀 Mars Inc. server running at http://localhost:${server.port}`);
console.log(`📂 Serving files from: ${process.cwd()}`);
console.log(`\n🎮 Open http://localhost:${server.port} in your browser to play!`);
console.log(`\n💡 Press Ctrl+C to stop the server\n`);
