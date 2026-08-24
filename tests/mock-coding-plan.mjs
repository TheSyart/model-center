/**
 * 验收用 mock：Coding Plan 套餐端点（kimi / zhipu / minimax 三种 shape）。
 * 用法：node tests/mock-coding-plan.mjs [port]（默认 4004）
 * - GET /coding/v1/usages → kimi：limits[]（resetTime 用**秒**）+ usage（resetTime 用**毫秒**）
 * - GET /api/monitor/usage/quota/limit → zhipu：Authorization 必须**不带** Bearer，否则 401
 * - GET /v1/api/openplatform/coding_plan/remains → minimax：model_remains（general）
 */
import http from 'node:http';

const port = Number(process.argv[2]) || 4004;
const nowSec = Math.floor(Date.now() / 1000);

const server = http.createServer((req, res) => {
  console.log(`[mock-coding-plan] ${req.method} ${req.url} auth=${req.headers.authorization ?? '(none)'}`);
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/coding/v1/usages') {
    // kimi：5 小时窗 resetTime 用秒，周限额 resetTime 用毫秒（验证秒/毫秒自适应）
    res.end(
      JSON.stringify({
        limits: [{ detail: { limit: 100, remaining: 40, resetTime: nowSec + 3600 } }],
        usage: { limit: 1000, remaining: 250, resetTime: (nowSec + 5 * 86400) * 1000 },
      }),
    );
    return;
  }

  if (req.url === '/api/monitor/usage/quota/limit') {
    const auth = req.headers.authorization ?? '';
    if (auth.startsWith('Bearer ')) {
      res.statusCode = 401;
      res.end(JSON.stringify({ success: false, msg: 'Bearer prefix not allowed (mock)' }));
      return;
    }
    res.end(
      JSON.stringify({
        success: true,
        data: {
          level: 'pro',
          limits: [
            { type: 'TOKENS_LIMIT', unit: 3, percentage: 42.5, nextResetTime: Date.now() + 2 * 3600_000 },
            { type: 'TOKENS_LIMIT', unit: 6, percentage: 10, nextResetTime: Date.now() + 4 * 86400_000 },
          ],
        },
      }),
    );
    return;
  }

  if (req.url === '/v1/api/openplatform/coding_plan/remains') {
    res.end(
      JSON.stringify({
        base_resp: { status_code: 0, status_msg: 'success' },
        model_remains: [
          {
            model_name: 'general',
            current_interval_remaining_percent: 25,
            end_time: Date.now() + 3 * 3600_000,
            current_weekly_status: 1,
            current_weekly_remaining_percent: 80,
            weekly_end_time: Date.now() + 3 * 86400_000,
          },
          { model_name: 'video', current_interval_remaining_percent: 99, end_time: 0 },
        ],
      }),
    );
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(port, '127.0.0.1', () => console.log(`[mock-coding-plan] listening on http://127.0.0.1:${port}`));
