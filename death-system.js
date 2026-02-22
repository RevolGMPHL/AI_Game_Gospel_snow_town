/**
 * 死亡系统与结局判定 — DeathSystem
 * 统一管理NPC死亡判定、死亡连锁反应、结局判定与结局界面
 * 依赖: game.js, npc.js, weather-system.js, resource-system.js
 */

// ============ 结局配置 ============
const ENDINGS = {
    PERFECT: {
        id: 'perfect',
        title: '🌟 众志成城，共度寒冬',
        minSurvivors: 8,
        desc: '所有人都活了下来。在这场史无前例的极寒中，八个人齐心协力、互相扶持，没有一个人掉队。当第五天的阳光终于穿透云层时，他们紧紧拥抱在一起，泪流满面。',
        color: '#ffd700',
    },
    NORMAL: {
        id: 'normal',
        title: '🕊️ 虽有牺牲，希望犹在',
        minSurvivors: 5,
        desc: '有人倒在了寒冬中，但大多数人活了下来。他们会永远记住那些没能熬过这个冬天的同伴，也会带着他们的份一起，走向春天。',
        color: '#87ceeb',
    },
    BLEAK: {
        id: 'bleak',
        title: '💀 寒冬无情，几经生死',
        minSurvivors: 2,
        desc: '只有少数人幸存。暖炉旁堆满了记忆，每一个空位都是一声沉默的叹息。他们不知道自己是幸运还是不幸——活下来，意味着要承受更多的失去。',
        color: '#ff6b6b',
    },
    EXTINCTION: {
        id: 'extinction',
        title: '❄️ 大雪掩埋了一切...',
        minSurvivors: 0,
        desc: '当救援队在第五天抵达时，小镇已经被白雪完全覆盖。暖炉熄灭了，食物耗尽了，所有的挣扎都变成了冰雕。只有风声在空荡荡的街道上回响，诉说着这个冬天的故事。',
        color: '#8b9dc3',
    },
};

// ============ 死亡原因配置 ============
const DEATH_CAUSES = {
    FROZEN: { id: '冻死', icon: '🧊', desc: '因严重失温而死亡' },
    STARVED: { id: '饿死', icon: '💀', desc: '因长期饥饿而死亡' },
    STAMINA_EXHAUSTION: { id: '体力衰竭', icon: '💤', desc: '因长期体力枯竭而死亡' },
    MENTAL_BREAKDOWN: { id: '精神崩溃致死', icon: '🌀', desc: '精神崩溃导致的悲剧' },
    VIOLENCE: { id: '暴力致死', icon: '💢', desc: '在冲突中被攻击致死' },
};

class DeathSystem {
    constructor(game) {
        this.game = game;

        // 死亡记录列表
        this.deathRecords = [];
        // { npcId, npcName, cause, causeIcon, time, dayNum, bodyTemp, location }

        // 关键事件时间线
        this.timeline = [];
        // { time, dayNum, text, type: 'death'|'crisis'|'milestone'|'conflict' }

        // 结局状态
        this.endingTriggered = false;
        this.currentEnding = null;

        // 死亡检测tick
        this._deathCheckTimer = 0;
        this._deathCheckInterval = 1.0; // 每1秒检查一次

        // 悲痛效果追踪
        this._griefEffects = [];
        // { npcId, deadNpcId, startTime, duration, efficiencyMult }

        console.log('[DeathSystem] 初始化完成');
    }

    // ============ 主更新循环 ============

    /** 在game.update()中调用 */
    update(gameDt) {
        if (this.endingTriggered) return;

        this._deathCheckTimer += gameDt;
        if (this._deathCheckTimer >= this._deathCheckInterval) {
            this._deathCheckTimer = 0;
            this._checkDeaths();
        }

        // 更新悲痛效果
        this._updateGriefEffects(gameDt);

        // 检查结局条件（第4天日落18:00）
        this._checkEndingCondition();
    }

    // ============ 死亡判定 ============

