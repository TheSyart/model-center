export interface GatewayProtocolEndpoint {
  id: 'openai-chat' | 'responses' | 'anthropic';
  label: string;
  client: string;
  baseUrl: string;
  endpoint: string;
}

export interface GatewayEndpointGuide {
  protocols: GatewayProtocolEndpoint[];
  modelsUrl: string;
}

/** 根据当前访问 origin 生成客户端应使用的聚合网关地址。 */
export function buildGatewayEndpoints(origin: string): GatewayEndpointGuide {
  const base = origin.replace(/\/+$/, '');
  return {
    protocols: [
      {
        id: 'openai-chat',
        label: 'OpenAI Chat',
        client: 'OpenAI SDK / 兼容客户端',
        baseUrl: `${base}/v1`,
        endpoint: `${base}/v1/chat/completions`,
      },
      {
        id: 'responses',
        label: 'Responses / Codex',
        client: 'Codex / Responses 客户端',
        baseUrl: `${base}/v1`,
        endpoint: `${base}/v1/responses`,
      },
      {
        id: 'anthropic',
        label: 'Anthropic',
        client: 'Claude Code / Anthropic SDK',
        baseUrl: base,
        endpoint: `${base}/v1/messages`,
      },
    ],
    modelsUrl: `${base}/v1/models`,
  };
}
