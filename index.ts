import { serve } from 'bun';
import { AuthManager } from './auth';
import { RateLimiter } from './rateLimit';
import { getUserIdByEmail, addRequest, updateRequestWithUsageData } from './db';

const PROXY_DOMAIN = 'api.anthropic.com';
const SERVER_SIDE_API_KEY = process.env.ANTHROPIC_KEY || '';

const server = serve({
  port: 3004,
  async fetch(req) {
    const url = new URL(req.url);

    console.log(`Incoming request: ${req.method} ${url}`);

    const authManager = new AuthManager();
    const rateLimiter = new RateLimiter();

    // Authentication endpoints
    if (url.pathname === '/auth/send-code' && req.method === 'POST') {
      const { email } = await req.json();
      const sent = await authManager.sendLoginCode(email);
      return new Response(JSON.stringify({ success: sent }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname === '/auth/verify-code' && req.method === 'POST') {
      const { email, code } = await req.json();
      const verified = authManager.verifyLoginCode(email, code);
      if (verified) {
        const token = authManager.issueToken(email);
        return new Response(JSON.stringify({ token }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Invalid code' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // For all other requests, verify the token and apply rate limiting
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Unauthorized', { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const userEmail = authManager.verifyToken(token);
    if (!userEmail) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userId = getUserIdByEmail(userEmail);
    if (!userId) {
      return new Response('User not found', { status: 404 });
    }

    // Prepare request data for rate limiting
    const requestData = {
      method: req.method,
      path: url.pathname,
      timestamp: Date.now(),
    };

    // Check rate limit
    const allowed = rateLimiter.checkAndIncrement(userEmail, requestData);

    if (!allowed) {
      return new Response('Rate limit exceeded', { status: 429 });
    }

    // Add the request to the database and get the requestId
    const requestId = addRequest(userEmail, requestData);

    // Swap the domain for the proxied domain
    url.hostname = PROXY_DOMAIN;
    url.port = '';
    url.protocol = 'https:';

    const body = await req.text();

    // Prepare the proxied request
    const proxyReq = new Request(url, {
      method: req.method,
      headers: new Headers(req.headers),
      body,
    });

    // Inject the server-side API key
    proxyReq.headers.set('x-api-key', SERVER_SIDE_API_KEY);

    proxyReq.headers.delete('Authorization');
    proxyReq.headers.delete('Host');

    // Forward the request and get the response
    const proxyRes = await fetch(proxyReq);

    const usageData = {
      id: '',
      input_tokens: 0,
      output_tokens: 0,
    };

    // Handle SSE
    if (proxyRes.headers.get('Content-Type')?.includes('text/event-stream')) {
      const { readable, writable } = new TransformStream({
        async transform(chunk, controller) {
          controller.enqueue(chunk);
          const text = new TextDecoder().decode(chunk);
          text
            .split('\n')
            .filter((line) => line.startsWith('data'))
            .forEach((line) => {
              const data = line.replace('data: ', '').trim();
              try {
                const json = JSON.parse(data);
                const type = json.type;
                const id = json.message?.id;

                if (id?.length) {
                  console.log('id', id);
                  usageData.id = id;
                }
                const input_tokens = json.message?.usage?.input_tokens;
                if (input_tokens) {
                  console.log('input_tokens', input_tokens);
                  usageData.input_tokens = input_tokens;
                }
                const output_tokens = json.usage?.output_tokens;
                if (output_tokens) {
                  console.log('output_tokens', output_tokens);
                  usageData.output_tokens = output_tokens;
                }

                if (type === 'message_stop') {
                  console.log('Usage data:', usageData);
                  updateRequestWithUsageData(requestId, usageData);
                }
              } catch (e) {
                // console.log('Error parsing JSON:', e);
              }
            });
        },
      });
      proxyRes.body?.pipeTo(writable);
      return new Response(readable, {
        headers: proxyRes.headers,
        status: proxyRes.status,
      });
    } else {
      console.log(`Proxied request to: ${url}`);
      console.log(`Response status: ${proxyRes.status}`);
      const json = await proxyRes.json();
      console.log(json);
      // Update usage data for non-SSE responses
      updateRequestWithUsageData(requestId, usageData);
      return proxyRes;
    }
  },
});

console.log(`Proxy server running at http://localhost:${server.port}`);
