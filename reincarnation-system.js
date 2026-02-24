/**
 * 轮回系统 — ReincarnationSystem
 * 管理轮回记忆的存储、摘要生成、教训推断、Prompt注入
 * 依赖: game.js, death-system.js, resource-system.js, task-system.js
 */

const REINCARNATION_STORAGE_KEY = 'gospel_reincarnation';
const REINCARNATION_LIFE_NUM_KEY = 'gospel_reincarnation_life_num'; // 独立存储世数，不受pastLives上限影响
const MAX_PAST_LIVES = 5; // 最多保留最近5世记忆

class ReincarnationSystem {
    constructor(game) {
        this.game = game;

        // 非轮回模式（agent/debug）不加载历史轮回数据，强制第1世
        if (game.mode !== 'reincarnation') {
            this.pastLives = [];
            this.currentLifeNumber = 1;
            console.log(`[ReincarnationSystem] 非轮回模式(${game.mode})，强制第1世，不加载历史记忆`);
            return;
        }

        // 轮回模式：从 localStorage 加载历史轮回记忆
        this.pastLives = this.loadPastLives();

        // 从独立存储读取世数（不再从pastLives.length推导，因为pastLives有上限裁剪）
        this.currentLifeNumber = this._loadLifeNumber();

        console.log(`[ReincarnationSystem] 轮回模式初始化完成，当前第${this.currentLifeNumber}世，历史${this.pastLives.length}条记忆`);
    }

    // ============ localStorage 读写 ============

    /** 从 localStorage 加载历史轮回记忆 */
    loadPastLives() {
        try {
            const raw = localStorage.getItem(REINCARNATION_STORAGE_KEY);
            if (!raw) return [];
            const data = JSON.parse(raw);
            if (!Array.isArray(data)) return [];
            return data;
        } catch (e) {
            console.warn('[ReincarnationSystem] 加载轮回记忆失败:', e);
            return [];
        }
    }

    /** 保存当前世的轮回记忆摘要到 localStorage */
    savePastLife() {
        const summary = this.generateReincarnationSummary();
        if (!summary) {
            console.warn('[ReincarnationSystem] 无法生成轮回摘要');
            return;
        }

        this.pastLives.push(summary);

        // 上限管理：最多保留最近5世
        while (this.pastLives.length > MAX_PAST_LIVES) {
            this.pastLives.shift(); // 丢弃最早的记录
        }

        try {
            localStorage.setItem(REINCARNATION_STORAGE_KEY, JSON.stringify(this.pastLives));
            // 同时保存当前世数到独立key
            this._saveLifeNumber(this.currentLifeNumber);
            console.log(`[ReincarnationSystem] 第${this.currentLifeNumber}世记忆已保存`);
        } catch (e) {
            console.error('[ReincarnationSystem] 保存轮回记忆失败:', e);
        }
    }

    /** 清除所有轮回记忆（彻底重来） */
    clearAllMemories() {
        this.pastLives = [];
        this.currentLifeNumber = 1;
        try {
            localStorage.removeItem(REINCARNATION_STORAGE_KEY);
            localStorage.removeItem(REINCARNATION_LIFE_NUM_KEY);
            console.log('[ReincarnationSystem] 所有轮回记忆已清除');
        } catch (e) {
            console.error('[ReincarnationSystem] 清除轮回记忆失败:', e);
        }
    }

    // ============ 世数管理 ============

    /** 获取当前世数 */
    getLifeNumber() {
        return this.currentLifeNumber;
    }

    /** 轮回后更新世数（在 game.reincarnate() 中调用） */
    advanceLife() {
        this.pastLives = this.loadPastLives(); // 重新从 localStorage 加载
        // 直接递增世数，不从pastLives.length推导（因为pastLives有MAX_PAST_LIVES上限裁剪）
        this.currentLifeNumber++;
        this._saveLifeNumber(this.currentLifeNumber);
        console.log(`[ReincarnationSystem] 进入第${this.currentLifeNumber}世`);
    }

    /** 从 localStorage 读取独立存储的世数 */
    _loadLifeNumber() {
        try {
            const raw = localStorage.getItem(REINCARNATION_LIFE_NUM_KEY);
            if (raw) {
                const num = parseInt(raw, 10);
                if (!isNaN(num) && num >= 1) return num;
            }
        } catch (e) {
            console.warn('[ReincarnationSystem] 读取世数失败:', e);
        }
        // 兼容旧版：如果没有独立存储的世数，从pastLives.length推导
        return this.pastLives.length + 1;
    }