    /** 每秒检测所有NPC的死亡条件 */
    _checkDeaths() {
        for (const npc of this.game.npcs) {
            if (npc.isDead) continue;

            let deathCause = null;

            // 1. 健康值归零 → 死亡
            if (npc.health <= 0) {
                // 判定死因（优先使用NPC自身标记的死因）
                if (npc._deathCause) {
                    deathCause = npc._deathCause;
                } else if (npc.bodyTemp < 30) {
                    deathCause = '冻死';
                } else if (npc.hunger !== undefined && npc.hunger <= 0 && npc.stamina <= 0) {
                    deathCause = '饥饿与体力衰竭';
                } else if (npc.hunger !== undefined && npc.hunger <= 0) {
                    deathCause = '饿死';
                } else if (npc.stamina <= 0) {
                    deathCause = '体力衰竭';
                } else if (npc.isSick) {
                    deathCause = '疾病致死';
                } else if (npc.sanity <= 0 || npc.isCrazy) {
                    deathCause = '精神崩溃致死';
                } else {
                    deathCause = '冻死'; // 默认死因
                }

                this._processNpcDeath(npc, deathCause);
            }

            // 2. 体温致命判定（健康还没归零但体温已经极低）
            if (npc.bodyTemp <= 25 && !npc.isDead) {
                npc.health = 0;
                this._processNpcDeath(npc, '冻死');
            }

            // 3. San值归零 + 健康低于20 → 精神崩溃致死
            if (npc.sanity <= 0 && npc.health <= 20 && !npc.isDead) {
                npc.health = 0;
                this._processNpcDeath(npc, '精神崩溃致死');
            }

            // 4. 【新增】体力衰竭致死：体力=0持续超过2小时(7200秒) + 健康<30
            if (!npc.isDead && npc._zeroStaminaDuration > 7200 && npc.health < 30) {
                npc.health = 0;
                this._processNpcDeath(npc, '体力衰竭');
            }

            // 5. 【v2.0】饥饿加速死亡：饱腹=0持续超过4小时(14400秒)，健康以高速率下降
            if (!npc.isDead && npc._zeroHungerDuration > 14400) {
                // 持续饥饿加速健康下降：0.15/秒 → 约11分钟从100降到0
                npc.health = Math.max(0, npc.health - 0.15 * this._deathCheckInterval);
                if (npc.health <= 0) {
                    npc._deathCause = '饿死';
                    this._processNpcDeath(npc, '饿死');
                }
            }

            // 6. 【v2.0】严重失温加速死亡：体温<33°C持续超过30分钟(1800秒)，健康以0.2/秒速率下降
            if (!npc.isDead && npc.bodyTemp < 33 && npc._hypothermiaDuration > 1800) {
                npc.health = Math.max(0, npc.health - 0.2 * this._deathCheckInterval);
                if (npc.health <= 0) {
                    npc._deathCause = '冻死';
                    this._processNpcDeath(npc, '冻死');
                }
            }

            // 7. 【v2.0】濒死状态检测：饱腹=0 + 体力=0 + 健康<30 → 进入濒死
            if (!npc.isDead && !npc._isDying && npc.hunger <= 0 && npc.stamina <= 0 && npc.health < 30) {
                npc._isDying = true;
                npc._dyingTimer = 0;
                npc.state = 'IDLE';
                npc.currentPath = [];
                npc.isMoving = false;
                npc.expression = '不行了…谁来帮帮我…';
                npc.expressionTimer = 30;
                npc.mood = '濒死';
                npc.stateDesc = '⚠️ 濒死';
                if (this.game.addEvent) {
                    this.game.addEvent(`🚨🚨 ${npc.name} 陷入濒死状态！需要急救包救助！`);
                }
                this._addTimelineEvent('crisis', `🚨 ${npc.name} 陷入濒死状态（饥饿+体力耗尽+健康极低）`);
                console.warn(`[DeathSystem] ${npc.name} 进入濒死状态! health:${npc.health.toFixed(1)}`);
            }

            // 8. 【v2.0】濒死状态持续5分钟(300秒)无救助则死亡
            if (!npc.isDead && npc._isDying) {
                npc._dyingTimer = (npc._dyingTimer || 0) + this._deathCheckInterval;
                // 濒死期间持续扣血
                npc.health = Math.max(0, npc.health - 0.05 * this._deathCheckInterval);
                if (npc._dyingTimer >= 300 || npc.health <= 0) {
                    const cause = npc.hunger <= 0 ? '饿死' : (npc.bodyTemp < 33 ? '冻死' : '体力衰竭');
                    npc._deathCause = cause;
                    this._processNpcDeath(npc, cause);
                }
            }

            // 9. 精神崩溃加速死亡：San=0且发疯持续超过1小时(3600秒)，健康以2倍速率下降
            if (!npc.isDead && npc._zeroCrazyDuration > 3600) {
                npc.health = Math.max(0, npc.health - 0.06 * this._deathCheckInterval);
                if (npc.health <= 0) {
                    npc._deathCause = '精神崩溃致死';
                    this._processNpcDeath(npc, '精神崩溃致死');
                }
            }
        }
    }

    /** 处理NPC死亡 */
    _processNpcDeath(npc, cause) {
        if (npc.isDead) return; // 防重复

        // 标记死亡
        npc.isDead = true;
        npc._deathCause = cause;
        npc._deathTime = this.game.getTimeStr();

        // 停止所有行动
        npc.state = 'IDLE';
        npc.currentPath = [];
        npc.pathIndex = 0;
        npc._pendingAction = null;
        npc._currentAction = null;
        npc._actionOverride = false;

        // 记录死亡信息
        const causeConfig = Object.values(DEATH_CAUSES).find(c => c.id === cause) || { icon: '💀', desc: cause };
        const record = {
            npcId: npc.id,
            npcName: npc.name,
            cause: cause,
            causeIcon: causeConfig.icon,
            causeDesc: causeConfig.desc,
            time: this.game.getTimeStr(),
            dayNum: this.game.dayCount,
            bodyTemp: npc.bodyTemp ? npc.bodyTemp.toFixed(1) : 'N/A',
            location: npc.currentScene || 'unknown',
            sanity: Math.round(npc.sanity || 0),
            health: 0,
            hunger: Math.round(npc.hunger || 0),
        };
        this.deathRecords.push(record);

        // 添加到时间线
        this._addTimelineEvent('death', `${causeConfig.icon} ${npc.name} ${cause}（体温:${record.bodyTemp}°C, 位置:${record.location}）`);

        // 全屏事件通知 【v2.0增强：添加死因详情和高亮标记】
        if (this.game.addEvent) {
            this.game.addEvent(`💀💀💀 ${npc.name} 死亡！死因: ${cause} ${causeConfig.icon}（体温:${record.bodyTemp}°C，健康:0，位置:${record.location}）`);
        }

        // 设置死亡视觉状态
        npc.mood = '已故';
        npc.stateDesc = `已故 — ${cause}`;
        npc.expression = '';
        npc.expressionTimer = 0;

        console.log(`[DeathSystem] ${npc.name} 死亡！死因: ${cause}, 时间: ${record.time}, 体温: ${record.bodyTemp}°C`);

        // 触发死亡连锁反应
        this._triggerDeathChainReaction(npc, cause);

        // 检查是否全灭
        this._checkExtinction();
    }

