export interface Env {
  ASSETS: KVNamespace;
  BACKEND_URL: string;
}

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf'
};

function getMimeType(path: string): string {
  const ext = path.substring(path.lastIndexOf('.'));
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    let pathname = url.pathname;

    // Handle root path
    if (pathname === '/') {
      pathname = '/index.html';
    }

    // Handle SPA routing - serve index.html for non-asset paths
    if (!pathname.includes('.') && pathname !== '/index.html') {
      pathname = '/index.html';
    }

    // Remove leading slash for KV key
    const key = pathname.startsWith('/') ? pathname.slice(1) : pathname;

    try {
      // Try to get the asset from KV
      const asset = await env.ASSETS.get(key, 'arrayBuffer');
      
      if (asset) {
        const mimeType = getMimeType(pathname);
        
        return new Response(asset, {
          headers: {
            'Content-Type': mimeType,
            'Cache-Control': pathname.includes('.') && !pathname.endsWith('.html') 
              ? 'public, max-age=31536000, immutable' 
              : 'public, max-age=0, must-revalidate',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }

      // If asset not found, return 404
      return new Response('Not Found', { 
        status: 404,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
        }
      });

    } catch (error) {
      console.error('Error serving asset:', error);
      return new Response('Internal Server Error', { 
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
  },
};
