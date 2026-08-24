/** GENERATED FILE — DO NOT EDIT. Source: farion1231/cc-switch@9a596158ca926e74b56243c08af67d9dd13fc27c; commit time: 2026-08-24T16:49:56+08:00. Run npm run sync:cc-switch. */
import type { ProviderPreset } from './types';

export const CC_SWITCH_PRESETS: ProviderPreset[] = [
  {
    "slug": "claude-official-anthropic",
    "name": "Claude Official",
    "protocol": "anthropic",
    "baseUrl": "https://api.anthropic.com",
    "category": "official",
    "logo": "/logos/anthropic.svg",
    "websiteUrl": "https://www.anthropic.com/claude-code",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": true,
      "partner": false
    }
  },
  {
    "slug": "kimi-anthropic",
    "name": "Kimi",
    "protocol": "anthropic",
    "baseUrl": "https://api.moonshot.cn/anthropic",
    "category": "cn_official",
    "logo": "/logos/kimi.svg",
    "websiteUrl": "https://platform.kimi.com?aff=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "kimi-for-coding-anthropic",
    "name": "Kimi For Coding",
    "protocol": "anthropic",
    "baseUrl": "https://api.kimi.com/coding",
    "category": "cn_official",
    "logo": "/logos/kimi.svg",
    "websiteUrl": "https://www.kimi.com/code/?aff=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "packycode-anthropic",
    "name": "PackyCode",
    "protocol": "anthropic",
    "baseUrl": "https://www.packyapi.ai",
    "category": "third_party",
    "logo": "/logos/packycode.svg",
    "websiteUrl": "https://www.packyapi.ai",
    "consoleUrl": "https://www.packyapi.ai/register?aff=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://www.packyapi.ai",
        "https://cf.api.fan",
        "https://slb-v1.api.fan",
        "https://www.packyapi.com"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "zetaapi-anthropic",
    "name": "ZetaAPI",
    "protocol": "anthropic",
    "baseUrl": "https://api.zetaapi.ai",
    "category": "aggregator",
    "logo": "/logos/zetaapi-icon.png",
    "websiteUrl": "https://zetaapi.ai",
    "consoleUrl": "https://zetaapi.ai/go/u117",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "apinebula-anthropic",
    "name": "APINebula",
    "protocol": "anthropic",
    "baseUrl": "https://apinebula.ai",
    "category": "third_party",
    "logo": "/logos/apinebula_icon.png",
    "websiteUrl": "https://apinebula.ai",
    "consoleUrl": "https://apinebula.ai/VjM74M",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://apinebula.ai"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "aicodemirror-anthropic",
    "name": "AICodeMirror",
    "protocol": "anthropic",
    "baseUrl": "https://api.aicodemirror.ai/api/claudecode",
    "category": "third_party",
    "logo": "/logos/aicodemirror.svg",
    "websiteUrl": "https://www.aicodemirror.ai",
    "consoleUrl": "https://www.aicodemirror.ai/register?invitecode=9915W3",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.aicodemirror.ai/api/claudecode"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "patewayai-anthropic",
    "name": "PatewayAI",
    "protocol": "anthropic",
    "baseUrl": "https://api.pateway.ai",
    "category": "third_party",
    "logo": "/logos/pateway.jpg",
    "websiteUrl": "https://pateway.ai",
    "consoleUrl": "https://pateway.ai/?ch=etzpm8&aff=WB6M6F67#/",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "api_key_field": "ANTHROPIC_API_KEY",
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "fennoai-anthropic",
    "name": "FennoAI",
    "protocol": "anthropic",
    "baseUrl": "https://api.fenno.ai",
    "category": "aggregator",
    "logo": "/logos/fenno-icon.webp",
    "websiteUrl": "https://api.fenno.ai",
    "consoleUrl": "https://api.fenno.ai/register?redirect=/purchase?tab=subscription%26group=16&aff=P9MR3D3PLCNL",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "runapi-anthropic",
    "name": "RunAPI",
    "protocol": "anthropic",
    "baseUrl": "https://runapi.host",
    "category": "aggregator",
    "logo": "/logos/runapi.jpg",
    "websiteUrl": "https://runapi.host",
    "consoleUrl": "https://runapi.host/register?aff=iOKB",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://runapi.host",
        "https://runapi.co"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "shengsuanyun-anthropic",
    "name": "Shengsuanyun",
    "protocol": "anthropic",
    "baseUrl": "https://router.shengsuanyun.com/api",
    "category": "aggregator",
    "logo": "/logos/shengsuanyun.svg",
    "websiteUrl": "https://www.shengsuanyun.com/?from=CH_4HHXMRYF",
    "consoleUrl": "https://www.shengsuanyun.com/?from=CH_4HHXMRYF",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "aigocode-anthropic",
    "name": "AIGoCode",
    "protocol": "anthropic",
    "baseUrl": "https://api.aigocode.app",
    "category": "third_party",
    "logo": "/logos/algocode.svg",
    "websiteUrl": "https://aigocode.app",
    "consoleUrl": "https://aigocode.app/invite/CC-SWITCH",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.aigocode.app"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "qiniu-anthropic",
    "name": "Qiniu",
    "protocol": "anthropic",
    "baseUrl": "https://api.qnaigc.com",
    "category": "aggregator",
    "logo": "/logos/qiniu.png",
    "websiteUrl": "https://s.qiniu.com/nMvAvy",
    "consoleUrl": "https://s.qiniu.com/nMvAvy",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.qnaigc.com",
        "https://api.modelink.ai"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "aicoding-anthropic",
    "name": "AICoding",
    "protocol": "anthropic",
    "baseUrl": "https://api.aicoding.inc",
    "category": "third_party",
    "logo": "/logos/aicoding.svg",
    "websiteUrl": "https://aicoding.inc",
    "consoleUrl": "https://aicoding.inc/i/CCSWITCH",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.aicoding.inc"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "subrouter-anthropic",
    "name": "SubRouter",
    "protocol": "anthropic",
    "baseUrl": "https://subrouter.ai",
    "category": "aggregator",
    "logo": "/logos/subrouter.svg",
    "websiteUrl": "https://subrouter.ai",
    "consoleUrl": "https://subrouter.ai/register?aff=l3ri",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "apikey-fun-anthropic",
    "name": "APIKEY.FUN",
    "protocol": "anthropic",
    "baseUrl": "https://api.apikey.fun",
    "category": "third_party",
    "logo": "/logos/apikeyfun.png",
    "websiteUrl": "https://apikey.fun",
    "consoleUrl": "https://apikey.fun/register?aff=CCSwitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.apikey.fun",
        "https://slb.apikey.fun"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "claudeapi-anthropic",
    "name": "ClaudeAPI",
    "protocol": "anthropic",
    "baseUrl": "https://gw.apito.ai",
    "category": "aggregator",
    "logo": "/logos/ClaudeApi.png",
    "websiteUrl": "https://www.apito.ai",
    "consoleUrl": "https://console.apito.ai/agent/register/pQBql2buaqiX3dDS",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "code0-anthropic",
    "name": "Code0",
    "protocol": "anthropic",
    "baseUrl": "https://code0.ai",
    "category": "aggregator",
    "logo": "/logos/code0.png",
    "websiteUrl": "https://code0.ai",
    "consoleUrl": "https://code0.ai/agent/register/B2XHxGjGmRvqgznY",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "teamorouter-anthropic",
    "name": "TeamoRouter",
    "protocol": "anthropic",
    "baseUrl": "https://api.teamorouter.cn",
    "category": "aggregator",
    "logo": "/logos/TeamoRouter-icon-dark.png",
    "websiteUrl": "https://teamorouter.cn",
    "consoleUrl": "https://teamorouter.cn/?utm_source=cc_switch&utm_medium=referral&utm_campaign=ai_directory",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.teamorouter.cn",
        "https://api.teamorouter.com"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "ppio-anthropic",
    "name": "PPIO",
    "protocol": "anthropic",
    "baseUrl": "https://api.ppio.com/anthropic",
    "category": "aggregator",
    "logo": "/logos/ppio.svg",
    "websiteUrl": "https://ppio.com",
    "consoleUrl": "https://ppio.com/activity/ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.ppio.com/anthropic"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "claudecn-anthropic",
    "name": "ClaudeCN",
    "protocol": "anthropic",
    "baseUrl": "https://claudecn.top",
    "category": "third_party",
    "logo": "/logos/claudecn.png",
    "websiteUrl": "https://claudecn.top",
    "consoleUrl": "https://claudecn.ai/register?aff=HEL9",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "agent-plan-anthropic",
    "name": "火山 Agent Plan",
    "protocol": "anthropic",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/plan",
    "category": "cn_official",
    "logo": "/logos/huoshan.png",
    "websiteUrl": "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    "consoleUrl": "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "coding-plan-anthropic",
    "name": "火山 Coding Plan",
    "protocol": "anthropic",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/coding",
    "category": "cn_official",
    "logo": "/logos/huoshan.png",
    "websiteUrl": "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "consoleUrl": "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "byteplus-anthropic",
    "name": "BytePlus",
    "protocol": "anthropic",
    "baseUrl": "https://ark.ap-southeast.bytepluses.com/api/coding",
    "category": "cn_official",
    "logo": "/logos/byteplus.png",
    "websiteUrl": "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "consoleUrl": "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "doubaoseed-anthropic",
    "name": "DouBaoSeed",
    "protocol": "anthropic",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/compatible",
    "category": "cn_official",
    "logo": "/logos/doubao.svg",
    "websiteUrl": "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "consoleUrl": "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "siliconflow-anthropic",
    "name": "SiliconFlow",
    "protocol": "anthropic",
    "baseUrl": "https://api.siliconflow.cn",
    "category": "aggregator",
    "logo": "/logos/siliconflow.svg",
    "websiteUrl": "https://siliconflow.cn",
    "consoleUrl": "https://cloud.siliconflow.cn/i/YflgU2Ve",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "siliconflow-en-anthropic",
    "name": "SiliconFlow en",
    "protocol": "anthropic",
    "baseUrl": "https://api.siliconflow.com",
    "category": "aggregator",
    "logo": "/logos/siliconflow.svg",
    "websiteUrl": "https://siliconflow.com",
    "consoleUrl": "https://cloud.siliconflow.cn/i/YflgU2Ve",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "a6api-anthropic",
    "name": "A6API",
    "protocol": "anthropic",
    "baseUrl": "https://api.a6api.com",
    "category": "aggregator",
    "logo": "/logos/a6-icon.png",
    "websiteUrl": "https://www.a6api.com",
    "consoleUrl": "https://a6api.com/register?aff=AqNr",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "atlascloud-anthropic",
    "name": "AtlasCloud",
    "protocol": "anthropic",
    "baseUrl": "https://api.atlascloud.ai",
    "category": "aggregator",
    "logo": "/logos/atlascloud_icon.png",
    "websiteUrl": "https://www.atlascloud.ai/console/coding-plan",
    "consoleUrl": "https://www.atlascloud.ai/console/coding-plan",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.atlascloud.ai"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "compshare-anthropic",
    "name": "Compshare",
    "protocol": "anthropic",
    "baseUrl": "https://api.modelverse.cn",
    "category": "aggregator",
    "logo": "/logos/ucloud.svg",
    "websiteUrl": "https://www.compshare.cn",
    "consoleUrl": "https://www.compshare.cn/coding-plan?ytag=GPU_YY_YX_git_cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.modelverse.cn"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "compshare-coding-plan-anthropic",
    "name": "Compshare Coding Plan",
    "protocol": "anthropic",
    "baseUrl": "https://cp.compshare.cn",
    "category": "aggregator",
    "logo": "/logos/ucloud.svg",
    "websiteUrl": "https://www.compshare.cn",
    "consoleUrl": "https://www.compshare.cn/coding-plan?ytag=GPU_YY_YX_git_cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://cp.compshare.cn"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "ccsub-anthropic",
    "name": "CCSub",
    "protocol": "anthropic",
    "baseUrl": "https://www.ccsub.net",
    "category": "aggregator",
    "logo": "/logos/ccsub.svg",
    "websiteUrl": "https://www.ccsub.net",
    "consoleUrl": "https://www.ccsub.net/register?ref=Y6Z8DXEA",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "sssaicode-anthropic",
    "name": "SSSAiCode",
    "protocol": "anthropic",
    "baseUrl": "https://node-hk.sssaicodeapi.com/api",
    "category": "third_party",
    "logo": "/logos/sssaicode.svg",
    "websiteUrl": "https://sssaicodeapi.com",
    "consoleUrl": "https://sssaicodeapi.com/register?ref=DCP0SM",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://node-hk.sssaicodeapi.com/api",
        "https://node-hk.sssaiapi.com/api",
        "https://node-cf.sssaicodeapi.com/api"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "micu-anthropic",
    "name": "Micu",
    "protocol": "anthropic",
    "baseUrl": "https://www.micuapi.ai",
    "category": "third_party",
    "logo": "/logos/micu.svg",
    "websiteUrl": "https://www.micuapi.ai",
    "consoleUrl": "https://www.micuapi.ai/register?aff=aOYQ",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://www.micuapi.ai"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "rightcode-anthropic",
    "name": "RightCode",
    "protocol": "anthropic",
    "baseUrl": "https://www.rightapi.ai/claude",
    "category": "third_party",
    "logo": "/logos/rc.svg",
    "websiteUrl": "https://www.rightapi.ai",
    "consoleUrl": "https://www.rightapi.ai/register?aff=CCSWITCH",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "etok-ai-anthropic",
    "name": "ETok.ai",
    "protocol": "anthropic",
    "baseUrl": "https://api.etok.ai",
    "category": "third_party",
    "logo": "/logos/etok.png",
    "websiteUrl": "https://etok.ai",
    "consoleUrl": "https://etok.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "cubence-anthropic",
    "name": "Cubence",
    "protocol": "anthropic",
    "baseUrl": "https://api.cubence.com",
    "category": "third_party",
    "logo": "/logos/cubence.svg",
    "websiteUrl": "https://cubence.com",
    "consoleUrl": "https://cubence.com/signup?code=CCSWITCH&source=ccs",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.cubence.com",
        "https://api-cf.cubence.com",
        "https://api-dmit.cubence.com",
        "https://api-bwg.cubence.com"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "crazyrouter-anthropic",
    "name": "CrazyRouter",
    "protocol": "anthropic",
    "baseUrl": "https://cn.crazyrouter.com",
    "category": "third_party",
    "logo": "/logos/crazyrouter.svg",
    "websiteUrl": "https://www.crazyrouter.com",
    "consoleUrl": "https://www.crazyrouter.com/register?aff=OZcm&ref=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://cn.crazyrouter.com"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "dmxapi-anthropic",
    "name": "DMXAPI",
    "protocol": "anthropic",
    "baseUrl": "https://www.dmxapi.cn",
    "category": "aggregator",
    "websiteUrl": "https://www.dmxapi.cn",
    "consoleUrl": "https://www.dmxapi.cn",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://www.dmxapi.cn",
        "https://api.dmxapi.cn"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "sudocode-chat-anthropic",
    "name": "SudoCode.chat",
    "protocol": "anthropic",
    "baseUrl": "https://api.sudocode.chat",
    "category": "third_party",
    "logo": "/logos/sudocode.png",
    "websiteUrl": "https://sudocode.chat",
    "consoleUrl": "https://sudocode.chat/sign-up?aff=CC-SWITCH&utm_source=cc-switch&utm_medium=sponsor&utm_campaign=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.sudocode.chat"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "sudocode-us-anthropic",
    "name": "SudoCode.us",
    "protocol": "anthropic",
    "baseUrl": "https://sudocode.us",
    "category": "third_party",
    "logo": "/logos/sudocode-us.png",
    "websiteUrl": "https://sudocode.us",
    "consoleUrl": "https://sudocode.us",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://sudocode.us",
        "https://sudocode.run"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "xycai-anthropic",
    "name": "XycAi",
    "protocol": "anthropic",
    "baseUrl": "https://apicdn.xycai.us",
    "category": "aggregator",
    "logo": "/logos/xycai-icon.png",
    "websiteUrl": "https://xycai.us",
    "consoleUrl": "https://xycai.us/register?aff=Uhu9",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://apicdn.xycai.us",
        "https://apicdn.xyc.ai"
      ],
      "api_key_field": "ANTHROPIC_API_KEY",
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "amux-anthropic",
    "name": "Amux",
    "protocol": "anthropic",
    "baseUrl": "https://api.amux.ai",
    "category": "aggregator",
    "logo": "/logos/amuxapi-icon.svg",
    "websiteUrl": "https://amux.ai",
    "consoleUrl": "https://amux.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "gemini-native-gemini",
    "name": "Gemini Native",
    "protocol": "gemini",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "category": "third_party",
    "logo": "/logos/gemini.svg",
    "websiteUrl": "https://ai.google.dev/gemini-api",
    "consoleUrl": "https://aistudio.google.com/app/apikey",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://generativelanguage.googleapis.com"
      ],
      "api_key_field": "ANTHROPIC_API_KEY",
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "deepseek-anthropic",
    "name": "DeepSeek",
    "protocol": "anthropic",
    "baseUrl": "https://api.deepseek.com/anthropic",
    "category": "cn_official",
    "logo": "/logos/deepseek.svg",
    "websiteUrl": "https://platform.deepseek.com",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "opencode-go-anthropic",
    "name": "OpenCode Go",
    "protocol": "anthropic",
    "baseUrl": "https://opencode.ai/zen/go",
    "category": "third_party",
    "websiteUrl": "https://opencode.ai/go",
    "consoleUrl": "https://opencode.ai/go?ref=2YTRG2NGTX",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://opencode.ai/zen/go"
      ],
      "api_key_field": "ANTHROPIC_API_KEY",
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "zhipu-glm-anthropic",
    "name": "Zhipu GLM",
    "protocol": "anthropic",
    "baseUrl": "https://open.bigmodel.cn/api/anthropic",
    "category": "cn_official",
    "logo": "/logos/zhipu.svg",
    "websiteUrl": "https://open.bigmodel.cn",
    "consoleUrl": "https://www.bigmodel.cn/claude-code?ic=RRVJPB5SII",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "zhipu-glm-en-anthropic",
    "name": "Zhipu GLM en",
    "protocol": "anthropic",
    "baseUrl": "https://api.z.ai/api/anthropic",
    "category": "cn_official",
    "logo": "/logos/zhipu.svg",
    "websiteUrl": "https://z.ai",
    "consoleUrl": "https://z.ai/subscribe?ic=8JVLJQFSKB",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "baidu-qianfan-coding-plan-anthropic",
    "name": "Baidu Qianfan Coding Plan",
    "protocol": "anthropic",
    "baseUrl": "https://qianfan.baidubce.com/anthropic/coding",
    "category": "cn_official",
    "logo": "/logos/baidu.svg",
    "websiteUrl": "https://cloud.baidu.com/product/qianfan_modelbuilder",
    "consoleUrl": "https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://qianfan.baidubce.com/anthropic/coding"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "baidu-qianfan-token-plan-anthropic",
    "name": "Baidu Qianfan Token Plan",
    "protocol": "anthropic",
    "baseUrl": "https://qianfan.baidubce.com/anthropic/tokenplan/personal",
    "category": "cn_official",
    "logo": "/logos/baidu.svg",
    "websiteUrl": "https://cloud.baidu.com/product/codingplan.html",
    "consoleUrl": "https://console.bce.baidu.com/qianfan/resource/token-plan",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://qianfan.baidubce.com/anthropic/tokenplan/personal"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "bailian-anthropic",
    "name": "Bailian",
    "protocol": "anthropic",
    "baseUrl": "https://dashscope.aliyuncs.com/apps/anthropic",
    "category": "cn_official",
    "logo": "/logos/bailian.svg",
    "websiteUrl": "https://bailian.console.aliyun.com",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "bailian-for-coding-anthropic",
    "name": "Bailian For Coding",
    "protocol": "anthropic",
    "baseUrl": "https://coding.dashscope.aliyuncs.com/apps/anthropic",
    "category": "cn_official",
    "logo": "/logos/bailian.svg",
    "websiteUrl": "https://bailian.console.aliyun.com",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "stepfun-anthropic",
    "name": "StepFun",
    "protocol": "anthropic",
    "baseUrl": "https://api.stepfun.com/step_plan",
    "category": "cn_official",
    "logo": "/logos/stepfun.svg",
    "websiteUrl": "https://platform.stepfun.com/step-plan",
    "consoleUrl": "https://platform.stepfun.com/interface-key",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.stepfun.com/step_plan"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "stepfun-en-anthropic",
    "name": "StepFun en",
    "protocol": "anthropic",
    "baseUrl": "https://api.stepfun.ai/step_plan",
    "category": "cn_official",
    "logo": "/logos/stepfun.svg",
    "websiteUrl": "https://platform.stepfun.ai/step-plan",
    "consoleUrl": "https://platform.stepfun.ai/interface-key",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.stepfun.ai/step_plan"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "modelscope-anthropic",
    "name": "ModelScope",
    "protocol": "anthropic",
    "baseUrl": "https://api-inference.modelscope.cn",
    "category": "aggregator",
    "websiteUrl": "https://modelscope.cn",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "kat-coder-anthropic",
    "name": "KAT-Coder",
    "protocol": "anthropic",
    "baseUrl": "https://vanchin.streamlake.ai/api/gateway/v1/endpoints/${ENDPOINT_ID}/claude-code-proxy",
    "category": "cn_official",
    "logo": "/logos/catcoder.svg",
    "websiteUrl": "https://console.streamlake.ai",
    "consoleUrl": "https://console.streamlake.ai/console/api-key",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "longcat-anthropic",
    "name": "Longcat",
    "protocol": "anthropic",
    "baseUrl": "https://api.longcat.chat/anthropic",
    "category": "cn_official",
    "websiteUrl": "https://longcat.chat/platform",
    "consoleUrl": "https://longcat.chat/platform/api_keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "minimax-anthropic",
    "name": "MiniMax",
    "protocol": "anthropic",
    "baseUrl": "https://api.minimaxi.com/anthropic",
    "category": "cn_official",
    "logo": "/logos/minimax.svg",
    "websiteUrl": "https://platform.minimaxi.com",
    "consoleUrl": "https://platform.minimaxi.com/subscribe/coding-plan",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "minimax-en-anthropic",
    "name": "MiniMax en",
    "protocol": "anthropic",
    "baseUrl": "https://api.minimax.io/anthropic",
    "category": "cn_official",
    "logo": "/logos/minimax.svg",
    "websiteUrl": "https://platform.minimax.io",
    "consoleUrl": "https://platform.minimax.io/subscribe/coding-plan",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "bailing-anthropic",
    "name": "BaiLing",
    "protocol": "anthropic",
    "baseUrl": "https://api.tbox.cn/api/anthropic",
    "category": "cn_official",
    "websiteUrl": "https://alipaytbox.yuque.com/sxs0ba/ling/get_started",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "aihubmix-anthropic",
    "name": "AiHubMix",
    "protocol": "anthropic",
    "baseUrl": "https://aihubmix.com",
    "category": "aggregator",
    "websiteUrl": "https://aihubmix.com",
    "consoleUrl": "https://aihubmix.com",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://aihubmix.com",
        "https://api.aihubmix.com"
      ],
      "api_key_field": "ANTHROPIC_API_KEY",
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "cherryin-anthropic",
    "name": "CherryIN",
    "protocol": "anthropic",
    "baseUrl": "https://open.cherryin.net",
    "category": "aggregator",
    "logo": "/logos/cherryin.png",
    "websiteUrl": "https://open.cherryin.ai",
    "consoleUrl": "https://open.cherryin.ai/console/token",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://open.cherryin.net"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "relaxycode-anthropic",
    "name": "RelaxyCode",
    "protocol": "anthropic",
    "baseUrl": "https://www.relaxycode.com",
    "category": "third_party",
    "logo": "/logos/relaxcode.png",
    "websiteUrl": "https://www.relaxycode.com",
    "consoleUrl": "https://www.relaxycode.com/register",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "e-flowcode-anthropic",
    "name": "E-FlowCode",
    "protocol": "anthropic",
    "baseUrl": "https://e-flowcode.cc",
    "category": "third_party",
    "logo": "/logos/eflowcode.png",
    "websiteUrl": "https://e-flowcode.cc",
    "consoleUrl": "https://e-flowcode.cc",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://e-flowcode.cc"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "openrouter-anthropic",
    "name": "OpenRouter",
    "protocol": "anthropic",
    "baseUrl": "https://openrouter.ai/api",
    "category": "aggregator",
    "logo": "/logos/openrouter.svg",
    "websiteUrl": "https://openrouter.ai",
    "consoleUrl": "https://openrouter.ai/keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "therouter-anthropic",
    "name": "TheRouter",
    "protocol": "anthropic",
    "baseUrl": "https://api.therouter.ai",
    "category": "aggregator",
    "websiteUrl": "https://therouter.ai",
    "consoleUrl": "https://dashboard.therouter.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.therouter.ai"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "novita-ai-anthropic",
    "name": "Novita AI",
    "protocol": "anthropic",
    "baseUrl": "https://api.novita.ai/anthropic",
    "category": "aggregator",
    "logo": "/logos/novita.svg",
    "websiteUrl": "https://novita.ai",
    "consoleUrl": "https://novita.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.novita.ai/anthropic"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "github-copilot-openai",
    "name": "GitHub Copilot",
    "protocol": "openai",
    "baseUrl": "https://api.githubcopilot.com",
    "category": "third_party",
    "logo": "/logos/github.svg",
    "websiteUrl": "https://github.com/features/copilot",
    "supported": false,
    "disabledReason": "需要 OAuth 登录，Model Center 暂不支持",
    "authMode": "oauth",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "codex-responses",
    "name": "Codex",
    "protocol": "openai-responses",
    "baseUrl": "https://chatgpt.com/backend-api/codex",
    "category": "third_party",
    "logo": "/logos/openai.svg",
    "websiteUrl": "https://openai.com/chatgpt/pricing",
    "supported": false,
    "disabledReason": "需要 OAuth 登录，Model Center 暂不支持",
    "authMode": "oauth",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "xai-grok-responses",
    "name": "xAI (Grok)",
    "protocol": "openai-responses",
    "baseUrl": "https://api.x.ai/v1",
    "category": "third_party",
    "logo": "/logos/xai.svg",
    "websiteUrl": "https://x.ai/grok",
    "supported": false,
    "disabledReason": "需要 OAuth 登录，Model Center 暂不支持",
    "authMode": "oauth",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.x.ai/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "nvidia-openai",
    "name": "Nvidia",
    "protocol": "openai",
    "baseUrl": "https://integrate.api.nvidia.com",
    "category": "aggregator",
    "logo": "/logos/nvidia.svg",
    "websiteUrl": "https://build.nvidia.com",
    "consoleUrl": "https://build.nvidia.com/settings/api-keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "pipellm-anthropic",
    "name": "PIPELLM",
    "protocol": "anthropic",
    "baseUrl": "https://cc-api.pipellm.ai",
    "category": "aggregator",
    "logo": "/logos/pipellm.png",
    "websiteUrl": "https://code.pipellm.ai",
    "consoleUrl": "https://code.pipellm.ai/login?ref=uvw650za",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "xiaomi-mimo-anthropic",
    "name": "Xiaomi MiMo",
    "protocol": "anthropic",
    "baseUrl": "https://api.xiaomimimo.com/anthropic",
    "category": "cn_official",
    "logo": "/logos/xiaomimimo.svg",
    "websiteUrl": "https://platform.xiaomimimo.com",
    "consoleUrl": "https://platform.xiaomimimo.com/#/console/api-keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "xiaomi-mimo-token-plan-china-anthropic",
    "name": "Xiaomi MiMo Token Plan (China)",
    "protocol": "anthropic",
    "baseUrl": "https://token-plan-cn.xiaomimimo.com/anthropic",
    "category": "cn_official",
    "logo": "/logos/xiaomimimo.svg",
    "websiteUrl": "https://platform.xiaomimimo.com/#/token-plan",
    "consoleUrl": "https://platform.xiaomimimo.com/#/console/plan-manage",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "aws-bedrock-aksk-anthropic",
    "name": "AWS Bedrock (AKSK)",
    "protocol": "anthropic",
    "baseUrl": "https://bedrock-runtime.${AWS_REGION}.amazonaws.com",
    "category": "cloud_provider",
    "logo": "/logos/aws.svg",
    "websiteUrl": "https://aws.amazon.com/bedrock/",
    "supported": false,
    "disabledReason": "Bedrock 协议暂不受 Model Center 支持",
    "authMode": "api-key",
    "sourceApps": [
      "claude"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "aws-bedrock-api-key-anthropic",
    "name": "AWS Bedrock (API Key)",
    "protocol": "anthropic",
    "baseUrl": "https://bedrock-runtime.${AWS_REGION}.amazonaws.com",
    "category": "cloud_provider",
    "logo": "/logos/aws.svg",
    "websiteUrl": "https://aws.amazon.com/bedrock/",
    "supported": false,
    "disabledReason": "Bedrock 协议暂不受 Model Center 支持",
    "authMode": "api-key",
    "sourceApps": [
      "claude"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "jiekou-ai-anthropic",
    "name": "JieKou AI",
    "protocol": "anthropic",
    "baseUrl": "https://api.jiekou.ai/anthropic",
    "category": "aggregator",
    "websiteUrl": "https://jiekou.ai/#model-library",
    "consoleUrl": "https://jiekou.ai/settings/key-management",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.jiekou.ai/anthropic"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "claude-desktop-official-anthropic",
    "name": "Claude Desktop Official",
    "protocol": "anthropic",
    "baseUrl": "https://api.anthropic.com",
    "category": "official",
    "logo": "/logos/anthropic.svg",
    "websiteUrl": "https://claude.ai/download",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude-desktop"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "openai-official-responses",
    "name": "OpenAI Official",
    "protocol": "openai-responses",
    "baseUrl": "",
    "category": "official",
    "logo": "/logos/openai.svg",
    "websiteUrl": "https://chatgpt.com/codex",
    "supported": false,
    "disabledReason": "需要 OAuth 登录，Model Center 暂不支持",
    "authMode": "oauth",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": true,
      "partner": false
    }
  },
  {
    "slug": "kimi-openai",
    "name": "Kimi",
    "protocol": "openai",
    "baseUrl": "https://api.moonshot.cn/v1",
    "category": "cn_official",
    "logo": "/logos/kimi.svg",
    "websiteUrl": "https://platform.kimi.com?aff=cc-switch",
    "consoleUrl": "https://platform.kimi.com/console/api-keys?aff=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.moonshot.cn/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "kimi-for-coding-openai",
    "name": "Kimi For Coding",
    "protocol": "openai",
    "baseUrl": "https://api.kimi.com/coding/v1",
    "category": "cn_official",
    "logo": "/logos/kimi.svg",
    "websiteUrl": "https://www.kimi.com/code/?aff=cc-switch",
    "consoleUrl": "https://www.kimi.com/code/?aff=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "opencode",
      "openclaw"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.kimi.com/coding/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "packycode-responses",
    "name": "PackyCode",
    "protocol": "openai-responses",
    "baseUrl": "https://www.packyapi.ai/v1",
    "category": "third_party",
    "logo": "/logos/packycode.svg",
    "websiteUrl": "https://www.packyapi.ai",
    "consoleUrl": "https://www.packyapi.ai/register?aff=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://www.packyapi.ai/v1",
        "https://cf.api.fan/v1",
        "https://slb-v1.api.fan/v1",
        "https://www.packyapi.com/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "zetaapi-responses",
    "name": "ZetaAPI",
    "protocol": "openai-responses",
    "baseUrl": "https://api.zetaapi.ai/v1",
    "category": "aggregator",
    "logo": "/logos/zetaapi-icon.png",
    "websiteUrl": "https://zetaapi.ai",
    "consoleUrl": "https://zetaapi.ai/go/u117",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.zetaapi.ai/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "apinebula-responses",
    "name": "APINebula",
    "protocol": "openai-responses",
    "baseUrl": "https://apinebula.ai/v1",
    "category": "third_party",
    "logo": "/logos/apinebula_icon.png",
    "websiteUrl": "https://apinebula.ai",
    "consoleUrl": "https://apinebula.ai/VjM74M",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://apinebula.ai/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "aicodemirror-responses",
    "name": "AICodeMirror",
    "protocol": "openai-responses",
    "baseUrl": "https://api.aicodemirror.ai/api/codex/backend-api/codex",
    "category": "other",
    "logo": "/logos/aicodemirror.svg",
    "websiteUrl": "https://www.aicodemirror.ai",
    "consoleUrl": "https://www.aicodemirror.ai/register?invitecode=9915W3",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.aicodemirror.ai/api/codex/backend-api/codex"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "patewayai-responses",
    "name": "PatewayAI",
    "protocol": "openai-responses",
    "baseUrl": "https://api.pateway.ai/v1",
    "category": "third_party",
    "logo": "/logos/pateway.jpg",
    "websiteUrl": "https://pateway.ai",
    "consoleUrl": "https://pateway.ai/?ch=etzpm8&aff=WB6M6F67#/",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.pateway.ai/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "fennoai-responses",
    "name": "FennoAI",
    "protocol": "openai-responses",
    "baseUrl": "https://api.fenno.ai",
    "category": "aggregator",
    "logo": "/logos/fenno-icon.webp",
    "websiteUrl": "https://api.fenno.ai",
    "consoleUrl": "https://api.fenno.ai/register?redirect=/purchase?tab=subscription%26group=16&aff=P9MR3D3PLCNL",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.fenno.ai"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "runapi-responses",
    "name": "RunAPI",
    "protocol": "openai-responses",
    "baseUrl": "https://runapi.host/v1",
    "category": "aggregator",
    "logo": "/logos/runapi.jpg",
    "websiteUrl": "https://runapi.host",
    "consoleUrl": "https://runapi.host/register?aff=iOKB",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://runapi.host/v1",
        "https://runapi.co/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "shengsuanyun-responses",
    "name": "Shengsuanyun",
    "protocol": "openai-responses",
    "baseUrl": "https://router.shengsuanyun.com/api/v1",
    "category": "aggregator",
    "logo": "/logos/shengsuanyun.svg",
    "websiteUrl": "https://www.shengsuanyun.com/?from=CH_4HHXMRYF",
    "consoleUrl": "https://www.shengsuanyun.com/?from=CH_4HHXMRYF",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "aigocode-responses",
    "name": "AIGoCode",
    "protocol": "openai-responses",
    "baseUrl": "https://api.aigocode.app",
    "category": "third_party",
    "logo": "/logos/algocode.svg",
    "websiteUrl": "https://aigocode.app",
    "consoleUrl": "https://aigocode.app/invite/CC-SWITCH",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.aigocode.app"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "qiniu-responses",
    "name": "Qiniu",
    "protocol": "openai-responses",
    "baseUrl": "https://api.qnaigc.com/bypass/openai/v1",
    "category": "aggregator",
    "logo": "/logos/qiniu.png",
    "websiteUrl": "https://s.qiniu.com/nMvAvy",
    "consoleUrl": "https://s.qiniu.com/nMvAvy",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.qnaigc.com/bypass/openai/v1",
        "https://api.modelink.ai/bypass/openai/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "aicoding-responses",
    "name": "AICoding",
    "protocol": "openai-responses",
    "baseUrl": "https://api.aicoding.inc",
    "category": "other",
    "logo": "/logos/aicoding.svg",
    "websiteUrl": "https://aicoding.inc",
    "consoleUrl": "https://aicoding.inc/i/CCSWITCH",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.aicoding.inc"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "subrouter-responses",
    "name": "SubRouter",
    "protocol": "openai-responses",
    "baseUrl": "https://subrouter.ai/v1",
    "category": "aggregator",
    "logo": "/logos/subrouter.svg",
    "websiteUrl": "https://subrouter.ai",
    "consoleUrl": "https://subrouter.ai/register?aff=l3ri",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://subrouter.ai/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "apikey-fun-responses",
    "name": "APIKEY.FUN",
    "protocol": "openai-responses",
    "baseUrl": "https://api.apikey.fun/v1",
    "category": "third_party",
    "logo": "/logos/apikeyfun.png",
    "websiteUrl": "https://apikey.fun",
    "consoleUrl": "https://apikey.fun/register?aff=CCSwitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.apikey.fun/v1",
        "https://slb.apikey.fun/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "code0-responses",
    "name": "Code0",
    "protocol": "openai-responses",
    "baseUrl": "https://code0.ai/v1",
    "category": "aggregator",
    "logo": "/logos/code0.png",
    "websiteUrl": "https://code0.ai",
    "consoleUrl": "https://code0.ai/agent/register/B2XHxGjGmRvqgznY",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://code0.ai/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "teamorouter-responses",
    "name": "TeamoRouter",
    "protocol": "openai-responses",
    "baseUrl": "https://api.teamorouter.cn/v1",
    "category": "aggregator",
    "logo": "/logos/TeamoRouter-icon-dark.png",
    "websiteUrl": "https://teamorouter.cn",
    "consoleUrl": "https://teamorouter.cn/?utm_source=cc_switch&utm_medium=referral&utm_campaign=ai_directory",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.teamorouter.cn/v1",
        "https://api.teamorouter.com/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "ppio-openai",
    "name": "PPIO",
    "protocol": "openai",
    "baseUrl": "https://api.ppio.com/openai/v1",
    "category": "aggregator",
    "logo": "/logos/ppio.svg",
    "websiteUrl": "https://ppio.com",
    "consoleUrl": "https://ppio.com/activity/ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "opencode",
      "openclaw",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.ppio.com/openai/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "claudecn-responses",
    "name": "ClaudeCN",
    "protocol": "openai-responses",
    "baseUrl": "https://claudecn.top/v1",
    "category": "third_party",
    "logo": "/logos/claudecn.png",
    "websiteUrl": "https://claudecn.top",
    "consoleUrl": "https://claudecn.ai/register?aff=HEL9",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "agent-plan-responses",
    "name": "火山 Agent Plan",
    "protocol": "openai-responses",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/plan/v3",
    "category": "cn_official",
    "logo": "/logos/huoshan.png",
    "websiteUrl": "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    "consoleUrl": "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://ark.cn-beijing.volces.com/api/plan/v3"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "coding-plan-responses",
    "name": "火山 Coding Plan",
    "protocol": "openai-responses",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/coding/v3",
    "category": "cn_official",
    "logo": "/logos/huoshan.png",
    "websiteUrl": "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "consoleUrl": "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://ark.cn-beijing.volces.com/api/coding/v3"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "byteplus-responses",
    "name": "BytePlus",
    "protocol": "openai-responses",
    "baseUrl": "https://ark.ap-southeast.bytepluses.com/api/coding/v3",
    "category": "cn_official",
    "logo": "/logos/byteplus.png",
    "websiteUrl": "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "consoleUrl": "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://ark.ap-southeast.bytepluses.com/api/coding/v3"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "doubaoseed-responses",
    "name": "DouBaoSeed",
    "protocol": "openai-responses",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
    "category": "cn_official",
    "logo": "/logos/doubao.svg",
    "websiteUrl": "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "consoleUrl": "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://ark.cn-beijing.volces.com/api/v3"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "siliconflow-openai",
    "name": "SiliconFlow",
    "protocol": "openai",
    "baseUrl": "https://api.siliconflow.cn/v1",
    "category": "aggregator",
    "logo": "/logos/siliconflow.svg",
    "websiteUrl": "https://siliconflow.cn",
    "consoleUrl": "https://cloud.siliconflow.cn/i/YflgU2Ve",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "openclaw",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.siliconflow.cn/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "siliconflow-en-openai",
    "name": "SiliconFlow en",
    "protocol": "openai",
    "baseUrl": "https://api.siliconflow.com/v1",
    "category": "aggregator",
    "logo": "/logos/siliconflow.svg",
    "websiteUrl": "https://siliconflow.com",
    "consoleUrl": "https://cloud.siliconflow.cn/i/YflgU2Ve",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "openclaw",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.siliconflow.com/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "a6api-responses",
    "name": "A6API",
    "protocol": "openai-responses",
    "baseUrl": "https://api.a6api.com/v1",
    "category": "aggregator",
    "logo": "/logos/a6-icon.png",
    "websiteUrl": "https://www.a6api.com",
    "consoleUrl": "https://a6api.com/register?aff=AqNr",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.a6api.com/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "atlascloud-openai",
    "name": "AtlasCloud",
    "protocol": "openai",
    "baseUrl": "https://api.atlascloud.ai/v1",
    "category": "aggregator",
    "logo": "/logos/atlascloud_icon.png",
    "websiteUrl": "https://www.atlascloud.ai/console/coding-plan",
    "consoleUrl": "https://www.atlascloud.ai/console/coding-plan",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.atlascloud.ai/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "compshare-responses",
    "name": "Compshare",
    "protocol": "openai-responses",
    "baseUrl": "https://api.modelverse.cn/v1",
    "category": "aggregator",
    "logo": "/logos/ucloud.svg",
    "websiteUrl": "https://www.compshare.cn",
    "consoleUrl": "https://www.compshare.cn/coding-plan?ytag=GPU_YY_YX_git_cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.modelverse.cn/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "compshare-coding-plan-responses",
    "name": "Compshare Coding Plan",
    "protocol": "openai-responses",
    "baseUrl": "https://cp.compshare.cn/v1",
    "category": "aggregator",
    "logo": "/logos/ucloud.svg",
    "websiteUrl": "https://www.compshare.cn",
    "consoleUrl": "https://www.compshare.cn/coding-plan?ytag=GPU_YY_YX_git_cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://cp.compshare.cn/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "ccsub-responses",
    "name": "CCSub",
    "protocol": "openai-responses",
    "baseUrl": "https://www.ccsub.net/v1",
    "category": "aggregator",
    "logo": "/logos/ccsub.svg",
    "websiteUrl": "https://www.ccsub.net",
    "consoleUrl": "https://www.ccsub.net/register?ref=Y6Z8DXEA",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://www.ccsub.net/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "sssaicode-responses",
    "name": "SSSAiCode",
    "protocol": "openai-responses",
    "baseUrl": "https://node-hk.sssaicodeapi.com/api/v1",
    "category": "third_party",
    "logo": "/logos/sssaicode.svg",
    "websiteUrl": "https://sssaicodeapi.com",
    "consoleUrl": "https://sssaicodeapi.com/register?ref=DCP0SM",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://node-hk.sssaicodeapi.com/api/v1",
        "https://node-hk.sssaiapi.com/api/v1",
        "https://node-cf.sssaicodeapi.com/api/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "micu-responses",
    "name": "Micu",
    "protocol": "openai-responses",
    "baseUrl": "https://www.micuapi.ai/v1",
    "category": "third_party",
    "logo": "/logos/micu.svg",
    "websiteUrl": "https://www.micuapi.ai",
    "consoleUrl": "https://www.micuapi.ai/register?aff=aOYQ",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://www.micuapi.ai/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "rightcode-responses",
    "name": "RightCode",
    "protocol": "openai-responses",
    "baseUrl": "https://www.rightapi.ai/codex/v1",
    "category": "third_party",
    "logo": "/logos/rc.svg",
    "websiteUrl": "https://www.rightapi.ai",
    "consoleUrl": "https://www.rightapi.ai/register?aff=CCSWITCH",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "etok-ai-responses",
    "name": "ETok.ai",
    "protocol": "openai-responses",
    "baseUrl": "https://api.etok.ai/v1",
    "category": "third_party",
    "logo": "/logos/etok.png",
    "websiteUrl": "https://etok.ai",
    "consoleUrl": "https://etok.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.etok.ai/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "cubence-responses",
    "name": "Cubence",
    "protocol": "openai-responses",
    "baseUrl": "https://api.cubence.com/v1",
    "category": "third_party",
    "logo": "/logos/cubence.svg",
    "websiteUrl": "https://cubence.com",
    "consoleUrl": "https://cubence.com/signup?code=CCSWITCH&source=ccs",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.cubence.com/v1",
        "https://api-cf.cubence.com/v1",
        "https://api-dmit.cubence.com/v1",
        "https://api-bwg.cubence.com/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "crazyrouter-responses",
    "name": "CrazyRouter",
    "protocol": "openai-responses",
    "baseUrl": "https://cn.crazyrouter.com/v1",
    "category": "other",
    "logo": "/logos/crazyrouter.svg",
    "websiteUrl": "https://www.crazyrouter.com",
    "consoleUrl": "https://www.crazyrouter.com/register?aff=OZcm&ref=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://cn.crazyrouter.com/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "dmxapi-responses",
    "name": "DMXAPI",
    "protocol": "openai-responses",
    "baseUrl": "https://www.dmxapi.cn/v1",
    "category": "aggregator",
    "websiteUrl": "https://www.dmxapi.cn",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://www.dmxapi.cn/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "sudocode-chat-responses",
    "name": "SudoCode.chat",
    "protocol": "openai-responses",
    "baseUrl": "https://api.sudocode.chat/v1",
    "category": "third_party",
    "logo": "/logos/sudocode.png",
    "websiteUrl": "https://sudocode.chat",
    "consoleUrl": "https://sudocode.chat/sign-up?aff=CC-SWITCH&utm_source=cc-switch&utm_medium=sponsor&utm_campaign=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.sudocode.chat/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "sudocode-us-responses",
    "name": "SudoCode.us",
    "protocol": "openai-responses",
    "baseUrl": "https://sudocode.us/v1",
    "category": "third_party",
    "logo": "/logos/sudocode-us.png",
    "websiteUrl": "https://sudocode.us",
    "consoleUrl": "https://sudocode.us",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://sudocode.us/v1",
        "https://sudocode.run/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "xycai-responses",
    "name": "XycAi",
    "protocol": "openai-responses",
    "baseUrl": "https://apicdn.xycai.us/v1",
    "category": "aggregator",
    "logo": "/logos/xycai-icon.png",
    "websiteUrl": "https://xycai.us",
    "consoleUrl": "https://xycai.us/register?aff=Uhu9",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://apicdn.xycai.us/v1",
        "https://apicdn.xyc.ai/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "amux-responses",
    "name": "Amux",
    "protocol": "openai-responses",
    "baseUrl": "https://api.amux.ai/v1",
    "category": "aggregator",
    "logo": "/logos/amuxapi-icon.svg",
    "websiteUrl": "https://amux.ai",
    "consoleUrl": "https://amux.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.amux.ai/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "azure-openai-responses",
    "name": "Azure OpenAI",
    "protocol": "openai-responses",
    "baseUrl": "https://YOUR_RESOURCE_NAME.openai.azure.com/openai",
    "category": "third_party",
    "logo": "/logos/azure.svg",
    "websiteUrl": "https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/codex",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://YOUR_RESOURCE_NAME.openai.azure.com/openai"
      ],
      "official": true,
      "partner": false
    }
  },
  {
    "slug": "deepseek-responses",
    "name": "DeepSeek",
    "protocol": "openai-responses",
    "baseUrl": "https://api.deepseek.com",
    "category": "cn_official",
    "logo": "/logos/deepseek.svg",
    "websiteUrl": "https://platform.deepseek.com",
    "consoleUrl": "https://platform.deepseek.com/api_keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.deepseek.com"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "zhipu-glm-openai",
    "name": "Zhipu GLM",
    "protocol": "openai",
    "baseUrl": "https://open.bigmodel.cn/api/coding/paas/v4",
    "category": "cn_official",
    "logo": "/logos/zhipu.svg",
    "websiteUrl": "https://open.bigmodel.cn",
    "consoleUrl": "https://www.bigmodel.cn/claude-code?ic=RRVJPB5SII",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://open.bigmodel.cn/api/coding/paas/v4"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "zhipu-glm-en-openai",
    "name": "Zhipu GLM en",
    "protocol": "openai",
    "baseUrl": "https://api.z.ai/api/coding/paas/v4",
    "category": "cn_official",
    "logo": "/logos/zhipu.svg",
    "websiteUrl": "https://z.ai",
    "consoleUrl": "https://z.ai/subscribe?ic=8JVLJQFSKB",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.z.ai/api/coding/paas/v4"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "baidu-qianfan-coding-plan-openai",
    "name": "Baidu Qianfan Coding Plan",
    "protocol": "openai",
    "baseUrl": "https://qianfan.baidubce.com/v2/coding",
    "category": "cn_official",
    "logo": "/logos/baidu.svg",
    "websiteUrl": "https://cloud.baidu.com/product/qianfan_modelbuilder",
    "consoleUrl": "https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://qianfan.baidubce.com/v2/coding"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "baidu-qianfan-token-plan-openai",
    "name": "Baidu Qianfan Token Plan",
    "protocol": "openai",
    "baseUrl": "https://qianfan.baidubce.com/v2/tokenplan/personal",
    "category": "cn_official",
    "logo": "/logos/baidu.svg",
    "websiteUrl": "https://cloud.baidu.com/product/codingplan.html",
    "consoleUrl": "https://console.bce.baidu.com/qianfan/resource/token-plan",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "opencode",
      "openclaw",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://qianfan.baidubce.com/v2/tokenplan/personal"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "bailian-responses",
    "name": "Bailian",
    "protocol": "openai-responses",
    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "category": "cn_official",
    "logo": "/logos/bailian.svg",
    "websiteUrl": "https://bailian.console.aliyun.com",
    "consoleUrl": "https://bailian.console.aliyun.com/#/api-key",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://dashscope.aliyuncs.com/compatible-mode/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "tencent-hunyuan-responses",
    "name": "Tencent Hunyuan",
    "protocol": "openai-responses",
    "baseUrl": "https://tokenhub.tencentmaas.com/v1",
    "category": "cn_official",
    "logo": "/logos/hunyuan.svg",
    "websiteUrl": "https://cloud.tencent.com/product/tokenhub",
    "consoleUrl": "https://console.cloud.tencent.com/tokenhub/apikey",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://tokenhub.tencentmaas.com/v1",
        "https://tokenhub.tencentmaas.cn/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "stepfun-openai",
    "name": "StepFun",
    "protocol": "openai",
    "baseUrl": "https://api.stepfun.com/step_plan/v1",
    "category": "cn_official",
    "logo": "/logos/stepfun.svg",
    "websiteUrl": "https://platform.stepfun.com/step-plan",
    "consoleUrl": "https://platform.stepfun.com/interface-key",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "opencode",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.stepfun.com/step_plan/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "stepfun-en-openai",
    "name": "StepFun en",
    "protocol": "openai",
    "baseUrl": "https://api.stepfun.ai/step_plan/v1",
    "category": "cn_official",
    "logo": "/logos/stepfun.svg",
    "websiteUrl": "https://platform.stepfun.ai/step-plan",
    "consoleUrl": "https://platform.stepfun.ai/interface-key",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "opencode",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.stepfun.ai/step_plan/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "modelscope-openai",
    "name": "ModelScope",
    "protocol": "openai",
    "baseUrl": "https://api-inference.modelscope.cn/v1",
    "category": "aggregator",
    "websiteUrl": "https://modelscope.cn",
    "consoleUrl": "https://modelscope.cn/my/myaccesstoken",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api-inference.modelscope.cn/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "longcat-responses",
    "name": "Longcat",
    "protocol": "openai-responses",
    "baseUrl": "https://api.longcat.chat/openai/v1",
    "category": "cn_official",
    "websiteUrl": "https://longcat.chat/platform",
    "consoleUrl": "https://longcat.chat/platform/api_keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.longcat.chat/openai/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "minimax-responses",
    "name": "MiniMax",
    "protocol": "openai-responses",
    "baseUrl": "https://api.minimaxi.com/v1",
    "category": "cn_official",
    "logo": "/logos/minimax.svg",
    "websiteUrl": "https://platform.minimaxi.com",
    "consoleUrl": "https://platform.minimaxi.com/subscribe/coding-plan",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.minimaxi.com/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "minimax-en-responses",
    "name": "MiniMax en",
    "protocol": "openai-responses",
    "baseUrl": "https://api.minimax.io/v1",
    "category": "cn_official",
    "logo": "/logos/minimax.svg",
    "websiteUrl": "https://platform.minimax.io",
    "consoleUrl": "https://platform.minimax.io/subscribe/coding-plan",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.minimax.io/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "bailing-openai",
    "name": "BaiLing",
    "protocol": "openai",
    "baseUrl": "https://api.tbox.cn/api/llm/v1",
    "category": "cn_official",
    "websiteUrl": "https://alipaytbox.yuque.com/sxs0ba/ling/get_started",
    "consoleUrl": "https://ling.tbox.cn/open",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.tbox.cn/api/llm/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "xiaomi-mimo-responses",
    "name": "Xiaomi MiMo",
    "protocol": "openai-responses",
    "baseUrl": "https://api.xiaomimimo.com/v1",
    "category": "cn_official",
    "logo": "/logos/xiaomimimo.svg",
    "websiteUrl": "https://platform.xiaomimimo.com",
    "consoleUrl": "https://platform.xiaomimimo.com/#/console/api-keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.xiaomimimo.com/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "xiaomi-mimo-token-plan-china-responses",
    "name": "Xiaomi MiMo Token Plan (China)",
    "protocol": "openai-responses",
    "baseUrl": "https://token-plan-cn.xiaomimimo.com/v1",
    "category": "cn_official",
    "logo": "/logos/xiaomimimo.svg",
    "websiteUrl": "https://platform.xiaomimimo.com/#/token-plan",
    "consoleUrl": "https://platform.xiaomimimo.com/#/console/plan-manage",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://token-plan-cn.xiaomimimo.com/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "novita-ai-openai",
    "name": "Novita AI",
    "protocol": "openai",
    "baseUrl": "https://api.novita.ai/openai/v1",
    "category": "aggregator",
    "logo": "/logos/novita.svg",
    "websiteUrl": "https://novita.ai",
    "consoleUrl": "https://novita.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.novita.ai/openai/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "xai-grok-oauth-responses",
    "name": "xAI (Grok) OAuth",
    "protocol": "openai-responses",
    "baseUrl": "https://api.x.ai/v1",
    "category": "third_party",
    "logo": "/logos/xai.svg",
    "websiteUrl": "https://x.ai/grok",
    "supported": false,
    "disabledReason": "需要 OAuth 登录，Model Center 暂不支持",
    "authMode": "oauth",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "nvidia-openai-integrate",
    "name": "Nvidia",
    "protocol": "openai",
    "baseUrl": "https://integrate.api.nvidia.com/v1",
    "category": "aggregator",
    "logo": "/logos/nvidia.svg",
    "websiteUrl": "https://build.nvidia.com",
    "consoleUrl": "https://build.nvidia.com/settings/api-keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "opencode",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://integrate.api.nvidia.com/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "opencode-go-openai",
    "name": "OpenCode Go",
    "protocol": "openai",
    "baseUrl": "https://opencode.ai/zen/go/v1",
    "category": "third_party",
    "websiteUrl": "https://opencode.ai/go",
    "consoleUrl": "https://opencode.ai/go?ref=2YTRG2NGTX",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "opencode",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://opencode.ai/zen/go/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "aihubmix-responses",
    "name": "AiHubMix",
    "protocol": "openai-responses",
    "baseUrl": "https://aihubmix.com/v1",
    "category": "aggregator",
    "websiteUrl": "https://aihubmix.com",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://aihubmix.com/v1",
        "https://api.aihubmix.com/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "cherryin-responses",
    "name": "CherryIN",
    "protocol": "openai-responses",
    "baseUrl": "https://open.cherryin.net/v1",
    "category": "aggregator",
    "logo": "/logos/cherryin.png",
    "websiteUrl": "https://open.cherryin.ai",
    "consoleUrl": "https://open.cherryin.ai/console/token",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://open.cherryin.net/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "relaxycode-responses",
    "name": "RelaxyCode",
    "protocol": "openai-responses",
    "baseUrl": "https://www.relaxycode.com/v1",
    "category": "third_party",
    "logo": "/logos/relaxcode.png",
    "websiteUrl": "https://www.relaxycode.com",
    "consoleUrl": "https://www.relaxycode.com/register",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "e-flowcode-responses",
    "name": "E-FlowCode",
    "protocol": "openai-responses",
    "baseUrl": "https://e-flowcode.cc/v1",
    "category": "third_party",
    "logo": "/logos/eflowcode.png",
    "websiteUrl": "https://e-flowcode.cc",
    "consoleUrl": "https://e-flowcode.cc",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://e-flowcode.cc/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "pipellm-responses",
    "name": "PIPELLM",
    "protocol": "openai-responses",
    "baseUrl": "https://cc-api.pipellm.ai/v1",
    "category": "aggregator",
    "logo": "/logos/pipellm.png",
    "websiteUrl": "https://code.pipellm.ai",
    "consoleUrl": "https://code.pipellm.ai/login?ref=uvw650za",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://cc-api.pipellm.ai/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "openrouter-responses",
    "name": "OpenRouter",
    "protocol": "openai-responses",
    "baseUrl": "https://openrouter.ai/api/v1",
    "category": "aggregator",
    "logo": "/logos/openrouter.svg",
    "websiteUrl": "https://openrouter.ai",
    "consoleUrl": "https://openrouter.ai/keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "therouter-responses",
    "name": "TheRouter",
    "protocol": "openai-responses",
    "baseUrl": "https://api.therouter.ai/v1",
    "category": "aggregator",
    "websiteUrl": "https://therouter.ai",
    "consoleUrl": "https://dashboard.therouter.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.therouter.ai/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "jiekou-ai-openai",
    "name": "JieKou AI",
    "protocol": "openai",
    "baseUrl": "https://api.jiekou.ai/openai/v1",
    "category": "aggregator",
    "websiteUrl": "https://jiekou.ai/#model-library",
    "consoleUrl": "https://jiekou.ai/settings/key-management",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex",
      "opencode",
      "openclaw",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.jiekou.ai/openai/v1"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "google-official-gemini",
    "name": "Google Official",
    "protocol": "gemini",
    "baseUrl": "https://generativelanguage.googleapis.com",
    "category": "official",
    "logo": "/logos/gemini.svg",
    "websiteUrl": "https://ai.google.dev/",
    "consoleUrl": "https://aistudio.google.com/apikey",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "packycode-gemini",
    "name": "PackyCode",
    "protocol": "gemini",
    "baseUrl": "https://www.packyapi.ai",
    "category": "third_party",
    "logo": "/logos/packycode.svg",
    "websiteUrl": "https://www.packyapi.ai",
    "consoleUrl": "https://www.packyapi.ai/register?aff=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://www.packyapi.ai",
        "https://cf.api.fan",
        "https://slb-v1.api.fan",
        "https://www.packyapi.com"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "apinebula-gemini",
    "name": "APINebula",
    "protocol": "gemini",
    "baseUrl": "https://apinebula.ai",
    "category": "third_party",
    "logo": "/logos/apinebula_icon.png",
    "websiteUrl": "https://apinebula.ai",
    "consoleUrl": "https://apinebula.ai/VjM74M",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://apinebula.ai"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "aicodemirror-gemini",
    "name": "AICodeMirror",
    "protocol": "gemini",
    "baseUrl": "https://api.aicodemirror.ai/api/gemini",
    "category": "third_party",
    "logo": "/logos/aicodemirror.svg",
    "websiteUrl": "https://www.aicodemirror.ai",
    "consoleUrl": "https://www.aicodemirror.ai/register?invitecode=9915W3",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.aicodemirror.ai/api/gemini"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "shengsuanyun-gemini",
    "name": "Shengsuanyun",
    "protocol": "gemini",
    "baseUrl": "https://router.shengsuanyun.com/api",
    "category": "aggregator",
    "logo": "/logos/shengsuanyun.svg",
    "websiteUrl": "https://www.shengsuanyun.com/?from=CH_4HHXMRYF",
    "consoleUrl": "https://www.shengsuanyun.com/?from=CH_4HHXMRYF",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "aigocode-gemini",
    "name": "AIGoCode",
    "protocol": "gemini",
    "baseUrl": "https://api.aigocode.app",
    "category": "third_party",
    "logo": "/logos/algocode.svg",
    "websiteUrl": "https://aigocode.app",
    "consoleUrl": "https://aigocode.app/invite/CC-SWITCH",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.aigocode.app"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "qiniu-gemini",
    "name": "Qiniu",
    "protocol": "gemini",
    "baseUrl": "https://api.qnaigc.com/bypass/vertex",
    "category": "aggregator",
    "logo": "/logos/qiniu.png",
    "websiteUrl": "https://s.qiniu.com/nMvAvy",
    "consoleUrl": "https://s.qiniu.com/nMvAvy",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.qnaigc.com/bypass/vertex",
        "https://api.modelink.ai/bypass/vertex"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "aicoding-gemini",
    "name": "AICoding",
    "protocol": "gemini",
    "baseUrl": "https://api.aicoding.inc",
    "category": "third_party",
    "logo": "/logos/aicoding.svg",
    "websiteUrl": "https://aicoding.inc",
    "consoleUrl": "https://aicoding.inc/i/CCSWITCH",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.aicoding.inc"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "subrouter-gemini",
    "name": "SubRouter",
    "protocol": "gemini",
    "baseUrl": "https://subrouter.ai/v1beta",
    "category": "aggregator",
    "logo": "/logos/subrouter.svg",
    "websiteUrl": "https://subrouter.ai",
    "consoleUrl": "https://subrouter.ai/register?aff=l3ri",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://subrouter.ai/v1beta"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "apikey-fun-gemini",
    "name": "APIKEY.FUN",
    "protocol": "gemini",
    "baseUrl": "https://api.apikey.fun",
    "category": "third_party",
    "logo": "/logos/apikeyfun.png",
    "websiteUrl": "https://apikey.fun",
    "consoleUrl": "https://apikey.fun/register?aff=CCSwitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.apikey.fun",
        "https://slb.apikey.fun"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "code0-gemini",
    "name": "Code0",
    "protocol": "gemini",
    "baseUrl": "https://code0.ai",
    "category": "aggregator",
    "logo": "/logos/code0.png",
    "websiteUrl": "https://code0.ai",
    "consoleUrl": "https://code0.ai/agent/register/B2XHxGjGmRvqgznY",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "a6api-gemini",
    "name": "A6API",
    "protocol": "gemini",
    "baseUrl": "https://api.a6api.com",
    "category": "aggregator",
    "logo": "/logos/a6-icon.png",
    "websiteUrl": "https://www.a6api.com",
    "consoleUrl": "https://a6api.com/register?aff=AqNr",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "sssaicode-gemini",
    "name": "SSSAiCode",
    "protocol": "gemini",
    "baseUrl": "https://node-hk.sssaicodeapi.com/api",
    "category": "third_party",
    "logo": "/logos/sssaicode.svg",
    "websiteUrl": "https://sssaicodeapi.com",
    "consoleUrl": "https://sssaicodeapi.com/register?ref=DCP0SM",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://node-hk.sssaicodeapi.com/api",
        "https://node-hk.sssaiapi.com/api",
        "https://node-cf.sssaicodeapi.com/api"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "etok-ai-gemini",
    "name": "ETok.ai",
    "protocol": "gemini",
    "baseUrl": "https://api.etok.ai/v1beta",
    "category": "third_party",
    "logo": "/logos/etok.png",
    "websiteUrl": "https://etok.ai",
    "consoleUrl": "https://etok.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.etok.ai/v1beta"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "cubence-gemini",
    "name": "Cubence",
    "protocol": "gemini",
    "baseUrl": "https://api.cubence.com",
    "category": "third_party",
    "logo": "/logos/cubence.svg",
    "websiteUrl": "https://cubence.com",
    "consoleUrl": "https://cubence.com/signup?code=CCSWITCH&source=ccs",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.cubence.com/v1",
        "https://api-cf.cubence.com/v1",
        "https://api-dmit.cubence.com/v1",
        "https://api-bwg.cubence.com/v1"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "crazyrouter-gemini",
    "name": "CrazyRouter",
    "protocol": "gemini",
    "baseUrl": "https://cn.crazyrouter.com",
    "category": "third_party",
    "logo": "/logos/crazyrouter.svg",
    "websiteUrl": "https://www.crazyrouter.com",
    "consoleUrl": "https://www.crazyrouter.com/register?aff=OZcm&ref=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://cn.crazyrouter.com"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "sudocode-us-gemini",
    "name": "SudoCode.us",
    "protocol": "gemini",
    "baseUrl": "https://sudocode.us",
    "category": "third_party",
    "logo": "/logos/sudocode-us.png",
    "websiteUrl": "https://sudocode.us",
    "consoleUrl": "https://sudocode.us",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://sudocode.us",
        "https://sudocode.run"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "xycai-gemini",
    "name": "XycAi",
    "protocol": "gemini",
    "baseUrl": "https://apicdn.xycai.us",
    "category": "aggregator",
    "logo": "/logos/xycai-icon.png",
    "websiteUrl": "https://xycai.us",
    "consoleUrl": "https://xycai.us/register?aff=Uhu9",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://apicdn.xycai.us",
        "https://apicdn.xyc.ai"
      ],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "e-flowcode-gemini",
    "name": "E-FlowCode",
    "protocol": "gemini",
    "baseUrl": "https://e-flowcode.cc",
    "category": "third_party",
    "logo": "/logos/eflowcode.png",
    "websiteUrl": "https://e-flowcode.cc",
    "consoleUrl": "https://e-flowcode.cc",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://e-flowcode.cc"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "cherryin-gemini",
    "name": "CherryIN",
    "protocol": "gemini",
    "baseUrl": "https://open.cherryin.net",
    "category": "aggregator",
    "logo": "/logos/cherryin.png",
    "websiteUrl": "https://open.cherryin.ai",
    "consoleUrl": "https://open.cherryin.ai/console/token",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://open.cherryin.net"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "openrouter-gemini",
    "name": "OpenRouter",
    "protocol": "gemini",
    "baseUrl": "https://openrouter.ai/api",
    "category": "aggregator",
    "logo": "/logos/openrouter.svg",
    "websiteUrl": "https://openrouter.ai",
    "consoleUrl": "https://openrouter.ai/keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "therouter-gemini",
    "name": "TheRouter",
    "protocol": "gemini",
    "baseUrl": "https://api.therouter.ai",
    "category": "aggregator",
    "websiteUrl": "https://therouter.ai",
    "consoleUrl": "https://dashboard.therouter.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "gemini"
    ],
    "extra": {
      "endpoint_candidates": [
        "https://api.therouter.ai"
      ],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "grok-official-responses",
    "name": "Grok Official",
    "protocol": "openai-responses",
    "baseUrl": "https://api.x.ai/v1",
    "category": "official",
    "logo": "/logos/grok.svg",
    "websiteUrl": "https://x.ai/grok",
    "supported": false,
    "disabledReason": "需要 OAuth 登录，Model Center 暂不支持",
    "authMode": "oauth",
    "sourceApps": [
      "grok-build"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": true,
      "partner": false
    }
  },
  {
    "slug": "packycode-openai",
    "name": "PackyCode",
    "protocol": "openai",
    "baseUrl": "https://www.packyapi.ai/v1",
    "category": "third_party",
    "logo": "/logos/packycode.svg",
    "websiteUrl": "https://www.packyapi.ai",
    "consoleUrl": "https://www.packyapi.ai/register?aff=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "zetaapi-openai",
    "name": "ZetaAPI",
    "protocol": "openai",
    "baseUrl": "https://api.zetaapi.ai/v1",
    "category": "aggregator",
    "logo": "/logos/zetaapi-icon.png",
    "websiteUrl": "https://zetaapi.ai",
    "consoleUrl": "https://zetaapi.ai/go/u117",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "apinebula-openai",
    "name": "APINebula",
    "protocol": "openai",
    "baseUrl": "https://apinebula.ai/v1",
    "category": "third_party",
    "logo": "/logos/apinebula_icon.png",
    "websiteUrl": "https://apinebula.ai",
    "consoleUrl": "https://apinebula.ai/VjM74M",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "aicodemirror-openai",
    "name": "AICodeMirror",
    "protocol": "openai",
    "baseUrl": "https://api.aicodemirror.ai/api/claudecode",
    "category": "third_party",
    "logo": "/logos/aicodemirror.svg",
    "websiteUrl": "https://www.aicodemirror.ai",
    "consoleUrl": "https://www.aicodemirror.ai/register?invitecode=9915W3",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "fennoai-openai",
    "name": "FennoAI",
    "protocol": "openai",
    "baseUrl": "https://api.fenno.ai/v1",
    "category": "aggregator",
    "logo": "/logos/fenno-icon.webp",
    "websiteUrl": "https://api.fenno.ai",
    "consoleUrl": "https://api.fenno.ai/register?redirect=/purchase?tab=subscription%26group=16&aff=P9MR3D3PLCNL",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "runapi-openai",
    "name": "RunAPI",
    "protocol": "openai",
    "baseUrl": "https://runapi.host",
    "category": "aggregator",
    "logo": "/logos/runapi.jpg",
    "websiteUrl": "https://runapi.host",
    "consoleUrl": "https://runapi.host/register?aff=iOKB",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "shengsuanyun-openai",
    "name": "Shengsuanyun",
    "protocol": "openai",
    "baseUrl": "https://router.shengsuanyun.com/api/v1",
    "category": "aggregator",
    "logo": "/logos/shengsuanyun.svg",
    "websiteUrl": "https://www.shengsuanyun.com/?from=CH_4HHXMRYF",
    "consoleUrl": "https://www.shengsuanyun.com/?from=CH_4HHXMRYF",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "aigocode-openai",
    "name": "AIGoCode",
    "protocol": "openai",
    "baseUrl": "https://api.aigocode.app",
    "category": "third_party",
    "logo": "/logos/algocode.svg",
    "websiteUrl": "https://aigocode.app",
    "consoleUrl": "https://aigocode.app/invite/CC-SWITCH",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "qiniu-openai",
    "name": "Qiniu",
    "protocol": "openai",
    "baseUrl": "https://api.qnaigc.com/v1",
    "category": "aggregator",
    "logo": "/logos/qiniu.png",
    "websiteUrl": "https://s.qiniu.com/nMvAvy",
    "consoleUrl": "https://s.qiniu.com/nMvAvy",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "aicoding-openai",
    "name": "AICoding",
    "protocol": "openai",
    "baseUrl": "https://api.aicoding.inc",
    "category": "third_party",
    "logo": "/logos/aicoding.svg",
    "websiteUrl": "https://aicoding.inc",
    "consoleUrl": "https://aicoding.inc/i/CCSWITCH",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "subrouter-openai",
    "name": "SubRouter",
    "protocol": "openai",
    "baseUrl": "https://subrouter.ai/v1",
    "category": "aggregator",
    "logo": "/logos/subrouter.svg",
    "websiteUrl": "https://subrouter.ai",
    "consoleUrl": "https://subrouter.ai/register?aff=l3ri",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "apikey-fun-openai",
    "name": "APIKEY.FUN",
    "protocol": "openai",
    "baseUrl": "https://api.apikey.fun/v1",
    "category": "third_party",
    "logo": "/logos/apikeyfun.png",
    "websiteUrl": "https://apikey.fun",
    "consoleUrl": "https://apikey.fun/register?aff=CCSwitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "code0-openai",
    "name": "Code0",
    "protocol": "openai",
    "baseUrl": "https://code0.ai/v1",
    "category": "aggregator",
    "logo": "/logos/code0.png",
    "websiteUrl": "https://code0.ai",
    "consoleUrl": "https://code0.ai/agent/register/B2XHxGjGmRvqgznY",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "teamorouter-openai",
    "name": "TeamoRouter",
    "protocol": "openai",
    "baseUrl": "https://api.teamorouter.cn/v1",
    "category": "aggregator",
    "logo": "/logos/TeamoRouter-icon-dark.png",
    "websiteUrl": "https://teamorouter.cn",
    "consoleUrl": "https://teamorouter.cn/?utm_source=cc_switch&utm_medium=referral&utm_campaign=ai_directory",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "claudecn-openai",
    "name": "ClaudeCN",
    "protocol": "openai",
    "baseUrl": "https://claudecn.top",
    "category": "third_party",
    "logo": "/logos/claudecn.png",
    "websiteUrl": "https://claudecn.top",
    "consoleUrl": "https://claudecn.ai/register?aff=HEL9",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "agent-plan-openai",
    "name": "火山 Agent Plan",
    "protocol": "openai",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/plan/v3",
    "category": "cn_official",
    "logo": "/logos/huoshan.png",
    "websiteUrl": "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    "consoleUrl": "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "coding-plan-openai",
    "name": "火山 Coding Plan",
    "protocol": "openai",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/coding/v3",
    "category": "cn_official",
    "logo": "/logos/huoshan.png",
    "websiteUrl": "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "consoleUrl": "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "byteplus-openai",
    "name": "BytePlus",
    "protocol": "openai",
    "baseUrl": "https://ark.ap-southeast.bytepluses.com/api/coding/v3",
    "category": "cn_official",
    "logo": "/logos/byteplus.png",
    "websiteUrl": "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "consoleUrl": "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "doubaoseed-openai",
    "name": "DouBaoSeed",
    "protocol": "openai",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
    "category": "cn_official",
    "logo": "/logos/doubao.svg",
    "websiteUrl": "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "consoleUrl": "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "a6api-openai",
    "name": "A6API",
    "protocol": "openai",
    "baseUrl": "https://api.a6api.com/v1",
    "category": "aggregator",
    "logo": "/logos/a6-icon.png",
    "websiteUrl": "https://www.a6api.com",
    "consoleUrl": "https://a6api.com/register?aff=AqNr",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "ccsub-openai",
    "name": "CCSub",
    "protocol": "openai",
    "baseUrl": "https://www.ccsub.net/v1",
    "category": "aggregator",
    "logo": "/logos/ccsub.svg",
    "websiteUrl": "https://www.ccsub.net",
    "consoleUrl": "https://www.ccsub.net/register?ref=Y6Z8DXEA",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "sssaicode-openai",
    "name": "SSSAiCode",
    "protocol": "openai",
    "baseUrl": "https://node-hk.sssaicodeapi.com/api/v1",
    "category": "third_party",
    "logo": "/logos/sssaicode.svg",
    "websiteUrl": "https://sssaicodeapi.com",
    "consoleUrl": "https://sssaicodeapi.com/register?ref=DCP0SM",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "micu-openai",
    "name": "Micu",
    "protocol": "openai",
    "baseUrl": "https://www.micuapi.ai/v1",
    "category": "third_party",
    "logo": "/logos/micu.svg",
    "websiteUrl": "https://www.micuapi.ai",
    "consoleUrl": "https://www.micuapi.ai/register?aff=aOYQ",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "rightcode-openai",
    "name": "RightCode",
    "protocol": "openai",
    "baseUrl": "https://www.rightapi.ai/codex/v1",
    "category": "third_party",
    "logo": "/logos/rc.svg",
    "websiteUrl": "https://www.rightapi.ai",
    "consoleUrl": "https://www.rightapi.ai/register?aff=CCSWITCH",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "etok-ai-openai",
    "name": "ETok.ai",
    "protocol": "openai",
    "baseUrl": "https://api.etok.ai/v1",
    "category": "third_party",
    "logo": "/logos/etok.png",
    "websiteUrl": "https://etok.ai",
    "consoleUrl": "https://etok.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "cubence-openai",
    "name": "Cubence",
    "protocol": "openai",
    "baseUrl": "https://api.cubence.com/v1",
    "category": "third_party",
    "logo": "/logos/cubence.svg",
    "websiteUrl": "https://cubence.com",
    "consoleUrl": "https://cubence.com/signup?code=CCSWITCH&source=ccs",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "crazyrouter-openai",
    "name": "CrazyRouter",
    "protocol": "openai",
    "baseUrl": "https://cn.crazyrouter.com",
    "category": "third_party",
    "logo": "/logos/crazyrouter.svg",
    "websiteUrl": "https://www.crazyrouter.com",
    "consoleUrl": "https://www.crazyrouter.com/register?aff=OZcm&ref=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "dmxapi-openai",
    "name": "DMXAPI",
    "protocol": "openai",
    "baseUrl": "https://www.dmxapi.cn/v1",
    "category": "aggregator",
    "websiteUrl": "https://www.dmxapi.cn",
    "consoleUrl": "https://www.dmxapi.cn",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "sudocode-chat-openai",
    "name": "SudoCode.chat",
    "protocol": "openai",
    "baseUrl": "https://api.sudocode.chat/v1",
    "category": "third_party",
    "logo": "/logos/sudocode.png",
    "websiteUrl": "https://sudocode.chat",
    "consoleUrl": "https://sudocode.chat/sign-up?aff=CC-SWITCH&utm_source=cc-switch&utm_medium=sponsor&utm_campaign=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "sudocode-us-openai",
    "name": "SudoCode.us",
    "protocol": "openai",
    "baseUrl": "https://sudocode.us/v1",
    "category": "third_party",
    "logo": "/logos/sudocode-us.png",
    "websiteUrl": "https://sudocode.us",
    "consoleUrl": "https://sudocode.us",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "xycai-openai",
    "name": "XycAi",
    "protocol": "openai",
    "baseUrl": "https://apicdn.xycai.us/v1",
    "category": "aggregator",
    "logo": "/logos/xycai-icon.png",
    "websiteUrl": "https://xycai.us",
    "consoleUrl": "https://xycai.us/register?aff=Uhu9",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "amux-openai",
    "name": "Amux",
    "protocol": "openai",
    "baseUrl": "https://api.amux.ai/v1",
    "category": "aggregator",
    "logo": "/logos/amuxapi-icon.svg",
    "websiteUrl": "https://amux.ai",
    "consoleUrl": "https://amux.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "deepseek-openai",
    "name": "DeepSeek",
    "protocol": "openai",
    "baseUrl": "https://api.deepseek.com/v1",
    "category": "cn_official",
    "logo": "/logos/deepseek.svg",
    "websiteUrl": "https://platform.deepseek.com",
    "consoleUrl": "https://platform.deepseek.com/api_keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "bailian-openai",
    "name": "Bailian",
    "protocol": "openai",
    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "category": "cn_official",
    "logo": "/logos/bailian.svg",
    "websiteUrl": "https://bailian.console.aliyun.com",
    "consoleUrl": "https://bailian.console.aliyun.com/#/api-key",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "stepfun-step-plan-openai",
    "name": "StepFun Step Plan",
    "protocol": "openai",
    "baseUrl": "https://api.stepfun.com/step_plan/v1",
    "category": "cn_official",
    "logo": "/logos/stepfun.svg",
    "websiteUrl": "https://platform.stepfun.com/docs/zh/step-plan/overview",
    "consoleUrl": "https://platform.stepfun.com/interface-key",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "kat-coder-openai",
    "name": "KAT-Coder",
    "protocol": "openai",
    "baseUrl": "https://vanchin.streamlake.ai/api/gateway/v1/endpoints/${ENDPOINT_ID}/openai",
    "category": "cn_official",
    "logo": "/logos/catcoder.svg",
    "websiteUrl": "https://console.streamlake.ai",
    "consoleUrl": "https://console.streamlake.ai/console/api-key",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "longcat-openai",
    "name": "Longcat",
    "protocol": "openai",
    "baseUrl": "https://api.longcat.chat/openai/v1",
    "category": "cn_official",
    "websiteUrl": "https://longcat.chat/platform",
    "consoleUrl": "https://longcat.chat/platform/api_keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "minimax-openai",
    "name": "MiniMax",
    "protocol": "openai",
    "baseUrl": "https://api.minimaxi.com/v1",
    "category": "cn_official",
    "logo": "/logos/minimax.svg",
    "websiteUrl": "https://platform.minimaxi.com",
    "consoleUrl": "https://platform.minimaxi.com/subscribe/coding-plan",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "minimax-en-openai",
    "name": "MiniMax en",
    "protocol": "openai",
    "baseUrl": "https://api.minimax.io/v1",
    "category": "cn_official",
    "logo": "/logos/minimax.svg",
    "websiteUrl": "https://platform.minimax.io",
    "consoleUrl": "https://platform.minimax.io/subscribe/coding-plan",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "bailing-openai-api",
    "name": "BaiLing",
    "protocol": "openai",
    "baseUrl": "https://api.tbox.cn/v1",
    "category": "cn_official",
    "websiteUrl": "https://alipaytbox.yuque.com/sxs0ba/ling/get_started",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "xiaomi-mimo-openai",
    "name": "Xiaomi MiMo",
    "protocol": "openai",
    "baseUrl": "https://api.xiaomimimo.com/v1",
    "category": "cn_official",
    "logo": "/logos/xiaomimimo.svg",
    "websiteUrl": "https://platform.xiaomimimo.com",
    "consoleUrl": "https://platform.xiaomimimo.com/#/console/api-keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "xiaomi-mimo-token-plan-china-openai",
    "name": "Xiaomi MiMo Token Plan (China)",
    "protocol": "openai",
    "baseUrl": "https://token-plan-cn.xiaomimimo.com/v1",
    "category": "cn_official",
    "logo": "/logos/xiaomimimo.svg",
    "websiteUrl": "https://platform.xiaomimimo.com/#/token-plan",
    "consoleUrl": "https://platform.xiaomimimo.com/#/console/plan-manage",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "aihubmix-openai",
    "name": "AiHubMix",
    "protocol": "openai",
    "baseUrl": "https://aihubmix.com/v1",
    "category": "aggregator",
    "websiteUrl": "https://aihubmix.com",
    "consoleUrl": "https://aihubmix.com",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "cherryin-openai",
    "name": "CherryIN",
    "protocol": "openai",
    "baseUrl": "https://open.cherryin.net/v1",
    "category": "aggregator",
    "logo": "/logos/cherryin.png",
    "websiteUrl": "https://open.cherryin.ai",
    "consoleUrl": "https://open.cherryin.ai/console/token",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "openrouter-openai",
    "name": "OpenRouter",
    "protocol": "openai",
    "baseUrl": "https://openrouter.ai/api/v1",
    "category": "aggregator",
    "logo": "/logos/openrouter.svg",
    "websiteUrl": "https://openrouter.ai",
    "consoleUrl": "https://openrouter.ai/keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "therouter-openai",
    "name": "TheRouter",
    "protocol": "openai",
    "baseUrl": "https://api.therouter.ai/v1",
    "category": "aggregator",
    "websiteUrl": "https://therouter.ai",
    "consoleUrl": "https://dashboard.therouter.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "novita-ai-openai-api",
    "name": "Novita AI",
    "protocol": "openai",
    "baseUrl": "https://api.novita.ai/openai",
    "category": "aggregator",
    "logo": "/logos/novita.svg",
    "websiteUrl": "https://novita.ai",
    "consoleUrl": "https://novita.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "openclaw",
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "pipellm-openai",
    "name": "PIPELLM",
    "protocol": "openai",
    "baseUrl": "https://cc-api.pipellm.ai",
    "category": "aggregator",
    "logo": "/logos/pipellm.png",
    "websiteUrl": "https://code.pipellm.ai",
    "consoleUrl": "https://code.pipellm.ai/login?ref=uvw650za",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode",
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "e-flowcode-openai",
    "name": "E-FlowCode",
    "protocol": "openai",
    "baseUrl": "https://e-flowcode.cc/v1",
    "category": "third_party",
    "logo": "/logos/eflowcode.png",
    "websiteUrl": "https://e-flowcode.cc",
    "consoleUrl": "https://e-flowcode.cc",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "opencode"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "aws-bedrock-anthropic",
    "name": "AWS Bedrock",
    "protocol": "anthropic",
    "baseUrl": "",
    "category": "cloud_provider",
    "logo": "/logos/aws.svg",
    "websiteUrl": "https://aws.amazon.com/bedrock/",
    "supported": false,
    "disabledReason": "Bedrock 协议暂不受 Model Center 支持",
    "authMode": "api-key",
    "sourceApps": [
      "opencode"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "compshare-anthropic-api",
    "name": "Compshare",
    "protocol": "anthropic",
    "baseUrl": "https://api.modelverse.cn/v1",
    "category": "aggregator",
    "logo": "/logos/ucloud.svg",
    "websiteUrl": "https://www.compshare.cn",
    "consoleUrl": "https://www.compshare.cn/coding-plan?ytag=GPU_YY_YX_git_cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "openclaw"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "compshare-coding-plan-anthropic-cp",
    "name": "Compshare Coding Plan",
    "protocol": "anthropic",
    "baseUrl": "https://cp.compshare.cn/v1",
    "category": "aggregator",
    "logo": "/logos/ucloud.svg",
    "websiteUrl": "https://www.compshare.cn",
    "consoleUrl": "https://www.compshare.cn/coding-plan?ytag=GPU_YY_YX_git_cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "openclaw"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "crazyrouter-anthropic-cn",
    "name": "CrazyRouter",
    "protocol": "anthropic",
    "baseUrl": "https://cn.crazyrouter.com/v1",
    "category": "third_party",
    "logo": "/logos/crazyrouter.svg",
    "websiteUrl": "https://www.crazyrouter.com",
    "consoleUrl": "https://www.crazyrouter.com/register?aff=OZcm&ref=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "openclaw"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "qwen-coder-openai",
    "name": "Qwen Coder",
    "protocol": "openai",
    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "category": "cn_official",
    "logo": "/logos/qwen.svg",
    "websiteUrl": "https://bailian.console.aliyun.com",
    "consoleUrl": "https://bailian.console.aliyun.com/#/api-key",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "openclaw"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "aws-bedrock-anthropic-bedrock-runtime",
    "name": "AWS Bedrock",
    "protocol": "anthropic",
    "baseUrl": "https://bedrock-runtime.us-west-2.amazonaws.com",
    "category": "cloud_provider",
    "logo": "/logos/aws.svg",
    "websiteUrl": "https://aws.amazon.com/bedrock/",
    "supported": false,
    "disabledReason": "Bedrock 协议暂不受 Model Center 支持",
    "authMode": "api-key",
    "sourceApps": [
      "openclaw"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "kimi-for-coding-openai-api",
    "name": "Kimi For Coding",
    "protocol": "openai",
    "baseUrl": "https://api.kimi.com/coding",
    "category": "cn_official",
    "logo": "/logos/kimi.svg",
    "websiteUrl": "https://www.kimi.com/code/?aff=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "packycode-openai-packyapi",
    "name": "PackyCode",
    "protocol": "openai",
    "baseUrl": "https://www.packyapi.ai",
    "category": "third_party",
    "logo": "/logos/packycode.svg",
    "websiteUrl": "https://www.packyapi.ai",
    "consoleUrl": "https://www.packyapi.ai/register?aff=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "apikey-fun-openai-api",
    "name": "APIKEY.FUN",
    "protocol": "openai",
    "baseUrl": "https://api.apikey.fun",
    "category": "third_party",
    "logo": "/logos/apikeyfun.png",
    "websiteUrl": "https://apikey.fun",
    "consoleUrl": "https://apikey.fun/register?aff=CCSwitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "agent-plan-openai-ark",
    "name": "火山 Agent Plan",
    "protocol": "openai",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/plan",
    "category": "cn_official",
    "logo": "/logos/huoshan.png",
    "websiteUrl": "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    "consoleUrl": "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "coding-plan-openai-ark",
    "name": "火山 Coding Plan",
    "protocol": "openai",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/coding",
    "category": "cn_official",
    "logo": "/logos/huoshan.png",
    "websiteUrl": "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "consoleUrl": "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "byteplus-openai-ark",
    "name": "BytePlus",
    "protocol": "openai",
    "baseUrl": "https://ark.ap-southeast.bytepluses.com/api/coding",
    "category": "cn_official",
    "logo": "/logos/byteplus.png",
    "websiteUrl": "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "consoleUrl": "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "doubaoseed-openai-ark",
    "name": "DouBaoSeed",
    "protocol": "openai",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/compatible",
    "category": "cn_official",
    "logo": "/logos/doubao.svg",
    "websiteUrl": "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "consoleUrl": "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "compshare-openai",
    "name": "Compshare",
    "protocol": "openai",
    "baseUrl": "https://api.modelverse.cn/v1",
    "category": "aggregator",
    "logo": "/logos/ucloud.svg",
    "websiteUrl": "https://www.compshare.cn",
    "consoleUrl": "https://www.compshare.cn/coding-plan?ytag=GPU_YY_YX_git_cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "compshare-coding-plan-openai",
    "name": "Compshare Coding Plan",
    "protocol": "openai",
    "baseUrl": "https://cp.compshare.cn/v1",
    "category": "aggregator",
    "logo": "/logos/ucloud.svg",
    "websiteUrl": "https://www.compshare.cn",
    "consoleUrl": "https://www.compshare.cn/coding-plan?ytag=GPU_YY_YX_git_cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "sssaicode-openai-node-hk",
    "name": "SSSAiCode",
    "protocol": "openai",
    "baseUrl": "https://node-hk.sssaicodeapi.com/api",
    "category": "third_party",
    "logo": "/logos/sssaicode.svg",
    "websiteUrl": "https://sssaicodeapi.com",
    "consoleUrl": "https://sssaicodeapi.com/register?ref=DCP0SM",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "micu-openai-micuapi",
    "name": "Micu",
    "protocol": "openai",
    "baseUrl": "https://www.micuapi.ai",
    "category": "third_party",
    "logo": "/logos/micu.svg",
    "websiteUrl": "https://www.micuapi.ai",
    "consoleUrl": "https://www.micuapi.ai/register?aff=aOYQ",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "rightcode-openai-rightapi",
    "name": "RightCode",
    "protocol": "openai",
    "baseUrl": "https://www.rightapi.ai/claude",
    "category": "third_party",
    "logo": "/logos/rc.svg",
    "websiteUrl": "https://www.rightapi.ai",
    "consoleUrl": "https://www.rightapi.ai/register?aff=CCSWITCH",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "etok-ai-openai-api",
    "name": "ETok.ai",
    "protocol": "openai",
    "baseUrl": "https://api.etok.ai",
    "category": "third_party",
    "logo": "/logos/etok.png",
    "websiteUrl": "https://etok.ai",
    "consoleUrl": "https://etok.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "cubence-openai-api",
    "name": "Cubence",
    "protocol": "openai",
    "baseUrl": "https://api.cubence.com",
    "category": "third_party",
    "logo": "/logos/cubence.svg",
    "websiteUrl": "https://cubence.com",
    "consoleUrl": "https://cubence.com/signup?code=CCSWITCH&source=ccs",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "deepseek-openai-api",
    "name": "DeepSeek",
    "protocol": "openai",
    "baseUrl": "https://api.deepseek.com",
    "category": "cn_official",
    "logo": "/logos/deepseek.svg",
    "websiteUrl": "https://platform.deepseek.com",
    "consoleUrl": "https://platform.deepseek.com/api_keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "together-ai-openai",
    "name": "Together AI",
    "protocol": "openai",
    "baseUrl": "https://api.together.xyz/v1",
    "category": "aggregator",
    "websiteUrl": "https://together.ai",
    "consoleUrl": "https://api.together.ai/settings/api-keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "nous-research-openai",
    "name": "Nous Research",
    "protocol": "openai",
    "baseUrl": "https://inference-api.nousresearch.com/v1",
    "category": "official",
    "logo": "/logos/hermes.png",
    "websiteUrl": "https://nousresearch.com",
    "consoleUrl": "https://portal.nousresearch.com/",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": true,
      "partner": false
    }
  },
  {
    "slug": "bailian-for-coding-openai",
    "name": "Bailian For Coding",
    "protocol": "openai",
    "baseUrl": "https://coding.dashscope.aliyuncs.com/apps/anthropic",
    "category": "cn_official",
    "logo": "/logos/bailian.svg",
    "websiteUrl": "https://bailian.console.aliyun.com",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "stepfun-openai-api",
    "name": "StepFun",
    "protocol": "openai",
    "baseUrl": "https://api.stepfun.ai/v1",
    "category": "cn_official",
    "logo": "/logos/stepfun.svg",
    "websiteUrl": "https://platform.stepfun.ai",
    "consoleUrl": "https://platform.stepfun.ai/interface-key",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "kat-coder-openai-vanchin",
    "name": "KAT-Coder",
    "protocol": "openai",
    "baseUrl": "https://vanchin.streamlake.ai/api/gateway/v1/endpoints/${ENDPOINT_ID}/claude-code-proxy",
    "category": "cn_official",
    "logo": "/logos/catcoder.svg",
    "websiteUrl": "https://console.streamlake.ai",
    "consoleUrl": "https://console.streamlake.ai/console/api-key",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "bailing-openai-api-2",
    "name": "BaiLing",
    "protocol": "openai",
    "baseUrl": "https://api.tbox.cn/api/anthropic",
    "category": "cn_official",
    "websiteUrl": "https://alipaytbox.yuque.com/sxs0ba/ling/get_started",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "cherryin-openai-open",
    "name": "CherryIN",
    "protocol": "openai",
    "baseUrl": "https://open.cherryin.net",
    "category": "aggregator",
    "logo": "/logos/cherryin.png",
    "websiteUrl": "https://open.cherryin.ai",
    "consoleUrl": "https://open.cherryin.ai/console/token",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "e-flowcode-openai-e-flowcode",
    "name": "E-FlowCode",
    "protocol": "openai",
    "baseUrl": "https://e-flowcode.cc",
    "category": "third_party",
    "logo": "/logos/eflowcode.png",
    "websiteUrl": "https://e-flowcode.cc",
    "consoleUrl": "https://e-flowcode.cc",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "novita-ai-openai-api-2",
    "name": "Novita AI",
    "protocol": "openai",
    "baseUrl": "https://api.novita.ai/v3/openai",
    "category": "aggregator",
    "logo": "/logos/novita.svg",
    "websiteUrl": "https://novita.ai",
    "consoleUrl": "https://novita.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "runapi-anthropic-runapi",
    "name": "RunAPI",
    "protocol": "anthropic",
    "baseUrl": "https://runapi.co",
    "category": "aggregator",
    "logo": "/logos/runapi.jpg",
    "websiteUrl": "https://runapi.co",
    "consoleUrl": "https://runapi.co/register?aff=iOKB",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "agentplan-openai",
    "name": "火山Agentplan",
    "protocol": "openai",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/coding/v3",
    "category": "cn_official",
    "logo": "/logos/huoshan.png",
    "websiteUrl": "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "consoleUrl": "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": true
    }
  },
  {
    "slug": "aws-bedrock-anthropic-bedrock-runtime-2",
    "name": "AWS Bedrock",
    "protocol": "anthropic",
    "baseUrl": "https://bedrock-runtime.us-east-1.amazonaws.com",
    "category": "cloud_provider",
    "logo": "/logos/aws.svg",
    "websiteUrl": "https://aws.amazon.com/bedrock/",
    "supported": false,
    "disabledReason": "Bedrock 协议暂不受 Model Center 支持",
    "authMode": "api-key",
    "sourceApps": [
      "pi"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  },
  {
    "slug": "newapi-openai",
    "name": "NewAPI",
    "protocol": "openai",
    "baseUrl": "",
    "category": "other",
    "logo": "/logos/newapi.svg",
    "websiteUrl": "https://www.newapi.pro",
    "supported": false,
    "disabledReason": "需要先填写自部署 Base URL",
    "authMode": "api-key",
    "sourceApps": [
      "universal"
    ],
    "extra": {
      "endpoint_candidates": [],
      "official": false,
      "partner": false
    }
  }
];