    // ============ 死亡连锁反应 ============

    /** 死亡连锁反应：对所有存活NPC施加San值打击 */
    _triggerDeathChainReaction(deadNpc, cause) {
        const aliveNPCs = this.game.npcs.filter(n => !n.isDead);
        if (aliveNPCs.length === 0) return;

        for (const npc of aliveNPCs) {
            // 基础San值打击: -10 【v2.0: 调整为-10，与需求文档一致】
            let sanPenalty = -10;

            // 判断亲密程度
            const affinity = npc.getAffinity ? npc.getAffinity(deadNpc.id) : 50;
            const isClose = affinity >= 70; // 好感度≥70视为亲密

            // 特殊家庭关系判定
            const isFamilyRelation = this._isFamilyRelation(npc.id, deadNpc.id);

            if (isFamilyRelation || isClose) {
                // 亲密者/家人: San值打击-25
                sanPenalty = -25;

                // 进入悲痛状态（效率×0.3，持续2小时=7200游戏秒）
                this._griefEffects.push({
                    npcId: npc.id,
                    deadNpcId: deadNpc.id,
                    deadNpcName: deadNpc.name,
                    startTime: 0,
                    duration: 7200, // 2小时
                    elapsed: 0,
                    efficiencyMult: 0.3,
                });

                npc.mood = '悲痛';
                npc.stateDesc = `因${deadNpc.name}的死亡陷入悲痛`;
                npc.expression = `${deadNpc.name}…不…`;
                npc.expressionTimer = 15;

                if (this.game.addEvent) {
                    this.game.addEvent(`😢 ${npc.name} 因${deadNpc.name}的死亡陷入深深的悲痛（San-25，效率降至30%）`);
                }
            } else {
                // 非亲密: San-15 + 恐惧
                npc.expression = `${deadNpc.name}死了…我们也会…`;
                npc.expressionTimer = 10;
            }

            // 施加San值打击
            npc.sanity = Math.max(0, npc.sanity + sanPenalty);

            // 好感度高的NPC额外健康影响（悲痛伤身）
            if (isClose || isFamilyRelation) {
                npc.health = Math.max(0, npc.health - 5);
            }
        }

        // 全体恐惧事件
        this._addTimelineEvent('crisis', `全镇因${deadNpc.name}的死亡陷入悲痛和恐惧`);
    }

    /** 判断是否为家庭关系 */
    _isFamilyRelation(npcId1, npcId2) {
        // 家庭关系对：
        // 李婶 ↔ 陆辰 (母子)
        // 老钱 ↔ 清璇 (爷孙)
        const familyPairs = [
            ['li_shen', 'lu_chen'],
            ['old_qian', 'qing_xuan'],
        ];
        return familyPairs.some(pair =>
            (pair[0] === npcId1 && pair[1] === npcId2) ||
            (pair[0] === npcId2 && pair[1] === npcId1)
        );
    }

    // ============ 悲痛效果 ============

    /** 更新悲痛效果（降低工作效率） */
    _updateGriefEffects(gameDt) {
        for (let i = this._griefEffects.length - 1; i >= 0; i--) {
            const grief = this._griefEffects[i];
            grief.elapsed += gameDt;

            if (grief.elapsed >= grief.duration) {
                // 悲痛结束
                const npc = this.game.npcs.find(n => n.id === grief.npcId);
                if (npc && !npc.isDead) {
                    npc.expression = `得振作起来…为了${grief.deadNpcName}…`;
                    npc.expressionTimer = 8;
                    if (npc.mood === '悲痛') {
                        npc.mood = '低落';
                    }
                    if (this.game.addEvent) {
                        this.game.addEvent(`🕊️ ${npc.name} 从悲痛中逐渐恢复，但内心仍很沉重`);
                    }
                }
                this._griefEffects.splice(i, 1);
            } else {
                // 悲痛期间持续轻微San值下降
                const npc = this.game.npcs.find(n => n.id === grief.npcId);
                if (npc && !npc.isDead) {
                    npc.sanity = Math.max(0, npc.sanity - 0.02 * gameDt);
                }
            }
        }
    }

    /** 检查NPC是否处于悲痛状态（供其他系统查询） */
    isNpcGrieving(npcId) {
        return this._griefEffects.some(g => g.npcId === npcId);
    }

    /** 获取NPC悲痛效率倍率 */
    getGriefEfficiency(npcId) {
        const grief = this._griefEffects.find(g => g.npcId === npcId);
        return grief ? grief.efficiencyMult : 1.0;
    }