    /** 保存世数到 localStorage */
    _saveLifeNumber(num) {
        try {
            localStorage.setItem(REINCARNATION_LIFE_NUM_KEY, String(num));
        } catch (e) {
            console.warn('[ReincarnationSystem] 保存世数失败:', e);
        }
    }

    // ============ 轮回记忆摘要生成 ============

    /** 在结局触发时，从各子系统收集数据，生成结构化摘要 */
    generateReincarnationSummary() {
        const game = this.game;
        const ds = game.deathSystem;
        const rs = game.resourceSystem;
        const ts = game.taskSystem;
        const ws = game.weatherSystem;
        const fs = game.furnaceSystem;

        // 存活/死亡统计
        const aliveCount = game.npcs.filter(n => !n.isDead).length;
        const deadCount = game.npcs.filter(n => n.isDead).length;

        // 结局类型
        let endingType = 'unknown';
        if (ds && ds.currentEnding) {
            endingType = ds.currentEnding.id;
        } else if (aliveCount >= 8) {
            endingType = 'perfect';
        } else if (aliveCount >= 5) {
            endingType = 'normal';
        } else if (aliveCount >= 2) {
            endingType = 'bleak';
        } else {
            endingType = 'extinction';
        }

        // 死亡记录
        const deathRecords = ds ? ds.getDeathRecords().map(r => ({
            name: r.npcName,
            cause: r.cause,
            day: r.dayNum,
            time: r.time,
            location: r.location,
        })) : [];

        // 资源快照（当前剩余）
        const resourceSnapshot = rs ? {
            woodFuel: Math.round(rs.woodFuel),
            food: Math.round(rs.food),
            power: Math.round(rs.power),
            material: Math.round(rs.material),
            totalConsumed: { ...rs.totalConsumed },
            totalCollected: { ...rs.totalCollected },
        } : null;

        // 第二暖炉状态
        const secondFurnaceBuilt = fs ? fs.secondFurnaceBuilt : false;

        // 未完成任务
        const unfinishedTasks = ts ? ts.unfinishedTaskLog.map(log => ({
            day: log.day,
            tasks: log.tasks.map(t => ({
                name: t.name,
                progress: t.progress,
                target: t.target,
            })),
        })) : [];

        // 关键事件（冲突和危机）
        const keyEvents = ds ? ds.timeline
            .filter(e => e.type === 'conflict' || e.type === 'crisis' || e.type === 'death')
            .map(e => ({
                day: e.dayNum,
                time: e.time,
                text: e.text,
                type: e.type,
            })) : [];

        // NPC最终状态
        const npcFinalStates = game.npcs.map(npc => ({
            id: npc.id,
            name: npc.name,
            isDead: npc.isDead,
            sanity: Math.round(npc.sanity || 0),
            stamina: Math.round(npc.stamina || 0),
            health: Math.round(npc.health || 0),
            bodyTemp: npc.bodyTemp ? parseFloat(npc.bodyTemp.toFixed(1)) : 36.5,
        }));

        // 教训总结
        const lessons = this.generateLessons(deathRecords, resourceSnapshot, secondFurnaceBuilt, aliveCount);

        const summary = {
            lifeNumber: this.currentLifeNumber,
            endingType: endingType,
            aliveCount: aliveCount,
            deadCount: deadCount,
            deathRecords: deathRecords,
            resourceSnapshot: resourceSnapshot,
            secondFurnaceBuilt: secondFurnaceBuilt,
            unfinishedTasks: unfinishedTasks,
            keyEvents: keyEvents.slice(-10), // 最多保留10条关键事件
            npcFinalStates: npcFinalStates,
            lessons: lessons,
            timestamp: Date.now(),
        };

        return summary;
    }

    // ============ 教训推断 ============

