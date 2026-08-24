/**
 * cc-switch 全量预设（自动提取自 https://github.com/farion1231/cc-switch main 分支
 * src/config/{claude,codex,gemini}ProviderPresets.ts，生成时间 2026-08-24）。
 * 已排除：OAuth-only 预设（无法仅用 api_key 使用）与无 base_url 的模板项。
 */
import type { ProviderPreset } from './types';

export const CC_SWITCH_PRESETS: ProviderPreset[] = [
  {
    slug: "claude-official",
    name: "Claude Official",
    protocol: "anthropic",
    baseUrl: "https://api.anthropic.com",
    category: "official",
    websiteUrl: "https://www.anthropic.com/claude-code",
    logo: "/logos/anthropic.svg"
  },
  {
    slug: "kimi-cc",
    name: "Kimi",
    protocol: "anthropic",
    baseUrl: "https://api.moonshot.cn/anthropic",
    category: "cn_official",
    websiteUrl: "https://platform.kimi.com?aff=cc-switch",
    logo: "/logos/kimi.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "kimi-k2.7-code",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "kimi-k2.7-code",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "kimi-k2.7-code",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "kimi-k2.7-code"
      }
    }
  },
  {
    slug: "kimi-for-coding",
    name: "Kimi For Coding",
    protocol: "anthropic",
    baseUrl: "https://api.kimi.com/coding/",
    category: "cn_official",
    codingPlan: "kimi",
    websiteUrl: "https://www.kimi.com/code/?aff=cc-switch",
    logo: "/logos/kimi.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "kimi-for-coding",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "kimi-for-coding",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "kimi-for-coding",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "kimi-for-coding",
        CLAUDE_CODE_MAX_CONTEXT_TOKENS: "262144",
        CLAUDE_CODE_AUTO_COMPACT_WINDOW: "262144"
      }
    }
  },
  {
    slug: "packycode",
    name: "PackyCode",
    protocol: "anthropic",
    baseUrl: "https://www.packyapi.ai",
    category: "relay",
    websiteUrl: "https://www.packyapi.ai",
    consoleUrl: "https://www.packyapi.ai/register?aff=cc-switch",
    logo: "/logos/packycode.svg",
    extra: {
      endpoint_candidates: [
        "https://www.packyapi.ai",
        "https://cf.api.fan",
        "https://slb-v1.api.fan",
        "https://www.packyapi.com"
      ]
    }
  },
  {
    slug: "zetaapi",
    name: "ZetaAPI",
    protocol: "anthropic",
    baseUrl: "https://api.zetaapi.ai",
    category: "aggregator",
    websiteUrl: "https://zetaapi.ai",
    consoleUrl: "https://zetaapi.ai/go/u117",
    logo: "/logos/zetaapi.png"
  },
  {
    slug: "apinebula",
    name: "APINebula",
    protocol: "anthropic",
    baseUrl: "https://apinebula.ai",
    category: "relay",
    websiteUrl: "https://apinebula.ai",
    consoleUrl: "https://apinebula.ai/VjM74M",
    logo: "/logos/apinebula.png",
    extra: {
      env: {
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1"
      },
      endpoint_candidates: [
        "https://apinebula.ai"
      ]
    }
  },
  {
    slug: "aicodemirror",
    name: "AICodeMirror",
    protocol: "anthropic",
    baseUrl: "https://api.aicodemirror.ai/api/claudecode",
    category: "relay",
    websiteUrl: "https://www.aicodemirror.ai",
    consoleUrl: "https://www.aicodemirror.ai/register?invitecode=9915W3",
    logo: "/logos/aicodemirror.svg",
    extra: {
      endpoint_candidates: [
        "https://api.aicodemirror.ai/api/claudecode"
      ]
    }
  },
  {
    slug: "patewayai",
    name: "PatewayAI",
    protocol: "anthropic",
    baseUrl: "https://api.pateway.ai",
    category: "relay",
    websiteUrl: "https://pateway.ai",
    consoleUrl: "https://pateway.ai/?ch=etzpm8&aff=WB6M6F67#/",
    logo: "/logos/pateway.jpg",
    extra: {
      api_key_field: "ANTHROPIC_API_KEY"
    }
  },
  {
    slug: "fennoai",
    name: "FennoAI",
    protocol: "anthropic",
    baseUrl: "https://api.fenno.ai",
    category: "aggregator",
    websiteUrl: "https://api.fenno.ai",
    consoleUrl: "https://api.fenno.ai/register?redirect=/purchase?tab=subscription%26group=16&aff=P9MR3D3PLCNL",
    logo: "/logos/fenno.webp"
  },
  {
    slug: "runapi",
    name: "RunAPI",
    protocol: "anthropic",
    baseUrl: "https://runapi.host",
    category: "aggregator",
    websiteUrl: "https://runapi.host",
    consoleUrl: "https://runapi.host/register?aff=iOKB",
    logo: "/logos/runapi.jpg",
    extra: {
      endpoint_candidates: [
        "https://runapi.host",
        "https://runapi.co"
      ]
    }
  },
  {
    slug: "shengsuanyun",
    name: "Shengsuanyun",
    protocol: "anthropic",
    baseUrl: "https://router.shengsuanyun.com/api",
    category: "aggregator",
    websiteUrl: "https://www.shengsuanyun.com/?from=CH_4HHXMRYF",
    consoleUrl: "https://www.shengsuanyun.com/?from=CH_4HHXMRYF",
    logo: "/logos/shengsuanyun.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "anthropic/claude-sonnet-5",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "anthropic/claude-haiku-4.5",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "anthropic/claude-sonnet-5",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "anthropic/claude-opus-5"
      }
    }
  },
  {
    slug: "aigocode",
    name: "AIGoCode",
    protocol: "anthropic",
    baseUrl: "https://api.aigocode.app",
    category: "relay",
    websiteUrl: "https://aigocode.app",
    consoleUrl: "https://aigocode.app/invite/CC-SWITCH",
    extra: {
      endpoint_candidates: [
        "https://api.aigocode.app"
      ]
    }
  },
  {
    slug: "qiniu",
    name: "Qiniu",
    protocol: "anthropic",
    baseUrl: "https://api.qnaigc.com",
    category: "aggregator",
    websiteUrl: "https://s.qiniu.com/nMvAvy",
    consoleUrl: "https://s.qiniu.com/nMvAvy",
    logo: "/logos/qiniu.png",
    extra: {
      endpoint_candidates: [
        "https://api.qnaigc.com",
        "https://api.modelink.ai"
      ]
    }
  },
  {
    slug: "aicoding",
    name: "AICoding",
    protocol: "anthropic",
    baseUrl: "https://api.aicoding.inc",
    category: "relay",
    websiteUrl: "https://aicoding.inc",
    consoleUrl: "https://aicoding.inc/i/CCSWITCH",
    logo: "/logos/aicoding.svg",
    extra: {
      endpoint_candidates: [
        "https://api.aicoding.inc"
      ]
    }
  },
  {
    slug: "subrouter",
    name: "SubRouter",
    protocol: "anthropic",
    baseUrl: "https://subrouter.ai",
    category: "aggregator",
    websiteUrl: "https://subrouter.ai",
    consoleUrl: "https://subrouter.ai/register?aff=l3ri",
    logo: "/logos/subrouter.svg"
  },
  {
    slug: "apikey-fun",
    name: "APIKEY.FUN",
    protocol: "anthropic",
    baseUrl: "https://api.apikey.fun",
    category: "relay",
    websiteUrl: "https://apikey.fun",
    consoleUrl: "https://apikey.fun/register?aff=CCSwitch",
    logo: "/logos/apikeyfun.png",
    extra: {
      env: {
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1"
      },
      endpoint_candidates: [
        "https://api.apikey.fun",
        "https://slb.apikey.fun"
      ]
    }
  },
  {
    slug: "claudeapi",
    name: "ClaudeAPI",
    protocol: "anthropic",
    baseUrl: "https://gw.apito.ai",
    category: "aggregator",
    websiteUrl: "https://www.apito.ai",
    consoleUrl: "https://console.apito.ai/agent/register/pQBql2buaqiX3dDS",
    logo: "/logos/claudeapi.png"
  },
  {
    slug: "code0",
    name: "Code0",
    protocol: "anthropic",
    baseUrl: "https://code0.ai",
    category: "aggregator",
    websiteUrl: "https://code0.ai",
    consoleUrl: "https://code0.ai/agent/register/B2XHxGjGmRvqgznY",
    logo: "/logos/code0.png"
  },
  {
    slug: "teamorouter",
    name: "TeamoRouter",
    protocol: "anthropic",
    baseUrl: "https://api.teamorouter.com",
    category: "aggregator",
    websiteUrl: "https://teamorouter.com",
    consoleUrl: "https://teamorouter.com/?utm_source=cc_switch&utm_medium=referral&utm_campaign=ai_directory",
    logo: "/logos/teamorouter.png"
  },
  {
    slug: "ppio-cc",
    name: "PPIO",
    protocol: "anthropic",
    baseUrl: "https://api.ppio.com/anthropic",
    category: "aggregator",
    websiteUrl: "https://ppio.com",
    consoleUrl: "https://ppio.com/activity/ccswitch",
    logo: "/logos/ppio.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "deepseek/deepseek-v4-flash-0731",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek/deepseek-v4-flash-0731",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "deepseek/deepseek-v4-flash-0731",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "deepseek/deepseek-v4-flash-0731"
      },
      endpoint_candidates: [
        "https://api.ppio.com/anthropic"
      ]
    }
  },
  {
    slug: "claudecn",
    name: "ClaudeCN",
    protocol: "anthropic",
    baseUrl: "https://claudecn.top",
    category: "relay",
    websiteUrl: "https://claudecn.top",
    consoleUrl: "https://claudecn.ai/register?aff=HEL9",
    logo: "/logos/claudecn.png"
  },
  {
    slug: "agent-plan",
    name: "火山 Agent Plan",
    protocol: "anthropic",
    baseUrl: "https://ark.cn-beijing.volces.com/api/plan",
    category: "cn_official",
    websiteUrl: "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    consoleUrl: "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    logo: "/logos/huoshan.png",
    extra: {
      env: {
        ANTHROPIC_MODEL: "ark-code-latest",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "ark-code-latest",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "ark-code-latest",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "ark-code-latest"
      }
    }
  },
  {
    slug: "coding-plan",
    name: "火山 Coding Plan",
    protocol: "anthropic",
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding",
    category: "cn_official",
    websiteUrl: "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    consoleUrl: "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    logo: "/logos/huoshan.png",
    extra: {
      env: {
        ANTHROPIC_MODEL: "ark-code-latest",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "ark-code-latest",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "ark-code-latest",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "ark-code-latest"
      }
    }
  },
  {
    slug: "byteplus",
    name: "BytePlus",
    protocol: "anthropic",
    baseUrl: "https://ark.ap-southeast.bytepluses.com/api/coding",
    category: "cn_official",
    websiteUrl: "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    consoleUrl: "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    logo: "/logos/byteplus.png",
    extra: {
      env: {
        ANTHROPIC_MODEL: "ark-code-latest",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "ark-code-latest",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "ark-code-latest",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "ark-code-latest"
      }
    }
  },
  {
    slug: "doubaoseed",
    name: "DouBaoSeed",
    protocol: "anthropic",
    baseUrl: "https://ark.cn-beijing.volces.com/api/compatible",
    category: "cn_official",
    websiteUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    consoleUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    logo: "/logos/doubao.svg",
    extra: {
      env: {
        API_TIMEOUT_MS: "3000000",
        ANTHROPIC_MODEL: "doubao-seed-2-1-pro-260628",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "doubao-seed-2-1-pro-260628",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "doubao-seed-2-1-pro-260628",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "doubao-seed-2-1-pro-260628"
      }
    }
  },
  {
    slug: "siliconflow-cc",
    name: "SiliconFlow",
    protocol: "anthropic",
    baseUrl: "https://api.siliconflow.cn",
    category: "aggregator",
    websiteUrl: "https://siliconflow.cn",
    consoleUrl: "https://cloud.siliconflow.cn/i/YflgU2Ve",
    logo: "/logos/siliconflow.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "Pro/MiniMaxAI/MiniMax-M2.5",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "Pro/MiniMaxAI/MiniMax-M2.5",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "Pro/MiniMaxAI/MiniMax-M2.5",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "Pro/MiniMaxAI/MiniMax-M2.5"
      }
    }
  },
  {
    slug: "siliconflow-en",
    name: "SiliconFlow en",
    protocol: "anthropic",
    baseUrl: "https://api.siliconflow.com",
    category: "aggregator",
    websiteUrl: "https://siliconflow.com",
    consoleUrl: "https://cloud.siliconflow.cn/i/YflgU2Ve",
    logo: "/logos/siliconflow.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "MiniMaxAI/MiniMax-M3",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "MiniMaxAI/MiniMax-M3",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "MiniMaxAI/MiniMax-M3",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "MiniMaxAI/MiniMax-M3"
      }
    }
  },
  {
    slug: "a6api",
    name: "A6API",
    protocol: "anthropic",
    baseUrl: "https://api.a6api.com",
    category: "aggregator",
    websiteUrl: "https://www.a6api.com",
    consoleUrl: "https://a6api.com/register?aff=AqNr"
  },
  {
    slug: "atlascloud",
    name: "AtlasCloud",
    protocol: "anthropic",
    baseUrl: "https://api.atlascloud.ai",
    category: "aggregator",
    websiteUrl: "https://www.atlascloud.ai/console/coding-plan",
    consoleUrl: "https://www.atlascloud.ai/console/coding-plan",
    logo: "/logos/atlascloud.png",
    extra: {
      env: {
        ANTHROPIC_MODEL: "zai-org/glm-5.1",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "zai-org/glm-5.1",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "zai-org/glm-5.1",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "zai-org/glm-5.1",
        CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: "1"
      },
      endpoint_candidates: [
        "https://api.atlascloud.ai"
      ]
    }
  },
  {
    slug: "compshare",
    name: "Compshare",
    protocol: "anthropic",
    baseUrl: "https://api.modelverse.cn",
    category: "aggregator",
    websiteUrl: "https://www.compshare.cn",
    consoleUrl: "https://www.compshare.cn/coding-plan?ytag=GPU_YY_YX_git_cc-switch",
    logo: "/logos/ucloud.svg",
    extra: {
      endpoint_candidates: [
        "https://api.modelverse.cn"
      ]
    }
  },
  {
    slug: "compshare-coding-plan",
    name: "Compshare Coding Plan",
    protocol: "anthropic",
    baseUrl: "https://cp.compshare.cn",
    category: "aggregator",
    websiteUrl: "https://www.compshare.cn",
    consoleUrl: "https://www.compshare.cn/coding-plan?ytag=GPU_YY_YX_git_cc-switch",
    logo: "/logos/ucloud.svg",
    extra: {
      endpoint_candidates: [
        "https://cp.compshare.cn"
      ]
    }
  },
  {
    slug: "ccsub",
    name: "CCSub",
    protocol: "anthropic",
    baseUrl: "https://www.ccsub.net",
    category: "aggregator",
    websiteUrl: "https://www.ccsub.net",
    consoleUrl: "https://www.ccsub.net/register?ref=Y6Z8DXEA",
    logo: "/logos/ccsub.svg"
  },
  {
    slug: "sssaicode",
    name: "SSSAiCode",
    protocol: "anthropic",
    baseUrl: "https://node-hk.sssaicodeapi.com/api",
    category: "relay",
    websiteUrl: "https://sssaicodeapi.com",
    consoleUrl: "https://sssaicodeapi.com/register?ref=DCP0SM",
    logo: "/logos/sssaicode.svg",
    extra: {
      endpoint_candidates: [
        "https://node-hk.sssaicodeapi.com/api",
        "https://node-hk.sssaiapi.com/api",
        "https://node-cf.sssaicodeapi.com/api"
      ]
    }
  },
  {
    slug: "micu",
    name: "Micu",
    protocol: "anthropic",
    baseUrl: "https://www.micuapi.ai",
    category: "relay",
    websiteUrl: "https://www.micuapi.ai",
    consoleUrl: "https://www.micuapi.ai/register?aff=aOYQ",
    logo: "/logos/micu.svg",
    extra: {
      endpoint_candidates: [
        "https://www.micuapi.ai"
      ]
    }
  },
  {
    slug: "rightcode",
    name: "RightCode",
    protocol: "anthropic",
    baseUrl: "https://www.rightapi.ai/claude",
    category: "relay",
    websiteUrl: "https://www.rightapi.ai",
    consoleUrl: "https://www.rightapi.ai/register?aff=CCSWITCH",
    logo: "/logos/rc.svg"
  },
  {
    slug: "etok-ai",
    name: "ETok.ai",
    protocol: "anthropic",
    baseUrl: "https://api.etok.ai",
    category: "relay",
    websiteUrl: "https://etok.ai",
    consoleUrl: "https://etok.ai",
    logo: "/logos/etok.png"
  },
  {
    slug: "cubence",
    name: "Cubence",
    protocol: "anthropic",
    baseUrl: "https://api.cubence.com",
    category: "relay",
    websiteUrl: "https://cubence.com",
    consoleUrl: "https://cubence.com/signup?code=CCSWITCH&source=ccs",
    logo: "/logos/cubence.svg",
    extra: {
      endpoint_candidates: [
        "https://api.cubence.com",
        "https://api-cf.cubence.com",
        "https://api-dmit.cubence.com",
        "https://api-bwg.cubence.com"
      ]
    }
  },
  {
    slug: "crazyrouter",
    name: "CrazyRouter",
    protocol: "anthropic",
    baseUrl: "https://cn.crazyrouter.com",
    category: "relay",
    websiteUrl: "https://www.crazyrouter.com",
    consoleUrl: "https://www.crazyrouter.com/register?aff=OZcm&ref=cc-switch",
    logo: "/logos/crazyrouter.svg",
    extra: {
      endpoint_candidates: [
        "https://cn.crazyrouter.com"
      ]
    }
  },
  {
    slug: "dmxapi",
    name: "DMXAPI",
    protocol: "anthropic",
    baseUrl: "https://www.dmxapi.cn",
    category: "aggregator",
    websiteUrl: "https://www.dmxapi.cn",
    consoleUrl: "https://www.dmxapi.cn",
    extra: {
      endpoint_candidates: [
        "https://www.dmxapi.cn",
        "https://api.dmxapi.cn"
      ]
    }
  },
  {
    slug: "sudocode-chat",
    name: "SudoCode.chat",
    protocol: "anthropic",
    baseUrl: "https://api.sudocode.chat",
    category: "relay",
    websiteUrl: "https://sudocode.chat",
    consoleUrl: "https://sudocode.chat/sign-up?aff=CC-SWITCH&utm_source=cc-switch&utm_medium=sponsor&utm_campaign=ccswitch",
    logo: "/logos/sudocode.png",
    extra: {
      env: {
        API_TIMEOUT_MS: "300000"
      },
      endpoint_candidates: [
        "https://api.sudocode.chat"
      ]
    }
  },
  {
    slug: "sudocode-us",
    name: "SudoCode.us",
    protocol: "anthropic",
    baseUrl: "https://sudocode.us",
    category: "relay",
    websiteUrl: "https://sudocode.us",
    consoleUrl: "https://sudocode.us",
    logo: "/logos/sudocode-us.png",
    extra: {
      env: {
        API_TIMEOUT_MS: "300000"
      },
      endpoint_candidates: [
        "https://sudocode.us",
        "https://sudocode.run"
      ]
    }
  },
  {
    slug: "xycai",
    name: "XycAi",
    protocol: "anthropic",
    baseUrl: "https://apicdn.xycai.us",
    category: "aggregator",
    websiteUrl: "https://xycai.us",
    consoleUrl: "https://xycai.us/register?aff=Uhu9",
    logo: "/logos/xycai.png",
    extra: {
      endpoint_candidates: [
        "https://apicdn.xycai.us",
        "https://apicdn.xyc.ai"
      ],
      api_key_field: "ANTHROPIC_API_KEY"
    }
  },
  {
    slug: "amux",
    name: "Amux",
    protocol: "anthropic",
    baseUrl: "https://api.amux.ai",
    category: "aggregator",
    websiteUrl: "https://amux.ai",
    consoleUrl: "https://amux.ai"
  },
  {
    slug: "gemini-native",
    name: "Gemini Native",
    protocol: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    category: "relay",
    websiteUrl: "https://ai.google.dev/gemini-api",
    consoleUrl: "https://aistudio.google.com/app/apikey",
    logo: "/logos/gemini.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "gemini-3.6-flash",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "gemini-3.6-flash",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "gemini-3.6-flash",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "gemini-3.6-flash"
      },
      endpoint_candidates: [
        "https://generativelanguage.googleapis.com"
      ],
      api_key_field: "ANTHROPIC_API_KEY"
    }
  },
  {
    slug: "deepseek-cc",
    name: "DeepSeek",
    protocol: "anthropic",
    baseUrl: "https://api.deepseek.com/anthropic",
    category: "cn_official",
    websiteUrl: "https://platform.deepseek.com",
    logo: "/logos/deepseek.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "deepseek-v4-pro",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "deepseek-v4-pro",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "deepseek-v4-pro"
      }
    }
  },
  {
    slug: "opencode-go",
    name: "OpenCode Go",
    protocol: "anthropic",
    baseUrl: "https://opencode.ai/zen/go",
    category: "relay",
    websiteUrl: "https://opencode.ai/go",
    consoleUrl: "https://opencode.ai/go?ref=2YTRG2NGTX",
    logo: "/logos/opencode.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "deepseek-v4-flash",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-flash",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "deepseek-v4-flash",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "deepseek-v4-flash"
      },
      endpoint_candidates: [
        "https://opencode.ai/zen/go"
      ],
      api_key_field: "ANTHROPIC_API_KEY"
    }
  },
  {
    slug: "zhipu-glm",
    name: "Zhipu GLM",
    protocol: "anthropic",
    baseUrl: "https://open.bigmodel.cn/api/anthropic",
    category: "cn_official",
    websiteUrl: "https://open.bigmodel.cn",
    consoleUrl: "https://www.bigmodel.cn/claude-code?ic=RRVJPB5SII",
    logo: "/logos/zhipu.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "glm-5.1",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "glm-5.1",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "glm-5.1",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "glm-5.1"
      }
    }
  },
  {
    slug: "zhipu-glm-en",
    name: "Zhipu GLM en",
    protocol: "anthropic",
    baseUrl: "https://api.z.ai/api/anthropic",
    category: "cn_official",
    websiteUrl: "https://z.ai",
    consoleUrl: "https://z.ai/subscribe?ic=8JVLJQFSKB",
    logo: "/logos/zhipu.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "glm-5.1",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "glm-5.1",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "glm-5.1",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "glm-5.1"
      }
    }
  },
  {
    slug: "baidu-qianfan-coding-plan",
    name: "Baidu Qianfan Coding Plan",
    protocol: "anthropic",
    baseUrl: "https://qianfan.baidubce.com/anthropic/coding",
    category: "cn_official",
    websiteUrl: "https://cloud.baidu.com/product/qianfan_modelbuilder",
    consoleUrl: "https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application",
    logo: "/logos/baidu.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "qianfan-code-latest",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "qianfan-code-latest",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "qianfan-code-latest",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "qianfan-code-latest"
      },
      endpoint_candidates: [
        "https://qianfan.baidubce.com/anthropic/coding"
      ]
    }
  },
  {
    slug: "baidu-qianfan-token-plan",
    name: "Baidu Qianfan Token Plan",
    protocol: "anthropic",
    baseUrl: "https://qianfan.baidubce.com/anthropic/tokenplan/personal",
    category: "cn_official",
    websiteUrl: "https://cloud.baidu.com/product/codingplan.html",
    consoleUrl: "https://console.bce.baidu.com/qianfan/resource/token-plan",
    logo: "/logos/baidu.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "deepseek-v4-pro",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "deepseek-v4-pro",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "deepseek-v4-pro",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "deepseek-v4-pro"
      },
      endpoint_candidates: [
        "https://qianfan.baidubce.com/anthropic/tokenplan/personal"
      ]
    }
  },
  {
    slug: "bailian",
    name: "Bailian",
    protocol: "anthropic",
    baseUrl: "https://dashscope.aliyuncs.com/apps/anthropic",
    category: "cn_official",
    websiteUrl: "https://bailian.console.aliyun.com",
    logo: "/logos/bailian.svg"
  },
  {
    slug: "bailian-for-coding",
    name: "Bailian For Coding",
    protocol: "anthropic",
    baseUrl: "https://coding.dashscope.aliyuncs.com/apps/anthropic",
    category: "cn_official",
    websiteUrl: "https://bailian.console.aliyun.com",
    logo: "/logos/bailian.svg"
  },
  {
    slug: "stepfun",
    name: "StepFun",
    protocol: "anthropic",
    baseUrl: "https://api.stepfun.com/step_plan",
    category: "cn_official",
    websiteUrl: "https://platform.stepfun.com/step-plan",
    consoleUrl: "https://platform.stepfun.com/interface-key",
    logo: "/logos/stepfun.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "step-3.5-flash-2603",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "step-3.5-flash-2603",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "step-3.5-flash-2603",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "step-3.5-flash-2603"
      },
      endpoint_candidates: [
        "https://api.stepfun.com/step_plan"
      ]
    }
  },
  {
    slug: "stepfun-en",
    name: "StepFun en",
    protocol: "anthropic",
    baseUrl: "https://api.stepfun.ai/step_plan",
    category: "cn_official",
    websiteUrl: "https://platform.stepfun.ai/step-plan",
    consoleUrl: "https://platform.stepfun.ai/interface-key",
    logo: "/logos/stepfun.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "step-3.5-flash-2603",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "step-3.5-flash-2603",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "step-3.5-flash-2603",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "step-3.5-flash-2603"
      },
      endpoint_candidates: [
        "https://api.stepfun.ai/step_plan"
      ]
    }
  },
  {
    slug: "modelscope",
    name: "ModelScope",
    protocol: "anthropic",
    baseUrl: "https://api-inference.modelscope.cn",
    category: "aggregator",
    websiteUrl: "https://modelscope.cn",
    logo: "/logos/modelscope.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "ZhipuAI/GLM-5.2",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "ZhipuAI/GLM-5.2",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "ZhipuAI/GLM-5.2",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "ZhipuAI/GLM-5.2"
      }
    }
  },
  {
    slug: "kat-coder",
    name: "KAT-Coder",
    protocol: "anthropic",
    baseUrl: "https://vanchin.streamlake.ai/api/gateway/v1/endpoints/${ENDPOINT_ID}/claude-code-proxy",
    category: "cn_official",
    websiteUrl: "https://console.streamlake.ai",
    consoleUrl: "https://console.streamlake.ai/console/api-key",
    logo: "/logos/catcoder.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "KAT-Coder-Pro V1",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "KAT-Coder-Air V1",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "KAT-Coder-Pro V1",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "KAT-Coder-Pro V1"
      }
    }
  },
  {
    slug: "longcat",
    name: "Longcat",
    protocol: "anthropic",
    baseUrl: "https://api.longcat.chat/anthropic",
    category: "cn_official",
    websiteUrl: "https://longcat.chat/platform",
    consoleUrl: "https://longcat.chat/platform/api_keys",
    logo: "/logos/longcat.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "LongCat-2.0",
        ANTHROPIC_SMALL_FAST_MODEL: "LongCat-2.0",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "LongCat-2.0",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "LongCat-2.0",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "LongCat-2.0",
        CLAUDE_CODE_MAX_OUTPUT_TOKENS: "131072",
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: 1
      }
    }
  },
  {
    slug: "minimax",
    name: "MiniMax",
    protocol: "anthropic",
    baseUrl: "https://api.minimaxi.com/anthropic",
    category: "cn_official",
    websiteUrl: "https://platform.minimaxi.com",
    consoleUrl: "https://platform.minimaxi.com/subscribe/coding-plan",
    logo: "/logos/minimax.svg",
    extra: {
      env: {
        API_TIMEOUT_MS: "3000000",
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: 1,
        ANTHROPIC_MODEL: "MiniMax-M2.7",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "MiniMax-M2.7",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "MiniMax-M2.7",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "MiniMax-M2.7"
      }
    }
  },
  {
    slug: "minimax-en",
    name: "MiniMax en",
    protocol: "anthropic",
    baseUrl: "https://api.minimax.io/anthropic",
    category: "cn_official",
    websiteUrl: "https://platform.minimax.io",
    consoleUrl: "https://platform.minimax.io/subscribe/coding-plan",
    logo: "/logos/minimax.svg",
    extra: {
      env: {
        API_TIMEOUT_MS: "3000000",
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: 1,
        ANTHROPIC_MODEL: "MiniMax-M2.7",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "MiniMax-M2.7",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "MiniMax-M2.7",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "MiniMax-M2.7"
      }
    }
  },
  {
    slug: "bailing",
    name: "BaiLing",
    protocol: "anthropic",
    baseUrl: "https://api.tbox.cn/api/anthropic",
    category: "cn_official",
    websiteUrl: "https://alipaytbox.yuque.com/sxs0ba/ling/get_started",
    extra: {
      env: {
        ANTHROPIC_MODEL: "Ling-2.5-1T",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "Ling-2.5-1T",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "Ling-2.5-1T",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "Ling-2.5-1T"
      }
    }
  },
  {
    slug: "aihubmix",
    name: "AiHubMix",
    protocol: "anthropic",
    baseUrl: "https://aihubmix.com",
    category: "aggregator",
    websiteUrl: "https://aihubmix.com",
    consoleUrl: "https://aihubmix.com",
    logo: "/logos/aihubmix.svg",
    extra: {
      endpoint_candidates: [
        "https://aihubmix.com",
        "https://api.aihubmix.com"
      ],
      api_key_field: "ANTHROPIC_API_KEY"
    }
  },
  {
    slug: "cherryin",
    name: "CherryIN",
    protocol: "anthropic",
    baseUrl: "https://open.cherryin.net",
    category: "aggregator",
    websiteUrl: "https://open.cherryin.ai",
    consoleUrl: "https://open.cherryin.ai/console/token",
    logo: "/logos/cherryin.png",
    extra: {
      env: {
        ANTHROPIC_MODEL: "anthropic/claude-sonnet-5",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "anthropic/claude-haiku-4.5",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "anthropic/claude-sonnet-5",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "anthropic/claude-opus-5"
      },
      endpoint_candidates: [
        "https://open.cherryin.net"
      ]
    }
  },
  {
    slug: "relaxycode",
    name: "RelaxyCode",
    protocol: "anthropic",
    baseUrl: "https://www.relaxycode.com",
    category: "relay",
    websiteUrl: "https://www.relaxycode.com",
    consoleUrl: "https://www.relaxycode.com/register",
    logo: "/logos/relaxcode.png"
  },
  {
    slug: "e-flowcode",
    name: "E-FlowCode",
    protocol: "anthropic",
    baseUrl: "https://e-flowcode.cc",
    category: "relay",
    websiteUrl: "https://e-flowcode.cc",
    consoleUrl: "https://e-flowcode.cc",
    logo: "/logos/eflowcode.png",
    extra: {
      endpoint_candidates: [
        "https://e-flowcode.cc"
      ]
    }
  },
  {
    slug: "openrouter-cc",
    name: "OpenRouter",
    protocol: "anthropic",
    baseUrl: "https://openrouter.ai/api",
    category: "aggregator",
    websiteUrl: "https://openrouter.ai",
    consoleUrl: "https://openrouter.ai/keys",
    logo: "/logos/openrouter.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "anthropic/claude-sonnet-5",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "anthropic/claude-haiku-4.5",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "anthropic/claude-sonnet-5",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "anthropic/claude-opus-5"
      }
    }
  },
  {
    slug: "therouter",
    name: "TheRouter",
    protocol: "anthropic",
    baseUrl: "https://api.therouter.ai",
    category: "aggregator",
    websiteUrl: "https://therouter.ai",
    consoleUrl: "https://dashboard.therouter.ai",
    extra: {
      env: {
        ANTHROPIC_MODEL: "anthropic/claude-sonnet-5",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "anthropic/claude-haiku-4.5",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "anthropic/claude-sonnet-5",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "anthropic/claude-opus-5"
      },
      endpoint_candidates: [
        "https://api.therouter.ai"
      ]
    }
  },
  {
    slug: "novita-ai",
    name: "Novita AI",
    protocol: "anthropic",
    baseUrl: "https://api.novita.ai/anthropic",
    category: "aggregator",
    websiteUrl: "https://novita.ai",
    consoleUrl: "https://novita.ai",
    logo: "/logos/novita.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "zai-org/glm-5.1",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "zai-org/glm-5.1",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "zai-org/glm-5.1",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "zai-org/glm-5.1"
      },
      endpoint_candidates: [
        "https://api.novita.ai/anthropic"
      ]
    }
  },
  {
    slug: "nvidia",
    name: "Nvidia",
    protocol: "openai",
    baseUrl: "https://integrate.api.nvidia.com",
    category: "aggregator",
    websiteUrl: "https://build.nvidia.com",
    consoleUrl: "https://build.nvidia.com/settings/api-keys",
    logo: "/logos/nvidia.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "moonshotai/kimi-k2.5",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "moonshotai/kimi-k2.5",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "moonshotai/kimi-k2.5",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "moonshotai/kimi-k2.5"
      }
    }
  },
  {
    slug: "pipellm",
    name: "PIPELLM",
    protocol: "anthropic",
    baseUrl: "https://cc-api.pipellm.ai",
    category: "aggregator",
    websiteUrl: "https://code.pipellm.ai",
    consoleUrl: "https://code.pipellm.ai/login?ref=uvw650za",
    logo: "/logos/pipellm.png",
    extra: {
      env: {
        ANTHROPIC_MODEL: "claude-opus-5",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4-5-20251001",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-5",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "claude-opus-5"
      }
    }
  },
  {
    slug: "xiaomi-mimo",
    name: "Xiaomi MiMo",
    protocol: "anthropic",
    baseUrl: "https://api.xiaomimimo.com/anthropic",
    category: "cn_official",
    websiteUrl: "https://platform.xiaomimimo.com",
    consoleUrl: "https://platform.xiaomimimo.com/#/console/api-keys",
    logo: "/logos/xiaomimimo.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "mimo-v2.5-pro",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "mimo-v2.5-pro",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "mimo-v2.5-pro",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "mimo-v2.5-pro"
      }
    }
  },
  {
    slug: "xiaomi-mimo-token-plan-china",
    name: "Xiaomi MiMo Token Plan (China)",
    protocol: "anthropic",
    baseUrl: "https://token-plan-cn.xiaomimimo.com/anthropic",
    category: "cn_official",
    websiteUrl: "https://platform.xiaomimimo.com/#/token-plan",
    consoleUrl: "https://platform.xiaomimimo.com/#/console/plan-manage",
    logo: "/logos/xiaomimimo.svg",
    extra: {
      env: {
        ANTHROPIC_MODEL: "mimo-v2.5-pro",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "mimo-v2.5-pro",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "mimo-v2.5-pro",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "mimo-v2.5-pro"
      }
    }
  },
  {
    slug: "aws-bedrock-aksk",
    name: "AWS Bedrock (AKSK)",
    protocol: "anthropic",
    baseUrl: "https://bedrock-runtime.${AWS_REGION}.amazonaws.com",
    category: "other",
    websiteUrl: "https://aws.amazon.com/bedrock/",
    logo: "/logos/aws.svg",
    extra: {
      env: {
        AWS_ACCESS_KEY_ID: "${AWS_ACCESS_KEY_ID}",
        AWS_SECRET_ACCESS_KEY: "${AWS_SECRET_ACCESS_KEY}",
        AWS_REGION: "${AWS_REGION}",
        ANTHROPIC_MODEL: "global.anthropic.claude-opus-5",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "global.anthropic.claude-haiku-4-5-20251001-v1:0",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "global.anthropic.claude-sonnet-5",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "global.anthropic.claude-opus-5",
        CLAUDE_CODE_USE_BEDROCK: "1"
      }
    }
  },
  {
    slug: "aws-bedrock-api-key",
    name: "AWS Bedrock (API Key)",
    protocol: "anthropic",
    baseUrl: "https://bedrock-runtime.${AWS_REGION}.amazonaws.com",
    category: "other",
    websiteUrl: "https://aws.amazon.com/bedrock/",
    logo: "/logos/aws.svg",
    extra: {
      env: {
        AWS_REGION: "${AWS_REGION}",
        ANTHROPIC_MODEL: "global.anthropic.claude-opus-5",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "global.anthropic.claude-haiku-4-5-20251001-v1:0",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "global.anthropic.claude-sonnet-5",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "global.anthropic.claude-opus-5",
        CLAUDE_CODE_USE_BEDROCK: "1"
      }
    }
  },
  {
    slug: "jiekou-ai",
    name: "JieKou AI",
    protocol: "anthropic",
    baseUrl: "https://api.jiekou.ai/anthropic",
    category: "aggregator",
    websiteUrl: "https://jiekou.ai/#model-library",
    consoleUrl: "https://jiekou.ai/settings/key-management",
    extra: {
      env: {
        ANTHROPIC_MODEL: "claude-fable-5",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-fable-5",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-fable-5",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "claude-fable-5"
      },
      endpoint_candidates: [
        "https://api.jiekou.ai/anthropic"
      ]
    }
  },
  {
    slug: "kimi-codex",
    name: "Kimi",
    protocol: "openai",
    baseUrl: "https://api.moonshot.cn/v1",
    category: "cn_official",
    websiteUrl: "https://platform.kimi.com?aff=cc-switch",
    consoleUrl: "https://platform.kimi.com/console/api-keys?aff=cc-switch",
    logo: "/logos/kimi.svg",
    extra: {
      endpoint_candidates: [
        "https://api.moonshot.cn/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"kimi-k2.7-code\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"kimi\"\nbase_url = \"https://api.moonshot.cn/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "kimi-for-coding-codex",
    name: "Kimi For Coding",
    protocol: "openai",
    baseUrl: "https://api.kimi.com/coding/v1",
    category: "cn_official",
    codingPlan: "kimi",
    websiteUrl: "https://www.kimi.com/code/?aff=cc-switch",
    consoleUrl: "https://www.kimi.com/code/?aff=cc-switch",
    logo: "/logos/kimi.svg",
    extra: {
      endpoint_candidates: [
        "https://api.kimi.com/coding/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"kimi-for-coding\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"kimi_coding\"\nbase_url = \"https://api.kimi.com/coding/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "packycode-codex",
    name: "PackyCode",
    protocol: "openai-responses",
    baseUrl: "https://www.packyapi.ai/v1",
    category: "relay",
    websiteUrl: "https://www.packyapi.ai",
    consoleUrl: "https://www.packyapi.ai/register?aff=cc-switch",
    logo: "/logos/packycode.svg",
    extra: {
      endpoint_candidates: [
        "https://www.packyapi.ai/v1",
        "https://cf.api.fan/v1",
        "https://slb-v1.api.fan/v1",
        "https://www.packyapi.com/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"packycode\"\nbase_url = \"https://www.packyapi.ai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "zetaapi-codex",
    name: "ZetaAPI",
    protocol: "openai-responses",
    baseUrl: "https://api.zetaapi.ai/v1",
    category: "aggregator",
    websiteUrl: "https://zetaapi.ai",
    consoleUrl: "https://zetaapi.ai/go/u117",
    logo: "/logos/zetaapi.png",
    extra: {
      endpoint_candidates: [
        "https://api.zetaapi.ai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"zetaapi\"\nbase_url = \"https://api.zetaapi.ai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "apinebula-codex",
    name: "APINebula",
    protocol: "openai-responses",
    baseUrl: "https://apinebula.ai/v1",
    category: "relay",
    websiteUrl: "https://apinebula.ai",
    consoleUrl: "https://apinebula.ai/VjM74M",
    logo: "/logos/apinebula.png",
    extra: {
      endpoint_candidates: [
        "https://apinebula.ai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nreview_model = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"APINebula\"\nbase_url = \"https://apinebula.ai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "aicodemirror-codex",
    name: "AICodeMirror",
    protocol: "openai-responses",
    baseUrl: "https://api.aicodemirror.ai/api/codex/backend-api/codex",
    category: "other",
    websiteUrl: "https://www.aicodemirror.ai",
    consoleUrl: "https://www.aicodemirror.ai/register?invitecode=9915W3",
    logo: "/logos/aicodemirror.svg",
    extra: {
      endpoint_candidates: [
        "https://api.aicodemirror.ai/api/codex/backend-api/codex"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"aicodemirror\"\nbase_url = \"https://api.aicodemirror.ai/api/codex/backend-api/codex\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "patewayai-codex",
    name: "PatewayAI",
    protocol: "openai-responses",
    baseUrl: "https://api.pateway.ai/v1",
    category: "relay",
    websiteUrl: "https://pateway.ai",
    consoleUrl: "https://pateway.ai/?ch=etzpm8&aff=WB6M6F67#/",
    logo: "/logos/pateway.jpg",
    extra: {
      endpoint_candidates: [
        "https://api.pateway.ai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"patewayai\"\nbase_url = \"https://api.pateway.ai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "fennoai-codex",
    name: "FennoAI",
    protocol: "openai-responses",
    baseUrl: "https://api.fenno.ai",
    category: "aggregator",
    websiteUrl: "https://api.fenno.ai",
    consoleUrl: "https://api.fenno.ai/register?redirect=/purchase?tab=subscription%26group=16&aff=P9MR3D3PLCNL",
    logo: "/logos/fenno.webp",
    extra: {
      endpoint_candidates: [
        "https://api.fenno.ai"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"fenno\"\nbase_url = \"https://api.fenno.ai\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "runapi-codex",
    name: "RunAPI",
    protocol: "openai-responses",
    baseUrl: "https://runapi.host/v1",
    category: "aggregator",
    websiteUrl: "https://runapi.host",
    consoleUrl: "https://runapi.host/register?aff=iOKB",
    logo: "/logos/runapi.jpg",
    extra: {
      endpoint_candidates: [
        "https://runapi.host/v1",
        "https://runapi.co/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"runapi\"\nbase_url = \"https://runapi.host/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "shengsuanyun-codex",
    name: "Shengsuanyun",
    protocol: "openai-responses",
    baseUrl: "https://router.shengsuanyun.com/api/v1",
    category: "aggregator",
    websiteUrl: "https://www.shengsuanyun.com/?from=CH_4HHXMRYF",
    consoleUrl: "https://www.shengsuanyun.com/?from=CH_4HHXMRYF",
    logo: "/logos/shengsuanyun.svg",
    extra: {
      config_toml: "model_provider = \"custom\"\nmodel = \"openai/gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"shengsuanyun\"\nbase_url = \"https://router.shengsuanyun.com/api/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "aigocode-codex",
    name: "AIGoCode",
    protocol: "openai-responses",
    baseUrl: "https://api.aigocode.app",
    category: "relay",
    websiteUrl: "https://aigocode.app",
    consoleUrl: "https://aigocode.app/invite/CC-SWITCH",
    extra: {
      endpoint_candidates: [
        "https://api.aigocode.app"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"aigocode\"\nbase_url = \"https://api.aigocode.app\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "qiniu-codex",
    name: "Qiniu",
    protocol: "openai-responses",
    baseUrl: "https://api.qnaigc.com/bypass/openai/v1",
    category: "aggregator",
    websiteUrl: "https://s.qiniu.com/nMvAvy",
    consoleUrl: "https://s.qiniu.com/nMvAvy",
    logo: "/logos/qiniu.png",
    extra: {
      endpoint_candidates: [
        "https://api.qnaigc.com/bypass/openai/v1",
        "https://api.modelink.ai/bypass/openai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"qiniu\"\nbase_url = \"https://api.qnaigc.com/bypass/openai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "aicoding-codex",
    name: "AICoding",
    protocol: "openai-responses",
    baseUrl: "https://api.aicoding.inc",
    category: "other",
    websiteUrl: "https://aicoding.inc",
    consoleUrl: "https://aicoding.inc/i/CCSWITCH",
    logo: "/logos/aicoding.svg",
    extra: {
      endpoint_candidates: [
        "https://api.aicoding.inc"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"aicoding\"\nbase_url = \"https://api.aicoding.inc\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "subrouter-codex",
    name: "SubRouter",
    protocol: "openai-responses",
    baseUrl: "https://subrouter.ai/v1",
    category: "aggregator",
    websiteUrl: "https://subrouter.ai",
    consoleUrl: "https://subrouter.ai/register?aff=l3ri",
    logo: "/logos/subrouter.svg",
    extra: {
      endpoint_candidates: [
        "https://subrouter.ai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"subrouter\"\nbase_url = \"https://subrouter.ai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "apikey-fun-codex",
    name: "APIKEY.FUN",
    protocol: "openai-responses",
    baseUrl: "https://api.apikey.fun/v1",
    category: "relay",
    websiteUrl: "https://apikey.fun",
    consoleUrl: "https://apikey.fun/register?aff=CCSwitch",
    logo: "/logos/apikeyfun.png",
    extra: {
      endpoint_candidates: [
        "https://api.apikey.fun/v1",
        "https://slb.apikey.fun/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nreview_model = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"APIKEY.FUN\"\nbase_url = \"https://api.apikey.fun/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "code0-codex",
    name: "Code0",
    protocol: "openai-responses",
    baseUrl: "https://code0.ai/v1",
    category: "aggregator",
    websiteUrl: "https://code0.ai",
    consoleUrl: "https://code0.ai/agent/register/B2XHxGjGmRvqgznY",
    logo: "/logos/code0.png",
    extra: {
      endpoint_candidates: [
        "https://code0.ai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"code0\"\nbase_url = \"https://code0.ai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "teamorouter-codex",
    name: "TeamoRouter",
    protocol: "openai-responses",
    baseUrl: "https://api.teamorouter.com/v1",
    category: "aggregator",
    websiteUrl: "https://teamorouter.com",
    consoleUrl: "https://teamorouter.com/?utm_source=cc_switch&utm_medium=referral&utm_campaign=ai_directory",
    logo: "/logos/teamorouter.png",
    extra: {
      endpoint_candidates: [
        "https://api.teamorouter.com/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"teamorouter\"\nbase_url = \"https://api.teamorouter.com/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "ppio-codex",
    name: "PPIO",
    protocol: "openai",
    baseUrl: "https://api.ppio.com/openai/v1",
    category: "aggregator",
    websiteUrl: "https://ppio.com",
    consoleUrl: "https://ppio.com/activity/ccswitch",
    logo: "/logos/ppio.svg",
    extra: {
      endpoint_candidates: [
        "https://api.ppio.com/openai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"deepseek/deepseek-v4-flash-0731\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"ppio\"\nbase_url = \"https://api.ppio.com/openai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "claudecn-codex",
    name: "ClaudeCN",
    protocol: "openai-responses",
    baseUrl: "https://claudecn.top/v1",
    category: "relay",
    websiteUrl: "https://claudecn.top",
    consoleUrl: "https://claudecn.ai/register?aff=HEL9",
    logo: "/logos/claudecn.png",
    extra: {
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"claudecn\"\nbase_url = \"https://claudecn.top/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "agent-plan-codex",
    name: "火山 Agent Plan",
    protocol: "openai-responses",
    baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3",
    category: "cn_official",
    websiteUrl: "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    consoleUrl: "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    logo: "/logos/huoshan.png",
    extra: {
      endpoint_candidates: [
        "https://ark.cn-beijing.volces.com/api/plan/v3"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"ark-code-latest\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"ark_agentplan\"\nbase_url = \"https://ark.cn-beijing.volces.com/api/plan/v3\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "coding-plan-codex",
    name: "火山 Coding Plan",
    protocol: "openai-responses",
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3",
    category: "cn_official",
    websiteUrl: "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    consoleUrl: "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    logo: "/logos/huoshan.png",
    extra: {
      endpoint_candidates: [
        "https://ark.cn-beijing.volces.com/api/coding/v3"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"ark-code-latest\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"ark_codingplan\"\nbase_url = \"https://ark.cn-beijing.volces.com/api/coding/v3\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "byteplus-codex",
    name: "BytePlus",
    protocol: "openai-responses",
    baseUrl: "https://ark.ap-southeast.bytepluses.com/api/coding/v3",
    category: "cn_official",
    websiteUrl: "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    consoleUrl: "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    logo: "/logos/byteplus.png",
    extra: {
      endpoint_candidates: [
        "https://ark.ap-southeast.bytepluses.com/api/coding/v3"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"ark-code-latest\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"byteplus\"\nbase_url = \"https://ark.ap-southeast.bytepluses.com/api/coding/v3\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "doubaoseed-codex",
    name: "DouBaoSeed",
    protocol: "openai-responses",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    category: "cn_official",
    websiteUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    consoleUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    logo: "/logos/doubao.svg",
    extra: {
      endpoint_candidates: [
        "https://ark.cn-beijing.volces.com/api/v3"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"doubao-seed-2-1-pro-260628\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"doubaoseed\"\nbase_url = \"https://ark.cn-beijing.volces.com/api/v3\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "siliconflow-codex",
    name: "SiliconFlow",
    protocol: "openai",
    baseUrl: "https://api.siliconflow.cn/v1",
    category: "aggregator",
    websiteUrl: "https://siliconflow.cn",
    consoleUrl: "https://cloud.siliconflow.cn/i/YflgU2Ve",
    logo: "/logos/siliconflow.svg",
    extra: {
      endpoint_candidates: [
        "https://api.siliconflow.cn/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"Pro/MiniMaxAI/MiniMax-M2.5\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"siliconflow\"\nbase_url = \"https://api.siliconflow.cn/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "siliconflow-en-codex",
    name: "SiliconFlow en",
    protocol: "openai",
    baseUrl: "https://api.siliconflow.com/v1",
    category: "aggregator",
    websiteUrl: "https://siliconflow.com",
    consoleUrl: "https://cloud.siliconflow.cn/i/YflgU2Ve",
    logo: "/logos/siliconflow.svg",
    extra: {
      endpoint_candidates: [
        "https://api.siliconflow.com/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"MiniMaxAI/MiniMax-M3\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"siliconflow_en\"\nbase_url = \"https://api.siliconflow.com/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "a6api-codex",
    name: "A6API",
    protocol: "openai-responses",
    baseUrl: "https://api.a6api.com/v1",
    category: "aggregator",
    websiteUrl: "https://www.a6api.com",
    consoleUrl: "https://a6api.com/register?aff=AqNr",
    extra: {
      endpoint_candidates: [
        "https://api.a6api.com/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"a6api\"\nbase_url = \"https://api.a6api.com/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "atlascloud-codex",
    name: "AtlasCloud",
    protocol: "openai",
    baseUrl: "https://api.atlascloud.ai/v1",
    category: "aggregator",
    websiteUrl: "https://www.atlascloud.ai/console/coding-plan",
    consoleUrl: "https://www.atlascloud.ai/console/coding-plan",
    logo: "/logos/atlascloud.png",
    extra: {
      endpoint_candidates: [
        "https://api.atlascloud.ai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"zai-org/glm-5.1\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"AtlasCloud\"\nbase_url = \"https://api.atlascloud.ai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "compshare-codex",
    name: "Compshare",
    protocol: "openai-responses",
    baseUrl: "https://api.modelverse.cn/v1",
    category: "aggregator",
    websiteUrl: "https://www.compshare.cn",
    consoleUrl: "https://www.compshare.cn/coding-plan?ytag=GPU_YY_YX_git_cc-switch",
    logo: "/logos/ucloud.svg",
    extra: {
      endpoint_candidates: [
        "https://api.modelverse.cn/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"compshare\"\nbase_url = \"https://api.modelverse.cn/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "compshare-coding-plan-codex",
    name: "Compshare Coding Plan",
    protocol: "openai-responses",
    baseUrl: "https://cp.compshare.cn/v1",
    category: "aggregator",
    websiteUrl: "https://www.compshare.cn",
    consoleUrl: "https://www.compshare.cn/coding-plan?ytag=GPU_YY_YX_git_cc-switch",
    logo: "/logos/ucloud.svg",
    extra: {
      endpoint_candidates: [
        "https://cp.compshare.cn/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"compshare_coding\"\nbase_url = \"https://cp.compshare.cn/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "ccsub-codex",
    name: "CCSub",
    protocol: "openai-responses",
    baseUrl: "https://www.ccsub.net/v1",
    category: "aggregator",
    websiteUrl: "https://www.ccsub.net",
    consoleUrl: "https://www.ccsub.net/register?ref=Y6Z8DXEA",
    logo: "/logos/ccsub.svg",
    extra: {
      endpoint_candidates: [
        "https://www.ccsub.net/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"ccsub\"\nbase_url = \"https://www.ccsub.net/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "sssaicode-codex",
    name: "SSSAiCode",
    protocol: "openai-responses",
    baseUrl: "https://node-hk.sssaicodeapi.com/api/v1",
    category: "relay",
    websiteUrl: "https://sssaicodeapi.com",
    consoleUrl: "https://sssaicodeapi.com/register?ref=DCP0SM",
    logo: "/logos/sssaicode.svg",
    extra: {
      endpoint_candidates: [
        "https://node-hk.sssaicodeapi.com/api/v1",
        "https://node-hk.sssaiapi.com/api/v1",
        "https://node-cf.sssaicodeapi.com/api/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"sssaicode\"\nbase_url = \"https://node-hk.sssaicodeapi.com/api/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "micu-codex",
    name: "Micu",
    protocol: "openai-responses",
    baseUrl: "https://www.micuapi.ai/v1",
    category: "relay",
    websiteUrl: "https://www.micuapi.ai",
    consoleUrl: "https://www.micuapi.ai/register?aff=aOYQ",
    logo: "/logos/micu.svg",
    extra: {
      endpoint_candidates: [
        "https://www.micuapi.ai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"micu\"\nbase_url = \"https://www.micuapi.ai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "rightcode-codex",
    name: "RightCode",
    protocol: "openai-responses",
    baseUrl: "https://www.rightapi.ai/codex/v1",
    category: "relay",
    websiteUrl: "https://www.rightapi.ai",
    consoleUrl: "https://www.rightapi.ai/register?aff=CCSWITCH",
    logo: "/logos/rc.svg",
    extra: {
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"rightcode\"\nbase_url = \"https://www.rightapi.ai/codex/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "etok-ai-codex",
    name: "ETok.ai",
    protocol: "openai-responses",
    baseUrl: "https://api.etok.ai/v1",
    category: "relay",
    websiteUrl: "https://etok.ai",
    consoleUrl: "https://etok.ai",
    logo: "/logos/etok.png",
    extra: {
      endpoint_candidates: [
        "https://api.etok.ai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"etok\"\nbase_url = \"https://api.etok.ai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "cubence-codex",
    name: "Cubence",
    protocol: "openai-responses",
    baseUrl: "https://api.cubence.com/v1",
    category: "relay",
    websiteUrl: "https://cubence.com",
    consoleUrl: "https://cubence.com/signup?code=CCSWITCH&source=ccs",
    logo: "/logos/cubence.svg",
    extra: {
      endpoint_candidates: [
        "https://api.cubence.com/v1",
        "https://api-cf.cubence.com/v1",
        "https://api-dmit.cubence.com/v1",
        "https://api-bwg.cubence.com/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"cubence\"\nbase_url = \"https://api.cubence.com/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "crazyrouter-codex",
    name: "CrazyRouter",
    protocol: "openai-responses",
    baseUrl: "https://cn.crazyrouter.com/v1",
    category: "other",
    websiteUrl: "https://www.crazyrouter.com",
    consoleUrl: "https://www.crazyrouter.com/register?aff=OZcm&ref=cc-switch",
    logo: "/logos/crazyrouter.svg",
    extra: {
      endpoint_candidates: [
        "https://cn.crazyrouter.com/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"crazyrouter\"\nbase_url = \"https://cn.crazyrouter.com/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "dmxapi-codex",
    name: "DMXAPI",
    protocol: "openai-responses",
    baseUrl: "https://www.dmxapi.cn/v1",
    category: "aggregator",
    websiteUrl: "https://www.dmxapi.cn",
    extra: {
      endpoint_candidates: [
        "https://www.dmxapi.cn/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"dmxapi\"\nbase_url = \"https://www.dmxapi.cn/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "sudocode-chat-codex",
    name: "SudoCode.chat",
    protocol: "openai-responses",
    baseUrl: "https://api.sudocode.chat/v1",
    category: "relay",
    websiteUrl: "https://sudocode.chat",
    consoleUrl: "https://sudocode.chat/sign-up?aff=CC-SWITCH&utm_source=cc-switch&utm_medium=sponsor&utm_campaign=ccswitch",
    logo: "/logos/sudocode.png",
    extra: {
      endpoint_candidates: [
        "https://api.sudocode.chat/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nreview_model = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"SudoCode\"\nbase_url = \"https://api.sudocode.chat/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "sudocode-us-codex",
    name: "SudoCode.us",
    protocol: "openai-responses",
    baseUrl: "https://sudocode.us/v1",
    category: "relay",
    websiteUrl: "https://sudocode.us",
    consoleUrl: "https://sudocode.us",
    logo: "/logos/sudocode-us.png",
    extra: {
      endpoint_candidates: [
        "https://sudocode.us/v1",
        "https://sudocode.run/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nreview_model = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\nmodel_verbosity = \"high\"\n\n[model_providers.custom]\nname = \"sudocode\"\nbase_url = \"https://sudocode.us/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "xycai-codex",
    name: "XycAi",
    protocol: "openai-responses",
    baseUrl: "https://apicdn.xycai.us/v1",
    category: "aggregator",
    websiteUrl: "https://xycai.us",
    consoleUrl: "https://xycai.us/register?aff=Uhu9",
    logo: "/logos/xycai.png",
    extra: {
      endpoint_candidates: [
        "https://apicdn.xycai.us/v1",
        "https://apicdn.xyc.ai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"xycai\"\nbase_url = \"https://apicdn.xycai.us/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "amux-codex",
    name: "Amux",
    protocol: "openai-responses",
    baseUrl: "https://api.amux.ai/v1",
    category: "aggregator",
    websiteUrl: "https://amux.ai",
    consoleUrl: "https://amux.ai",
    extra: {
      endpoint_candidates: [
        "https://api.amux.ai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"amux\"\nbase_url = \"https://api.amux.ai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "azure-openai",
    name: "Azure OpenAI",
    protocol: "openai-responses",
    baseUrl: "https://YOUR_RESOURCE_NAME.openai.azure.com/openai",
    category: "relay",
    websiteUrl: "https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/codex",
    logo: "/logos/azure.svg",
    extra: {
      endpoint_candidates: [
        "https://YOUR_RESOURCE_NAME.openai.azure.com/openai"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"Azure OpenAI\"\nbase_url = \"https://YOUR_RESOURCE_NAME.openai.azure.com/openai\"\nenv_key = \"OPENAI_API_KEY\"\nquery_params = { \"api-version\" = \"2025-04-01-preview\" }\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "deepseek-codex",
    name: "DeepSeek",
    protocol: "openai-responses",
    baseUrl: "https://api.deepseek.com",
    category: "cn_official",
    websiteUrl: "https://platform.deepseek.com",
    consoleUrl: "https://platform.deepseek.com/api_keys",
    logo: "/logos/deepseek.svg",
    extra: {
      endpoint_candidates: [
        "https://api.deepseek.com"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"deepseek-v4-flash\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"deepseek\"\nbase_url = \"https://api.deepseek.com\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "zhipu-glm-codex",
    name: "Zhipu GLM",
    protocol: "openai",
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
    category: "cn_official",
    websiteUrl: "https://open.bigmodel.cn",
    consoleUrl: "https://www.bigmodel.cn/claude-code?ic=RRVJPB5SII",
    logo: "/logos/zhipu.svg",
    extra: {
      endpoint_candidates: [
        "https://open.bigmodel.cn/api/coding/paas/v4"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"glm-5.2\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"zhipu_glm\"\nbase_url = \"https://open.bigmodel.cn/api/coding/paas/v4\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "zhipu-glm-en-codex",
    name: "Zhipu GLM en",
    protocol: "openai",
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    category: "cn_official",
    websiteUrl: "https://z.ai",
    consoleUrl: "https://z.ai/subscribe?ic=8JVLJQFSKB",
    logo: "/logos/zhipu.svg",
    extra: {
      endpoint_candidates: [
        "https://api.z.ai/api/coding/paas/v4"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"glm-5.2\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"zhipu_glm_en\"\nbase_url = \"https://api.z.ai/api/coding/paas/v4\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "baidu-qianfan-coding-plan-codex",
    name: "Baidu Qianfan Coding Plan",
    protocol: "openai",
    baseUrl: "https://qianfan.baidubce.com/v2/coding",
    category: "cn_official",
    websiteUrl: "https://cloud.baidu.com/product/qianfan_modelbuilder",
    consoleUrl: "https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application",
    logo: "/logos/baidu.svg",
    extra: {
      endpoint_candidates: [
        "https://qianfan.baidubce.com/v2/coding"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"qianfan-code-latest\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"qianfan_coding\"\nbase_url = \"https://qianfan.baidubce.com/v2/coding\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "baidu-qianfan-token-plan-codex",
    name: "Baidu Qianfan Token Plan",
    protocol: "openai",
    baseUrl: "https://qianfan.baidubce.com/v2/tokenplan/personal",
    category: "cn_official",
    websiteUrl: "https://cloud.baidu.com/product/codingplan.html",
    consoleUrl: "https://console.bce.baidu.com/qianfan/resource/token-plan",
    logo: "/logos/baidu.svg",
    extra: {
      endpoint_candidates: [
        "https://qianfan.baidubce.com/v2/tokenplan/personal"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"deepseek-v4-pro\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"qianfan_tokenplan\"\nbase_url = \"https://qianfan.baidubce.com/v2/tokenplan/personal\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "bailian-codex",
    name: "Bailian",
    protocol: "openai-responses",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    category: "cn_official",
    websiteUrl: "https://bailian.console.aliyun.com",
    consoleUrl: "https://bailian.console.aliyun.com/#/api-key",
    logo: "/logos/bailian.svg",
    extra: {
      endpoint_candidates: [
        "https://dashscope.aliyuncs.com/compatible-mode/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"qwen3-coder-plus\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"bailian\"\nbase_url = \"https://dashscope.aliyuncs.com/compatible-mode/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "tencent-hunyuan",
    name: "Tencent Hunyuan",
    protocol: "openai-responses",
    baseUrl: "https://tokenhub.tencentmaas.com/v1",
    category: "cn_official",
    websiteUrl: "https://cloud.tencent.com/product/tokenhub",
    consoleUrl: "https://console.cloud.tencent.com/tokenhub/apikey",
    logo: "/logos/hunyuan.svg",
    extra: {
      endpoint_candidates: [
        "https://tokenhub.tencentmaas.com/v1",
        "https://tokenhub.tencentmaas.cn/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"hy3\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"hy3_tokenhub\"\nbase_url = \"https://tokenhub.tencentmaas.com/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "stepfun-codex",
    name: "StepFun",
    protocol: "openai",
    baseUrl: "https://api.stepfun.com/step_plan/v1",
    category: "cn_official",
    websiteUrl: "https://platform.stepfun.com/step-plan",
    consoleUrl: "https://platform.stepfun.com/interface-key",
    logo: "/logos/stepfun.svg",
    extra: {
      endpoint_candidates: [
        "https://api.stepfun.com/step_plan/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"step-3.7-flash\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"stepfun\"\nbase_url = \"https://api.stepfun.com/step_plan/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "stepfun-en-codex",
    name: "StepFun en",
    protocol: "openai",
    baseUrl: "https://api.stepfun.ai/step_plan/v1",
    category: "cn_official",
    websiteUrl: "https://platform.stepfun.ai/step-plan",
    consoleUrl: "https://platform.stepfun.ai/interface-key",
    logo: "/logos/stepfun.svg",
    extra: {
      endpoint_candidates: [
        "https://api.stepfun.ai/step_plan/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"step-3.7-flash\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"stepfun_en\"\nbase_url = \"https://api.stepfun.ai/step_plan/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "modelscope-codex",
    name: "ModelScope",
    protocol: "openai",
    baseUrl: "https://api-inference.modelscope.cn/v1",
    category: "aggregator",
    websiteUrl: "https://modelscope.cn",
    consoleUrl: "https://modelscope.cn/my/myaccesstoken",
    logo: "/logos/modelscope.svg",
    extra: {
      endpoint_candidates: [
        "https://api-inference.modelscope.cn/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"ZhipuAI/GLM-5.2\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"modelscope\"\nbase_url = \"https://api-inference.modelscope.cn/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "longcat-codex",
    name: "Longcat",
    protocol: "openai-responses",
    baseUrl: "https://api.longcat.chat/openai/v1",
    category: "cn_official",
    websiteUrl: "https://longcat.chat/platform",
    consoleUrl: "https://longcat.chat/platform/api_keys",
    logo: "/logos/longcat.svg",
    extra: {
      endpoint_candidates: [
        "https://api.longcat.chat/openai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"LongCat-2.0\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"longcat\"\nbase_url = \"https://api.longcat.chat/openai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "minimax-codex",
    name: "MiniMax",
    protocol: "openai-responses",
    baseUrl: "https://api.minimaxi.com/v1",
    category: "cn_official",
    websiteUrl: "https://platform.minimaxi.com",
    consoleUrl: "https://platform.minimaxi.com/subscribe/coding-plan",
    logo: "/logos/minimax.svg",
    extra: {
      endpoint_candidates: [
        "https://api.minimaxi.com/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"MiniMax-M3\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"minimax\"\nbase_url = \"https://api.minimaxi.com/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "minimax-en-codex",
    name: "MiniMax en",
    protocol: "openai-responses",
    baseUrl: "https://api.minimax.io/v1",
    category: "cn_official",
    websiteUrl: "https://platform.minimax.io",
    consoleUrl: "https://platform.minimax.io/subscribe/coding-plan",
    logo: "/logos/minimax.svg",
    extra: {
      endpoint_candidates: [
        "https://api.minimax.io/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"MiniMax-M3\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"minimax_en\"\nbase_url = \"https://api.minimax.io/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "bailing-codex",
    name: "BaiLing",
    protocol: "openai",
    baseUrl: "https://api.tbox.cn/api/llm/v1",
    category: "cn_official",
    websiteUrl: "https://alipaytbox.yuque.com/sxs0ba/ling/get_started",
    consoleUrl: "https://ling.tbox.cn/open",
    extra: {
      endpoint_candidates: [
        "https://api.tbox.cn/api/llm/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"Ling-2.6-1T\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"bailing\"\nbase_url = \"https://api.tbox.cn/api/llm/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "xiaomi-mimo-codex",
    name: "Xiaomi MiMo",
    protocol: "openai-responses",
    baseUrl: "https://api.xiaomimimo.com/v1",
    category: "cn_official",
    websiteUrl: "https://platform.xiaomimimo.com",
    consoleUrl: "https://platform.xiaomimimo.com/#/console/api-keys",
    logo: "/logos/xiaomimimo.svg",
    extra: {
      endpoint_candidates: [
        "https://api.xiaomimimo.com/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"mimo-v2.5-pro\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"xiaomi_mimo\"\nbase_url = \"https://api.xiaomimimo.com/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "xiaomi-mimo-token-plan-china-codex",
    name: "Xiaomi MiMo Token Plan (China)",
    protocol: "openai-responses",
    baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
    category: "cn_official",
    websiteUrl: "https://platform.xiaomimimo.com/#/token-plan",
    consoleUrl: "https://platform.xiaomimimo.com/#/console/plan-manage",
    logo: "/logos/xiaomimimo.svg",
    extra: {
      endpoint_candidates: [
        "https://token-plan-cn.xiaomimimo.com/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"mimo-v2.5-pro\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"xiaomi_mimo_token_plan\"\nbase_url = \"https://token-plan-cn.xiaomimimo.com/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "novita-ai-codex",
    name: "Novita AI",
    protocol: "openai",
    baseUrl: "https://api.novita.ai/openai/v1",
    category: "aggregator",
    websiteUrl: "https://novita.ai",
    consoleUrl: "https://novita.ai",
    logo: "/logos/novita.svg",
    extra: {
      endpoint_candidates: [
        "https://api.novita.ai/openai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"zai-org/glm-5.1\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"novita\"\nbase_url = \"https://api.novita.ai/openai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "xai-grok",
    name: "xAI (Grok)",
    protocol: "openai-responses",
    baseUrl: "https://api.x.ai/v1",
    category: "relay",
    websiteUrl: "https://x.ai/api",
    consoleUrl: "https://console.x.ai",
    logo: "/logos/xai.svg",
    extra: {
      endpoint_candidates: [
        "https://api.x.ai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"grok-4.5\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"xai\"\nbase_url = \"https://api.x.ai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "nvidia-codex",
    name: "Nvidia",
    protocol: "openai",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    category: "aggregator",
    websiteUrl: "https://build.nvidia.com",
    consoleUrl: "https://build.nvidia.com/settings/api-keys",
    logo: "/logos/nvidia.svg",
    extra: {
      endpoint_candidates: [
        "https://integrate.api.nvidia.com/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"moonshotai/kimi-k2.5\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"nvidia\"\nbase_url = \"https://integrate.api.nvidia.com/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "opencode-go-codex",
    name: "OpenCode Go",
    protocol: "openai",
    baseUrl: "https://opencode.ai/zen/go/v1",
    category: "relay",
    websiteUrl: "https://opencode.ai/go",
    consoleUrl: "https://opencode.ai/go?ref=2YTRG2NGTX",
    logo: "/logos/opencode.svg",
    extra: {
      endpoint_candidates: [
        "https://opencode.ai/zen/go/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"glm-5.2\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"opencode_go\"\nbase_url = \"https://opencode.ai/zen/go/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "aihubmix-codex",
    name: "AiHubMix",
    protocol: "openai-responses",
    baseUrl: "https://aihubmix.com/v1",
    category: "aggregator",
    websiteUrl: "https://aihubmix.com",
    logo: "/logos/aihubmix.svg",
    extra: {
      endpoint_candidates: [
        "https://aihubmix.com/v1",
        "https://api.aihubmix.com/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"aihubmix\"\nbase_url = \"https://aihubmix.com/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "cherryin-codex",
    name: "CherryIN",
    protocol: "openai-responses",
    baseUrl: "https://open.cherryin.net/v1",
    category: "aggregator",
    websiteUrl: "https://open.cherryin.ai",
    consoleUrl: "https://open.cherryin.ai/console/token",
    logo: "/logos/cherryin.png",
    extra: {
      endpoint_candidates: [
        "https://open.cherryin.net/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"openai/gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"cherryin\"\nbase_url = \"https://open.cherryin.net/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "relaxycode-codex",
    name: "RelaxyCode",
    protocol: "openai-responses",
    baseUrl: "https://www.relaxycode.com/v1",
    category: "relay",
    websiteUrl: "https://www.relaxycode.com",
    consoleUrl: "https://www.relaxycode.com/register",
    logo: "/logos/relaxcode.png",
    extra: {
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"relaxycode\"\nbase_url = \"https://www.relaxycode.com/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "e-flowcode-codex",
    name: "E-FlowCode",
    protocol: "openai-responses",
    baseUrl: "https://e-flowcode.cc/v1",
    category: "relay",
    websiteUrl: "https://e-flowcode.cc",
    consoleUrl: "https://e-flowcode.cc",
    logo: "/logos/eflowcode.png",
    extra: {
      endpoint_candidates: [
        "https://e-flowcode.cc/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\npersonality = \"pragmatic\"\n\n[model_providers.custom]\nname = \"E-FlowCode\"\nbase_url = \"https://e-flowcode.cc/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true\nmodel_context_window = 1000000\nmodel_auto_compact_token_limit = 9000000"
    }
  },
  {
    slug: "pipellm-codex",
    name: "PIPELLM",
    protocol: "openai-responses",
    baseUrl: "https://cc-api.pipellm.ai/v1",
    category: "aggregator",
    websiteUrl: "https://code.pipellm.ai",
    consoleUrl: "https://code.pipellm.ai/login?ref=uvw650za",
    logo: "/logos/pipellm.png",
    extra: {
      endpoint_candidates: [
        "https://cc-api.pipellm.ai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"medium\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"PIPELLM\"\nwire_api = \"responses\"\nrequires_openai_auth = true\nbase_url = \"https://cc-api.pipellm.ai/v1\""
    }
  },
  {
    slug: "openrouter-codex",
    name: "OpenRouter",
    protocol: "openai-responses",
    baseUrl: "https://openrouter.ai/api/v1",
    category: "aggregator",
    websiteUrl: "https://openrouter.ai",
    consoleUrl: "https://openrouter.ai/keys",
    logo: "/logos/openrouter.svg",
    extra: {
      config_toml: "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"openrouter\"\nbase_url = \"https://openrouter.ai/api/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "therouter-codex",
    name: "TheRouter",
    protocol: "openai-responses",
    baseUrl: "https://api.therouter.ai/v1",
    category: "aggregator",
    websiteUrl: "https://therouter.ai",
    consoleUrl: "https://dashboard.therouter.ai",
    extra: {
      endpoint_candidates: [
        "https://api.therouter.ai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"openai/gpt-5.3-codex\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"therouter\"\nbase_url = \"https://api.therouter.ai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "jiekou-ai-codex",
    name: "JieKou AI",
    protocol: "openai",
    baseUrl: "https://api.jiekou.ai/openai/v1",
    category: "aggregator",
    websiteUrl: "https://jiekou.ai/#model-library",
    consoleUrl: "https://jiekou.ai/settings/key-management",
    extra: {
      endpoint_candidates: [
        "https://api.jiekou.ai/openai/v1"
      ],
      config_toml: "model_provider = \"custom\"\nmodel = \"claude-fable-5\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"jiekou\"\nbase_url = \"https://api.jiekou.ai/openai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    }
  },
  {
    slug: "google-official",
    name: "Google Official",
    protocol: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    category: "official",
    websiteUrl: "https://ai.google.dev/",
    consoleUrl: "https://aistudio.google.com/apikey",
    logo: "/logos/gemini.svg"
  },
  {
    slug: "packycode-gemini",
    name: "PackyCode",
    protocol: "gemini",
    baseUrl: "https://www.packyapi.ai",
    category: "relay",
    websiteUrl: "https://www.packyapi.ai",
    consoleUrl: "https://www.packyapi.ai/register?aff=cc-switch",
    logo: "/logos/packycode.svg",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  },
  {
    slug: "apinebula-gemini",
    name: "APINebula",
    protocol: "gemini",
    baseUrl: "https://apinebula.ai",
    category: "relay",
    websiteUrl: "https://apinebula.ai",
    consoleUrl: "https://apinebula.ai/VjM74M",
    logo: "/logos/apinebula.png",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  },
  {
    slug: "aicodemirror-gemini",
    name: "AICodeMirror",
    protocol: "gemini",
    baseUrl: "https://api.aicodemirror.ai/api/gemini",
    category: "relay",
    websiteUrl: "https://www.aicodemirror.ai",
    consoleUrl: "https://www.aicodemirror.ai/register?invitecode=9915W3",
    logo: "/logos/aicodemirror.svg",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  },
  {
    slug: "shengsuanyun-gemini",
    name: "Shengsuanyun",
    protocol: "gemini",
    baseUrl: "https://router.shengsuanyun.com/api",
    category: "aggregator",
    websiteUrl: "https://www.shengsuanyun.com/?from=CH_4HHXMRYF",
    consoleUrl: "https://www.shengsuanyun.com/?from=CH_4HHXMRYF",
    logo: "/logos/shengsuanyun.svg",
    extra: {
      env: {
        GEMINI_MODEL: "google/gemini-3.6-flash"
      }
    }
  },
  {
    slug: "aigocode-gemini",
    name: "AIGoCode",
    protocol: "gemini",
    baseUrl: "https://api.aigocode.app",
    category: "relay",
    websiteUrl: "https://aigocode.app",
    consoleUrl: "https://aigocode.app/invite/CC-SWITCH",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  },
  {
    slug: "qiniu-gemini",
    name: "Qiniu",
    protocol: "gemini",
    baseUrl: "https://api.qnaigc.com/bypass/vertex",
    category: "aggregator",
    websiteUrl: "https://s.qiniu.com/nMvAvy",
    consoleUrl: "https://s.qiniu.com/nMvAvy",
    logo: "/logos/qiniu.png",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  },
  {
    slug: "aicoding-gemini",
    name: "AICoding",
    protocol: "gemini",
    baseUrl: "https://api.aicoding.inc",
    category: "relay",
    websiteUrl: "https://aicoding.inc",
    consoleUrl: "https://aicoding.inc/i/CCSWITCH",
    logo: "/logos/aicoding.svg",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  },
  {
    slug: "subrouter-gemini",
    name: "SubRouter",
    protocol: "gemini",
    baseUrl: "https://subrouter.ai/v1beta",
    category: "aggregator",
    websiteUrl: "https://subrouter.ai",
    consoleUrl: "https://subrouter.ai/register?aff=l3ri",
    logo: "/logos/subrouter.svg",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  },
  {
    slug: "apikey-fun-gemini",
    name: "APIKEY.FUN",
    protocol: "gemini",
    baseUrl: "https://api.apikey.fun",
    category: "relay",
    websiteUrl: "https://apikey.fun",
    consoleUrl: "https://apikey.fun/register?aff=CCSwitch",
    logo: "/logos/apikeyfun.png",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  },
  {
    slug: "code0-gemini",
    name: "Code0",
    protocol: "gemini",
    baseUrl: "https://code0.ai",
    category: "aggregator",
    websiteUrl: "https://code0.ai",
    consoleUrl: "https://code0.ai/agent/register/B2XHxGjGmRvqgznY",
    logo: "/logos/code0.png",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  },
  {
    slug: "a6api-gemini",
    name: "A6API",
    protocol: "gemini",
    baseUrl: "https://api.a6api.com",
    category: "aggregator",
    websiteUrl: "https://www.a6api.com",
    consoleUrl: "https://a6api.com/register?aff=AqNr",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  },
  {
    slug: "sssaicode-gemini",
    name: "SSSAiCode",
    protocol: "gemini",
    baseUrl: "https://node-hk.sssaicodeapi.com/api",
    category: "relay",
    websiteUrl: "https://sssaicodeapi.com",
    consoleUrl: "https://sssaicodeapi.com/register?ref=DCP0SM",
    logo: "/logos/sssaicode.svg",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  },
  {
    slug: "etok-ai-gemini",
    name: "ETok.ai",
    protocol: "gemini",
    baseUrl: "https://api.etok.ai/v1beta",
    category: "relay",
    websiteUrl: "https://etok.ai",
    consoleUrl: "https://etok.ai",
    logo: "/logos/etok.png",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  },
  {
    slug: "cubence-gemini",
    name: "Cubence",
    protocol: "gemini",
    baseUrl: "https://api.cubence.com",
    category: "relay",
    websiteUrl: "https://cubence.com",
    consoleUrl: "https://cubence.com/signup?code=CCSWITCH&source=ccs",
    logo: "/logos/cubence.svg",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  },
  {
    slug: "crazyrouter-gemini",
    name: "CrazyRouter",
    protocol: "gemini",
    baseUrl: "https://cn.crazyrouter.com",
    category: "relay",
    websiteUrl: "https://www.crazyrouter.com",
    consoleUrl: "https://www.crazyrouter.com/register?aff=OZcm&ref=cc-switch",
    logo: "/logos/crazyrouter.svg",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  },
  {
    slug: "sudocode-us-gemini",
    name: "SudoCode.us",
    protocol: "gemini",
    baseUrl: "https://sudocode.us",
    category: "relay",
    websiteUrl: "https://sudocode.us",
    consoleUrl: "https://sudocode.us",
    logo: "/logos/sudocode-us.png",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.1-flash-lite"
      }
    }
  },
  {
    slug: "xycai-gemini",
    name: "XycAi",
    protocol: "gemini",
    baseUrl: "https://apicdn.xycai.us",
    category: "aggregator",
    websiteUrl: "https://xycai.us",
    consoleUrl: "https://xycai.us/register?aff=Uhu9",
    logo: "/logos/xycai.png",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  },
  {
    slug: "e-flowcode-gemini",
    name: "E-FlowCode",
    protocol: "gemini",
    baseUrl: "https://e-flowcode.cc",
    category: "relay",
    websiteUrl: "https://e-flowcode.cc",
    consoleUrl: "https://e-flowcode.cc",
    logo: "/logos/eflowcode.png",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  },
  {
    slug: "cherryin-gemini",
    name: "CherryIN",
    protocol: "gemini",
    baseUrl: "https://open.cherryin.net",
    category: "aggregator",
    websiteUrl: "https://open.cherryin.ai",
    consoleUrl: "https://open.cherryin.ai/console/token",
    logo: "/logos/cherryin.png",
    extra: {
      env: {
        GEMINI_MODEL: "google/gemini-3.6-flash"
      }
    }
  },
  {
    slug: "openrouter-gemini",
    name: "OpenRouter",
    protocol: "gemini",
    baseUrl: "https://openrouter.ai/api",
    category: "aggregator",
    websiteUrl: "https://openrouter.ai",
    consoleUrl: "https://openrouter.ai/keys",
    logo: "/logos/openrouter.svg",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  },
  {
    slug: "therouter-gemini",
    name: "TheRouter",
    protocol: "gemini",
    baseUrl: "https://api.therouter.ai",
    category: "aggregator",
    websiteUrl: "https://therouter.ai",
    consoleUrl: "https://dashboard.therouter.ai",
    extra: {
      env: {
        GEMINI_MODEL: "gemini-3.6-flash"
      }
    }
  }
];
