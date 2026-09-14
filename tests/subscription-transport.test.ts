import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { Socket } from 'node:net';
import { subscriptionFetch } from '../lib/subscriptions/transport.ts';

test('subscription requests traverse the configured CONNECT proxy without resolving the target locally', async () => {
  const prior = process.env.MODEL_CENTER_SUBSCRIPTION_PROXY_URL;
  const sockets = new Set<Socket>();
  const targets: string[] = [];
  const proxy = http.createServer();
  proxy.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  proxy.on('connect', (req, socket) => {
    targets.push(req.url!);
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    socket.once('data', () => socket.end('HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK'));
  });
  await new Promise<void>((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  try {
    const address = proxy.address() as { port: number };
    process.env.MODEL_CENTER_SUBSCRIPTION_PROXY_URL = `http://127.0.0.1:${address.port}`;
    const response = await subscriptionFetch('http://subscription-upstream.invalid/check', {
      signal: AbortSignal.timeout(2000),
    });
    assert.equal(await response.text(), 'OK');
    assert.deepEqual(targets, ['subscription-upstream.invalid:80']);
  } finally {
    if (prior === undefined) delete process.env.MODEL_CENTER_SUBSCRIPTION_PROXY_URL;
    else process.env.MODEL_CENTER_SUBSCRIPTION_PROXY_URL = prior;
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => proxy.close(() => resolve()));
  }
});

test('unconfigured subscription transport preserves the default fetch and request options', async () => {
  const prior = process.env.MODEL_CENTER_SUBSCRIPTION_PROXY_URL;
  const original = globalThis.fetch;
  delete process.env.MODEL_CENTER_SUBSCRIPTION_PROXY_URL;
  const init = { method: 'POST', body: '{}', redirect: 'error' as const };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    assert.equal(options, init);
    return new Response('direct');
  };
  try {
    assert.equal(await (await subscriptionFetch('https://oauth2.googleapis.com/token', init)).text(), 'direct');
  } finally {
    globalThis.fetch = original;
    if (prior !== undefined) process.env.MODEL_CENTER_SUBSCRIPTION_PROXY_URL = prior;
  }
});

test('invalid proxy configuration fails without exposing its value or sending a request', async () => {
  const prior = process.env.MODEL_CENTER_SUBSCRIPTION_PROXY_URL;
  try {
    for (const proxy of ['socks5://localhost:1080', 'https://user:secret@example.com/path', 'secret']) {
      process.env.MODEL_CENTER_SUBSCRIPTION_PROXY_URL = proxy;
      await assert.rejects(subscriptionFetch('https://oauth2.googleapis.com/token'), (error: unknown) =>
        error instanceof Error && error.message.includes('MODEL_CENTER_SUBSCRIPTION_PROXY_URL') && !error.message.includes('secret'));
    }
  } finally {
    if (prior === undefined) delete process.env.MODEL_CENTER_SUBSCRIPTION_PROXY_URL;
    else process.env.MODEL_CENTER_SUBSCRIPTION_PROXY_URL = prior;
  }
});