    /** 基于数据自动推断教训 */
    generateLessons(deathRecords, resourceSnapshot, secondFurnaceBuilt, aliveCount) {
        const lessons = [];

        // 1. 木柴不足
        if (resourceSnapshot && resourceSnapshot.woodFuel < 20) {
            lessons.push('木柴储备严重不足，第1天应多安排人手砍柴，目标至少80单位');
        }

        // 2. 食物不足
        if (resourceSnapshot && resourceSnapshot.food < 10) {
            lessons.push('食物储备不足，需更积极收集食物，目标至少50单位');
        }

        // 3. 有人冻死
        const frozenDeaths = deathRecords.filter(r => r.cause === '冻死');
        if (frozenDeaths.length > 0) {
            const outdoorDeaths = frozenDeaths.filter(r => r.location === 'village');
            if (outdoorDeaths.length > 0) {
                lessons.push(`${outdoorDeaths.map(r => r.name).join('、')}在户外冻死，应严格控制外出时间，尤其第2天`);
            }
            if (frozenDeaths.some(r => r.day >= 4)) {
                lessons.push('第4天有人冻死，暖炉供暖和木柴储备不够，需提前准备更多木柴');
            }
        }

        // 4. 有人饿死
        const starvedDeaths = deathRecords.filter(r => r.cause === '饿死');
        if (starvedDeaths.length > 0) {
            lessons.push('有人饿死，食物收集严重不足，第1天应优先大量收集食物');
        }

        // 5. 精神崩溃致死
        const mentalDeaths = deathRecords.filter(r => r.cause === '精神崩溃致死');
        if (mentalDeaths.length > 0) {
            lessons.push('有人精神崩溃致死，需更重视San值维护，多安排鼓舞和心理疏导');
        }

        // 6. 第二暖炉未建好
        if (!secondFurnaceBuilt) {
            lessons.push('第二暖炉未能建好，应在第1天就开始收集建材，第3天优先建造');
        }

        // 7. 全员存活
        if (aliveCount >= 8) {
            lessons.push('策略成功！保持当前分配方案，关注资源节约');
        }

        // 8. 电力不足
        if (resourceSnapshot && resourceSnapshot.power < 10) {
            lessons.push('电力不足，需安排人手维护发电机');
        }

        return lessons;
    }

    // ============ Prompt 生成方法 ============

