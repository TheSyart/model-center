import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const deckUrl = new URL('../public/security-risk-deck.html', import.meta.url);

function readDeck(): string {
  return readFileSync(deckUrl, 'utf8');
}

function readManifest(html: string): Array<{ screenLabel: string; title: string }> {
  const match = html.match(/<script id="deck-manifest" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'deck manifest must be embedded as JSON');
  return JSON.parse(match[1]) as Array<{ screenLabel: string; title: string }>;
}

const expectedSlides = [
  ['01', '中转站，新时代木马'],
  ['02', '中转站的风险，不只有“贵”和“假”'],
  ['03', '传统木马与中转站：入口不同，借权机制相似'],
  ['04', '你以为它只是转发，实际上它是通信终点'],
  ['05', '货物没换，底下却多了一块'],
  ['06', '一把合法钥匙，穿过中转后变成两把'],
  ['07', '聊天模型只会回答，Agent 会动手'],
  ['08', '看起来是模型回答，实际可能经过中间人改写'],
  ['09', '你的对话，也可以成为中转站的库存'],
  ['10', '证明能力，不伪造指控'],
  ['11', '不要使用不可信中转站'],
] as const;

test('security risk deck is an eleven-slide standalone HTML presentation', () => {
  assert.equal(existsSync(deckUrl), true, 'public/security-risk-deck.html must exist');
  const html = readDeck();
  const manifest = readManifest(html);

  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="zh-CN">/);
  assert.equal(manifest.length, 11);
  assert.deepEqual(
    manifest.map((slide) => [slide.screenLabel.slice(0, 2), slide.title]),
    expectedSlides,
  );
  assert.equal(new Set(manifest.map((slide) => slide.title)).size, 11);
  assert.doesNotMatch(html, /class="(?:scope-conclusion|bottom-claim|analogy-note|closing-line)/);
  assert.doesNotMatch(html, /本期不讨论模型真假与计费/);
  assert.doesNotMatch(html, /安装或漏洞进入|恶意代码在设备内运行|隐藏意图|只需修改 API 地址/);
  assert.match(html, /不要使用不可信中转站/);
  assert.match(html, /注意 Agent 安全/);
});

test('security risk deck embeds every runtime asset and performs no data requests', () => {
  const html = readDeck();
  const images = [...html.matchAll(/data:image\/jpeg;base64,([^)'"\s]+)/g)].map((match) => match[1]);
  const uniqueImageHashes = new Set(
    images.map((image) => createHash('sha256').update(image).digest('hex')),
  );

  assert.match(html, /data:font\/woff2;base64,/);
  assert.equal(images.length, 11, 'the deck must embed one illustration per slide');
  assert.equal(uniqueImageHashes.size, 11, 'every slide must use a distinct illustration');
  assert.doesNotMatch(html, /<(?:script|img)[^>]+src=["']https?:\/\//i);
  assert.doesNotMatch(html, /<link[^>]+href=["']https?:\/\//i);
  assert.doesNotMatch(html, /\b(?:fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/);
  assert.match(html, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('security risk deck contains no dedicated live-demo controls and keeps the cited reference', () => {
  const html = readDeck();

  assert.doesNotMatch(html, /http:\/\/127\.0\.0\.1:3100\/security-lab/);
  assert.doesNotMatch(html, /http:\/\/127\.0\.0\.1:3100\/raw-data/);
  assert.doesNotMatch(html, /进入提示词注入演示|进入工具注入演示|进入原始数据演示/);
  assert.match(html, /https:\/\/github\.com\/TheSyart\/how-to-hack-as-model-router\/blob\/main\/readme_zh-cn\.md/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test('security risk deck uses fullscreen artwork and keyboard-only navigation', () => {
  const html = readDeck();

  assert.match(html, /class="ambient-backdrop"/);
  assert.match(html, /Math\.min\(innerWidth\/1920,innerHeight\/1080\)/);
  assert.match(html, /\["ArrowRight","PageDown"," "\]/);
  assert.match(html, /\["ArrowLeft","PageUp"\]/);
  assert.doesNotMatch(html, /<nav\b/i);
  assert.doesNotMatch(html, /class="controls"|id="previous"|id="next"|id="fullscreen"/);
});