    // ============ 全灭检测 ============

    _checkExtinction() {
        const aliveCount = this.game.npcs.filter(n => !n.isDead).length;
        if (aliveCount === 0) {
            console.log('[DeathSystem] 🚨 全灭！所有NPC已死亡');
            this._addTimelineEvent('crisis', '🚨 全员死亡…小镇陷入了永恒的沉寂');
            this._triggerEnding();
        }
    }

    // ============ 结局判定 ============

    /** 检查结局触发条件：第4天日落(18:00) */
    _checkEndingCondition() {
        if (this.endingTriggered) return;

        const dayCount = this.game.dayCount;
        const hour = this.game.getHour();

        // 第4天18:00触发结局
        if (dayCount >= 4 && hour >= 18) {
            this._triggerEnding();
        }
    }

    /** 触发结局 */
    _triggerEnding() {
        if (this.endingTriggered) return;
        this.endingTriggered = true;

        const aliveCount = this.game.npcs.filter(n => !n.isDead).length;

        // 根据存活人数确定结局
        if (aliveCount >= ENDINGS.PERFECT.minSurvivors) {
            this.currentEnding = ENDINGS.PERFECT;
        } else if (aliveCount >= ENDINGS.NORMAL.minSurvivors) {
            this.currentEnding = ENDINGS.NORMAL;
        } else if (aliveCount >= ENDINGS.BLEAK.minSurvivors) {
            this.currentEnding = ENDINGS.BLEAK;
        } else {
            this.currentEnding = ENDINGS.EXTINCTION;
        }

        console.log(`[DeathSystem] 🏁 结局触发: ${this.currentEnding.title} (存活${aliveCount}人)`);

        // 暂停游戏
        this.game.paused = true;

        // 添加最终时间线事件
        this._addTimelineEvent('milestone', `🏁 ${this.currentEnding.title} — 存活${aliveCount}/8人`);

        // 渲染结局界面
        this._renderEndingScreen(aliveCount);
    }

    // ============ 结局界面渲染 ============