    /**
     * 生成对话用的前世记忆提示（≤300字符）
     * @param {boolean} isReincarnationMode - 是否轮回模式，轮回模式下记忆更清晰直接
     */
    getPastLifeHintForDialogue(isReincarnationMode = false) {
        if (this.currentLifeNumber <= 1 || this.pastLives.length === 0) {
            return ''; // 第1世不注入
        }

        const lastLife = this.pastLives[this.pastLives.length - 1];
        let hint = '';

        if (isReincarnationMode) {
            // 轮回模式：记忆清晰直接，不用模糊化
            hint += `【前世记忆(清晰)】你清楚地记得上一世的一切，这是第${this.currentLifeNumber}次轮回。`;

            // 上一世结局
            const endingNames = { perfect: '全员存活', normal: '大部分人存活', bleak: '只有少数人活下来', extinction: '全员死亡' };
            hint += `上一世${endingNames[lastLife.endingType] || '结局不明'}（${lastLife.aliveCount}/8人存活）。`;

            // 关键死亡记忆
            if (lastLife.deathRecords && lastLife.deathRecords.length > 0) {
                const deaths = lastLife.deathRecords.slice(0, 3);
                hint += `上世${deaths.map(d => `${d.name}在第${d.day}天${d.cause}`).join('，')}。`;
            }

            // 关键教训（更具体）
            if (lastLife.lessons && lastLife.lessons.length > 0) {
                hint += `教训：${lastLife.lessons.slice(0, 2).join('；')}。`;
            }

            // 对话规则
            hint += '说话时可以直接引用前世经验，主动提出具体的生存策略和分工建议，比如“上次我们因为木柴不够死了3个人，这次必须先砍够80单位”。';
        } else {
            // 非轮回模式：模糊语言
            if (this.currentLifeNumber === 2) {
                hint += '【前世记忆(模糊)】你好像做了一个很长的噩梦…';
            } else {
                hint += `【前世记忆(模糊)】你有一种强烈的既视感，好像经历过${this.currentLifeNumber - 1}次了…`;
            }

            const endingNames = { perfect: '全员存活', normal: '大部分人存活', bleak: '只有少数人活下来', extinction: '全员死亡' };
            hint += `梦里${endingNames[lastLife.endingType] || '结局模糊'}。`;

            if (lastLife.deathRecords && lastLife.deathRecords.length > 0) {
                const deaths = lastLife.deathRecords.slice(0, 3);
                hint += `隐约记得${deaths.map(d => `${d.name}好像${d.cause === '冻死' ? '被冻僵了' : d.cause === '饿死' ? '饿倒了' : '出了事'}`).join('，')}。`;
            }

            if (lastLife.lessons && lastLife.lessons.length > 0) {
                hint += `总觉得${lastLife.lessons[0]}。`;
            }

            hint += '说话时可隐晦提及前世感觉，但保持模糊（用“隐约记得”、“总觉得”、“好像梦到过”等词）。';
        }

        // 截断到300字符
        if (hint.length > 300) {
            hint = hint.substring(0, 297) + '…';
        }

        return hint;
    }
    /**
     * 生成思考/行动决策用的前世经验参考
     * @param {boolean} isReincarnationMode - 是否轮回模式，轮回模式下给出更具体的行动指令
     */
    getPastLifeHintForThinking(isReincarnationMode = false) {
        if (this.currentLifeNumber <= 1 || this.pastLives.length === 0) {
            return ''; // 第1世不注入
        }

        const lastLife = this.pastLives[this.pastLives.length - 1];
        let hint = '';

        if (isReincarnationMode) {
            // 轮回模式：记忆完全清晰，给出精确指令
            hint += `【前世清晰记忆 — 第${this.currentLifeNumber}世】`;
            hint += `你完全记得上一世的经历。`;

            // 结局
            const endingNames = { perfect: '完美结局', normal: '普通结局', bleak: '惨淡结局', extinction: '全灭结局' };
            hint += `上世结果：${endingNames[lastLife.endingType] || '未知'}，${lastLife.aliveCount}/8人存活。`;

            // 详细死亡信息
            if (lastLife.deathRecords && lastLife.deathRecords.length > 0) {
                hint += '死亡详情:';
                for (const d of lastLife.deathRecords.slice(0, 5)) {
                    hint += `${d.name}第${d.day}天${d.time}在${d.location}${d.cause};`;
                }
            }

            // 资源状况
            if (lastLife.resourceSnapshot) {
                const rs = lastLife.resourceSnapshot;
                hint += `上世最终资源:木柴${rs.woodFuel}食物${rs.food}电力${rs.power}建材${rs.material}。`;
            }

            // 暖炉状态
            if (!lastLife.secondFurnaceBuilt) {
                hint += '❗上世第二暖炉未建成！';
            }

            // 教训
            if (lastLife.lessons && lastLife.lessons.length > 0) {
                hint += '必须牢记的教训:' + lastLife.lessons.slice(0, 3).join('；') + '。';
            }

            // 策略建议
            hint += this._generateStrategyAdvice(lastLife);

            // 轮回模式专属指令
            hint += '【重要】你完全记得前世所有细节，应主动提出分工建议，并根据上世失败调整策略。第1天开始就应明确知道优先做什么。';

        } else {
            // 非轮回模式：原有的半模糊经验
            hint += `【前世经验(第${lastLife.lifeNumber}世)】`;

            const endingNames = { perfect: '完美结局', normal: '普通结局', bleak: '惨淡结局', extinction: '全灭结局' };
            hint += `上世${endingNames[lastLife.endingType] || '未知'}，存活${lastLife.aliveCount}/8人。`;

            if (lastLife.deathRecords && lastLife.deathRecords.length > 0) {
                hint += '死亡:';
                for (const d of lastLife.deathRecords.slice(0, 4)) {
                    hint += `${d.name}第${d.day}天${d.cause}(${d.location});`;
                }
            }

            if (lastLife.resourceSnapshot) {
                const rs = lastLife.resourceSnapshot;
                hint += `最终资源:木柴${rs.woodFuel}食物${rs.food}电力${rs.power}建材${rs.material}。`;
            }

            if (!lastLife.secondFurnaceBuilt) {
                hint += '第二暖炉未建好！';
            }

            if (lastLife.lessons && lastLife.lessons.length > 0) {
                hint += '教训:' + lastLife.lessons.slice(0, 3).join('；') + '。';
            }

            hint += this._generateStrategyAdvice(lastLife);
        }

        // 截断到500字符（轮回模式允许更长）
        const maxLen = isReincarnationMode ? 500 : 400;
        if (hint.length > maxLen) {
            hint = hint.substring(0, maxLen - 3) + '…';
        }

        return hint;
    }

