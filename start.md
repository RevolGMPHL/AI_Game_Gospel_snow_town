# 🥶 福音雪镇 — 末日生存 启动说明

## 网页地址

http://localhost:8080

## 启动服务

```bash
cd /data/project/project_revol/vibegame/20260220-gospel_snow_town
nohup node server.js > log/server.log 2>&1 &
echo "服务已启动，PID: $!"

```

## 关闭服务

```bash
kill $(lsof -t -i:8080) 2>/dev/null && echo "服务已关闭" || echo "没有运行中的服务"
```

## 快速重启

```bash
kill $(lsof -t -i:8080) 2>/dev/null; sleep 0.5
cd /data/project/project_revol/vibegame/20260220-gospel_snow_town
nohup node server.js > log/server.log 2>&1 &
echo "服务已重启，PID: $!"

```

## 查看服务状态

```bash
lsof -i :8080 | grep LISTEN
```

## 项目文件说明

| 文件 | 说明 |
|------|------|
| `index.html` | 主页面（含生存状态栏 + 资源面板） |
| `game.js` | 主游戏逻辑，集成所有子系统 |
| `npc.js` | NPC系统（含体温/失温/死亡属性） |
| `maps.js` | 地图系统（冬季末日配色） |
| `dialogue.js` | 对话系统 |
| `weather-system.js` | 4天温度周期 + 雪花粒子 |
| `resource-system.js` | 木柴/食物/电力/建材资源管理 |
| `furnace-system.js` | 暖炉系统 + 室内温度 |
| `task-system.js` | NPC专长 + 每日任务分配 |
| `death-system.js` | 死亡判定 + 4种结局 |
| `event-system.js` | 冲突事件 + 调解/鼓舞机制 |
| `style.css` | 冰霜深色主题样式 |
| `server.js` | Node.js 静态服务器 |