    _renderEndingScreen(aliveCount) {
        const ending = this.currentEnding;

        // 创建结局遮罩层
        const overlay = document.createElement('div');
        overlay.id = 'ending-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0); z-index: 10000;
            display: flex; align-items: center; justify-content: center;
            transition: background 2s ease;
            overflow-y: auto;
        `;

        // 创建结局内容面板
        const panel = document.createElement('div');
        panel.id = 'ending-panel';
        panel.style.cssText = `
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            border: 2px solid ${ending.color}40;
            border-radius: 20px; padding: 40px; max-width: 800px; width: 90%;
            max-height: 85vh; overflow-y: auto;
            color: #e0e0e0; font-family: 'Microsoft YaHei', sans-serif;
            box-shadow: 0 0 60px ${ending.color}30;
            opacity: 0; transform: translateY(30px);
            transition: opacity 1.5s ease 1s, transform 1.5s ease 1s;
        `;

        // 轮回世数和对比信息
        const rs = this.game.reincarnationSystem;
        const lifeNumber = rs ? rs.getLifeNumber() : 1;
        const lastLifeAlive = rs ? rs.getLastLifeAliveCount() : null;
        let comparisonText = '';
        if (lastLifeAlive !== null) {
            const diff = aliveCount - lastLifeAlive;
            if (diff > 0) comparisonText = `<span style="color:#4ade80;">比上一世多存活了${diff}人 ↑</span>`;
            else if (diff < 0) comparisonText = `<span style="color:#ff6b6b;">比上一世少存活了${Math.abs(diff)}人 ↓</span>`;
            else comparisonText = `<span style="color:#888;">与上一世存活人数相同</span>`;
        }

        // 标题
        let html = `
            <div style="text-align:center; margin-bottom:30px;">
                <div style="font-size:48px; margin-bottom:10px;">❄️</div>
                <h1 style="font-size:28px; color:${ending.color}; margin:0 0 10px 0; text-shadow: 0 0 20px ${ending.color}60;">
                    ${ending.title}
                </h1>
                <div style="font-size:14px; color:#888; margin-bottom:8px;">
                    ${lifeNumber > 1 ? `🔄 第${lifeNumber}世 · ` : ''}第4天 · 极寒-60°C · 存活 ${aliveCount}/8 人
                </div>
                ${comparisonText ? `<div style="font-size:13px; margin-bottom:10px;">${comparisonText}</div>` : ''}
                <p style="font-size:15px; line-height:1.8; color:#bbb; max-width:600px; margin:0 auto;">
                    ${ending.desc}
                </p>
            </div>
        `;

        // 世代存活对比（第2世+才显示）
        if (rs && rs.pastLives && rs.pastLives.length > 0) {
            html += `
                <div style="margin-bottom:24px; background:rgba(155,89,182,0.08); border:1px solid rgba(155,89,182,0.2); border-radius:12px; padding:16px;">
                    <h3 style="font-size:15px; color:#c084fc; margin:0 0 12px 0;">🔄 世代存活进度</h3>
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:14px;">
            `;
            // 渲染历史世代
            for (let i = 0; i < rs.pastLives.length; i++) {
                const life = rs.pastLives[i];
                const alive = life.aliveCount;
                const barPct = Math.round((alive / 8) * 100);
                const barColor = alive >= 8 ? '#4ade80' : alive >= 5 ? '#facc15' : alive >= 2 ? '#fb923c' : '#ff6b6b';
                html += `
                    <div style="text-align:center; min-width:60px;">
                        <div style="font-size:11px; color:#888;">第${life.lifeNumber}世</div>
                        <div style="width:50px; height:6px; background:#2a2a3a; border-radius:3px; margin:4px auto; overflow:hidden;">
                            <div style="width:${barPct}%; height:100%; background:${barColor}; border-radius:3px;"></div>
                        </div>
                        <div style="font-size:13px; color:${barColor}; font-weight:bold;">${alive}/8</div>
                    </div>
                `;
                if (i < rs.pastLives.length - 1) {
                    html += `<span style="color:#555;">→</span>`;
                }
            }
            // 当前世
            const curBarPct = Math.round((aliveCount / 8) * 100);
            const curBarColor = aliveCount >= 8 ? '#4ade80' : aliveCount >= 5 ? '#facc15' : aliveCount >= 2 ? '#fb923c' : '#ff6b6b';
            html += `
                    <span style="color:#555;">→</span>
                    <div style="text-align:center; min-width:60px; border:1px solid ${curBarColor}40; border-radius:8px; padding:4px 6px; background:${curBarColor}10;">
                        <div style="font-size:11px; color:#c084fc; font-weight:bold;">第${lifeNumber}世</div>
                        <div style="width:50px; height:6px; background:#2a2a3a; border-radius:3px; margin:4px auto; overflow:hidden;">
                            <div style="width:${curBarPct}%; height:100%; background:${curBarColor}; border-radius:3px;"></div>
                        </div>
                        <div style="font-size:13px; color:${curBarColor}; font-weight:bold;">${aliveCount}/8</div>
                    </div>
                </div>
            `;
            // 简单对比文字
            const lastAlive = rs.pastLives[rs.pastLives.length - 1].aliveCount;
            const diff = aliveCount - lastAlive;
            if (diff > 0) {
                html += `<div style="font-size:12px; color:#4ade80; margin-top:8px;">📈 比上一世多存活了${diff}人！前世经验发挥了作用</div>`;
            } else if (diff < 0) {
                html += `<div style="font-size:12px; color:#ff6b6b; margin-top:8px;">📉 比上一世少存活了${Math.abs(diff)}人…需要调整策略</div>`;
            } else {
                html += `<div style="font-size:12px; color:#888; margin-top:8px;">↔️ 与上一世存活人数相同</div>`;
            }
            html += `</div>`;
        }

        // NPC 状态卡片
        html += `
            <div style="margin-bottom:30px;">
                <h2 style="font-size:18px; color:#fff; border-bottom:1px solid #333; padding-bottom:8px; margin-bottom:15px;">
                    👥 居民最终状态
                </h2>
                <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap:12px;">
        `;

        for (const npc of this.game.npcs) {
            const alive = !npc.isDead;
            const deathRecord = this.deathRecords.find(r => r.npcId === npc.id);
            const statusColor = alive ? '#4ade80' : '#ff6b6b';
            const statusIcon = alive ? '✅' : '💀';
            const statusText = alive ? '存活' : `${deathRecord ? deathRecord.cause : '已故'}`;

            html += `
                <div style="
                    background: ${alive ? 'rgba(74, 222, 128, 0.08)' : 'rgba(255, 107, 107, 0.08)'};
                    border: 1px solid ${alive ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255, 107, 107, 0.2)'};
                    border-radius: 12px; padding: 14px; display:flex; align-items:center; gap:12px;
                ">
                    <div style="
                        width:44px; height:44px; border-radius:50%;
                        background: ${npc.color || '#666'}30;
                        border: 2px solid ${statusColor};
                        display:flex; align-items:center; justify-content:center;
                        font-size:20px; flex-shrink:0;
                    ">${statusIcon}</div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:15px; font-weight:bold; color:${statusColor};">
                            ${npc.name} <span style="font-size:12px; color:#888; font-weight:normal;">${npc.age}岁 · ${npc.occupation}</span>
                        </div>
                        <div style="font-size:13px; color:#999; margin-top:3px;">
                            ${alive
                                ? `❤️${Math.round(npc.health)} 🌡️${npc.bodyTemp ? npc.bodyTemp.toFixed(1) : '36.5'}°C 🧠San:${Math.round(npc.sanity)}`
                                : `${deathRecord ? `${deathRecord.causeIcon} ${deathRecord.cause} · 第${deathRecord.dayNum}天 ${deathRecord.time}` : '已故'}`
                            }
                        </div>
                    </div>
                </div>
            `;
        }

        html += `</div></div>`;

        // 关键事件时间线
        if (this.timeline.length > 0) {
            html += `
                <div style="margin-bottom:30px;">
                    <h2 style="font-size:18px; color:#fff; border-bottom:1px solid #333; padding-bottom:8px; margin-bottom:15px;">
                        📜 关键事件时间线
                    </h2>
                    <div style="position:relative; padding-left:24px;">
                        <div style="position:absolute; left:8px; top:0; bottom:0; width:2px; background:#333;"></div>
            `;

            for (const event of this.timeline) {
                const typeColors = {
                    death: '#ff6b6b',
                    crisis: '#ffa500',
                    milestone: '#4ade80',
                    conflict: '#ff4757',
                };
                const dotColor = typeColors[event.type] || '#666';

                html += `
                    <div style="position:relative; margin-bottom:12px; padding-left:16px;">
                        <div style="
                            position:absolute; left:-5px; top:6px; width:12px; height:12px;
                            border-radius:50%; background:${dotColor};
                            border: 2px solid #1a1a2e;
                        "></div>
                        <div style="font-size:12px; color:#666;">第${event.dayNum}天 ${event.time}</div>
                        <div style="font-size:14px; color:#ccc; margin-top:2px;">${event.text}</div>
                    </div>
                `;
            }

            html += `</div></div>`;
        }

        // 资源统计
        const resSys = this.game.resourceSystem;
        if (resSys) {
            html += `
                <div style="margin-bottom:30px;">
                    <h2 style="font-size:18px; color:#fff; border-bottom:1px solid #333; padding-bottom:8px; margin-bottom:15px;">
                        📊 最终资源统计
                    </h2>
                    <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; text-align:center;">
                        <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:12px;">
                            <div style="font-size:24px;">🪵</div>
                            <div style="font-size:20px; color:#facc15; font-weight:bold;">${Math.round(resSys.woodFuel)}</div>
                            <div style="font-size:11px; color:#888;">木柴剩余</div>
                            <div style="font-size:11px; color:#666;">总消耗: ${Math.round(resSys.totalConsumed.woodFuel)}</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:12px;">
                            <div style="font-size:24px;">🍞</div>
                            <div style="font-size:20px; color:#fb923c; font-weight:bold;">${Math.round(resSys.food)}</div>
                            <div style="font-size:11px; color:#888;">食物剩余</div>
                            <div style="font-size:11px; color:#666;">总消耗: ${Math.round(resSys.totalConsumed.food)}</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:12px;">
                            <div style="font-size:24px;">⚡</div>
                            <div style="font-size:20px; color:#60a5fa; font-weight:bold;">${Math.round(resSys.power)}</div>
                            <div style="font-size:11px; color:#888;">电力剩余</div>
                            <div style="font-size:11px; color:#666;">总消耗: ${Math.round(resSys.totalConsumed.power)}</div>
                        </div>
                        <div style="background:rgba(255,255,255,0.05); border-radius:8px; padding:12px;">
                            <div style="font-size:24px;">🧱</div>
                            <div style="font-size:20px; color:#a78bfa; font-weight:bold;">${Math.round(resSys.material)}</div>
                            <div style="font-size:11px; color:#888;">建材剩余</div>
                            <div style="font-size:11px; color:#666;">总消耗: ${Math.round(resSys.totalConsumed.material)}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        // 底部按钮 — 根据模式显示不同按钮
        const isReincarnationMode = this.game.mode === 'reincarnation';
        const nextLifeNum = lifeNumber + 1;

        if (isReincarnationMode) {
            // 轮回模式：自动倒计时 + 立即轮回 / 暂停轮回
            html += `
                <div id="ending-reincarnation-area" style="text-align:center; margin-top:20px;">
                    <div id="reincarnation-countdown-text" style="font-size:16px; color:#c084fc; margin-bottom:14px;">
                        ⏳ <span id="reincarnation-countdown-num">10</span>秒后自动进入第${nextLifeNum}世...
                    </div>
                    <div id="reincarnation-auto-btns">
                        <button id="btn-ending-instant-reincarnate" style="
                            background: linear-gradient(135deg, #9b59b660, #9b59b630);
                            border: 1px solid #9b59b660; color: #fff;
                            padding: 12px 36px; border-radius: 10px; font-size: 16px;
                            cursor: pointer; transition: all 0.3s;
                        ">⏭️ 立即轮回</button>
                        <button id="btn-ending-pause-reincarnation" style="
                            background: rgba(255,255,255,0.08);
                            border: 1px solid rgba(255,255,255,0.15); color: #aaa;
                            padding: 12px 28px; border-radius: 10px; font-size: 14px;
                            cursor: pointer; margin-left: 12px; transition: all 0.3s;
                        ">⏸️ 暂停轮回</button>
                    </div>
                    <div id="reincarnation-manual-btns" style="display:none;">
                        <button id="btn-ending-resume-reincarnate" style="
                            background: linear-gradient(135deg, #9b59b660, #9b59b630);
                            border: 1px solid #9b59b660; color: #fff;
                            padding: 12px 36px; border-radius: 10px; font-size: 16px;
                            cursor: pointer; transition: all 0.3s;
                        ">🔄 继续轮回</button>
                        <button id="btn-ending-reset" style="
                            background: rgba(255,255,255,0.08);
                            border: 1px solid rgba(255,255,255,0.15); color: #aaa;
                            padding: 12px 28px; border-radius: 10px; font-size: 14px;
                            cursor: pointer; margin-left: 12px; transition: all 0.3s;
                        ">🆕 彻底重来</button>
                        <button id="btn-ending-continue" style="
                            background: rgba(255,255,255,0.08);
                            border: 1px solid rgba(255,255,255,0.15); color: #aaa;
                            padding: 12px 28px; border-radius: 10px; font-size: 14px;
                            cursor: pointer; margin-left: 12px; transition: all 0.3s;
                        ">📷 继续观察</button>
                    </div>
                </div>
            `;
        } else {
            // 非轮回模式：保持原有按钮
            html += `
                <div style="text-align:center; margin-top:20px;">
                    <button id="btn-ending-reincarnate" style="
                        background: linear-gradient(135deg, ${ending.color}60, ${ending.color}30);
                        border: 1px solid ${ending.color}60; color: #fff;
                        padding: 12px 36px; border-radius: 10px; font-size: 16px;
                        cursor: pointer; transition: all 0.3s;
                    ">🔄 轮回重生</button>
                    <button id="btn-ending-reset" style="
                        background: rgba(255,255,255,0.08);
                        border: 1px solid rgba(255,255,255,0.15); color: #aaa;
                        padding: 12px 28px; border-radius: 10px; font-size: 14px;
                        cursor: pointer; margin-left: 12px; transition: all 0.3s;
                    ">🆕 彻底重来</button>
                    <button id="btn-ending-continue" style="
                        background: rgba(255,255,255,0.08);
                        border: 1px solid rgba(255,255,255,0.15); color: #aaa;
                        padding: 12px 28px; border-radius: 10px; font-size: 14px;
                        cursor: pointer; margin-left: 12px; transition: all 0.3s;
                    ">📷 继续观察</button>
                </div>
            `;
        }

        panel.innerHTML = html;
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        // 动画淡入
        requestAnimationFrame(() => {
            overlay.style.background = 'rgba(0, 0, 0, 0.85)';
            panel.style.opacity = '1';
            panel.style.transform = 'translateY(0)';
        });

        // 绑定按钮事件
        setTimeout(() => {
            const self = this;
            const game = this.game;

            // 通用：执行轮回
            const doReincarnate = () => {
                // 清除倒计时定时器
                if (game._reincarnationCountdownInterval) {
                    clearInterval(game._reincarnationCountdownInterval);
                    game._reincarnationCountdownInterval = null;
                }
                if (game._reincarnationCountdownTimer) {
                    clearTimeout(game._reincarnationCountdownTimer);
                    game._reincarnationCountdownTimer = null;
                }
                game.reincarnate();
            };

            // 通用：彻底重来
            const doReset = () => {
                if (game._reincarnationCountdownInterval) {
                    clearInterval(game._reincarnationCountdownInterval);
                }
                if (game._reincarnationCountdownTimer) {
                    clearTimeout(game._reincarnationCountdownTimer);
                }
                if (game.reincarnationSystem) {
                    game.reincarnationSystem.clearAllMemories();
                }
                localStorage.removeItem('tihutown_save');
                location.reload();
            };

            // 通用：继续观察
            const doContinue = () => {
                if (game._reincarnationCountdownInterval) {
                    clearInterval(game._reincarnationCountdownInterval);
                }
                if (game._reincarnationCountdownTimer) {
                    clearTimeout(game._reincarnationCountdownTimer);
                }
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.5s';
                setTimeout(() => {
                    overlay.remove();
                    game.paused = false;
                }, 500);
            };

            if (isReincarnationMode) {
                // ====== 轮回模式：自动倒计时 ======
                let countdown = 10;
                const countdownNumEl = document.getElementById('reincarnation-countdown-num');
                const countdownTextEl = document.getElementById('reincarnation-countdown-text');
                const autoBtns = document.getElementById('reincarnation-auto-btns');
                const manualBtns = document.getElementById('reincarnation-manual-btns');

                // 倒计时定时器
                game._reincarnationCountdownInterval = setInterval(() => {
                    countdown--;
                    if (countdownNumEl) countdownNumEl.textContent = countdown;
                    if (countdown <= 0) {
                        clearInterval(game._reincarnationCountdownInterval);
                        game._reincarnationCountdownInterval = null;
                        // 自动轮回
                        doReincarnate();
                    }
                }, 1000);

                // 立即轮回
                const btnInstant = document.getElementById('btn-ending-instant-reincarnate');
                if (btnInstant) btnInstant.addEventListener('click', doReincarnate);

                // 暂停轮回
                const btnPause = document.getElementById('btn-ending-pause-reincarnation');
                if (btnPause) {
                    btnPause.addEventListener('click', () => {
                        // 停止倒计时
                        if (game._reincarnationCountdownInterval) {
                            clearInterval(game._reincarnationCountdownInterval);
                            game._reincarnationCountdownInterval = null;
                        }
                        // 切换到手动按钮
                        if (countdownTextEl) countdownTextEl.textContent = '⏸️ 轮回已暂停';
                        if (autoBtns) autoBtns.style.display = 'none';
                        if (manualBtns) manualBtns.style.display = '';
                    });
                }

                // 继续轮回（手动模式下）
                const btnResume = document.getElementById('btn-ending-resume-reincarnate');
                if (btnResume) btnResume.addEventListener('click', doReincarnate);

            } else {
                // ====== 非轮回模式：原有按钮绑定 ======
                const btnReincarnate = document.getElementById('btn-ending-reincarnate');
                if (btnReincarnate) btnReincarnate.addEventListener('click', doReincarnate);
            }

            // 通用按钮（两种模式都可能存在）
            const btnReset = document.getElementById('btn-ending-reset');
            if (btnReset) btnReset.addEventListener('click', doReset);

            const btnContinue = document.getElementById('btn-ending-continue');
            if (btnContinue) btnContinue.addEventListener('click', doContinue);

        }, 2000);
    }

