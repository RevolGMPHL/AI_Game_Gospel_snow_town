# 技术架构 & 素材清单

## 文件结构

```
20260217-gospeltown/
├── index.html              # 入口页面
├── game.js                 # 游戏主逻辑（主循环/渲染/昼夜天气/碰撞/输入/LLM调用/Debug面板）
├── maps.js                 # 地图定义（村庄+9个室内场景，含医院）
├── npc.js                  # NPC 系统（8个NPC配置/日程/AI思考/移动/睡眠/属性/目标/奖惩/Sprite渲染）
├── dialogue.js             # 对话系统（NPC↔NPC对话生成+逐句播放/AI轮询调度/fallback机制）
├── style.css               # 样式
├── start-ollama.sh         # Ollama 本地模型启动脚本（含模型路径/CORS/性能配置）
├── asset/                  # 素材目录
│   ├── character/          # NPC sprite sheets
│   │   ├── 李婶/           # texture.png + portrait.png
│   │   ├── 赵大厨/
│   │   ├── 王老师/
│   │   ├── 老钱/
│   │   ├── 苏医生/
│   │   ├── 陆辰/
│   │   ├── 凌玥/
│   │   ├── 清璇/
│   │   └── sprite.json     # Sprite 帧定义
│   └── 角色设计稿/          # 新角色形象设计
└── guide/
    ├── guide.md            # 总目录索引
    ├── 01-design.md        # 设计理念
    ├── 02-map.md           # 地图设计
    ├── 03-npc.md           # NPC 居民设计
    ├── 04-attributes.md    # 属性系统
    ├── 05-ai.md            # AI 系统
    ├── 06-tech.md          # 技术架构（本文件）
    ├── 07-plan.md          # 开发计划
    ├── 08-changelog.md     # 更新日志
    └── 09-pitfalls.md      # 踩坑记录 & 开发注意事项
```

## 核心类设计

```javascript
class BaseMap { ... }           // 地图基类
class VillageMap extends BaseMap { ... }  // 村庄主地图
class TavernMap extends BaseMap { ... }   // 室内场景...

class NPC {
    constructor(config)           // 名字、性格、住所、日程、属性等
    think(gameTime, allNPCs)      // AI 思考主循环（含奖惩意识 + concern/goalFocus）
    _actionDecision(game)         // AI 行动决策（含威胁/机会分析）
    _updateAttributes(dt, game)   // 属性缓慢变化（含10种连锁惩罚）
    _updateSchedule(dt, game)     // 日程调度
    _updateHunger(dt, game)       // 饥饿系统
    _updateGoals(dt, game)        // 目标系统（每日/长期目标 + 奖励发放）
    getStatusLine()               // 统一状态摘要出口
    drawBubbleLayer(ctx)          // 对话气泡独立渲染层
    _logDebug(type, detail)       // Debug日志（含游戏天数+真实时间）
}

class DialogueManager {
    startNPCChat(npc1, npc2)   // NPC间对话（全链路同场景保护）
    startPlayerChat(npc)       // 玩家对话
    _generateNPCLineWithEnd()  // 对话生成（含fallback+连续失败检测）
}

class Game {
    constructor()
    update(dt)                 // 主循环
    render()                   // 渲染（分层：实体层 → 气泡层）
    switchScene(target, pos)   // 场景切换
    _renderDebugTab(npc)       // Debug面板（状态/行动/目标/奖惩/对话）
}

// 全局
const LLM_STATUS = { ... }     // API状态跟踪（成功率/连续失败/宕机检测）
async function callLLM(...)    // LLM调用（重试/Ollama原生+OpenAI兼容/think标签清理）
```
```

## 渲染层次

```
绘制顺序（从底到顶）:
1. 地面层 — getTileColor() 绘制基础地面
2. 路径层 — 石板路、泥土路
3. 装饰层 — 花、草丛、栅栏
4. 建筑层 — 房屋外观（Y-Sort）
5. 实体层 — NPC + 玩家 + 状态标签（Y-Sort）
6. 气泡层 — 对话气泡（drawBubbleLayer，独立pass，不被遮挡）
7. 顶层 — 树冠（遮挡效果）
8. UI 层 — 名字标签、时间、小地图、Debug面板
```

---

## 可复用素材清单

### 从 town 项目复用

| 素材 | 路径 | 用途 |
|------|------|------|
| NPC Sprite 素材 | `20260215-town/.../agents/*/texture.png` | 角色行走动画 |
| NPC 头像 | `20260215-town/.../agents/*/portrait.png` | 对话框头像 |
| Sprite Atlas | `20260215-town/.../agents/sprite.json` | 帧定义 |

### 从 farm3 复用

| 模块 | 内容 | 说明 |
|------|------|------|
| BaseMap 框架 | 地图基类 + drawGrid + 碰撞检测 | 核心地图系统 |
| A* 寻路 | findPath + BFS 目标修正 | 路径规划 |
| 碰撞系统 | AABB + 圆形碰撞 + getCirclePush | 物理碰撞 |
| AI 调用架构 | LLM API 调用 + retry + failsafe | AI 引擎 |

---

## LLM 配置（v1.4 新增）

### 双模式 API 架构

game.js 中的 `callLLM` 支持两种模式，通过 `USE_OLLAMA_NATIVE` 开关切换：

| 模式 | API URL | 适用模型 | 特点 |
|------|---------|----------|------|
| Ollama 原生 | `http://localhost:11434/api/chat` | qwen3:4b 等本地模型 | 支持 `think:false` 关闭思考模式 |
| OpenAI 兼容 | `http://localhost:11434/v1/chat/completions` 或云端 | GLM-4-Flash 等 | 标准 OpenAI 格式 |

### Ollama 本地部署

```bash
# 启动（使用项目脚本）
./start-ollama.sh

# 或手动启动（指定模型存储路径 + CORS）
OLLAMA_MODELS=/Users/revolgmphl/Desktop/DEMO/vibegame/model \
OLLAMA_ORIGINS="*" \
ollama serve
```

环境变量说明：
- `OLLAMA_MODELS` — 模型权重存储路径
- `OLLAMA_ORIGINS="*"` — 解决浏览器 CORS 跨域问题（file:// 协议必须）
- `OLLAMA_FLASH_ATTENTION=1` — 启用 Flash Attention 加速
- `OLLAMA_KV_CACHE_TYPE=q8_0` — KV Cache 量化节省显存

### LLM_STATUS 全局状态跟踪

```javascript
LLM_STATUS = {
    totalCalls,        // 总调用次数
    successCalls,      // 成功次数
    failedCalls,       // 失败次数
    consecutiveFails,  // 连续失败次数（≥10 触发60秒暂停）
    lastError,         // 最后一次错误信息
    isDown             // API 是否疑似宕机
}
```