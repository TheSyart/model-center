/** GENERATED FILE — DO NOT EDIT. Source: farion1231/cc-switch@9a596158ca926e74b56243c08af67d9dd13fc27c; commit time: 2026-08-24T16:49:56+08:00. Run npm run sync:cc-switch. */
import type { ProviderPreset } from './types';

export const CC_SWITCH_LOGICAL_PRESETS: ProviderPreset[] = [
  {
    "presetKey": "claude-official",
    "slug": "claude-official",
    "name": "Claude Official",
    "category": "official",
    "logo": "/logos/anthropic.svg",
    "websiteUrl": "https://www.anthropic.com/claude-code",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop"
    ],
    "extra": {
      "env": {}
    },
    "defaultProtocol": "anthropic",
    "endpoints": [
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.anthropic.com",
        "selectedVariantSlug": "claude-official-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "claude-official-anthropic",
            "baseUrl": "https://api.anthropic.com",
            "sourceApps": [
              "claude"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "claude-desktop-official-anthropic",
            "baseUrl": "https://api.anthropic.com",
            "sourceApps": [
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "claude-official-anthropic",
      "claude-desktop-official-anthropic"
    ],
    "protocol": "anthropic",
    "baseUrl": "https://api.anthropic.com"
  },
  {
    "presetKey": "kimi",
    "slug": "kimi",
    "name": "Kimi",
    "category": "cn_official",
    "logo": "/logos/kimi.svg",
    "websiteUrl": "https://platform.kimi.com?aff=cc-switch",
    "consoleUrl": "https://platform.kimi.com/console/api-keys?aff=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"kimi-k2.7-code\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"kimi\"\nbase_url = \"https://api.moonshot.cn/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.moonshot.cn/v1",
        "selectedVariantSlug": "kimi-openai",
        "sourceApps": [
          "codex",
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "kimi-k2.7-code",
            "displayName": "Kimi K2.7 Code",
            "contextWindow": 262144,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 262144,
              "thinkingLevelMap": {
                "off": null
              }
            },
            "pricing": {
              "input": 0.95,
              "output": 4,
              "cacheRead": 0.19,
              "cacheWrite": 0
            }
          },
          {
            "id": "kimi-k3",
            "displayName": "Kimi K3",
            "contextWindow": 1048576,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 131072,
              "compat": {
                "supportsStore": false,
                "supportsDeveloperRole": false,
                "supportsReasoningEffort": true,
                "maxTokensField": "max_tokens",
                "supportsStrictMode": false,
                "thinkingFormat": "openai",
                "requiresReasoningContentOnAssistantMessages": true,
                "deferredToolsMode": "kimi"
              },
              "thinkingLevelMap": {
                "off": null,
                "minimal": null,
                "low": "low",
                "medium": null,
                "high": "high",
                "xhigh": null,
                "max": "max"
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "kimi-openai",
            "baseUrl": "https://api.moonshot.cn/v1",
            "sourceApps": [
              "codex",
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.moonshot.cn/anthropic",
        "selectedVariantSlug": "kimi-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "kimi-anthropic",
            "baseUrl": "https://api.moonshot.cn/anthropic",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "kimi-openai",
      "kimi-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.moonshot.cn/v1"
  },
  {
    "presetKey": "kimi-for-coding",
    "slug": "kimi-for-coding",
    "name": "Kimi For Coding",
    "category": "cn_official",
    "logo": "/logos/kimi.svg",
    "websiteUrl": "https://www.kimi.com/code/?aff=cc-switch",
    "consoleUrl": "https://www.kimi.com/code/?aff=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "pi",
      "codex",
      "opencode",
      "openclaw",
      "hermes"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"kimi-for-coding\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"kimi_coding\"\nbase_url = \"https://api.kimi.com/coding/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.kimi.com/coding/v1",
        "selectedVariantSlug": "kimi-for-coding-openai",
        "sourceApps": [
          "codex",
          "opencode",
          "openclaw",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "kimi-for-coding",
            "displayName": "Kimi For Coding",
            "contextWindow": 131072,
            "pricing": {
              "input": 0.95,
              "output": 4,
              "cacheRead": 0.19,
              "cacheWrite": null
            }
          },
          {
            "id": "kimi-for-coding-highspeed",
            "displayName": "Kimi For Coding HighSpeed",
            "contextWindow": 262144,
            "reasoningLevels": [
              "high"
            ]
          },
          {
            "id": "k3",
            "displayName": "Kimi K3",
            "contextWindow": 1048576,
            "reasoningLevels": [
              "low",
              "high",
              "max"
            ],
            "defaultReasoningLevel": "high",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          },
          {
            "id": "k3-256k",
            "displayName": "Kimi K3 256K",
            "contextWindow": 262144,
            "reasoningLevels": [
              "low",
              "high",
              "max"
            ],
            "defaultReasoningLevel": "high"
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "kimi-for-coding-openai",
            "baseUrl": "https://api.kimi.com/coding/v1",
            "sourceApps": [
              "codex",
              "opencode",
              "openclaw"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "kimi-for-coding-openai-api",
            "baseUrl": "https://api.kimi.com/coding",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.kimi.com/coding",
        "selectedVariantSlug": "kimi-for-coding-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "pi"
        ],
        "knownModels": [
          {
            "id": "kimi-for-coding",
            "displayName": "Kimi For Coding",
            "contextWindow": 262144,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 32768,
              "thinkingLevelMap": {}
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "kimi-for-coding-anthropic",
            "baseUrl": "https://api.kimi.com/coding",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "kimi-for-coding-openai",
      "kimi-for-coding-openai-api",
      "kimi-for-coding-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.kimi.com/coding/v1"
  },
  {
    "presetKey": "packycode",
    "slug": "packycode",
    "name": "PackyCode",
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
      "pi",
      "codex",
      "grok-build",
      "gemini",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://www.packyapi.ai/v1",
        "selectedVariantSlug": "packycode-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "packycode-openai",
            "baseUrl": "https://www.packyapi.ai/v1",
            "sourceApps": [
              "opencode"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "packycode-openai-packyapi",
            "baseUrl": "https://www.packyapi.ai",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://www.packyapi.ai/v1",
        "selectedVariantSlug": "packycode-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "packycode-responses",
            "baseUrl": "https://www.packyapi.ai/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://www.packyapi.ai",
        "selectedVariantSlug": "packycode-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "packycode-anthropic",
            "baseUrl": "https://www.packyapi.ai",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://www.packyapi.ai",
        "selectedVariantSlug": "packycode-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "packycode-gemini",
            "baseUrl": "https://www.packyapi.ai",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "packycode-openai",
      "packycode-openai-packyapi",
      "packycode-responses",
      "packycode-anthropic",
      "packycode-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://www.packyapi.ai/v1"
  },
  {
    "presetKey": "zetaapi",
    "slug": "zetaapi",
    "name": "ZetaAPI",
    "category": "aggregator",
    "logo": "/logos/zetaapi-icon.png",
    "websiteUrl": "https://zetaapi.ai",
    "consoleUrl": "https://zetaapi.ai/go/u117",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.zetaapi.ai/v1",
        "selectedVariantSlug": "zetaapi-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "contextWindow": 272000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "zetaapi-openai",
            "baseUrl": "https://api.zetaapi.ai/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.zetaapi.ai/v1",
        "selectedVariantSlug": "zetaapi-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "zetaapi-responses",
            "baseUrl": "https://api.zetaapi.ai/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.zetaapi.ai",
        "selectedVariantSlug": "zetaapi-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "zetaapi-anthropic",
            "baseUrl": "https://api.zetaapi.ai",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "zetaapi-openai",
      "zetaapi-responses",
      "zetaapi-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.zetaapi.ai/v1"
  },
  {
    "presetKey": "apinebula",
    "slug": "apinebula",
    "name": "APINebula",
    "category": "third_party",
    "logo": "/logos/apinebula_icon.png",
    "websiteUrl": "https://apinebula.ai",
    "consoleUrl": "https://apinebula.ai/VjM74M",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build",
      "gemini",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://apinebula.ai/v1",
        "selectedVariantSlug": "apinebula-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "contextWindow": 272000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "apinebula-openai",
            "baseUrl": "https://apinebula.ai/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://apinebula.ai/v1",
        "selectedVariantSlug": "apinebula-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "apinebula-responses",
            "baseUrl": "https://apinebula.ai/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://apinebula.ai",
        "selectedVariantSlug": "apinebula-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "apinebula-anthropic",
            "baseUrl": "https://apinebula.ai",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://apinebula.ai",
        "selectedVariantSlug": "apinebula-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "apinebula-gemini",
            "baseUrl": "https://apinebula.ai",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "apinebula-openai",
      "apinebula-responses",
      "apinebula-anthropic",
      "apinebula-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://apinebula.ai/v1"
  },
  {
    "presetKey": "aicodemirror",
    "slug": "aicodemirror",
    "name": "AICodeMirror",
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
      "pi",
      "codex",
      "grok-build",
      "gemini",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.aicodemirror.ai/api/claudecode",
        "selectedVariantSlug": "aicodemirror-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-haiku-4-5-20251001",
            "displayName": "Claude Haiku 4.5",
            "pricing": {
              "input": 1,
              "output": 5,
              "cacheRead": 0.1,
              "cacheWrite": 1.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "aicodemirror-openai",
            "baseUrl": "https://api.aicodemirror.ai/api/claudecode",
            "sourceApps": [
              "opencode",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.aicodemirror.ai/api/codex/backend-api/codex",
        "selectedVariantSlug": "aicodemirror-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "aicodemirror-responses",
            "baseUrl": "https://api.aicodemirror.ai/api/codex/backend-api/codex",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.aicodemirror.ai/api/claudecode",
        "selectedVariantSlug": "aicodemirror-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "aicodemirror-anthropic",
            "baseUrl": "https://api.aicodemirror.ai/api/claudecode",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://api.aicodemirror.ai/api/gemini",
        "selectedVariantSlug": "aicodemirror-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "aicodemirror-gemini",
            "baseUrl": "https://api.aicodemirror.ai/api/gemini",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "aicodemirror-openai",
      "aicodemirror-responses",
      "aicodemirror-anthropic",
      "aicodemirror-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.aicodemirror.ai/api/claudecode"
  },
  {
    "presetKey": "patewayai",
    "slug": "patewayai",
    "name": "PatewayAI",
    "category": "third_party",
    "logo": "/logos/pateway.jpg",
    "websiteUrl": "https://pateway.ai",
    "consoleUrl": "https://pateway.ai/?ch=etzpm8&aff=WB6M6F67#/",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"patewayai\"\nbase_url = \"https://api.pateway.ai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai-responses",
    "endpoints": [
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.pateway.ai/v1",
        "selectedVariantSlug": "patewayai-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "patewayai-responses",
            "baseUrl": "https://api.pateway.ai/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.pateway.ai",
        "selectedVariantSlug": "patewayai-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "patewayai-anthropic",
            "baseUrl": "https://api.pateway.ai",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "patewayai-responses",
      "patewayai-anthropic"
    ],
    "protocol": "openai-responses",
    "baseUrl": "https://api.pateway.ai/v1"
  },
  {
    "presetKey": "fennoai",
    "slug": "fennoai",
    "name": "FennoAI",
    "category": "aggregator",
    "logo": "/logos/fenno-icon.webp",
    "websiteUrl": "https://api.fenno.ai",
    "consoleUrl": "https://api.fenno.ai/register?redirect=/purchase?tab=subscription%26group=16&aff=P9MR3D3PLCNL",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.fenno.ai/v1",
        "selectedVariantSlug": "fennoai-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "contextWindow": 272000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "fennoai-openai",
            "baseUrl": "https://api.fenno.ai/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.fenno.ai",
        "selectedVariantSlug": "fennoai-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "fennoai-responses",
            "baseUrl": "https://api.fenno.ai",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.fenno.ai",
        "selectedVariantSlug": "fennoai-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "fennoai-anthropic",
            "baseUrl": "https://api.fenno.ai",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "fennoai-openai",
      "fennoai-responses",
      "fennoai-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.fenno.ai/v1"
  },
  {
    "presetKey": "runapi",
    "slug": "runapi",
    "name": "RunAPI",
    "category": "aggregator",
    "logo": "/logos/runapi.jpg",
    "websiteUrl": "https://runapi.host",
    "consoleUrl": "https://runapi.host/register?aff=iOKB",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "codex",
      "grok-build",
      "opencode",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://runapi.host",
        "selectedVariantSlug": "runapi-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-haiku-4-5",
            "displayName": "Claude Haiku 4.5"
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "runapi-openai",
            "baseUrl": "https://runapi.host",
            "sourceApps": [
              "opencode",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://runapi.host/v1",
        "selectedVariantSlug": "runapi-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "runapi-responses",
            "baseUrl": "https://runapi.host/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://runapi.host",
        "selectedVariantSlug": "runapi-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-haiku-4-5",
            "displayName": "Claude Haiku 4.5",
            "contextWindow": 200000
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "runapi-anthropic",
            "baseUrl": "https://runapi.host",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "openclaw"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "runapi-anthropic-runapi",
            "baseUrl": "https://runapi.co",
            "sourceApps": [
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "runapi-openai",
      "runapi-responses",
      "runapi-anthropic",
      "runapi-anthropic-runapi"
    ],
    "protocol": "openai",
    "baseUrl": "https://runapi.host"
  },
  {
    "presetKey": "shengsuanyun",
    "slug": "shengsuanyun",
    "name": "Shengsuanyun",
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
      "pi",
      "codex",
      "grok-build",
      "gemini",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://router.shengsuanyun.com/api/v1",
        "selectedVariantSlug": "shengsuanyun-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "anthropic/claude-opus-5",
            "displayName": "Claude Opus 5",
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "anthropic/claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "openai/gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "shengsuanyun-openai",
            "baseUrl": "https://router.shengsuanyun.com/api/v1",
            "sourceApps": [
              "opencode",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://router.shengsuanyun.com/api/v1",
        "selectedVariantSlug": "shengsuanyun-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "openai/gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "x-ai/grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "shengsuanyun-responses",
            "baseUrl": "https://router.shengsuanyun.com/api/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://router.shengsuanyun.com/api",
        "selectedVariantSlug": "shengsuanyun-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "anthropic/claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "anthropic/claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "shengsuanyun-anthropic",
            "baseUrl": "https://router.shengsuanyun.com/api",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://router.shengsuanyun.com/api",
        "selectedVariantSlug": "shengsuanyun-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "google/gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "shengsuanyun-gemini",
            "baseUrl": "https://router.shengsuanyun.com/api",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "shengsuanyun-openai",
      "shengsuanyun-responses",
      "shengsuanyun-anthropic",
      "shengsuanyun-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://router.shengsuanyun.com/api/v1"
  },
  {
    "presetKey": "aigocode",
    "slug": "aigocode",
    "name": "AIGoCode",
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
      "pi",
      "codex",
      "grok-build",
      "gemini",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.aigocode.app",
        "selectedVariantSlug": "aigocode-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-haiku-4-5-20251001",
            "displayName": "Claude Haiku 4.5",
            "pricing": {
              "input": 1,
              "output": 5,
              "cacheRead": 0.1,
              "cacheWrite": 1.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "aigocode-openai",
            "baseUrl": "https://api.aigocode.app",
            "sourceApps": [
              "opencode",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.aigocode.app",
        "selectedVariantSlug": "aigocode-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "aigocode-responses",
            "baseUrl": "https://api.aigocode.app",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.aigocode.app",
        "selectedVariantSlug": "aigocode-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "aigocode-anthropic",
            "baseUrl": "https://api.aigocode.app",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://api.aigocode.app",
        "selectedVariantSlug": "aigocode-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "aigocode-gemini",
            "baseUrl": "https://api.aigocode.app",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "aigocode-openai",
      "aigocode-responses",
      "aigocode-anthropic",
      "aigocode-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.aigocode.app"
  },
  {
    "presetKey": "qiniu",
    "slug": "qiniu",
    "name": "Qiniu",
    "category": "aggregator",
    "logo": "/logos/qiniu.png",
    "websiteUrl": "https://s.qiniu.com/nMvAvy",
    "consoleUrl": "https://s.qiniu.com/nMvAvy",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build",
      "gemini",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.qnaigc.com/v1",
        "selectedVariantSlug": "qiniu-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "contextWindow": 272000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "qiniu-openai",
            "baseUrl": "https://api.qnaigc.com/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.qnaigc.com/bypass/openai/v1",
        "selectedVariantSlug": "qiniu-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "qiniu-responses",
            "baseUrl": "https://api.qnaigc.com/bypass/openai/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.qnaigc.com",
        "selectedVariantSlug": "qiniu-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "qiniu-anthropic",
            "baseUrl": "https://api.qnaigc.com",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://api.qnaigc.com/bypass/vertex",
        "selectedVariantSlug": "qiniu-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "qiniu-gemini",
            "baseUrl": "https://api.qnaigc.com/bypass/vertex",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "qiniu-openai",
      "qiniu-responses",
      "qiniu-anthropic",
      "qiniu-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.qnaigc.com/v1"
  },
  {
    "presetKey": "aicoding",
    "slug": "aicoding",
    "name": "AICoding",
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
      "pi",
      "codex",
      "gemini",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.aicoding.inc",
        "selectedVariantSlug": "aicoding-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-haiku-4-5-20251001",
            "displayName": "Claude Haiku 4.5",
            "pricing": {
              "input": 1,
              "output": 5,
              "cacheRead": 0.1,
              "cacheWrite": 1.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "aicoding-openai",
            "baseUrl": "https://api.aicoding.inc",
            "sourceApps": [
              "opencode",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.aicoding.inc",
        "selectedVariantSlug": "aicoding-responses",
        "sourceApps": [
          "codex"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "aicoding-responses",
            "baseUrl": "https://api.aicoding.inc",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.aicoding.inc",
        "selectedVariantSlug": "aicoding-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "aicoding-anthropic",
            "baseUrl": "https://api.aicoding.inc",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://api.aicoding.inc",
        "selectedVariantSlug": "aicoding-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "aicoding-gemini",
            "baseUrl": "https://api.aicoding.inc",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "aicoding-openai",
      "aicoding-responses",
      "aicoding-anthropic",
      "aicoding-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.aicoding.inc"
  },
  {
    "presetKey": "subrouter",
    "slug": "subrouter",
    "name": "SubRouter",
    "category": "aggregator",
    "logo": "/logos/subrouter.svg",
    "websiteUrl": "https://subrouter.ai",
    "consoleUrl": "https://subrouter.ai/register?aff=l3ri",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build",
      "gemini",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://subrouter.ai/v1",
        "selectedVariantSlug": "subrouter-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "contextWindow": 272000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "subrouter-openai",
            "baseUrl": "https://subrouter.ai/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://subrouter.ai/v1",
        "selectedVariantSlug": "subrouter-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "subrouter-responses",
            "baseUrl": "https://subrouter.ai/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://subrouter.ai",
        "selectedVariantSlug": "subrouter-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "subrouter-anthropic",
            "baseUrl": "https://subrouter.ai",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://subrouter.ai/v1beta",
        "selectedVariantSlug": "subrouter-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "subrouter-gemini",
            "baseUrl": "https://subrouter.ai/v1beta",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "subrouter-openai",
      "subrouter-responses",
      "subrouter-anthropic",
      "subrouter-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://subrouter.ai/v1"
  },
  {
    "presetKey": "apikey-fun",
    "slug": "apikey-fun",
    "name": "APIKEY.FUN",
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
      "pi",
      "codex",
      "grok-build",
      "gemini",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.apikey.fun/v1",
        "selectedVariantSlug": "apikey-fun-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-haiku-4-5",
            "displayName": "Claude Haiku 4.5"
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "apikey-fun-openai",
            "baseUrl": "https://api.apikey.fun/v1",
            "sourceApps": [
              "opencode"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "apikey-fun-openai-api",
            "baseUrl": "https://api.apikey.fun",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.apikey.fun/v1",
        "selectedVariantSlug": "apikey-fun-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "apikey-fun-responses",
            "baseUrl": "https://api.apikey.fun/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.apikey.fun",
        "selectedVariantSlug": "apikey-fun-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-haiku-4-5",
            "displayName": "Claude Haiku 4.5 (latest)",
            "contextWindow": 200000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 64000,
              "thinkingLevelMap": {}
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "apikey-fun-anthropic",
            "baseUrl": "https://api.apikey.fun",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://api.apikey.fun",
        "selectedVariantSlug": "apikey-fun-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "apikey-fun-gemini",
            "baseUrl": "https://api.apikey.fun",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "apikey-fun-openai",
      "apikey-fun-openai-api",
      "apikey-fun-responses",
      "apikey-fun-anthropic",
      "apikey-fun-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.apikey.fun/v1"
  },
  {
    "presetKey": "claudeapi",
    "slug": "claudeapi",
    "name": "ClaudeAPI",
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
      "env": {
        "ANTHROPIC_BASE_URL": "https://gw.apito.ai",
        "ANTHROPIC_AUTH_TOKEN": ""
      }
    },
    "defaultProtocol": "anthropic",
    "endpoints": [
      {
        "protocol": "anthropic",
        "baseUrl": "https://gw.apito.ai",
        "selectedVariantSlug": "claudeapi-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "claudeapi-anthropic",
            "baseUrl": "https://gw.apito.ai",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "claudeapi-anthropic"
    ],
    "protocol": "anthropic",
    "baseUrl": "https://gw.apito.ai"
  },
  {
    "presetKey": "code0",
    "slug": "code0",
    "name": "Code0",
    "category": "aggregator",
    "logo": "/logos/code0.png",
    "websiteUrl": "https://code0.ai",
    "consoleUrl": "https://code0.ai/agent/register/B2XHxGjGmRvqgznY",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build",
      "gemini",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://code0.ai/v1",
        "selectedVariantSlug": "code0-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "contextWindow": 272000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "code0-openai",
            "baseUrl": "https://code0.ai/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://code0.ai/v1",
        "selectedVariantSlug": "code0-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "code0-responses",
            "baseUrl": "https://code0.ai/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://code0.ai",
        "selectedVariantSlug": "code0-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "code0-anthropic",
            "baseUrl": "https://code0.ai",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://code0.ai",
        "selectedVariantSlug": "code0-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "code0-gemini",
            "baseUrl": "https://code0.ai",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "code0-openai",
      "code0-responses",
      "code0-anthropic",
      "code0-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://code0.ai/v1"
  },
  {
    "presetKey": "teamorouter",
    "slug": "teamorouter",
    "name": "TeamoRouter",
    "category": "aggregator",
    "logo": "/logos/TeamoRouter-icon-dark.png",
    "websiteUrl": "https://teamorouter.cn",
    "consoleUrl": "https://teamorouter.cn/?utm_source=cc_switch&utm_medium=referral&utm_campaign=ai_directory",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.teamorouter.cn/v1",
        "selectedVariantSlug": "teamorouter-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "contextWindow": 272000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "teamorouter-openai",
            "baseUrl": "https://api.teamorouter.cn/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.teamorouter.cn/v1",
        "selectedVariantSlug": "teamorouter-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "teamorouter-responses",
            "baseUrl": "https://api.teamorouter.cn/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.teamorouter.cn",
        "selectedVariantSlug": "teamorouter-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "teamorouter-anthropic",
            "baseUrl": "https://api.teamorouter.cn",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "teamorouter-openai",
      "teamorouter-responses",
      "teamorouter-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.teamorouter.cn/v1"
  },
  {
    "presetKey": "ppio-cc-switch",
    "slug": "ppio-cc-switch",
    "name": "PPIO",
    "category": "aggregator",
    "logo": "/logos/ppio.svg",
    "websiteUrl": "https://ppio.com",
    "consoleUrl": "https://ppio.com/activity/ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "hermes"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"deepseek/deepseek-v4-flash-0731\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"ppio\"\nbase_url = \"https://api.ppio.com/openai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.ppio.com/openai/v1",
        "selectedVariantSlug": "ppio-openai",
        "sourceApps": [
          "codex",
          "opencode",
          "openclaw",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "deepseek/deepseek-v4-flash-0731",
            "displayName": "Deepseek V4 Flash 0731",
            "contextWindow": 1048576,
            "pricing": {
              "input": 0.44,
              "output": 1.32,
              "cacheRead": 0.014,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "ppio-openai",
            "baseUrl": "https://api.ppio.com/openai/v1",
            "sourceApps": [
              "codex",
              "opencode",
              "openclaw",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.ppio.com/anthropic",
        "selectedVariantSlug": "ppio-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "ppio-anthropic",
            "baseUrl": "https://api.ppio.com/anthropic",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "ppio-openai",
      "ppio-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.ppio.com/openai/v1"
  },
  {
    "presetKey": "claudecn",
    "slug": "claudecn",
    "name": "ClaudeCN",
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
      "pi",
      "codex",
      "grok-build",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://claudecn.top",
        "selectedVariantSlug": "claudecn-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-haiku-4-5",
            "displayName": "Claude Haiku 4.5"
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "claudecn-openai",
            "baseUrl": "https://claudecn.top",
            "sourceApps": [
              "opencode",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://claudecn.top/v1",
        "selectedVariantSlug": "claudecn-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "claudecn-responses",
            "baseUrl": "https://claudecn.top/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://claudecn.top",
        "selectedVariantSlug": "claudecn-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-haiku-4-5",
            "displayName": "Claude Haiku 4.5 (latest)",
            "contextWindow": 200000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 64000,
              "thinkingLevelMap": {}
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "claudecn-anthropic",
            "baseUrl": "https://claudecn.top",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "claudecn-openai",
      "claudecn-responses",
      "claudecn-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://claudecn.top"
  },
  {
    "presetKey": "agent-plan",
    "slug": "agent-plan",
    "name": "火山 Agent Plan",
    "category": "cn_official",
    "logo": "/logos/huoshan.png",
    "websiteUrl": "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    "consoleUrl": "https://www.volcengine.com/activity/agentplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_source=OWO&utm_medium=devrel-1&utm_campaign=hw&utm_term=ccswitch&utm_content=hw",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://ark.cn-beijing.volces.com/api/plan/v3",
        "selectedVariantSlug": "agent-plan-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "ark-code-latest",
            "displayName": "Ark Code Latest",
            "contextWindow": 256000
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "agent-plan-openai",
            "baseUrl": "https://ark.cn-beijing.volces.com/api/plan/v3",
            "sourceApps": [
              "opencode",
              "openclaw"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "agent-plan-openai-ark",
            "baseUrl": "https://ark.cn-beijing.volces.com/api/plan",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://ark.cn-beijing.volces.com/api/plan/v3",
        "selectedVariantSlug": "agent-plan-responses",
        "sourceApps": [
          "codex"
        ],
        "knownModels": [
          {
            "id": "ark-code-latest",
            "displayName": "Ark Code Latest",
            "contextWindow": 256000,
            "reasoningLevels": [
              "low",
              "medium",
              "high"
            ]
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "agent-plan-responses",
            "baseUrl": "https://ark.cn-beijing.volces.com/api/plan/v3",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://ark.cn-beijing.volces.com/api/plan",
        "selectedVariantSlug": "agent-plan-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "agent-plan-anthropic",
            "baseUrl": "https://ark.cn-beijing.volces.com/api/plan",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "agent-plan-openai",
      "agent-plan-openai-ark",
      "agent-plan-responses",
      "agent-plan-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/plan/v3"
  },
  {
    "presetKey": "coding-plan",
    "slug": "coding-plan",
    "name": "火山 Coding Plan",
    "category": "cn_official",
    "logo": "/logos/huoshan.png",
    "websiteUrl": "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "consoleUrl": "https://www.volcengine.com/activity/codingplan?ac=MMAP8JTTCAQ2&rc=6J6FV5N2&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://ark.cn-beijing.volces.com/api/coding/v3",
        "selectedVariantSlug": "coding-plan-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "pi",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "ark-code-latest",
            "displayName": "Ark Code Latest",
            "contextWindow": 256000
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "coding-plan-openai",
            "baseUrl": "https://ark.cn-beijing.volces.com/api/coding/v3",
            "sourceApps": [
              "opencode",
              "openclaw"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "agentplan-openai",
            "baseUrl": "https://ark.cn-beijing.volces.com/api/coding/v3",
            "sourceApps": [
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "coding-plan-openai-ark",
            "baseUrl": "https://ark.cn-beijing.volces.com/api/coding",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://ark.cn-beijing.volces.com/api/coding/v3",
        "selectedVariantSlug": "coding-plan-responses",
        "sourceApps": [
          "codex"
        ],
        "knownModels": [
          {
            "id": "ark-code-latest",
            "displayName": "Ark Code Latest",
            "contextWindow": 256000,
            "reasoningLevels": [
              "low",
              "medium",
              "high"
            ]
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "coding-plan-responses",
            "baseUrl": "https://ark.cn-beijing.volces.com/api/coding/v3",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://ark.cn-beijing.volces.com/api/coding",
        "selectedVariantSlug": "coding-plan-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "coding-plan-anthropic",
            "baseUrl": "https://ark.cn-beijing.volces.com/api/coding",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "coding-plan-openai",
      "agentplan-openai",
      "coding-plan-openai-ark",
      "coding-plan-responses",
      "coding-plan-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/coding/v3"
  },
  {
    "presetKey": "byteplus",
    "slug": "byteplus",
    "name": "BytePlus",
    "category": "cn_official",
    "logo": "/logos/byteplus.png",
    "websiteUrl": "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "consoleUrl": "https://www.byteplus.com/en/product/modelark?utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "pi",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://ark.ap-southeast.bytepluses.com/api/coding/v3",
        "selectedVariantSlug": "byteplus-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "pi",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "ark-code-latest",
            "displayName": "Ark Code Latest",
            "contextWindow": 128000,
            "capabilities": {
              "reasoning": false,
              "input": [
                "text"
              ],
              "maxTokens": 16384
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "byteplus-openai",
            "baseUrl": "https://ark.ap-southeast.bytepluses.com/api/coding/v3",
            "sourceApps": [
              "opencode",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "byteplus-openai-ark",
            "baseUrl": "https://ark.ap-southeast.bytepluses.com/api/coding",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://ark.ap-southeast.bytepluses.com/api/coding/v3",
        "selectedVariantSlug": "byteplus-responses",
        "sourceApps": [
          "codex"
        ],
        "knownModels": [
          {
            "id": "ark-code-latest",
            "displayName": "Ark Code Latest",
            "contextWindow": 256000,
            "reasoningLevels": [
              "low",
              "medium",
              "high"
            ]
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "byteplus-responses",
            "baseUrl": "https://ark.ap-southeast.bytepluses.com/api/coding/v3",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://ark.ap-southeast.bytepluses.com/api/coding",
        "selectedVariantSlug": "byteplus-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "byteplus-anthropic",
            "baseUrl": "https://ark.ap-southeast.bytepluses.com/api/coding",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "byteplus-openai",
      "byteplus-openai-ark",
      "byteplus-responses",
      "byteplus-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://ark.ap-southeast.bytepluses.com/api/coding/v3"
  },
  {
    "presetKey": "doubaoseed",
    "slug": "doubaoseed",
    "name": "DouBaoSeed",
    "category": "cn_official",
    "logo": "/logos/doubao.svg",
    "websiteUrl": "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "consoleUrl": "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey?apikey=%7B%7D&utm_campaign=hw&utm_content=ccswitch&utm_medium=devrel_tool_web&utm_source=OWO&utm_term=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "pi",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
        "selectedVariantSlug": "doubaoseed-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "pi",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "doubao-seed-2-1-pro-260628",
            "displayName": "Doubao Seed 2.1 Pro",
            "contextWindow": 128000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 16384,
              "thinkingLevelMap": {}
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "doubaoseed-openai",
            "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
            "sourceApps": [
              "opencode",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "doubaoseed-openai-ark",
            "baseUrl": "https://ark.cn-beijing.volces.com/api/compatible",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
        "selectedVariantSlug": "doubaoseed-responses",
        "sourceApps": [
          "codex"
        ],
        "knownModels": [
          {
            "id": "doubao-seed-2-1-pro-260628",
            "displayName": "Doubao Seed 2.1 Pro",
            "contextWindow": 262144,
            "reasoningLevels": [
              "minimal",
              "low",
              "medium",
              "high"
            ]
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "doubaoseed-responses",
            "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://ark.cn-beijing.volces.com/api/compatible",
        "selectedVariantSlug": "doubaoseed-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "doubaoseed-anthropic",
            "baseUrl": "https://ark.cn-beijing.volces.com/api/compatible",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "doubaoseed-openai",
      "doubaoseed-openai-ark",
      "doubaoseed-responses",
      "doubaoseed-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://ark.cn-beijing.volces.com/api/v3"
  },
  {
    "presetKey": "siliconflow",
    "slug": "siliconflow",
    "name": "SiliconFlow",
    "category": "aggregator",
    "logo": "/logos/siliconflow.svg",
    "websiteUrl": "https://siliconflow.cn",
    "consoleUrl": "https://cloud.siliconflow.cn/i/YflgU2Ve",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "openclaw",
      "hermes"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"Pro/MiniMaxAI/MiniMax-M2.5\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"siliconflow\"\nbase_url = \"https://api.siliconflow.cn/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.siliconflow.cn/v1",
        "selectedVariantSlug": "siliconflow-openai",
        "sourceApps": [
          "codex",
          "openclaw",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "Pro/MiniMaxAI/MiniMax-M2.5",
            "displayName": "Pro / MiniMax M2.5",
            "pricing": {
              "input": 0.15,
              "output": 0.95,
              "cacheRead": 0.03,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "siliconflow-openai",
            "baseUrl": "https://api.siliconflow.cn/v1",
            "sourceApps": [
              "codex",
              "openclaw",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.siliconflow.cn",
        "selectedVariantSlug": "siliconflow-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "siliconflow-anthropic",
            "baseUrl": "https://api.siliconflow.cn",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "siliconflow-openai",
      "siliconflow-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.siliconflow.cn/v1"
  },
  {
    "presetKey": "siliconflow-en",
    "slug": "siliconflow-en",
    "name": "SiliconFlow en",
    "category": "aggregator",
    "logo": "/logos/siliconflow.svg",
    "websiteUrl": "https://siliconflow.com",
    "consoleUrl": "https://cloud.siliconflow.cn/i/YflgU2Ve",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "openclaw",
      "hermes"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"MiniMaxAI/MiniMax-M3\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"siliconflow_en\"\nbase_url = \"https://api.siliconflow.com/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.siliconflow.com/v1",
        "selectedVariantSlug": "siliconflow-en-openai",
        "sourceApps": [
          "codex",
          "openclaw",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "MiniMaxAI/MiniMax-M3",
            "displayName": "MiniMax M3",
            "pricing": {
              "input": 0.3,
              "output": 1.2,
              "cacheRead": 0.06,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "siliconflow-en-openai",
            "baseUrl": "https://api.siliconflow.com/v1",
            "sourceApps": [
              "codex",
              "openclaw",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.siliconflow.com",
        "selectedVariantSlug": "siliconflow-en-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "siliconflow-en-anthropic",
            "baseUrl": "https://api.siliconflow.com",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "siliconflow-en-openai",
      "siliconflow-en-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.siliconflow.com/v1"
  },
  {
    "presetKey": "a6api",
    "slug": "a6api",
    "name": "A6API",
    "category": "aggregator",
    "logo": "/logos/a6-icon.png",
    "websiteUrl": "https://www.a6api.com",
    "consoleUrl": "https://a6api.com/register?aff=AqNr",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build",
      "gemini",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.a6api.com/v1",
        "selectedVariantSlug": "a6api-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "contextWindow": 272000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "a6api-openai",
            "baseUrl": "https://api.a6api.com/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.a6api.com/v1",
        "selectedVariantSlug": "a6api-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "a6api-responses",
            "baseUrl": "https://api.a6api.com/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.a6api.com",
        "selectedVariantSlug": "a6api-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "a6api-anthropic",
            "baseUrl": "https://api.a6api.com",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://api.a6api.com",
        "selectedVariantSlug": "a6api-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "a6api-gemini",
            "baseUrl": "https://api.a6api.com",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "a6api-openai",
      "a6api-responses",
      "a6api-anthropic",
      "a6api-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.a6api.com/v1"
  },
  {
    "presetKey": "atlascloud",
    "slug": "atlascloud",
    "name": "AtlasCloud",
    "category": "aggregator",
    "logo": "/logos/atlascloud_icon.png",
    "websiteUrl": "https://www.atlascloud.ai/console/coding-plan",
    "consoleUrl": "https://www.atlascloud.ai/console/coding-plan",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"zai-org/glm-5.1\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"AtlasCloud\"\nbase_url = \"https://api.atlascloud.ai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.atlascloud.ai/v1",
        "selectedVariantSlug": "atlascloud-openai",
        "sourceApps": [
          "codex",
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "zai-org/glm-5.1",
            "displayName": "GLM 5.1",
            "contextWindow": 200000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 131072,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 1.4,
              "output": 4.4,
              "cacheRead": 0.26,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "atlascloud-openai",
            "baseUrl": "https://api.atlascloud.ai/v1",
            "sourceApps": [
              "codex",
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.atlascloud.ai",
        "selectedVariantSlug": "atlascloud-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "atlascloud-anthropic",
            "baseUrl": "https://api.atlascloud.ai",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "atlascloud-openai",
      "atlascloud-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.atlascloud.ai/v1"
  },
  {
    "presetKey": "compshare",
    "slug": "compshare",
    "name": "Compshare",
    "category": "aggregator",
    "logo": "/logos/ucloud.svg",
    "websiteUrl": "https://www.compshare.cn",
    "consoleUrl": "https://www.compshare.cn/coding-plan?ytag=GPU_YY_YX_git_cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build",
      "openclaw",
      "hermes"
    ],
    "extra": {
      "suggestedDefaults": {
        "model": {
          "default": "gpt-5.6-sol",
          "provider": "compshare"
        }
      }
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.modelverse.cn/v1",
        "selectedVariantSlug": "compshare-openai",
        "sourceApps": [
          "hermes"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "compshare-openai",
            "baseUrl": "https://api.modelverse.cn/v1",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.modelverse.cn/v1",
        "selectedVariantSlug": "compshare-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "compshare-responses",
            "baseUrl": "https://api.modelverse.cn/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.modelverse.cn",
        "selectedVariantSlug": "compshare-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "compshare-anthropic",
            "baseUrl": "https://api.modelverse.cn",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "compshare-anthropic-api",
            "baseUrl": "https://api.modelverse.cn/v1",
            "sourceApps": [
              "openclaw"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "compshare-openai",
      "compshare-responses",
      "compshare-anthropic",
      "compshare-anthropic-api"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.modelverse.cn/v1"
  },
  {
    "presetKey": "compshare-coding-plan",
    "slug": "compshare-coding-plan",
    "name": "Compshare Coding Plan",
    "category": "aggregator",
    "logo": "/logos/ucloud.svg",
    "websiteUrl": "https://www.compshare.cn",
    "consoleUrl": "https://www.compshare.cn/coding-plan?ytag=GPU_YY_YX_git_cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build",
      "openclaw",
      "hermes"
    ],
    "extra": {
      "suggestedDefaults": {
        "model": {
          "default": "gpt-5.6-sol",
          "provider": "compshare_coding"
        }
      }
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://cp.compshare.cn/v1",
        "selectedVariantSlug": "compshare-coding-plan-openai",
        "sourceApps": [
          "hermes"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "compshare-coding-plan-openai",
            "baseUrl": "https://cp.compshare.cn/v1",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://cp.compshare.cn/v1",
        "selectedVariantSlug": "compshare-coding-plan-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "compshare-coding-plan-responses",
            "baseUrl": "https://cp.compshare.cn/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://cp.compshare.cn",
        "selectedVariantSlug": "compshare-coding-plan-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "compshare-coding-plan-anthropic",
            "baseUrl": "https://cp.compshare.cn",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "compshare-coding-plan-anthropic-cp",
            "baseUrl": "https://cp.compshare.cn/v1",
            "sourceApps": [
              "openclaw"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "compshare-coding-plan-openai",
      "compshare-coding-plan-responses",
      "compshare-coding-plan-anthropic",
      "compshare-coding-plan-anthropic-cp"
    ],
    "protocol": "openai",
    "baseUrl": "https://cp.compshare.cn/v1"
  },
  {
    "presetKey": "ccsub",
    "slug": "ccsub",
    "name": "CCSub",
    "category": "aggregator",
    "logo": "/logos/ccsub.svg",
    "websiteUrl": "https://www.ccsub.net",
    "consoleUrl": "https://www.ccsub.net/register?ref=Y6Z8DXEA",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://www.ccsub.net/v1",
        "selectedVariantSlug": "ccsub-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "contextWindow": 272000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "ccsub-openai",
            "baseUrl": "https://www.ccsub.net/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://www.ccsub.net/v1",
        "selectedVariantSlug": "ccsub-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "ccsub-responses",
            "baseUrl": "https://www.ccsub.net/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://www.ccsub.net",
        "selectedVariantSlug": "ccsub-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "ccsub-anthropic",
            "baseUrl": "https://www.ccsub.net",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "ccsub-openai",
      "ccsub-responses",
      "ccsub-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://www.ccsub.net/v1"
  },
  {
    "presetKey": "sssaicode",
    "slug": "sssaicode",
    "name": "SSSAiCode",
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
      "pi",
      "codex",
      "grok-build",
      "gemini",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://node-hk.sssaicodeapi.com/api/v1",
        "selectedVariantSlug": "sssaicode-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "sssaicode-openai",
            "baseUrl": "https://node-hk.sssaicodeapi.com/api/v1",
            "sourceApps": [
              "opencode"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "sssaicode-openai-node-hk",
            "baseUrl": "https://node-hk.sssaicodeapi.com/api",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://node-hk.sssaicodeapi.com/api/v1",
        "selectedVariantSlug": "sssaicode-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "sssaicode-responses",
            "baseUrl": "https://node-hk.sssaicodeapi.com/api/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://node-hk.sssaicodeapi.com/api",
        "selectedVariantSlug": "sssaicode-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "sssaicode-anthropic",
            "baseUrl": "https://node-hk.sssaicodeapi.com/api",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://node-hk.sssaicodeapi.com/api",
        "selectedVariantSlug": "sssaicode-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "sssaicode-gemini",
            "baseUrl": "https://node-hk.sssaicodeapi.com/api",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "sssaicode-openai",
      "sssaicode-openai-node-hk",
      "sssaicode-responses",
      "sssaicode-anthropic",
      "sssaicode-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://node-hk.sssaicodeapi.com/api/v1"
  },
  {
    "presetKey": "micu",
    "slug": "micu",
    "name": "Micu",
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
      "pi",
      "codex",
      "grok-build",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://www.micuapi.ai/v1",
        "selectedVariantSlug": "micu-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "micu-openai",
            "baseUrl": "https://www.micuapi.ai/v1",
            "sourceApps": [
              "opencode"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "micu-openai-micuapi",
            "baseUrl": "https://www.micuapi.ai",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://www.micuapi.ai/v1",
        "selectedVariantSlug": "micu-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "micu-responses",
            "baseUrl": "https://www.micuapi.ai/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://www.micuapi.ai",
        "selectedVariantSlug": "micu-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "micu-anthropic",
            "baseUrl": "https://www.micuapi.ai",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "micu-openai",
      "micu-openai-micuapi",
      "micu-responses",
      "micu-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://www.micuapi.ai/v1"
  },
  {
    "presetKey": "rightcode",
    "slug": "rightcode",
    "name": "RightCode",
    "category": "third_party",
    "logo": "/logos/rc.svg",
    "websiteUrl": "https://www.rightapi.ai",
    "consoleUrl": "https://www.rightapi.ai/register?aff=CCSWITCH",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "codex",
      "grok-build",
      "pi",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://www.rightapi.ai/codex/v1",
        "selectedVariantSlug": "rightcode-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "rightcode-openai",
            "baseUrl": "https://www.rightapi.ai/codex/v1",
            "sourceApps": [
              "opencode"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "rightcode-openai-rightapi",
            "baseUrl": "https://www.rightapi.ai/claude",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://www.rightapi.ai/codex/v1",
        "selectedVariantSlug": "rightcode-responses",
        "sourceApps": [
          "codex",
          "grok-build",
          "pi"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "contextWindow": 272000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "off": "none",
                "minimal": null,
                "low": "low",
                "medium": "medium",
                "high": "high",
                "xhigh": "xhigh",
                "max": "max"
              }
            },
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "rightcode-responses",
            "baseUrl": "https://www.rightapi.ai/codex/v1",
            "sourceApps": [
              "codex",
              "grok-build",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://www.rightapi.ai/claude",
        "selectedVariantSlug": "rightcode-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "rightcode-anthropic",
            "baseUrl": "https://www.rightapi.ai/claude",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "openclaw"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "rightcode-openai",
      "rightcode-openai-rightapi",
      "rightcode-responses",
      "rightcode-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://www.rightapi.ai/codex/v1"
  },
  {
    "presetKey": "etok-ai",
    "slug": "etok-ai",
    "name": "ETok.ai",
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
      "pi",
      "codex",
      "grok-build",
      "gemini",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.etok.ai/v1",
        "selectedVariantSlug": "etok-ai-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "etok-ai-openai",
            "baseUrl": "https://api.etok.ai/v1",
            "sourceApps": [
              "opencode"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "etok-ai-openai-api",
            "baseUrl": "https://api.etok.ai",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.etok.ai/v1",
        "selectedVariantSlug": "etok-ai-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "etok-ai-responses",
            "baseUrl": "https://api.etok.ai/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.etok.ai",
        "selectedVariantSlug": "etok-ai-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "etok-ai-anthropic",
            "baseUrl": "https://api.etok.ai",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://api.etok.ai/v1beta",
        "selectedVariantSlug": "etok-ai-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "etok-ai-gemini",
            "baseUrl": "https://api.etok.ai/v1beta",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "etok-ai-openai",
      "etok-ai-openai-api",
      "etok-ai-responses",
      "etok-ai-anthropic",
      "etok-ai-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.etok.ai/v1"
  },
  {
    "presetKey": "cubence",
    "slug": "cubence",
    "name": "Cubence",
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
      "pi",
      "codex",
      "grok-build",
      "gemini",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.cubence.com/v1",
        "selectedVariantSlug": "cubence-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "cubence-openai",
            "baseUrl": "https://api.cubence.com/v1",
            "sourceApps": [
              "opencode"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "cubence-openai-api",
            "baseUrl": "https://api.cubence.com",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.cubence.com/v1",
        "selectedVariantSlug": "cubence-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "cubence-responses",
            "baseUrl": "https://api.cubence.com/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.cubence.com",
        "selectedVariantSlug": "cubence-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "cubence-anthropic",
            "baseUrl": "https://api.cubence.com",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://api.cubence.com",
        "selectedVariantSlug": "cubence-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "cubence-gemini",
            "baseUrl": "https://api.cubence.com",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "cubence-openai",
      "cubence-openai-api",
      "cubence-responses",
      "cubence-anthropic",
      "cubence-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.cubence.com/v1"
  },
  {
    "presetKey": "crazyrouter",
    "slug": "crazyrouter",
    "name": "CrazyRouter",
    "category": "third_party",
    "logo": "/logos/crazyrouter.svg",
    "websiteUrl": "https://www.crazyrouter.com",
    "consoleUrl": "https://www.crazyrouter.com/register?aff=OZcm&ref=cc-switch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "pi",
      "codex",
      "grok-build",
      "gemini",
      "opencode",
      "hermes",
      "openclaw"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://cn.crazyrouter.com",
        "selectedVariantSlug": "crazyrouter-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-haiku-4-5-20251001",
            "displayName": "Claude Haiku 4.5",
            "pricing": {
              "input": 1,
              "output": 5,
              "cacheRead": 0.1,
              "cacheWrite": 1.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "crazyrouter-openai",
            "baseUrl": "https://cn.crazyrouter.com",
            "sourceApps": [
              "opencode",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://cn.crazyrouter.com/v1",
        "selectedVariantSlug": "crazyrouter-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "crazyrouter-responses",
            "baseUrl": "https://cn.crazyrouter.com/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://cn.crazyrouter.com",
        "selectedVariantSlug": "crazyrouter-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "pi",
          "openclaw"
        ],
        "knownModels": [
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "crazyrouter-anthropic",
            "baseUrl": "https://cn.crazyrouter.com",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "crazyrouter-anthropic-cn",
            "baseUrl": "https://cn.crazyrouter.com/v1",
            "sourceApps": [
              "openclaw"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://cn.crazyrouter.com",
        "selectedVariantSlug": "crazyrouter-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "crazyrouter-gemini",
            "baseUrl": "https://cn.crazyrouter.com",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "crazyrouter-openai",
      "crazyrouter-responses",
      "crazyrouter-anthropic",
      "crazyrouter-anthropic-cn",
      "crazyrouter-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://cn.crazyrouter.com"
  },
  {
    "presetKey": "dmxapi",
    "slug": "dmxapi",
    "name": "DMXAPI",
    "category": "aggregator",
    "websiteUrl": "https://www.dmxapi.cn",
    "consoleUrl": "https://www.dmxapi.cn",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "pi",
      "codex",
      "grok-build",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://www.dmxapi.cn/v1",
        "selectedVariantSlug": "dmxapi-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "dmxapi-openai",
            "baseUrl": "https://www.dmxapi.cn/v1",
            "sourceApps": [
              "opencode",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://www.dmxapi.cn/v1",
        "selectedVariantSlug": "dmxapi-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "dmxapi-responses",
            "baseUrl": "https://www.dmxapi.cn/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://www.dmxapi.cn",
        "selectedVariantSlug": "dmxapi-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "dmxapi-anthropic",
            "baseUrl": "https://www.dmxapi.cn",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "dmxapi-openai",
      "dmxapi-responses",
      "dmxapi-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://www.dmxapi.cn/v1"
  },
  {
    "presetKey": "sudocode-chat",
    "slug": "sudocode-chat",
    "name": "SudoCode.chat",
    "category": "third_party",
    "logo": "/logos/sudocode.png",
    "websiteUrl": "https://sudocode.chat",
    "consoleUrl": "https://sudocode.chat/sign-up?aff=CC-SWITCH&utm_source=cc-switch&utm_medium=sponsor&utm_campaign=ccswitch",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build",
      "openclaw",
      "pi",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.sudocode.chat/v1",
        "selectedVariantSlug": "sudocode-chat-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "sudocode-chat-openai",
            "baseUrl": "https://api.sudocode.chat/v1",
            "sourceApps": [
              "opencode",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.sudocode.chat/v1",
        "selectedVariantSlug": "sudocode-chat-responses",
        "sourceApps": [
          "codex",
          "grok-build",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "contextWindow": 272000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "off": "none",
                "minimal": null,
                "low": "low",
                "medium": "medium",
                "high": "high",
                "xhigh": "xhigh",
                "max": "max"
              }
            },
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "sudocode-chat-responses",
            "baseUrl": "https://api.sudocode.chat/v1",
            "sourceApps": [
              "codex",
              "grok-build",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.sudocode.chat",
        "selectedVariantSlug": "sudocode-chat-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "sudocode-chat-anthropic",
            "baseUrl": "https://api.sudocode.chat",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "sudocode-chat-openai",
      "sudocode-chat-responses",
      "sudocode-chat-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.sudocode.chat/v1"
  },
  {
    "presetKey": "sudocode-us",
    "slug": "sudocode-us",
    "name": "SudoCode.us",
    "category": "third_party",
    "logo": "/logos/sudocode-us.png",
    "websiteUrl": "https://sudocode.us",
    "consoleUrl": "https://sudocode.us",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build",
      "openclaw",
      "pi",
      "gemini",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://sudocode.us/v1",
        "selectedVariantSlug": "sudocode-us-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "sudocode-us-openai",
            "baseUrl": "https://sudocode.us/v1",
            "sourceApps": [
              "opencode",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://sudocode.us/v1",
        "selectedVariantSlug": "sudocode-us-responses",
        "sourceApps": [
          "codex",
          "grok-build",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "contextWindow": 272000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "off": "none",
                "minimal": null,
                "low": "low",
                "medium": "medium",
                "high": "high",
                "xhigh": "xhigh",
                "max": "max"
              }
            },
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "sudocode-us-responses",
            "baseUrl": "https://sudocode.us/v1",
            "sourceApps": [
              "codex",
              "grok-build",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://sudocode.us",
        "selectedVariantSlug": "sudocode-us-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "sudocode-us-anthropic",
            "baseUrl": "https://sudocode.us",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://sudocode.us",
        "selectedVariantSlug": "sudocode-us-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.1-flash-lite",
            "pricing": {
              "input": 0.25,
              "output": 1.5,
              "cacheRead": 0.025,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "sudocode-us-gemini",
            "baseUrl": "https://sudocode.us",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "sudocode-us-openai",
      "sudocode-us-responses",
      "sudocode-us-anthropic",
      "sudocode-us-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://sudocode.us/v1"
  },
  {
    "presetKey": "xycai",
    "slug": "xycai",
    "name": "XycAi",
    "category": "aggregator",
    "logo": "/logos/xycai-icon.png",
    "websiteUrl": "https://xycai.us",
    "consoleUrl": "https://xycai.us/register?aff=Uhu9",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "gemini",
      "opencode",
      "openclaw",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://apicdn.xycai.us/v1",
        "selectedVariantSlug": "xycai-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "xycai-openai",
            "baseUrl": "https://apicdn.xycai.us/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://apicdn.xycai.us/v1",
        "selectedVariantSlug": "xycai-responses",
        "sourceApps": [
          "codex"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "xycai-responses",
            "baseUrl": "https://apicdn.xycai.us/v1",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://apicdn.xycai.us",
        "selectedVariantSlug": "xycai-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "xycai-anthropic",
            "baseUrl": "https://apicdn.xycai.us",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://apicdn.xycai.us",
        "selectedVariantSlug": "xycai-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "xycai-gemini",
            "baseUrl": "https://apicdn.xycai.us",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "xycai-openai",
      "xycai-responses",
      "xycai-anthropic",
      "xycai-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://apicdn.xycai.us/v1"
  },
  {
    "presetKey": "amux",
    "slug": "amux",
    "name": "Amux",
    "category": "aggregator",
    "logo": "/logos/amuxapi-icon.svg",
    "websiteUrl": "https://amux.ai",
    "consoleUrl": "https://amux.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.amux.ai/v1",
        "selectedVariantSlug": "amux-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "contextWindow": 272000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "amux-openai",
            "baseUrl": "https://api.amux.ai/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.amux.ai/v1",
        "selectedVariantSlug": "amux-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "amux-responses",
            "baseUrl": "https://api.amux.ai/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.amux.ai",
        "selectedVariantSlug": "amux-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "amux-anthropic",
            "baseUrl": "https://api.amux.ai",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "amux-openai",
      "amux-responses",
      "amux-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.amux.ai/v1"
  },
  {
    "presetKey": "gemini-native",
    "slug": "gemini-native",
    "name": "Gemini Native",
    "category": "official",
    "logo": "/logos/gemini.svg",
    "websiteUrl": "https://ai.google.dev/",
    "consoleUrl": "https://aistudio.google.com/apikey",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "gemini"
    ],
    "extra": {
      "env": {}
    },
    "defaultProtocol": "gemini",
    "endpoints": [
      {
        "protocol": "gemini",
        "baseUrl": "https://generativelanguage.googleapis.com",
        "selectedVariantSlug": "google-official-gemini",
        "sourceApps": [
          "gemini",
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "google-official-gemini",
            "baseUrl": "https://generativelanguage.googleapis.com",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "gemini-native-gemini",
            "baseUrl": "https://generativelanguage.googleapis.com",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "google-official-gemini",
      "gemini-native-gemini"
    ],
    "protocol": "gemini",
    "baseUrl": "https://generativelanguage.googleapis.com"
  },
  {
    "presetKey": "deepseek",
    "slug": "deepseek",
    "name": "DeepSeek",
    "category": "cn_official",
    "logo": "/logos/deepseek.svg",
    "websiteUrl": "https://platform.deepseek.com",
    "consoleUrl": "https://platform.deepseek.com/api_keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "pi",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.deepseek.com/v1",
        "selectedVariantSlug": "deepseek-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "pi",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "deepseek-v4-pro",
            "displayName": "DeepSeek V4 Pro",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 384000,
              "thinkingLevelMap": {
                "minimal": null,
                "low": null,
                "medium": null,
                "high": "high",
                "max": "max"
              }
            },
            "pricing": {
              "input": 1.32,
              "output": 3.96,
              "cacheRead": 0.044,
              "cacheWrite": 0
            }
          },
          {
            "id": "deepseek-v4-flash",
            "displayName": "DeepSeek V4 Flash",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 384000,
              "thinkingLevelMap": {
                "minimal": null,
                "low": null,
                "medium": null,
                "high": "high",
                "max": "max"
              }
            },
            "pricing": {
              "input": 0.44,
              "output": 1.32,
              "cacheRead": 0.014,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "deepseek-openai",
            "baseUrl": "https://api.deepseek.com/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "deepseek-openai-api",
            "baseUrl": "https://api.deepseek.com",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.deepseek.com",
        "selectedVariantSlug": "deepseek-responses",
        "sourceApps": [
          "codex"
        ],
        "knownModels": [
          {
            "id": "deepseek-v4-flash",
            "displayName": "DeepSeek V4 Flash",
            "contextWindow": 1048576,
            "reasoningLevels": [
              "low",
              "high",
              "max"
            ],
            "pricing": {
              "input": 0.44,
              "output": 1.32,
              "cacheRead": 0.014,
              "cacheWrite": 0
            }
          },
          {
            "id": "deepseek-v4-pro",
            "displayName": "DeepSeek V4 Pro",
            "contextWindow": 1048576,
            "reasoningLevels": [
              "low",
              "high",
              "max"
            ],
            "pricing": {
              "input": 1.32,
              "output": 3.96,
              "cacheRead": 0.044,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "deepseek-responses",
            "baseUrl": "https://api.deepseek.com",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.deepseek.com/anthropic",
        "selectedVariantSlug": "deepseek-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "deepseek-anthropic",
            "baseUrl": "https://api.deepseek.com/anthropic",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "deepseek-openai",
      "deepseek-openai-api",
      "deepseek-responses",
      "deepseek-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.deepseek.com/v1"
  },
  {
    "presetKey": "opencode-go",
    "slug": "opencode-go",
    "name": "OpenCode Go",
    "category": "third_party",
    "websiteUrl": "https://opencode.ai/go",
    "consoleUrl": "https://opencode.ai/go?ref=2YTRG2NGTX",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "pi"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"glm-5.2\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"opencode_go\"\nbase_url = \"https://opencode.ai/zen/go/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://opencode.ai/zen/go/v1",
        "selectedVariantSlug": "opencode-go-openai",
        "sourceApps": [
          "codex",
          "opencode",
          "pi"
        ],
        "knownModels": [
          {
            "id": "glm-5.2",
            "displayName": "GLM 5.2",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 131072,
              "compat": {
                "supportsStore": false,
                "supportsDeveloperRole": false,
                "maxTokensField": "max_tokens"
              },
              "thinkingLevelMap": {
                "off": null,
                "minimal": null,
                "low": null,
                "medium": null,
                "high": "high",
                "xhigh": null,
                "max": "max"
              }
            },
            "pricing": {
              "input": 1.4,
              "output": 4.4,
              "cacheRead": 0.26,
              "cacheWrite": 0
            }
          },
          {
            "id": "glm-5.1",
            "displayName": "GLM 5.1",
            "contextWindow": 204800,
            "pricing": {
              "input": 1.4,
              "output": 4.4,
              "cacheRead": 0.26,
              "cacheWrite": 0
            }
          },
          {
            "id": "kimi-k2.7-code",
            "displayName": "Kimi K2.7 Code",
            "contextWindow": 262144,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 262144,
              "compat": {
                "supportsStore": false,
                "supportsDeveloperRole": false,
                "maxTokensField": "max_tokens"
              },
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 0.95,
              "output": 4,
              "cacheRead": 0.19,
              "cacheWrite": 0
            }
          },
          {
            "id": "deepseek-v4-pro",
            "displayName": "DeepSeek V4 Pro",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 384000,
              "compat": {
                "supportsStore": false,
                "supportsDeveloperRole": false,
                "maxTokensField": "max_tokens",
                "requiresReasoningContentOnAssistantMessages": true,
                "thinkingFormat": "deepseek"
              },
              "thinkingLevelMap": {
                "minimal": null,
                "low": null,
                "medium": null,
                "high": "high",
                "max": "max"
              }
            },
            "pricing": {
              "input": 1.32,
              "output": 3.96,
              "cacheRead": 0.044,
              "cacheWrite": 0
            }
          },
          {
            "id": "deepseek-v4-flash",
            "displayName": "DeepSeek V4 Flash",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 384000,
              "compat": {
                "supportsStore": false,
                "supportsDeveloperRole": false,
                "maxTokensField": "max_tokens",
                "requiresReasoningContentOnAssistantMessages": true,
                "thinkingFormat": "deepseek"
              },
              "thinkingLevelMap": {
                "minimal": null,
                "low": null,
                "medium": null,
                "high": "high",
                "max": "max"
              }
            },
            "pricing": {
              "input": 0.44,
              "output": 1.32,
              "cacheRead": 0.014,
              "cacheWrite": 0
            }
          },
          {
            "id": "mimo-v2.5-pro",
            "displayName": "MiMo-V2.5-Pro",
            "contextWindow": 1048576,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 131072,
              "compat": {
                "supportsStore": false,
                "supportsDeveloperRole": false,
                "maxTokensField": "max_tokens"
              },
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 0.435,
              "output": 0.87,
              "cacheRead": 0.0036,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "opencode-go-openai",
            "baseUrl": "https://opencode.ai/zen/go/v1",
            "sourceApps": [
              "codex",
              "opencode",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://opencode.ai/zen/go",
        "selectedVariantSlug": "opencode-go-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "opencode-go-anthropic",
            "baseUrl": "https://opencode.ai/zen/go",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "opencode-go-openai",
      "opencode-go-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://opencode.ai/zen/go/v1"
  },
  {
    "presetKey": "zhipu-glm",
    "slug": "zhipu-glm",
    "name": "Zhipu GLM",
    "category": "cn_official",
    "logo": "/logos/zhipu.svg",
    "websiteUrl": "https://open.bigmodel.cn",
    "consoleUrl": "https://www.bigmodel.cn/claude-code?ic=RRVJPB5SII",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"glm-5.2\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"zhipu_glm\"\nbase_url = \"https://open.bigmodel.cn/api/coding/paas/v4\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://open.bigmodel.cn/api/coding/paas/v4",
        "selectedVariantSlug": "zhipu-glm-openai",
        "sourceApps": [
          "codex",
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "glm-5.2",
            "displayName": "GLM-5.2",
            "contextWindow": 200000,
            "reasoningLevels": [
              "none",
              "high"
            ],
            "pricing": {
              "input": 1.4,
              "output": 4.4,
              "cacheRead": 0.26,
              "cacheWrite": 0
            }
          },
          {
            "id": "glm-5.1",
            "displayName": "GLM-5.1",
            "contextWindow": 200000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 131072,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 1.4,
              "output": 4.4,
              "cacheRead": 0.26,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "zhipu-glm-openai",
            "baseUrl": "https://open.bigmodel.cn/api/coding/paas/v4",
            "sourceApps": [
              "codex",
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://open.bigmodel.cn/api/anthropic",
        "selectedVariantSlug": "zhipu-glm-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "zhipu-glm-anthropic",
            "baseUrl": "https://open.bigmodel.cn/api/anthropic",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "zhipu-glm-openai",
      "zhipu-glm-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://open.bigmodel.cn/api/coding/paas/v4"
  },
  {
    "presetKey": "zhipu-glm-en",
    "slug": "zhipu-glm-en",
    "name": "Zhipu GLM en",
    "category": "cn_official",
    "logo": "/logos/zhipu.svg",
    "websiteUrl": "https://z.ai",
    "consoleUrl": "https://z.ai/subscribe?ic=8JVLJQFSKB",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"glm-5.2\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"zhipu_glm_en\"\nbase_url = \"https://api.z.ai/api/coding/paas/v4\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.z.ai/api/coding/paas/v4",
        "selectedVariantSlug": "zhipu-glm-en-openai",
        "sourceApps": [
          "codex",
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "glm-5.2",
            "displayName": "GLM-5.2",
            "contextWindow": 200000,
            "reasoningLevels": [
              "none",
              "high"
            ],
            "pricing": {
              "input": 1.4,
              "output": 4.4,
              "cacheRead": 0.26,
              "cacheWrite": 0
            }
          },
          {
            "id": "glm-5.1",
            "displayName": "GLM-5.1",
            "contextWindow": 200000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 131072,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 1.4,
              "output": 4.4,
              "cacheRead": 0.26,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "zhipu-glm-en-openai",
            "baseUrl": "https://api.z.ai/api/coding/paas/v4",
            "sourceApps": [
              "codex",
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.z.ai/api/anthropic",
        "selectedVariantSlug": "zhipu-glm-en-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "zhipu-glm-en-anthropic",
            "baseUrl": "https://api.z.ai/api/anthropic",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "zhipu-glm-en-openai",
      "zhipu-glm-en-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.z.ai/api/coding/paas/v4"
  },
  {
    "presetKey": "baidu-qianfan-coding-plan",
    "slug": "baidu-qianfan-coding-plan",
    "name": "Baidu Qianfan Coding Plan",
    "category": "cn_official",
    "logo": "/logos/baidu.svg",
    "websiteUrl": "https://cloud.baidu.com/product/qianfan_modelbuilder",
    "consoleUrl": "https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"qianfan-code-latest\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"qianfan_coding\"\nbase_url = \"https://qianfan.baidubce.com/v2/coding\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://qianfan.baidubce.com/v2/coding",
        "selectedVariantSlug": "baidu-qianfan-coding-plan-openai",
        "sourceApps": [
          "codex"
        ],
        "knownModels": [
          {
            "id": "qianfan-code-latest",
            "displayName": "Qianfan Code Latest",
            "contextWindow": 131072,
            "reasoningLevels": [
              "none",
              "high"
            ]
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "baidu-qianfan-coding-plan-openai",
            "baseUrl": "https://qianfan.baidubce.com/v2/coding",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://qianfan.baidubce.com/anthropic/coding",
        "selectedVariantSlug": "baidu-qianfan-coding-plan-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "baidu-qianfan-coding-plan-anthropic",
            "baseUrl": "https://qianfan.baidubce.com/anthropic/coding",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "baidu-qianfan-coding-plan-openai",
      "baidu-qianfan-coding-plan-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://qianfan.baidubce.com/v2/coding"
  },
  {
    "presetKey": "baidu-qianfan-token-plan",
    "slug": "baidu-qianfan-token-plan",
    "name": "Baidu Qianfan Token Plan",
    "category": "cn_official",
    "logo": "/logos/baidu.svg",
    "websiteUrl": "https://cloud.baidu.com/product/codingplan.html",
    "consoleUrl": "https://console.bce.baidu.com/qianfan/resource/token-plan",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "hermes"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"deepseek-v4-pro\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"qianfan_tokenplan\"\nbase_url = \"https://qianfan.baidubce.com/v2/tokenplan/personal\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://qianfan.baidubce.com/v2/tokenplan/personal",
        "selectedVariantSlug": "baidu-qianfan-token-plan-openai",
        "sourceApps": [
          "codex",
          "opencode",
          "openclaw",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "deepseek-v4-pro",
            "displayName": "DeepSeek V4 Pro",
            "pricing": {
              "input": 1.32,
              "output": 3.96,
              "cacheRead": 0.044,
              "cacheWrite": 0
            }
          },
          {
            "id": "deepseek-v4-flash",
            "displayName": "DeepSeek V4 Flash",
            "pricing": {
              "input": 0.44,
              "output": 1.32,
              "cacheRead": 0.014,
              "cacheWrite": 0
            }
          },
          {
            "id": "deepseek-v4-flash-0731",
            "displayName": "DeepSeek V4 Flash 0731",
            "pricing": {
              "input": 0.44,
              "output": 1.32,
              "cacheRead": 0.014,
              "cacheWrite": 0
            }
          },
          {
            "id": "glm-5.2",
            "displayName": "GLM-5.2",
            "pricing": {
              "input": 1.4,
              "output": 4.4,
              "cacheRead": 0.26,
              "cacheWrite": 0
            }
          },
          {
            "id": "glm-5.1",
            "displayName": "GLM-5.1",
            "pricing": {
              "input": 1.4,
              "output": 4.4,
              "cacheRead": 0.26,
              "cacheWrite": 0
            }
          },
          {
            "id": "kimi-k2.6",
            "displayName": "Kimi K2.6",
            "pricing": {
              "input": 0.95,
              "output": 4,
              "cacheRead": 0.16,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "baidu-qianfan-token-plan-openai",
            "baseUrl": "https://qianfan.baidubce.com/v2/tokenplan/personal",
            "sourceApps": [
              "codex",
              "opencode",
              "openclaw",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://qianfan.baidubce.com/anthropic/tokenplan/personal",
        "selectedVariantSlug": "baidu-qianfan-token-plan-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "baidu-qianfan-token-plan-anthropic",
            "baseUrl": "https://qianfan.baidubce.com/anthropic/tokenplan/personal",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "baidu-qianfan-token-plan-openai",
      "baidu-qianfan-token-plan-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://qianfan.baidubce.com/v2/tokenplan/personal"
  },
  {
    "presetKey": "bailian",
    "slug": "bailian",
    "name": "Bailian",
    "category": "cn_official",
    "logo": "/logos/bailian.svg",
    "websiteUrl": "https://bailian.console.aliyun.com",
    "consoleUrl": "https://bailian.console.aliyun.com/#/api-key",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "hermes",
      "pi",
      "openclaw"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "selectedVariantSlug": "bailian-openai",
        "sourceApps": [
          "opencode",
          "hermes",
          "pi",
          "openclaw"
        ],
        "knownModels": [
          {
            "id": "qwen3-coder-plus",
            "displayName": "Qwen3 Coder Plus",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": false,
              "input": [
                "text"
              ],
              "maxTokens": 65536
            },
            "pricing": {
              "input": 0.65,
              "output": 3.25,
              "cacheRead": 0.13,
              "cacheWrite": 0
            }
          },
          {
            "id": "qwen3-max",
            "displayName": "Qwen3 Max",
            "pricing": {
              "input": 0.78,
              "output": 3.9,
              "cacheRead": 0,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "bailian-openai",
            "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "sourceApps": [
              "opencode",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "qwen-coder-openai",
            "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "sourceApps": [
              "openclaw"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "selectedVariantSlug": "bailian-responses",
        "sourceApps": [
          "codex"
        ],
        "knownModels": [
          {
            "id": "qwen3-coder-plus",
            "displayName": "Qwen3 Coder Plus",
            "contextWindow": 1048576,
            "pricing": {
              "input": 0.65,
              "output": 3.25,
              "cacheRead": 0.13,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "bailian-responses",
            "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://dashscope.aliyuncs.com/apps/anthropic",
        "selectedVariantSlug": "bailian-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "bailian-anthropic",
            "baseUrl": "https://dashscope.aliyuncs.com/apps/anthropic",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "bailian-openai",
      "qwen-coder-openai",
      "bailian-responses",
      "bailian-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1"
  },
  {
    "presetKey": "bailian-for-coding",
    "slug": "bailian-for-coding",
    "name": "Bailian For Coding",
    "category": "cn_official",
    "logo": "/logos/bailian.svg",
    "websiteUrl": "https://bailian.console.aliyun.com",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "hermes"
    ],
    "extra": {
      "suggestedDefaults": {
        "model": {
          "default": "qwen3-coder-plus",
          "provider": "bailian_coding"
        }
      }
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://coding.dashscope.aliyuncs.com/apps/anthropic",
        "selectedVariantSlug": "bailian-for-coding-openai",
        "sourceApps": [
          "hermes"
        ],
        "knownModels": [
          {
            "id": "qwen3-coder-plus",
            "displayName": "Qwen3 Coder Plus",
            "pricing": {
              "input": 0.65,
              "output": 3.25,
              "cacheRead": 0.13,
              "cacheWrite": 0
            }
          },
          {
            "id": "qwen3-max",
            "displayName": "Qwen3 Max",
            "pricing": {
              "input": 0.78,
              "output": 3.9,
              "cacheRead": 0,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "bailian-for-coding-openai",
            "baseUrl": "https://coding.dashscope.aliyuncs.com/apps/anthropic",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://coding.dashscope.aliyuncs.com/apps/anthropic",
        "selectedVariantSlug": "bailian-for-coding-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "bailian-for-coding-anthropic",
            "baseUrl": "https://coding.dashscope.aliyuncs.com/apps/anthropic",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "bailian-for-coding-openai",
      "bailian-for-coding-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://coding.dashscope.aliyuncs.com/apps/anthropic"
  },
  {
    "presetKey": "stepfun",
    "slug": "stepfun",
    "name": "StepFun",
    "category": "cn_official",
    "logo": "/logos/stepfun.svg",
    "websiteUrl": "https://platform.stepfun.com/step-plan",
    "consoleUrl": "https://platform.stepfun.com/interface-key",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "pi",
      "hermes"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"step-3.7-flash\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"stepfun\"\nbase_url = \"https://api.stepfun.com/step_plan/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.stepfun.com/step_plan/v1",
        "selectedVariantSlug": "stepfun-openai",
        "sourceApps": [
          "codex",
          "opencode",
          "openclaw",
          "pi",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "step-3.7-flash",
            "displayName": "Step 3.7 Flash",
            "contextWindow": 262144,
            "reasoningLevels": [
              "low",
              "medium",
              "high"
            ],
            "pricing": {
              "input": 0.19,
              "output": 1.13,
              "cacheRead": 0.04,
              "cacheWrite": 0
            }
          },
          {
            "id": "step-3.5-flash-2603",
            "displayName": "Step 3.5 Flash 2603",
            "contextWindow": 256000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 256000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 0.1,
              "output": 0.3,
              "cacheRead": 0.02,
              "cacheWrite": 0
            }
          },
          {
            "id": "step-3.5-flash",
            "displayName": "Step 3.5 Flash",
            "contextWindow": 256000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 256000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 0.1,
              "output": 0.3,
              "cacheRead": 0.02,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "stepfun-openai",
            "baseUrl": "https://api.stepfun.com/step_plan/v1",
            "sourceApps": [
              "codex",
              "opencode",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "stepfun-step-plan-openai",
            "baseUrl": "https://api.stepfun.com/step_plan/v1",
            "sourceApps": [
              "opencode",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "stepfun-openai-api",
            "baseUrl": "https://api.stepfun.ai/v1",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.stepfun.com/step_plan",
        "selectedVariantSlug": "stepfun-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "stepfun-anthropic",
            "baseUrl": "https://api.stepfun.com/step_plan",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "stepfun-openai",
      "stepfun-step-plan-openai",
      "stepfun-openai-api",
      "stepfun-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.stepfun.com/step_plan/v1"
  },
  {
    "presetKey": "stepfun-en",
    "slug": "stepfun-en",
    "name": "StepFun en",
    "category": "cn_official",
    "logo": "/logos/stepfun.svg",
    "websiteUrl": "https://platform.stepfun.ai/step-plan",
    "consoleUrl": "https://platform.stepfun.ai/interface-key",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "pi"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"step-3.7-flash\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"stepfun_en\"\nbase_url = \"https://api.stepfun.ai/step_plan/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.stepfun.ai/step_plan/v1",
        "selectedVariantSlug": "stepfun-en-openai",
        "sourceApps": [
          "codex",
          "opencode",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "step-3.7-flash",
            "displayName": "Step 3.7 Flash",
            "contextWindow": 262144,
            "reasoningLevels": [
              "low",
              "medium",
              "high"
            ],
            "pricing": {
              "input": 0.19,
              "output": 1.13,
              "cacheRead": 0.04,
              "cacheWrite": 0
            }
          },
          {
            "id": "step-3.5-flash-2603",
            "displayName": "Step 3.5 Flash 2603",
            "contextWindow": 256000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 256000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 0.1,
              "output": 0.3,
              "cacheRead": 0.02,
              "cacheWrite": 0
            }
          },
          {
            "id": "step-3.5-flash",
            "displayName": "Step 3.5 Flash",
            "contextWindow": 256000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 256000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 0.1,
              "output": 0.3,
              "cacheRead": 0.02,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "stepfun-en-openai",
            "baseUrl": "https://api.stepfun.ai/step_plan/v1",
            "sourceApps": [
              "codex",
              "opencode",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.stepfun.ai/step_plan",
        "selectedVariantSlug": "stepfun-en-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "stepfun-en-anthropic",
            "baseUrl": "https://api.stepfun.ai/step_plan",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "stepfun-en-openai",
      "stepfun-en-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.stepfun.ai/step_plan/v1"
  },
  {
    "presetKey": "modelscope",
    "slug": "modelscope",
    "name": "ModelScope",
    "category": "aggregator",
    "websiteUrl": "https://modelscope.cn",
    "consoleUrl": "https://modelscope.cn/my/myaccesstoken",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"ZhipuAI/GLM-5.2\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"modelscope\"\nbase_url = \"https://api-inference.modelscope.cn/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api-inference.modelscope.cn/v1",
        "selectedVariantSlug": "modelscope-openai",
        "sourceApps": [
          "codex",
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "ZhipuAI/GLM-5.2",
            "displayName": "GLM-5.2",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 131072,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 1.4,
              "output": 4.4,
              "cacheRead": 0.26,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "modelscope-openai",
            "baseUrl": "https://api-inference.modelscope.cn/v1",
            "sourceApps": [
              "codex",
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api-inference.modelscope.cn",
        "selectedVariantSlug": "modelscope-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "modelscope-anthropic",
            "baseUrl": "https://api-inference.modelscope.cn",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "modelscope-openai",
      "modelscope-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api-inference.modelscope.cn/v1"
  },
  {
    "presetKey": "kat-coder",
    "slug": "kat-coder",
    "name": "KAT-Coder",
    "category": "cn_official",
    "logo": "/logos/catcoder.svg",
    "websiteUrl": "https://console.streamlake.ai",
    "consoleUrl": "https://console.streamlake.ai/console/api-key",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "opencode",
      "openclaw",
      "pi",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://vanchin.streamlake.ai/api/gateway/v1/endpoints/${ENDPOINT_ID}/openai",
        "selectedVariantSlug": "kat-coder-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "pi",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "KAT-Coder-Pro",
            "displayName": "KAT-Coder Pro",
            "contextWindow": 256000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 32000,
              "thinkingLevelMap": {}
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "kat-coder-openai",
            "baseUrl": "https://vanchin.streamlake.ai/api/gateway/v1/endpoints/${ENDPOINT_ID}/openai",
            "sourceApps": [
              "opencode",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "kat-coder-openai-vanchin",
            "baseUrl": "https://vanchin.streamlake.ai/api/gateway/v1/endpoints/${ENDPOINT_ID}/claude-code-proxy",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://vanchin.streamlake.ai/api/gateway/v1/endpoints/${ENDPOINT_ID}/claude-code-proxy",
        "selectedVariantSlug": "kat-coder-anthropic",
        "sourceApps": [
          "claude"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "kat-coder-anthropic",
            "baseUrl": "https://vanchin.streamlake.ai/api/gateway/v1/endpoints/${ENDPOINT_ID}/claude-code-proxy",
            "sourceApps": [
              "claude"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "kat-coder-openai",
      "kat-coder-openai-vanchin",
      "kat-coder-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://vanchin.streamlake.ai/api/gateway/v1/endpoints/${ENDPOINT_ID}/openai"
  },
  {
    "presetKey": "longcat",
    "slug": "longcat",
    "name": "Longcat",
    "category": "cn_official",
    "websiteUrl": "https://longcat.chat/platform",
    "consoleUrl": "https://longcat.chat/platform/api_keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.longcat.chat/openai/v1",
        "selectedVariantSlug": "longcat-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "LongCat-2.0",
            "displayName": "LongCat 2.0",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 131072,
              "thinkingLevelMap": {}
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "longcat-openai",
            "baseUrl": "https://api.longcat.chat/openai/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.longcat.chat/openai/v1",
        "selectedVariantSlug": "longcat-responses",
        "sourceApps": [
          "codex"
        ],
        "knownModels": [
          {
            "id": "LongCat-2.0",
            "displayName": "LongCat 2.0",
            "contextWindow": 1048576,
            "reasoningLevels": [
              "high"
            ]
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "longcat-responses",
            "baseUrl": "https://api.longcat.chat/openai/v1",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.longcat.chat/anthropic",
        "selectedVariantSlug": "longcat-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "longcat-anthropic",
            "baseUrl": "https://api.longcat.chat/anthropic",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "longcat-openai",
      "longcat-responses",
      "longcat-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.longcat.chat/openai/v1"
  },
  {
    "presetKey": "minimax",
    "slug": "minimax",
    "name": "MiniMax",
    "category": "cn_official",
    "logo": "/logos/minimax.svg",
    "websiteUrl": "https://platform.minimaxi.com",
    "consoleUrl": "https://platform.minimaxi.com/subscribe/coding-plan",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.minimaxi.com/v1",
        "selectedVariantSlug": "minimax-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "MiniMax-M2.7",
            "displayName": "MiniMax-M2.7",
            "contextWindow": 204800,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 131072,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 0.3,
              "output": 1.2,
              "cacheRead": 0.06,
              "cacheWrite": 0.375
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "minimax-openai",
            "baseUrl": "https://api.minimaxi.com/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.minimaxi.com/v1",
        "selectedVariantSlug": "minimax-responses",
        "sourceApps": [
          "codex"
        ],
        "knownModels": [
          {
            "id": "MiniMax-M3",
            "displayName": "MiniMax-M3",
            "contextWindow": 1000000,
            "modalities": [
              "text",
              "image"
            ],
            "reasoningLevels": [
              "none",
              "high"
            ],
            "capabilities": {
              "supportsParallelToolCalls": true,
              "baseInstructions": "You are Codex, a coding agent based on MiniMax-M3. You and the user share the same workspace and collaborate to achieve the user's goals."
            },
            "pricing": {
              "input": 0.3,
              "output": 1.2,
              "cacheRead": 0.06,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "minimax-responses",
            "baseUrl": "https://api.minimaxi.com/v1",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.minimaxi.com/anthropic",
        "selectedVariantSlug": "minimax-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "minimax-anthropic",
            "baseUrl": "https://api.minimaxi.com/anthropic",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "minimax-openai",
      "minimax-responses",
      "minimax-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.minimaxi.com/v1"
  },
  {
    "presetKey": "minimax-en",
    "slug": "minimax-en",
    "name": "MiniMax en",
    "category": "cn_official",
    "logo": "/logos/minimax.svg",
    "websiteUrl": "https://platform.minimax.io",
    "consoleUrl": "https://platform.minimax.io/subscribe/coding-plan",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.minimax.io/v1",
        "selectedVariantSlug": "minimax-en-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "MiniMax-M2.7",
            "displayName": "MiniMax-M2.7",
            "contextWindow": 204800,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 131072,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 0.3,
              "output": 1.2,
              "cacheRead": 0.06,
              "cacheWrite": 0.375
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "minimax-en-openai",
            "baseUrl": "https://api.minimax.io/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.minimax.io/v1",
        "selectedVariantSlug": "minimax-en-responses",
        "sourceApps": [
          "codex"
        ],
        "knownModels": [
          {
            "id": "MiniMax-M3",
            "displayName": "MiniMax-M3",
            "contextWindow": 1000000,
            "modalities": [
              "text",
              "image"
            ],
            "reasoningLevels": [
              "none",
              "high"
            ],
            "capabilities": {
              "supportsParallelToolCalls": true,
              "baseInstructions": "You are Codex, a coding agent based on MiniMax-M3. You and the user share the same workspace and collaborate to achieve the user's goals."
            },
            "pricing": {
              "input": 0.3,
              "output": 1.2,
              "cacheRead": 0.06,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "minimax-en-responses",
            "baseUrl": "https://api.minimax.io/v1",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.minimax.io/anthropic",
        "selectedVariantSlug": "minimax-en-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "minimax-en-anthropic",
            "baseUrl": "https://api.minimax.io/anthropic",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "minimax-en-openai",
      "minimax-en-responses",
      "minimax-en-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.minimax.io/v1"
  },
  {
    "presetKey": "bailing",
    "slug": "bailing",
    "name": "BaiLing",
    "category": "cn_official",
    "websiteUrl": "https://alipaytbox.yuque.com/sxs0ba/ling/get_started",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "pi",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.tbox.cn/v1",
        "selectedVariantSlug": "bailing-openai-api",
        "sourceApps": [
          "opencode",
          "openclaw",
          "pi",
          "hermes",
          "codex"
        ],
        "knownModels": [
          {
            "id": "Ling-2.5-1T",
            "displayName": "Ling 2.5-1T",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": false,
              "input": [
                "text"
              ],
              "maxTokens": 16384
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "bailing-openai-api",
            "baseUrl": "https://api.tbox.cn/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "bailing-openai-api-2",
            "baseUrl": "https://api.tbox.cn/api/anthropic",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "bailing-openai",
            "baseUrl": "https://api.tbox.cn/api/llm/v1",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.tbox.cn/api/anthropic",
        "selectedVariantSlug": "bailing-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "bailing-anthropic",
            "baseUrl": "https://api.tbox.cn/api/anthropic",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "bailing-openai-api",
      "bailing-openai-api-2",
      "bailing-openai",
      "bailing-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.tbox.cn/v1"
  },
  {
    "presetKey": "aihubmix",
    "slug": "aihubmix",
    "name": "AiHubMix",
    "category": "aggregator",
    "websiteUrl": "https://aihubmix.com",
    "consoleUrl": "https://aihubmix.com",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "openclaw",
      "pi",
      "codex",
      "grok-build",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://aihubmix.com/v1",
        "selectedVariantSlug": "aihubmix-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "aihubmix-openai",
            "baseUrl": "https://aihubmix.com/v1",
            "sourceApps": [
              "opencode",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://aihubmix.com/v1",
        "selectedVariantSlug": "aihubmix-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "aihubmix-responses",
            "baseUrl": "https://aihubmix.com/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://aihubmix.com",
        "selectedVariantSlug": "aihubmix-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "aihubmix-anthropic",
            "baseUrl": "https://aihubmix.com",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "aihubmix-openai",
      "aihubmix-responses",
      "aihubmix-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://aihubmix.com/v1"
  },
  {
    "presetKey": "cherryin",
    "slug": "cherryin",
    "name": "CherryIN",
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
      "pi",
      "codex",
      "grok-build",
      "gemini",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://open.cherryin.net/v1",
        "selectedVariantSlug": "cherryin-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "anthropic/claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "anthropic/claude-opus-5",
            "displayName": "Claude Opus 5",
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "cherryin-openai",
            "baseUrl": "https://open.cherryin.net/v1",
            "sourceApps": [
              "opencode"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "cherryin-openai-open",
            "baseUrl": "https://open.cherryin.net",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://open.cherryin.net/v1",
        "selectedVariantSlug": "cherryin-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "openai/gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "x-ai/grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "cherryin-responses",
            "baseUrl": "https://open.cherryin.net/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://open.cherryin.net",
        "selectedVariantSlug": "cherryin-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "anthropic/claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "anthropic/claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "cherryin-anthropic",
            "baseUrl": "https://open.cherryin.net",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://open.cherryin.net",
        "selectedVariantSlug": "cherryin-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "google/gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "cherryin-gemini",
            "baseUrl": "https://open.cherryin.net",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "cherryin-openai",
      "cherryin-openai-open",
      "cherryin-responses",
      "cherryin-anthropic",
      "cherryin-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://open.cherryin.net/v1"
  },
  {
    "presetKey": "relaxycode",
    "slug": "relaxycode",
    "name": "RelaxyCode",
    "category": "third_party",
    "logo": "/logos/relaxcode.png",
    "websiteUrl": "https://www.relaxycode.com",
    "consoleUrl": "https://www.relaxycode.com/register",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"relaxycode\"\nbase_url = \"https://www.relaxycode.com/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai-responses",
    "endpoints": [
      {
        "protocol": "openai-responses",
        "baseUrl": "https://www.relaxycode.com/v1",
        "selectedVariantSlug": "relaxycode-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "relaxycode-responses",
            "baseUrl": "https://www.relaxycode.com/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://www.relaxycode.com",
        "selectedVariantSlug": "relaxycode-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "relaxycode-anthropic",
            "baseUrl": "https://www.relaxycode.com",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "relaxycode-responses",
      "relaxycode-anthropic"
    ],
    "protocol": "openai-responses",
    "baseUrl": "https://www.relaxycode.com/v1"
  },
  {
    "presetKey": "e-flowcode",
    "slug": "e-flowcode",
    "name": "E-FlowCode",
    "category": "third_party",
    "logo": "/logos/eflowcode.png",
    "websiteUrl": "https://e-flowcode.cc",
    "consoleUrl": "https://e-flowcode.cc",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build",
      "openclaw",
      "pi",
      "gemini",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://e-flowcode.cc/v1",
        "selectedVariantSlug": "e-flowcode-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "gpt-5.2-codex",
            "displayName": "gpt-5.2-codex",
            "pricing": {
              "input": 1.75,
              "output": 14,
              "cacheRead": 0.175,
              "cacheWrite": 0
            }
          },
          {
            "id": "gpt-5.3-codex",
            "displayName": "gpt-5.3-codex",
            "pricing": {
              "input": 1.75,
              "output": 14,
              "cacheRead": 0.175,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "e-flowcode-openai",
            "baseUrl": "https://e-flowcode.cc/v1",
            "sourceApps": [
              "opencode"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "e-flowcode-openai-e-flowcode",
            "baseUrl": "https://e-flowcode.cc",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://e-flowcode.cc/v1",
        "selectedVariantSlug": "e-flowcode-responses",
        "sourceApps": [
          "codex",
          "grok-build",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "displayName": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          },
          {
            "id": "gpt-5.3-codex",
            "displayName": "gpt-5.3-codex",
            "contextWindow": 400000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "off": "none",
                "minimal": null,
                "low": "low",
                "medium": "medium",
                "high": "high",
                "xhigh": "xhigh",
                "max": null
              }
            },
            "pricing": {
              "input": 1.75,
              "output": 14,
              "cacheRead": 0.175,
              "cacheWrite": 0
            }
          },
          {
            "id": "gpt-5.2-codex",
            "displayName": "gpt-5.2-codex",
            "contextWindow": 400000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 1.75,
              "output": 14,
              "cacheRead": 0.175,
              "cacheWrite": 0
            }
          },
          {
            "id": "gpt-5.2",
            "displayName": "gpt-5.2",
            "pricing": {
              "input": 1.75,
              "output": 14,
              "cacheRead": 0.175,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "e-flowcode-responses",
            "baseUrl": "https://e-flowcode.cc/v1",
            "sourceApps": [
              "codex",
              "grok-build",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://e-flowcode.cc",
        "selectedVariantSlug": "e-flowcode-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "e-flowcode-anthropic",
            "baseUrl": "https://e-flowcode.cc",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://e-flowcode.cc",
        "selectedVariantSlug": "e-flowcode-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "e-flowcode-gemini",
            "baseUrl": "https://e-flowcode.cc",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "e-flowcode-openai",
      "e-flowcode-openai-e-flowcode",
      "e-flowcode-responses",
      "e-flowcode-anthropic",
      "e-flowcode-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://e-flowcode.cc/v1"
  },
  {
    "presetKey": "openrouter",
    "slug": "openrouter",
    "name": "OpenRouter",
    "category": "aggregator",
    "logo": "/logos/openrouter.svg",
    "websiteUrl": "https://openrouter.ai",
    "consoleUrl": "https://openrouter.ai/keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "pi",
      "codex",
      "grok-build",
      "gemini",
      "opencode",
      "openclaw",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://openrouter.ai/api/v1",
        "selectedVariantSlug": "openrouter-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "anthropic/claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "anthropic/claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "anthropic/claude-haiku-4-5",
            "displayName": "Claude Haiku 4.5",
            "contextWindow": 200000
          },
          {
            "id": "openai/gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "contextWindow": 400000,
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "google/gemini-3.6-flash",
            "displayName": "Gemini 3.6 Flash",
            "contextWindow": 1000000,
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "openrouter-openai",
            "baseUrl": "https://openrouter.ai/api/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://openrouter.ai/api/v1",
        "selectedVariantSlug": "openrouter-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "x-ai/grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "openrouter-responses",
            "baseUrl": "https://openrouter.ai/api/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://openrouter.ai/api",
        "selectedVariantSlug": "openrouter-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "pi"
        ],
        "knownModels": [
          {
            "id": "anthropic/claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "anthropic/claude-opus-5",
            "displayName": "Claude Opus 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "openrouter-anthropic",
            "baseUrl": "https://openrouter.ai/api",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://openrouter.ai/api",
        "selectedVariantSlug": "openrouter-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "openrouter-gemini",
            "baseUrl": "https://openrouter.ai/api",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "openrouter-openai",
      "openrouter-responses",
      "openrouter-anthropic",
      "openrouter-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://openrouter.ai/api/v1"
  },
  {
    "presetKey": "therouter",
    "slug": "therouter",
    "name": "TheRouter",
    "category": "aggregator",
    "websiteUrl": "https://therouter.ai",
    "consoleUrl": "https://dashboard.therouter.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "grok-build",
      "gemini",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.therouter.ai/v1",
        "selectedVariantSlug": "therouter-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "anthropic/claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "openai/gpt-5.3-codex",
            "displayName": "GPT-5.3 Codex",
            "contextWindow": 400000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 1.75,
              "output": 14,
              "cacheRead": 0.175,
              "cacheWrite": 0
            }
          },
          {
            "id": "openai/gpt-5.2",
            "displayName": "GPT-5.2",
            "contextWindow": 400000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 1.75,
              "output": 14,
              "cacheRead": 0.175,
              "cacheWrite": 0
            }
          },
          {
            "id": "google/gemini-3.6-flash",
            "displayName": "Gemini 3.6 Flash",
            "contextWindow": 1048576,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 65536,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          },
          {
            "id": "qwen/qwen3-coder-480b",
            "displayName": "Qwen3 Coder 480B",
            "contextWindow": 262144,
            "capabilities": {
              "reasoning": false,
              "input": [
                "text"
              ],
              "maxTokens": 65536
            },
            "pricing": {
              "input": 0.65,
              "output": 3.25,
              "cacheRead": 0,
              "cacheWrite": 0
            }
          },
          {
            "id": "openai/gpt-5.6-sol",
            "displayName": "GPT-5.6 Sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "openai/gpt-5.4-mini",
            "displayName": "GPT-5.4 mini",
            "pricing": {
              "input": 0.75,
              "output": 4.5,
              "cacheRead": 0.075,
              "cacheWrite": 0
            }
          },
          {
            "id": "openai/gpt-5.4-nano",
            "displayName": "GPT-5.4 nano",
            "pricing": {
              "input": 0.2,
              "output": 1.25,
              "cacheRead": 0.02,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "therouter-openai",
            "baseUrl": "https://api.therouter.ai/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.therouter.ai/v1",
        "selectedVariantSlug": "therouter-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "openai/gpt-5.3-codex",
            "pricing": {
              "input": 1.75,
              "output": 14,
              "cacheRead": 0.175,
              "cacheWrite": 0
            }
          },
          {
            "id": "x-ai/grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "therouter-responses",
            "baseUrl": "https://api.therouter.ai/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.therouter.ai",
        "selectedVariantSlug": "therouter-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "therouter-anthropic",
            "baseUrl": "https://api.therouter.ai",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "gemini",
        "baseUrl": "https://api.therouter.ai",
        "selectedVariantSlug": "therouter-gemini",
        "sourceApps": [
          "gemini"
        ],
        "knownModels": [
          {
            "id": "gemini-3.6-flash",
            "pricing": {
              "input": 1.5,
              "output": 7.5,
              "cacheRead": 0.15,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "therouter-gemini",
            "baseUrl": "https://api.therouter.ai",
            "sourceApps": [
              "gemini"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "therouter-openai",
      "therouter-responses",
      "therouter-anthropic",
      "therouter-gemini"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.therouter.ai/v1"
  },
  {
    "presetKey": "novita-ai",
    "slug": "novita-ai",
    "name": "Novita AI",
    "category": "aggregator",
    "logo": "/logos/novita.svg",
    "websiteUrl": "https://novita.ai",
    "consoleUrl": "https://novita.ai",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "pi",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.novita.ai/openai",
        "selectedVariantSlug": "novita-ai-openai-api",
        "sourceApps": [
          "opencode",
          "openclaw",
          "pi",
          "hermes",
          "codex"
        ],
        "knownModels": [
          {
            "id": "zai-org/glm-5.1",
            "displayName": "GLM-5.1",
            "contextWindow": 200000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 131072,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 1.4,
              "output": 4.4,
              "cacheRead": 0.26,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "novita-ai-openai-api",
            "baseUrl": "https://api.novita.ai/openai",
            "sourceApps": [
              "opencode",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "novita-ai-openai-api-2",
            "baseUrl": "https://api.novita.ai/v3/openai",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "novita-ai-openai",
            "baseUrl": "https://api.novita.ai/openai/v1",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.novita.ai/anthropic",
        "selectedVariantSlug": "novita-ai-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "novita-ai-anthropic",
            "baseUrl": "https://api.novita.ai/anthropic",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "novita-ai-openai-api",
      "novita-ai-openai-api-2",
      "novita-ai-openai",
      "novita-ai-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.novita.ai/openai"
  },
  {
    "presetKey": "github-copilot",
    "slug": "github-copilot",
    "name": "GitHub Copilot",
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
      "env": {
        "ANTHROPIC_BASE_URL": "https://api.githubcopilot.com",
        "ANTHROPIC_MODEL": "claude-sonnet-5",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4.5",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-5",
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-sonnet-5"
      }
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.githubcopilot.com",
        "selectedVariantSlug": "github-copilot-openai",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "github-copilot-openai",
            "baseUrl": "https://api.githubcopilot.com",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": false,
            "authMode": "oauth"
          }
        ]
      }
    ],
    "legacySlugs": [
      "github-copilot-openai"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.githubcopilot.com"
  },
  {
    "presetKey": "codex",
    "slug": "codex",
    "name": "Codex",
    "category": "official",
    "logo": "/logos/openai.svg",
    "websiteUrl": "https://chatgpt.com/codex",
    "supported": false,
    "disabledReason": "需要 OAuth 登录，Model Center 暂不支持",
    "authMode": "oauth",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex"
    ],
    "extra": {
      "config": ""
    },
    "defaultProtocol": "openai-responses",
    "endpoints": [
      {
        "protocol": "openai-responses",
        "baseUrl": "",
        "selectedVariantSlug": "openai-official-responses",
        "sourceApps": [
          "codex",
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "openai-official-responses",
            "baseUrl": "",
            "sourceApps": [
              "codex"
            ],
            "supported": false,
            "authMode": "oauth"
          },
          {
            "variantSlug": "codex-responses",
            "baseUrl": "https://chatgpt.com/backend-api/codex",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": false,
            "authMode": "oauth"
          }
        ]
      }
    ],
    "legacySlugs": [
      "openai-official-responses",
      "codex-responses"
    ],
    "protocol": "openai-responses",
    "baseUrl": ""
  },
  {
    "presetKey": "xai-grok",
    "slug": "xai-grok",
    "name": "xAI (Grok)",
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
      "env": {
        "ANTHROPIC_BASE_URL": "https://api.x.ai/v1",
        "ANTHROPIC_MODEL": "grok-4.5",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "grok-4.5",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "grok-4.5",
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "grok-4.5"
      }
    },
    "defaultProtocol": "openai-responses",
    "endpoints": [
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.x.ai/v1",
        "selectedVariantSlug": "xai-grok-responses",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "grok-4.5",
            "displayName": "Grok 4.5",
            "contextWindow": 500000,
            "modalities": [
              "text",
              "image"
            ],
            "reasoningLevels": [
              "low",
              "medium",
              "high"
            ],
            "capabilities": {
              "supportsParallelToolCalls": true
            },
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "xai-grok-responses",
            "baseUrl": "https://api.x.ai/v1",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "codex",
              "grok-build"
            ],
            "supported": false,
            "authMode": "oauth"
          },
          {
            "variantSlug": "xai-grok-oauth-responses",
            "baseUrl": "https://api.x.ai/v1",
            "sourceApps": [
              "codex"
            ],
            "supported": false,
            "authMode": "oauth"
          },
          {
            "variantSlug": "grok-official-responses",
            "baseUrl": "https://api.x.ai/v1",
            "sourceApps": [
              "grok-build"
            ],
            "supported": false,
            "authMode": "oauth"
          }
        ]
      }
    ],
    "legacySlugs": [
      "xai-grok-responses",
      "xai-grok-oauth-responses",
      "grok-official-responses"
    ],
    "protocol": "openai-responses",
    "baseUrl": "https://api.x.ai/v1"
  },
  {
    "presetKey": "nvidia",
    "slug": "nvidia",
    "name": "Nvidia",
    "category": "aggregator",
    "logo": "/logos/nvidia.svg",
    "websiteUrl": "https://build.nvidia.com",
    "consoleUrl": "https://build.nvidia.com/settings/api-keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "hermes",
      "codex",
      "opencode",
      "openclaw",
      "pi"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"moonshotai/kimi-k2.5\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"nvidia\"\nbase_url = \"https://integrate.api.nvidia.com/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://integrate.api.nvidia.com/v1",
        "selectedVariantSlug": "nvidia-openai-integrate",
        "sourceApps": [
          "codex",
          "opencode",
          "openclaw",
          "pi",
          "claude",
          "claude-desktop",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "moonshotai/kimi-k2.5",
            "displayName": "Kimi K2.5",
            "contextWindow": 262144,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 262144,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 0.6,
              "output": 3,
              "cacheRead": 0.1,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "nvidia-openai-integrate",
            "baseUrl": "https://integrate.api.nvidia.com/v1",
            "sourceApps": [
              "codex",
              "opencode",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          },
          {
            "variantSlug": "nvidia-openai",
            "baseUrl": "https://integrate.api.nvidia.com",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "nvidia-openai-integrate",
      "nvidia-openai"
    ],
    "protocol": "openai",
    "baseUrl": "https://integrate.api.nvidia.com/v1"
  },
  {
    "presetKey": "pipellm",
    "slug": "pipellm",
    "name": "PIPELLM",
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
      "pi",
      "codex",
      "grok-build",
      "opencode",
      "hermes"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://cc-api.pipellm.ai",
        "selectedVariantSlug": "pipellm-openai",
        "sourceApps": [
          "opencode",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "Claude Opus 5",
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "Claude Sonnet 5",
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-haiku-4-5-20251001",
            "displayName": "Claude Haiku 4.5",
            "pricing": {
              "input": 1,
              "output": 5,
              "cacheRead": 0.1,
              "cacheWrite": 1.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "pipellm-openai",
            "baseUrl": "https://cc-api.pipellm.ai",
            "sourceApps": [
              "opencode",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://cc-api.pipellm.ai/v1",
        "selectedVariantSlug": "pipellm-responses",
        "sourceApps": [
          "codex",
          "grok-build"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "grok-4.5",
            "pricing": {
              "input": 2,
              "output": 6,
              "cacheRead": 0.3,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "pipellm-responses",
            "baseUrl": "https://cc-api.pipellm.ai/v1",
            "sourceApps": [
              "codex",
              "grok-build"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://cc-api.pipellm.ai",
        "selectedVariantSlug": "pipellm-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop",
          "openclaw",
          "pi"
        ],
        "knownModels": [
          {
            "id": "claude-opus-5",
            "displayName": "claude-opus-5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 5,
              "output": 25,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          },
          {
            "id": "claude-sonnet-5",
            "displayName": "claude-sonnet-5",
            "contextWindow": 1000000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 128000,
              "thinkingLevelMap": {
                "xhigh": "xhigh",
                "max": "max"
              },
              "compat": {
                "forceAdaptiveThinking": true
              }
            },
            "pricing": {
              "input": 3,
              "output": 15,
              "cacheRead": 0.3,
              "cacheWrite": 3.75
            }
          },
          {
            "id": "claude-haiku-4-5-20251001",
            "displayName": "claude-haiku-4-5-20251001",
            "contextWindow": 200000,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 64000,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 1,
              "output": 5,
              "cacheRead": 0.1,
              "cacheWrite": 1.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "pipellm-anthropic",
            "baseUrl": "https://cc-api.pipellm.ai",
            "sourceApps": [
              "claude",
              "claude-desktop",
              "openclaw",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "pipellm-openai",
      "pipellm-responses",
      "pipellm-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://cc-api.pipellm.ai"
  },
  {
    "presetKey": "xiaomi-mimo",
    "slug": "xiaomi-mimo",
    "name": "Xiaomi MiMo",
    "category": "cn_official",
    "logo": "/logos/xiaomimimo.svg",
    "websiteUrl": "https://platform.xiaomimimo.com",
    "consoleUrl": "https://platform.xiaomimimo.com/#/console/api-keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.xiaomimimo.com/v1",
        "selectedVariantSlug": "xiaomi-mimo-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "mimo-v2.5-pro",
            "displayName": "MiMo-V2.5-Pro",
            "contextWindow": 1048576,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 131072,
              "compat": {
                "requiresReasoningContentOnAssistantMessages": true,
                "thinkingFormat": "deepseek"
              },
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 0.435,
              "output": 0.87,
              "cacheRead": 0.0036,
              "cacheWrite": 0
            }
          },
          {
            "id": "mimo-v2.5",
            "displayName": "MiMo-V2.5",
            "contextWindow": 1048576,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 131072,
              "compat": {
                "requiresReasoningContentOnAssistantMessages": true,
                "thinkingFormat": "deepseek"
              },
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 0.14,
              "output": 0.29,
              "cacheRead": 0.0028,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "xiaomi-mimo-openai",
            "baseUrl": "https://api.xiaomimimo.com/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://api.xiaomimimo.com/v1",
        "selectedVariantSlug": "xiaomi-mimo-responses",
        "sourceApps": [
          "codex"
        ],
        "knownModels": [
          {
            "id": "mimo-v2.5-pro",
            "displayName": "MiMo V2.5 Pro",
            "contextWindow": 1048576,
            "modalities": [
              "text"
            ],
            "reasoningLevels": [
              "none",
              "high"
            ],
            "capabilities": {
              "baseInstructions": "You are MiMo, an AI assistant developed by Xiaomi. Today's date: {date} {week}. Your knowledge cutoff date is December 2024."
            },
            "pricing": {
              "input": 0.435,
              "output": 0.87,
              "cacheRead": 0.0036,
              "cacheWrite": 0
            }
          },
          {
            "id": "mimo-v2.5",
            "displayName": "MiMo V2.5",
            "contextWindow": 1048576,
            "modalities": [
              "text",
              "image"
            ],
            "reasoningLevels": [
              "none",
              "high"
            ],
            "capabilities": {
              "baseInstructions": "You are MiMo, an AI assistant developed by Xiaomi. Today's date: {date} {week}. Your knowledge cutoff date is December 2024."
            },
            "pricing": {
              "input": 0.14,
              "output": 0.29,
              "cacheRead": 0.0028,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "xiaomi-mimo-responses",
            "baseUrl": "https://api.xiaomimimo.com/v1",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.xiaomimimo.com/anthropic",
        "selectedVariantSlug": "xiaomi-mimo-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "xiaomi-mimo-anthropic",
            "baseUrl": "https://api.xiaomimimo.com/anthropic",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "xiaomi-mimo-openai",
      "xiaomi-mimo-responses",
      "xiaomi-mimo-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.xiaomimimo.com/v1"
  },
  {
    "presetKey": "xiaomi-mimo-token-plan-china",
    "slug": "xiaomi-mimo-token-plan-china",
    "name": "Xiaomi MiMo Token Plan (China)",
    "category": "cn_official",
    "logo": "/logos/xiaomimimo.svg",
    "websiteUrl": "https://platform.xiaomimimo.com/#/token-plan",
    "consoleUrl": "https://platform.xiaomimimo.com/#/console/plan-manage",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "hermes",
      "pi"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://token-plan-cn.xiaomimimo.com/v1",
        "selectedVariantSlug": "xiaomi-mimo-token-plan-china-openai",
        "sourceApps": [
          "opencode",
          "openclaw",
          "hermes",
          "pi"
        ],
        "knownModels": [
          {
            "id": "mimo-v2.5-pro",
            "displayName": "MiMo-V2.5-Pro",
            "contextWindow": 1048576,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text"
              ],
              "maxTokens": 131072,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 0.435,
              "output": 0.87,
              "cacheRead": 0.0036,
              "cacheWrite": 0
            }
          },
          {
            "id": "mimo-v2.5",
            "displayName": "MiMo-V2.5",
            "contextWindow": 1048576,
            "capabilities": {
              "reasoning": true,
              "input": [
                "text",
                "image"
              ],
              "maxTokens": 131072,
              "thinkingLevelMap": {}
            },
            "pricing": {
              "input": 0.14,
              "output": 0.29,
              "cacheRead": 0.0028,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "xiaomi-mimo-token-plan-china-openai",
            "baseUrl": "https://token-plan-cn.xiaomimimo.com/v1",
            "sourceApps": [
              "opencode",
              "openclaw",
              "hermes",
              "pi"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "openai-responses",
        "baseUrl": "https://token-plan-cn.xiaomimimo.com/v1",
        "selectedVariantSlug": "xiaomi-mimo-token-plan-china-responses",
        "sourceApps": [
          "codex"
        ],
        "knownModels": [
          {
            "id": "mimo-v2.5-pro",
            "displayName": "MiMo V2.5 Pro",
            "contextWindow": 1048576,
            "modalities": [
              "text"
            ],
            "reasoningLevels": [
              "none",
              "high"
            ],
            "capabilities": {
              "baseInstructions": "You are MiMo, an AI assistant developed by Xiaomi. Today's date: {date} {week}. Your knowledge cutoff date is December 2024."
            },
            "pricing": {
              "input": 0.435,
              "output": 0.87,
              "cacheRead": 0.0036,
              "cacheWrite": 0
            }
          },
          {
            "id": "mimo-v2.5",
            "displayName": "MiMo V2.5",
            "contextWindow": 1048576,
            "modalities": [
              "text",
              "image"
            ],
            "reasoningLevels": [
              "none",
              "high"
            ],
            "capabilities": {
              "baseInstructions": "You are MiMo, an AI assistant developed by Xiaomi. Today's date: {date} {week}. Your knowledge cutoff date is December 2024."
            },
            "pricing": {
              "input": 0.14,
              "output": 0.29,
              "cacheRead": 0.0028,
              "cacheWrite": 0
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "xiaomi-mimo-token-plan-china-responses",
            "baseUrl": "https://token-plan-cn.xiaomimimo.com/v1",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://token-plan-cn.xiaomimimo.com/anthropic",
        "selectedVariantSlug": "xiaomi-mimo-token-plan-china-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "xiaomi-mimo-token-plan-china-anthropic",
            "baseUrl": "https://token-plan-cn.xiaomimimo.com/anthropic",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "xiaomi-mimo-token-plan-china-openai",
      "xiaomi-mimo-token-plan-china-responses",
      "xiaomi-mimo-token-plan-china-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://token-plan-cn.xiaomimimo.com/v1"
  },
  {
    "presetKey": "aws-bedrock-aksk",
    "slug": "aws-bedrock-aksk",
    "name": "AWS Bedrock (AKSK)",
    "category": "cloud_provider",
    "logo": "/logos/aws.svg",
    "websiteUrl": "https://aws.amazon.com/bedrock/",
    "supported": false,
    "disabledReason": "Bedrock 协议暂不受 Model Center 支持",
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "opencode",
      "openclaw",
      "pi"
    ],
    "extra": {
      "env": {
        "ANTHROPIC_BASE_URL": "https://bedrock-runtime.${AWS_REGION}.amazonaws.com",
        "AWS_ACCESS_KEY_ID": "${AWS_ACCESS_KEY_ID}",
        "AWS_SECRET_ACCESS_KEY": "${AWS_SECRET_ACCESS_KEY}",
        "AWS_REGION": "${AWS_REGION}",
        "ANTHROPIC_MODEL": "global.anthropic.claude-opus-5",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "global.anthropic.claude-haiku-4-5-20251001-v1:0",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "global.anthropic.claude-sonnet-5",
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "global.anthropic.claude-opus-5",
        "CLAUDE_CODE_USE_BEDROCK": "1"
      }
    },
    "defaultProtocol": "anthropic",
    "endpoints": [
      {
        "protocol": "anthropic",
        "baseUrl": "https://bedrock-runtime.${AWS_REGION}.amazonaws.com",
        "selectedVariantSlug": "aws-bedrock-aksk-anthropic",
        "sourceApps": [
          "claude",
          "pi",
          "opencode",
          "openclaw"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "aws-bedrock-aksk-anthropic",
            "baseUrl": "https://bedrock-runtime.${AWS_REGION}.amazonaws.com",
            "sourceApps": [
              "claude"
            ],
            "supported": false,
            "authMode": "api-key"
          },
          {
            "variantSlug": "aws-bedrock-anthropic-bedrock-runtime-2",
            "baseUrl": "https://bedrock-runtime.us-east-1.amazonaws.com",
            "sourceApps": [
              "pi"
            ],
            "supported": false,
            "authMode": "api-key"
          },
          {
            "variantSlug": "aws-bedrock-anthropic",
            "baseUrl": "",
            "sourceApps": [
              "opencode"
            ],
            "supported": false,
            "authMode": "api-key"
          },
          {
            "variantSlug": "aws-bedrock-anthropic-bedrock-runtime",
            "baseUrl": "https://bedrock-runtime.us-west-2.amazonaws.com",
            "sourceApps": [
              "openclaw"
            ],
            "supported": false,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "aws-bedrock-aksk-anthropic",
      "aws-bedrock-anthropic-bedrock-runtime-2",
      "aws-bedrock-anthropic",
      "aws-bedrock-anthropic-bedrock-runtime"
    ],
    "protocol": "anthropic",
    "baseUrl": "https://bedrock-runtime.${AWS_REGION}.amazonaws.com"
  },
  {
    "presetKey": "aws-bedrock-api-key",
    "slug": "aws-bedrock-api-key",
    "name": "AWS Bedrock (API Key)",
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
      "env": {
        "ANTHROPIC_BASE_URL": "https://bedrock-runtime.${AWS_REGION}.amazonaws.com",
        "AWS_REGION": "${AWS_REGION}",
        "ANTHROPIC_MODEL": "global.anthropic.claude-opus-5",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "global.anthropic.claude-haiku-4-5-20251001-v1:0",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "global.anthropic.claude-sonnet-5",
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "global.anthropic.claude-opus-5",
        "CLAUDE_CODE_USE_BEDROCK": "1"
      }
    },
    "defaultProtocol": "anthropic",
    "endpoints": [
      {
        "protocol": "anthropic",
        "baseUrl": "https://bedrock-runtime.${AWS_REGION}.amazonaws.com",
        "selectedVariantSlug": "aws-bedrock-api-key-anthropic",
        "sourceApps": [
          "claude"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "aws-bedrock-api-key-anthropic",
            "baseUrl": "https://bedrock-runtime.${AWS_REGION}.amazonaws.com",
            "sourceApps": [
              "claude"
            ],
            "supported": false,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "aws-bedrock-api-key-anthropic"
    ],
    "protocol": "anthropic",
    "baseUrl": "https://bedrock-runtime.${AWS_REGION}.amazonaws.com"
  },
  {
    "presetKey": "jiekou-ai",
    "slug": "jiekou-ai",
    "name": "JieKou AI",
    "category": "aggregator",
    "websiteUrl": "https://jiekou.ai/#model-library",
    "consoleUrl": "https://jiekou.ai/settings/key-management",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "claude",
      "claude-desktop",
      "codex",
      "opencode",
      "openclaw",
      "hermes"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"claude-fable-5\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"jiekou\"\nbase_url = \"https://api.jiekou.ai/openai/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.jiekou.ai/openai/v1",
        "selectedVariantSlug": "jiekou-ai-openai",
        "sourceApps": [
          "codex",
          "opencode",
          "openclaw",
          "hermes"
        ],
        "knownModels": [
          {
            "id": "claude-fable-5",
            "displayName": "Claude Fable 5",
            "contextWindow": 1000000,
            "pricing": {
              "input": 10,
              "output": 50,
              "cacheRead": 1,
              "cacheWrite": 12.5
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "jiekou-ai-openai",
            "baseUrl": "https://api.jiekou.ai/openai/v1",
            "sourceApps": [
              "codex",
              "opencode",
              "openclaw",
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      },
      {
        "protocol": "anthropic",
        "baseUrl": "https://api.jiekou.ai/anthropic",
        "selectedVariantSlug": "jiekou-ai-anthropic",
        "sourceApps": [
          "claude",
          "claude-desktop"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "jiekou-ai-anthropic",
            "baseUrl": "https://api.jiekou.ai/anthropic",
            "sourceApps": [
              "claude",
              "claude-desktop"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "jiekou-ai-openai",
      "jiekou-ai-anthropic"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.jiekou.ai/openai/v1"
  },
  {
    "presetKey": "azure-openai",
    "slug": "azure-openai",
    "name": "Azure OpenAI",
    "category": "third_party",
    "logo": "/logos/azure.svg",
    "websiteUrl": "https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/codex",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "codex"
    ],
    "extra": {
      "config": "model_provider = \"custom\"\nmodel = \"gpt-5.6-sol\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"Azure OpenAI\"\nbase_url = \"https://YOUR_RESOURCE_NAME.openai.azure.com/openai\"\nenv_key = \"OPENAI_API_KEY\"\nquery_params = { \"api-version\" = \"2025-04-01-preview\" }\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai-responses",
    "endpoints": [
      {
        "protocol": "openai-responses",
        "baseUrl": "https://YOUR_RESOURCE_NAME.openai.azure.com/openai",
        "selectedVariantSlug": "azure-openai-responses",
        "sourceApps": [
          "codex"
        ],
        "knownModels": [
          {
            "id": "gpt-5.6-sol",
            "pricing": {
              "input": 5,
              "output": 30,
              "cacheRead": 0.5,
              "cacheWrite": 6.25
            }
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "azure-openai-responses",
            "baseUrl": "https://YOUR_RESOURCE_NAME.openai.azure.com/openai",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "azure-openai-responses"
    ],
    "protocol": "openai-responses",
    "baseUrl": "https://YOUR_RESOURCE_NAME.openai.azure.com/openai"
  },
  {
    "presetKey": "tencent-hunyuan",
    "slug": "tencent-hunyuan",
    "name": "Tencent Hunyuan",
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
      "config": "model_provider = \"custom\"\nmodel = \"hy3\"\nmodel_reasoning_effort = \"high\"\ndisable_response_storage = true\n\n[model_providers.custom]\nname = \"hy3_tokenhub\"\nbase_url = \"https://tokenhub.tencentmaas.com/v1\"\nwire_api = \"responses\"\nrequires_openai_auth = true"
    },
    "defaultProtocol": "openai-responses",
    "endpoints": [
      {
        "protocol": "openai-responses",
        "baseUrl": "https://tokenhub.tencentmaas.com/v1",
        "selectedVariantSlug": "tencent-hunyuan-responses",
        "sourceApps": [
          "codex"
        ],
        "knownModels": [
          {
            "id": "hy3",
            "displayName": "Hy3",
            "contextWindow": 256000,
            "modalities": [
              "text"
            ],
            "reasoningLevels": [
              "low",
              "high"
            ],
            "pricing": {
              "input": 0.14,
              "output": 0.56,
              "cacheRead": 0.035,
              "cacheWrite": 0
            }
          },
          {
            "id": "hy3-preview",
            "displayName": "Hy3 Preview",
            "contextWindow": 256000,
            "modalities": [
              "text"
            ],
            "reasoningLevels": [
              "low",
              "high"
            ]
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "tencent-hunyuan-responses",
            "baseUrl": "https://tokenhub.tencentmaas.com/v1",
            "sourceApps": [
              "codex"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "tencent-hunyuan-responses"
    ],
    "protocol": "openai-responses",
    "baseUrl": "https://tokenhub.tencentmaas.com/v1"
  },
  {
    "presetKey": "together-ai",
    "slug": "together-ai",
    "name": "Together AI",
    "category": "aggregator",
    "websiteUrl": "https://together.ai",
    "consoleUrl": "https://api.together.ai/settings/api-keys",
    "supported": true,
    "authMode": "api-key",
    "sourceApps": [
      "hermes"
    ],
    "extra": {
      "suggestedDefaults": {
        "model": {
          "default": "Qwen/Qwen3-Coder-480B-A35B-Instruct",
          "provider": "together"
        }
      }
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://api.together.xyz/v1",
        "selectedVariantSlug": "together-ai-openai",
        "sourceApps": [
          "hermes"
        ],
        "knownModels": [
          {
            "id": "Qwen/Qwen3-Coder-480B-A35B-Instruct",
            "displayName": "Qwen3 Coder 480B",
            "contextWindow": 262144,
            "pricing": {
              "input": 0.65,
              "output": 3.25,
              "cacheRead": 0,
              "cacheWrite": 0
            }
          },
          {
            "id": "deepseek-ai/DeepSeek-V3.2",
            "displayName": "DeepSeek V3.2",
            "contextWindow": 64000,
            "pricing": {
              "input": 0.28,
              "output": 0.42,
              "cacheRead": 0.028,
              "cacheWrite": 0
            }
          },
          {
            "id": "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
            "displayName": "Llama 4 Maverick",
            "contextWindow": 131072
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "together-ai-openai",
            "baseUrl": "https://api.together.xyz/v1",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "together-ai-openai"
    ],
    "protocol": "openai",
    "baseUrl": "https://api.together.xyz/v1"
  },
  {
    "presetKey": "nous-research",
    "slug": "nous-research",
    "name": "Nous Research",
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
      "suggestedDefaults": {
        "model": {
          "default": "Hermes-4-405B",
          "provider": "nous"
        }
      }
    },
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "https://inference-api.nousresearch.com/v1",
        "selectedVariantSlug": "nous-research-openai",
        "sourceApps": [
          "hermes"
        ],
        "knownModels": [
          {
            "id": "Hermes-4-405B",
            "displayName": "Hermes 4 405B",
            "contextWindow": 131072
          },
          {
            "id": "Hermes-4-70B",
            "displayName": "Hermes 4 70B",
            "contextWindow": 131072
          }
        ],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "nous-research-openai",
            "baseUrl": "https://inference-api.nousresearch.com/v1",
            "sourceApps": [
              "hermes"
            ],
            "supported": true,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "nous-research-openai"
    ],
    "protocol": "openai",
    "baseUrl": "https://inference-api.nousresearch.com/v1"
  },
  {
    "presetKey": "newapi",
    "slug": "newapi",
    "name": "NewAPI",
    "category": "other",
    "logo": "/logos/newapi.svg",
    "websiteUrl": "https://www.newapi.pro",
    "supported": false,
    "disabledReason": "需要先填写自部署 Base URL",
    "authMode": "api-key",
    "sourceApps": [
      "universal"
    ],
    "extra": {},
    "defaultProtocol": "openai",
    "endpoints": [
      {
        "protocol": "openai",
        "baseUrl": "",
        "selectedVariantSlug": "newapi-openai",
        "sourceApps": [
          "universal"
        ],
        "knownModels": [],
        "modelCatalogComplete": false,
        "alternateCandidates": [
          {
            "variantSlug": "newapi-openai",
            "baseUrl": "",
            "sourceApps": [
              "universal"
            ],
            "supported": false,
            "authMode": "api-key"
          }
        ]
      }
    ],
    "legacySlugs": [
      "newapi-openai"
    ],
    "protocol": "openai",
    "baseUrl": ""
  }
];

export const CC_SWITCH_PRESETS: ProviderPreset[] = CC_SWITCH_LOGICAL_PRESETS;