    // ============ 墓碑渲染 ============

    /** 在canvas上绘制死亡NPC的墓碑（在game的render中调用） */
    renderGraves(ctx, offsetX, offsetY) {
        for (const record of this.deathRecords) {
            const npc = this.game.npcs.find(n => n.id === record.npcId);
            if (!npc) continue;

            // 只在同一场景中绘制
            if (npc.currentScene !== this.game.currentScene) continue;

            const x = npc.x - offsetX;
            const y = npc.y - offsetY;

            // 绘制墓碑
            ctx.save();

            // 墓碑底座
            ctx.fillStyle = '#555';
            ctx.fillRect(x - 8, y + 6, 16, 6);

            // 墓碑石头
            ctx.fillStyle = '#888';
            ctx.beginPath();
            ctx.moveTo(x - 7, y + 6);
            ctx.lineTo(x - 7, y - 8);
            ctx.quadraticCurveTo(x, y - 14, x + 7, y - 8);
            ctx.lineTo(x + 7, y + 6);
            ctx.closePath();
            ctx.fill();

            // 墓碑边框
            ctx.strokeStyle = '#666';
            ctx.lineWidth = 1;
            ctx.stroke();

            // 十字架
            ctx.strokeStyle = '#aaa';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x, y - 10);
            ctx.lineTo(x, y - 2);
            ctx.moveTo(x - 4, y - 7);
            ctx.lineTo(x + 4, y - 7);
            ctx.stroke();

            // 名字标签
            ctx.font = '9px sans-serif';
            ctx.fillStyle = '#ccc';
            ctx.textAlign = 'center';
            ctx.fillText(npc.name, x, y - 16);

            // 死因图标
            ctx.font = '12px sans-serif';
            ctx.fillText(record.causeIcon, x, y - 24);

            ctx.restore();
        }
    }

    // ============ 时间线管理 ============

    /** 添加关键事件到时间线 */
    _addTimelineEvent(type, text) {
        this.timeline.push({
            time: this.game.getTimeStr(),
            dayNum: this.game.dayCount,
            text: text,
            type: type,
        });

        // 最多保留50条
        if (this.timeline.length > 50) {
            this.timeline.shift();
        }
    }

    /** 外部调用：添加里程碑事件 */
    addMilestone(text) {
        this._addTimelineEvent('milestone', text);
    }

    /** 外部调用：添加危机事件 */
    addCrisis(text) {
        this._addTimelineEvent('crisis', text);
    }

    /** 外部调用：添加冲突事件 */
    addConflict(text) {
        this._addTimelineEvent('conflict', text);
    }

    // ============ 查询接口 ============

    /** 获取存活NPC数量 */
    getAliveCount() {
        return this.game.npcs.filter(n => !n.isDead).length;
    }

    /** 获取死亡NPC数量 */
    getDeadCount() {
        return this.deathRecords.length;
    }

    /** 获取死亡记录列表 */
    getDeathRecords() {
        return [...this.deathRecords];
    }

    /** 获取死亡摘要（给AI prompt用） */
    getDeathSummaryForPrompt() {
        if (this.deathRecords.length === 0) return '';

        let summary = `已有${this.deathRecords.length}人死亡: `;
        summary += this.deathRecords.map(r => `${r.npcName}(${r.cause})`).join('、');
        return summary;
    }

    /** 获取特定NPC的死亡信息 */
    getDeathRecord(npcId) {
        return this.deathRecords.find(r => r.npcId === npcId) || null;
    }

    /** 获取当前结局预估（不触发结局，仅预估） */
    getEndingForecast() {
        const alive = this.getAliveCount();
        if (alive >= 8) return ENDINGS.PERFECT;
        if (alive >= 5) return ENDINGS.NORMAL;
        if (alive >= 2) return ENDINGS.BLEAK;
        return ENDINGS.EXTINCTION;
    }

    // ============ 序列化 ============

    serialize() {
        return {
            deathRecords: [...this.deathRecords],
            timeline: [...this.timeline],
            endingTriggered: this.endingTriggered,
            currentEnding: this.currentEnding ? this.currentEnding.id : null,
            griefEffects: this._griefEffects.map(g => ({
                npcId: g.npcId,
                deadNpcId: g.deadNpcId,
                deadNpcName: g.deadNpcName,
                elapsed: g.elapsed,
                duration: g.duration,
                efficiencyMult: g.efficiencyMult,
            })),
        };
    }

    deserialize(data) {
        if (!data) return;
        this.deathRecords = data.deathRecords || [];
        this.timeline = data.timeline || [];
        this.endingTriggered = data.endingTriggered || false;
        if (data.currentEnding) {
            this.currentEnding = Object.values(ENDINGS).find(e => e.id === data.currentEnding) || null;
        }
        if (data.griefEffects) {
            this._griefEffects = data.griefEffects.map(g => ({
                ...g,
                startTime: 0,
            }));
        }
    }
}