    /** 根据前世数据生成具体策略建议 */
    _generateStrategyAdvice(lastLife) {
        let advice = '策略建议:';

        const rs = lastLife.resourceSnapshot;
        if (rs) {
            // 木柴建议
            if (rs.woodFuel < 30) {
                const needed = Math.max(80, Math.round(rs.totalConsumed.woodFuel * 1.2));
                advice += `第1天至少收集${needed}单位木柴;`;
            }
            // 食物建议
            if (rs.food < 15) {
                const needed = Math.max(50, Math.round(rs.totalConsumed.food * 1.1));
                advice += `食物目标至少${needed}单位;`;
            }
        }

        // 暖炉建议
        if (!lastLife.secondFurnaceBuilt) {
            advice += '第1天就开始收集建材50+，第3天全力建第二暖炉;';
        }

        // 户外安全
        const frozenOutdoor = (lastLife.deathRecords || []).filter(d => d.cause === '冻死' && d.location === 'village');
        if (frozenOutdoor.length > 0) {
            advice += `第2天严格限制户外时间，${frozenOutdoor.map(d => d.name).join('、')}上世在户外冻死;`;
        }

        return advice;
    }

    // ============ 前世记忆淡化处理 ============

    /**
     * 获取多世综合记忆（含淡化）
     * 最近1世详细，更早世代模糊，3世以上压缩为一句话
     */
    getCompositePastLifeHint(forDialogue = true, isReincarnationMode = false) {
        if (this.pastLives.length === 0) return '';

        let hint = '';

        for (let i = this.pastLives.length - 1; i >= 0; i--) {
            const life = this.pastLives[i];
            const age = this.pastLives.length - i; // 1=最近，2=上上世...

            if (age === 1) {
                // 最近1世：详细记忆
                if (forDialogue) {
                    hint += this.getPastLifeHintForDialogue(isReincarnationMode);
                } else {
                    hint += this.getPastLifeHintForThinking(isReincarnationMode);
                }
            } else if (age === 2) {
                // 上上世：模糊概要
                const endingNames = { perfect: '成功了', normal: '勉强活下来', bleak: '很惨', extinction: '全灭了' };
                hint += `更早的记忆更模糊：似乎还有一世${endingNames[life.endingType] || '记不清了'}。`;
            } else {
                // 3世以上：一句话
                hint += '很久以前似乎经历过更惨烈的失败。';
                break; // 更早的不再添加
            }
        }

        return hint;
    }

    // ============ 查询接口 ============

    /** 获取上一世的数据（供其他系统读取） */
    getLastLifeData() {
        if (this.pastLives.length === 0) return null;
        return this.pastLives[this.pastLives.length - 1];
    }

    /** 获取上一世的死亡记录 */
    getLastLifeDeathRecords() {
        const last = this.getLastLifeData();
        if (!last) return [];
        return last.deathRecords || [];
    }

    /** 获取上一世的资源快照 */
    getLastLifeResourceSnapshot() {
        const last = this.getLastLifeData();
        if (!last) return null;
        return last.resourceSnapshot || null;
    }

    /** 获取上一世的教训列表 */
    getLastLifeLessons() {
        const last = this.getLastLifeData();
        if (!last) return [];
        return last.lessons || [];
    }

    /** 获取上一世的关键事件（冲突） */
    getLastLifeConflictEvents() {
        const last = this.getLastLifeData();
        if (!last) return [];
        return (last.keyEvents || []).filter(e => e.type === 'conflict');
    }

    /** 获取上一世的存活数量 */
    getLastLifeAliveCount() {
        const last = this.getLastLifeData();
        if (!last) return null;
        return last.aliveCount;
    }

    /** 获取上一世的结局类型 */
    getLastLifeEndingType() {
        const last = this.getLastLifeData();
        if (!last) return null;
        return last.endingType;
    }

    /** 检查某个NPC在上一世是否死亡 */
    wasNpcDeadLastLife(npcId) {
        const last = this.getLastLifeData();
        if (!last) return false;
        const finalState = (last.npcFinalStates || []).find(s => s.id === npcId);
        return finalState ? finalState.isDead : false;
    }

    /** 获取上一世NPC的死因 */
    getNpcDeathCauseLastLife(npcId) {
        const deathRecords = this.getLastLifeDeathRecords();
        const record = deathRecords.find(r => {
            // deathRecords中存的是name不是id，需要通过game.npcs反查
            const npc = this.game.npcs.find(n => n.id === npcId);
            return npc && r.name === npc.name;
        });
        return record ? record.cause : null;
    }

    // ============ 序列化 ============

    serialize() {
        return {
            pastLives: this.pastLives,
            currentLifeNumber: this.currentLifeNumber,
        };
    }

    deserialize(data) {
        if (!data) return;
        this.pastLives = data.pastLives || [];
        this.currentLifeNumber = data.currentLifeNumber || (this.pastLives.length + 1);
    }
}
