/**
 * 资源系统 - 全镇共享物资管理
 * 管理木柴、食物、电力、建材四种核心资源
 * 依赖: game.js, weather-system.js
 */

// ============ 资源初始值配置 ============
const RESOURCE_DEFAULTS = {
    woodFuel: 20,    // 木柴 — 初始少量，需大量采集
    food: 100,       // 食物 — 初始100单位，够吃数天
    power: 30,       // 电力 — 初始有一定储备
    material: 10,    // 建材 — 初始少量，需采集50+才能建第二暖炉
};

// ============ 资源消耗速率配置（每游戏小时） ============
const RESOURCE_CONSUMPTION = {
    woodPerFurnacePerHour: 2.5,   // 每座暖炉每小时消耗木柴【已调整：从3降为2.5】
    powerPerHour: 3,              // 发电机每小时消耗电力【已调整：从5降为3】
    foodPerMealPerPerson: 1.5,    // 每人每餐消耗食物【已调整：从2降为1.5】
    mealsPerDay: 2,               // 每天2餐（8:00早餐, 18:00晚餐）
};

// 用餐时间（小时）
const MEAL_HOURS = [8, 18];

class ResourceSystem {
    constructor(game) {
        this.game = game;

        // 四种核心资源池
        this.woodFuel = RESOURCE_DEFAULTS.woodFuel;
        this.food = RESOURCE_DEFAULTS.food;
        this.power = RESOURCE_DEFAULTS.power;
        this.material = RESOURCE_DEFAULTS.material;

        // 【轮回系统】难度微调：世数>=3 且上一世达成普通或更好结局时，初始资源略微降低
        if (game && game.reincarnationSystem) {
            const rs = game.reincarnationSystem;
            const lifeNum = rs.getLifeNumber();
            const lastEnding = rs.getLastLifeEndingType();
            if (lifeNum >= 3 && (lastEnding === 'perfect' || lastEnding === 'normal')) {
                this.woodFuel = Math.max(5, this.woodFuel - 5);
                this.food = Math.max(5, this.food - 3);
                console.log(`[ResourceSystem-轮回] 第${lifeNum}世难度微调: 木柴${RESOURCE_DEFAULTS.woodFuel}→${this.woodFuel}, 食物${RESOURCE_DEFAULTS.food}→${this.food}`);
            }
        }

        // 【v2.0】天气消耗乘数缓存
        this._weatherConsumptionMult = { wood: 1.0, power: 1.0 };
        this._lastWeatherMultDay = 0;

        // 消耗统计（每日重置）
        this.dailyConsumed = { woodFuel: 0, food: 0, power: 0, material: 0 };
        this.dailyCollected = { woodFuel: 0, food: 0, power: 0, material: 0 };

        // 历史统计（全局）
        this.totalConsumed = { woodFuel: 0, food: 0, power: 0, material: 0 };
        this.totalCollected = { woodFuel: 0, food: 0, power: 0, material: 0 };

        // 资源消耗tick计时
        this._consumptionTick = 0;
        this._mealServed = {}; // { dayX_hourY: true } 防止重复发放餐食

        // 危机状态标记
        this.crisisFlags = {
            noFood: false,       // 食物耗尽
            noPower: false,      // 电力耗尽
            noWoodFuel: false,   // 木柴耗尽
            hungerCrisis: false, // 饥饿危机进行中
        };

        // 饥饿危机持续时间追踪（秒）
        this._hungerCrisisDuration = 0;

        // 日结算报告数据
        this.lastDayReport = null;

        console.log('[ResourceSystem] 初始化完成:', this.getResourceSummary());
    }

    // ============ 资源增减接口 ============

    /** 增加资源（NPC采集完成时调用） */
    addResource(type, amount, source = '') {
        if (amount <= 0) return;
        switch (type) {
            case 'woodFuel':
                this.woodFuel += amount;
                break;
            case 'food':
                this.food += amount;
                break;
            case 'power':
                this.power += amount;
                break;
            case 'material':
                this.material += amount;
                break;
            default:
                console.warn(`[ResourceSystem] 未知资源类型: ${type}`);
                return;
        }
        this.dailyCollected[type] = (this.dailyCollected[type] || 0) + amount;
        this.totalCollected[type] = (this.totalCollected[type] || 0) + amount;

        if (this.game.addEvent && amount >= 1) {
            const icons = { woodFuel: '🪵', food: '🍞', power: '⚡', material: '🧱' };
            const names = { woodFuel: '木柴', food: '食物', power: '电力', material: '建材' };
            this.game.addEvent(`${icons[type]} ${source ? source + '收集了' : '获得'}${names[type]} +${Math.round(amount)}（剩余${Math.round(this[type])}）`);
        }

        console.log(`[ResourceSystem] +${type}: ${amount} (${source}), 当前: ${Math.round(this[type])}`);
    }

    /** 消耗资源（返回实际消耗量，可能不足） */
    consumeResource(type, amount, reason = '') {
        if (amount <= 0) return 0;
        const current = this[type] || 0;
        const actual = Math.min(current, amount);
        this[type] = Math.max(0, current - amount);
        this.dailyConsumed[type] = (this.dailyConsumed[type] || 0) + actual;
        this.totalConsumed[type] = (this.totalConsumed[type] || 0) + actual;
        return actual;
    }

    /** 直接设置资源值（存档恢复用） */
    setResource(type, value) {
        if (this[type] !== undefined) {
            this[type] = Math.max(0, value);
        }
    }

    /**
     * 【新增】NPC进入食堂时触发的个人进食逻辑
     * 当NPC说"肚子饿"并走到食堂时，消耗食物并恢复饱腹值
     * @param {object} npc - NPC对象
     * @returns {boolean} 是否成功进食
     */
    npcEatAtKitchen(npc) {
        if (!npc || npc.isDead) return false;
        // 饱腹度>70时不需要额外进食
        if ((npc.hunger || 50) >= 70) return false;
        // 5分钟内同一NPC不能重复进食（防刷）
        const now = Date.now();
        if (!this._lastEatTime) this._lastEatTime = {};
        if (this._lastEatTime[npc.id] && (now - this._lastEatTime[npc.id]) < 300000) return false;

        const needed = RESOURCE_CONSUMPTION.foodPerMealPerPerson;
        if (this.food >= needed) {
            const consumed = this.consumeResource('food', needed, `${npc.name}在食堂进食`);
            npc.hunger = Math.min(100, (npc.hunger || 50) + 25);
            this._lastEatTime[npc.id] = now;
            if (this.game.addEvent) {
                this.game.addEvent(`🍽️ ${npc.name}在食堂吃了一份食物（-${Math.round(consumed)}食物，饱腹+25，剩余${Math.round(this.food)}）`);
            }
            console.log(`[ResourceSystem] ${npc.name}在食堂进食: -${consumed}食物, hunger=${Math.round(npc.hunger)}, 剩余food=${Math.round(this.food)}`);
            return true;
        } else if (this.food > 0) {
            // 食物不足，吃掉剩余的
            const consumed = this.consumeResource('food', this.food, `${npc.name}在食堂进食(不足)`);
            const ratio = consumed / needed;
            npc.hunger = Math.min(100, (npc.hunger || 50) + Math.round(25 * ratio));
            this._lastEatTime[npc.id] = now;
            if (this.game.addEvent) {
                this.game.addEvent(`⚠️ ${npc.name}在食堂进食但食物不足（-${Math.round(consumed)}食物，饱腹+${Math.round(25 * ratio)}）`);
            }
            return true;
        }
        // 没有食物
        if (this.game.addEvent) {
            this.game.addEvent(`⚠️ ${npc.name}到食堂却发现没有食物了！`);
        }
        return false;
    }

    // ============ 主更新循环 ============

    /** 在game.update()中调用 */
    update(gameDt) {
        this._consumptionTick += gameDt;

        // 每游戏秒执行一次消耗
        if (this._consumptionTick >= 1.0) {
            const elapsed = this._consumptionTick;
            this._consumptionTick = 0;
            this._tickConsumption(elapsed);
        }

        // 用餐时间检测
        this._checkMealTime();

        // 危机状态更新
        this._updateCrisisFlags(gameDt);
    }

    /** 每秒消耗tick */
    _tickConsumption(dt) {
        const hourFraction = dt / 3600; // 转为小时比例

        // 【v2.0】获取天气消耗乘数
        const weatherMult = this._getWeatherConsumptionMult();

        // 1) 暖炉消耗木柴（通过FurnaceSystem管理），应用天气乘数
        const furnaceSystem = this.game.furnaceSystem;
        if (furnaceSystem) {
            const activeFurnaces = furnaceSystem.getActiveFurnaceCount();
            if (activeFurnaces > 0) {
                const baseWood = RESOURCE_CONSUMPTION.woodPerFurnacePerHour * activeFurnaces * hourFraction;
                const woodNeeded = baseWood * weatherMult.wood;
                const consumed = this.consumeResource('woodFuel', woodNeeded, '暖炉消耗');

                // 如果木柴不够，通知暖炉系统
                if (consumed < woodNeeded && this.woodFuel <= 0) {
                    furnaceSystem.onFuelDepleted();
                }
            }
        }

        // 2) 发电机消耗电力，应用天气乘数
        const basePower = RESOURCE_CONSUMPTION.powerPerHour * hourFraction;
        const powerNeeded = basePower * weatherMult.power;
        this.consumeResource('power', powerNeeded, '发电机');
    }

    // ============ 【v2.0】天气消耗乘数系统 ============

    /**
     * 获取当前天气对资源消耗的乘数
     * 第1天(0°C)  → 木柴×1.0, 电力×1.0
     * 第2天(-30°C) → 木柴×1.3, 电力×1.2
     * 第3天(0°C喘息) → 木柴×0.5, 电力×0.7
     * 第4天(-60°C) → 木柴×2.0, 电力×1.5
     */
    _getWeatherConsumptionMult() {
        const day = this.game.dayCount || 1;

        // 缓存：同一天只计算一次
        if (this._lastWeatherMultDay === day) {
            return this._weatherConsumptionMult;
        }

        let woodMult = 1.0;
        let powerMult = 1.0;

        // 根据天数和温度确定消耗乘数
        const ws = this.game.weatherSystem;
        if (ws) {
            const config = ws.getDayConfig(day);
            const baseTemp = config ? config.baseTemp : 0;

            if (baseTemp <= -50) {
                // 第4天极寒：-60°C
                woodMult = 2.0;
                powerMult = 1.5;
            } else if (baseTemp <= -20) {
                // 第2天寒冷：-30°C
                woodMult = 1.3;
                powerMult = 1.2;
            } else if (baseTemp >= 0 && day === 3) {
                // 第3天喘息日：0°C，天气好省柴
                woodMult = 0.5;
                powerMult = 0.7;
            } else {
                // 第1天或其他：0°C
                woodMult = 1.0;
                powerMult = 1.0;
            }
        }

        this._weatherConsumptionMult = { wood: woodMult, power: powerMult };
        this._lastWeatherMultDay = day;

        console.log(`[ResourceSystem-天气乘数] 第${day}天: 木柴消耗×${woodMult}, 电力消耗×${powerMult}`);
        return this._weatherConsumptionMult;
    }

    /**
     * 【v2.0】天气变化时刷新消耗乘数并通知玩家
     * 在weather-system.js的onDayChange()中调用
     */
    onWeatherChange(newDay) {
        // 强制刷新缓存
        this._lastWeatherMultDay = 0;
        const mult = this._getWeatherConsumptionMult();

        // 向事件日志发送天气消耗变化提示
        if (this.game.addEvent) {
            const furnaceCount = this.game.furnaceSystem ? this.game.furnaceSystem.getActiveFurnaceCount() : 1;
            const baseWoodPerHour = RESOURCE_CONSUMPTION.woodPerFurnacePerHour * furnaceCount;
            const actualWoodPerHour = baseWoodPerHour * mult.wood;
            const basePowerPerHour = RESOURCE_CONSUMPTION.powerPerHour;
            const actualPowerPerHour = basePowerPerHour * mult.power;

            if (mult.wood > 1.0) {
                this.game.addEvent(`🌡️❄️ 气温骤降，暖炉消耗增加！木柴消耗: ${actualWoodPerHour.toFixed(1)}/时（×${mult.wood}），电力消耗: ${actualPowerPerHour.toFixed(1)}/时（×${mult.power}）`);
            } else if (mult.wood < 1.0) {
                this.game.addEvent(`🌡️☀️ 气温回升，暖炉消耗降低！木柴消耗: ${actualWoodPerHour.toFixed(1)}/时（×${mult.wood}），电力消耗: ${actualPowerPerHour.toFixed(1)}/时（×${mult.power}）`);
            } else {
                this.game.addEvent(`🌡️ 天气变化，当前木柴消耗: ${actualWoodPerHour.toFixed(1)}/时，电力消耗: ${actualPowerPerHour.toFixed(1)}/时`);
            }
        }
    }

    /** 检测用餐时间，分配食物 */
    _checkMealTime() {
        const hour = this.game.getHour();
        const day = this.game.dayCount;
        const key = `d${day}_h${hour}`;

        // 是否到了用餐时间
        if (!MEAL_HOURS.includes(hour)) return;
        if (this._mealServed[key]) return;
        this._mealServed[key] = true;

        // 计算需要的食物
        const aliveNPCs = this.game.npcs.filter(n => !n.isDead);
        let totalNeeded = aliveNPCs.length * RESOURCE_CONSUMPTION.foodPerMealPerPerson;

        // 【任务7】食物浪费减少：有人管理仓库/做饭时消耗量×0.8
        if (this.game._foodWasteReduction) {
            totalNeeded *= 0.8;
        }

        const mealName = hour <= 12 ? '早餐' : '晚餐';

        if (this.food >= totalNeeded) {
            // 食物充足，全员用餐
            const consumed = this.consumeResource('food', totalNeeded, mealName);
            for (const npc of aliveNPCs) {
                npc.hunger = Math.min(100, (npc.hunger || 50) + 30);
                // 更新目标追踪
                if (npc._goalTrackers) {
                    npc._goalTrackers.mealsToday = (npc._goalTrackers.mealsToday || 0) + 1;
                }
            }
            if (this.game.addEvent) {
                this.game.addEvent(`🍞 ${mealName}：消耗食物${Math.round(consumed)}单位，人均恢复30饱腹（剩余${Math.round(this.food)}）`);
            }
        } else if (this.food > 0) {
            // 【任务7】食物不足时按比例分配
            const ratio = this.food / totalNeeded;
            const consumed = this.consumeResource('food', this.food, `${mealName}(不足)`);
            const hungerRecovery = Math.round(30 * ratio);
            for (const npc of aliveNPCs) {
                npc.hunger = Math.min(100, (npc.hunger || 50) + hungerRecovery);
                if (npc._goalTrackers) {
                    npc._goalTrackers.mealsToday = (npc._goalTrackers.mealsToday || 0) + 1;
                }
            }
            if (this.game.addEvent) {
                this.game.addEvent(`⚠️ ${mealName}食物不足！按比例分配，人均恢复${hungerRecovery}饱腹（食物已耗尽）`);
            }
        } else {
            // 完全没有食物
            for (const npc of aliveNPCs) {
                npc.hunger = Math.max(0, (npc.hunger || 50) - 15);
            }
            if (this.game.addEvent) {
                this.game.addEvent(`⚠️ 食物耗尽，全镇断粮！所有人饱腹-15`);
            }
        }
    }

    /** 更新危机状态 */
    _updateCrisisFlags(gameDt) {
        const oldFlags = { ...this.crisisFlags };

        this.crisisFlags.noFood = this.food <= 0;
        this.crisisFlags.noPower = this.power <= 0;
        this.crisisFlags.noWoodFuel = this.woodFuel <= 0;

        // 食物危机：食物为0且有NPC在饥饿
        if (this.crisisFlags.noFood) {
            this._hungerCrisisDuration += gameDt;
            this.crisisFlags.hungerCrisis = true;

            // 饥饿伤害：无食物时NPC属性持续下降
            if (this._hungerCrisisDuration > 0) {
                for (const npc of this.game.npcs) {
                    if (npc.isDead) continue;
                    // 饥饿衰减：体力-0.2/秒、健康-0.1/秒、San-0.1/秒
                    npc.stamina = Math.max(0, npc.stamina - 0.2 * (gameDt / 1));
                    npc.health = Math.max(0, npc.health - 0.1 * (gameDt / 1));
                    npc.sanity = Math.max(0, npc.sanity - 0.1 * (gameDt / 1));
                    // 饥饿值加速下降（2倍）
                    npc.hunger = Math.max(0, (npc.hunger || 0) - 0.2 * (gameDt / 1));
                }
            }

            // 持续无食物超过6小时（6*3600=21600游戏秒）→ NPC饿死
            if (this._hungerCrisisDuration >= 21600) {
                for (const npc of this.game.npcs) {
                    if (npc.isDead) continue;
                    if (npc.hunger <= 0 && npc.health <= 10) {
                        npc.health = 0;
                        // 标记死因（由死亡系统处理具体逻辑）
                        npc._deathCause = '饿死';
                        console.log(`[ResourceSystem] ${npc.name} 因长期饥饿而死亡`);
                    }
                }
            }
        } else {
            this._hungerCrisisDuration = 0;
            this.crisisFlags.hungerCrisis = false;
        }

        // 电力耗尽 → 通知暖炉系统停止
        if (this.crisisFlags.noPower && !oldFlags.noPower) {
            if (this.game.addEvent) {
                this.game.addEvent(`🚨 电力耗尽！暖炉停止运转！`);
            }
            const furnaceSystem = this.game.furnaceSystem;
            if (furnaceSystem) {
                furnaceSystem.onPowerOut();
            }
        }

        // 木柴耗尽 → 暖炉熄灭
        if (this.crisisFlags.noWoodFuel && !oldFlags.noWoodFuel) {
            if (this.game.addEvent) {
                this.game.addEvent(`🚨 木柴耗尽！暖炉即将熄灭！`);
            }
        }
    }

    // ============ 日结算 ============

    /** 生成日结算报告（在天数切换时调用） */
    generateDayReport(dayNum) {
        const ws = this.game.weatherSystem;
        const nextDay = dayNum + 1;
        const nextConfig = ws ? ws.getDayConfig(nextDay) : null;

        // 预估明日消耗（【v2.0】应用天气消耗乘数）
        const furnaceCount = this.game.furnaceSystem ? this.game.furnaceSystem.furnaces.length : 1;
        const aliveCount = this.game.npcs.filter(n => !n.isDead).length;

        // 获取明日天气乘数
        let nextWoodMult = 1.0, nextPowerMult = 1.0;
        if (nextConfig) {
            const nextTemp = nextConfig.baseTemp || 0;
            if (nextTemp <= -50) { nextWoodMult = 2.0; nextPowerMult = 1.5; }
            else if (nextTemp <= -20) { nextWoodMult = 1.3; nextPowerMult = 1.2; }
            else if (nextTemp >= 0 && nextDay === 3) { nextWoodMult = 0.5; nextPowerMult = 0.7; }
        }

        const estimatedWood = RESOURCE_CONSUMPTION.woodPerFurnacePerHour * furnaceCount * 24 * nextWoodMult;
        const estimatedFood = aliveCount * RESOURCE_CONSUMPTION.foodPerMealPerPerson * RESOURCE_CONSUMPTION.mealsPerDay;
        const estimatedPower = RESOURCE_CONSUMPTION.powerPerHour * 24 * nextPowerMult;

        const report = {
            day: dayNum,
            consumed: { ...this.dailyConsumed },
            collected: { ...this.dailyCollected },
            remaining: {
                woodFuel: Math.round(this.woodFuel),
                food: Math.round(this.food),
                power: Math.round(this.power),
                material: Math.round(this.material),
            },
            aliveCount: aliveCount,
            nextDay: nextConfig ? {
                temp: nextConfig.baseTemp,
                weather: nextConfig.weather,
                desc: nextConfig.desc,
            } : null,
            estimated: {
                woodNeeded: Math.round(estimatedWood),
                foodNeeded: Math.round(estimatedFood),
                powerNeeded: Math.round(estimatedPower),
            },
            warnings: [],
        };

        // 【v2.0】今日收支平衡检查
        const resourceTypes = ['woodFuel', 'food', 'power', 'material'];
        const resourceNames = { woodFuel: '木柴', food: '食物', power: '电力', material: '建材' };
        const resourceIcons = { woodFuel: '🪵', food: '🍞', power: '⚡', material: '🧱' };
        for (const rt of resourceTypes) {
            const collected = this.dailyCollected[rt] || 0;
            const consumed = this.dailyConsumed[rt] || 0;
            if (consumed > collected && consumed > 0) {
                const deficit = Math.round(consumed - collected);
                report.warnings.push(`📉 今日${resourceNames[rt]}收支不平衡：收集${Math.round(collected)} < 消耗${Math.round(consumed)}，缺口${deficit}单位`);
            }
        }

        // 生成预警
        if (nextConfig) {
            if (this.woodFuel < estimatedWood) {
                report.warnings.push(`⚠️ 木柴不足！明天需要${Math.round(estimatedWood)}单位，当前仅${Math.round(this.woodFuel)}单位`);
            }
            if (this.food < estimatedFood) {
                report.warnings.push(`⚠️ 食物不足！明天需要${Math.round(estimatedFood)}单位，当前仅${Math.round(this.food)}单位`);
            }
            if (this.power < estimatedPower) {
                report.warnings.push(`⚠️ 电力不足！明天需要${Math.round(estimatedPower)}单位，当前仅${Math.round(this.power)}单位`);
            }
            if (nextConfig.day === 4 && this.material < 50 && furnaceCount < 2) {
                report.warnings.push(`🚨 警告：第二座暖炉尚未修建！明天-60°C仅1座暖炉，8人拥挤将导致巨大压力！`);
            }

            // 【v2.0-需求10】第3天结束时显示第4天准备评估清单
            if (dayNum === 3) {
                const woodOk = this.woodFuel >= estimatedWood;
                const foodOk = this.food >= estimatedFood;
                const powerOk = this.power >= estimatedPower;
                const furnaceOk = furnaceCount >= 2;
                report.day4ReadinessCheck = {
                    wood: { ok: woodOk, current: Math.round(this.woodFuel), needed: Math.round(estimatedWood) },
                    food: { ok: foodOk, current: Math.round(this.food), needed: Math.round(estimatedFood) },
                    power: { ok: powerOk, current: Math.round(this.power), needed: Math.round(estimatedPower) },
                    furnace: { ok: furnaceOk, count: furnaceCount },
                };
                const checkIcon = (ok) => ok ? '✅' : '❌';
                report.warnings.push(`\n📋 第4天准备评估：`);
                report.warnings.push(`  🪵 木柴 ${checkIcon(woodOk)} （${Math.round(this.woodFuel)}/${Math.round(estimatedWood)}）`);
                report.warnings.push(`  🍞 食物 ${checkIcon(foodOk)} （${Math.round(this.food)}/${Math.round(estimatedFood)}）`);
                report.warnings.push(`  ⚡ 电力 ${checkIcon(powerOk)} （${Math.round(this.power)}/${Math.round(estimatedPower)}）`);
                report.warnings.push(`  🔥 暖炉 ${checkIcon(furnaceOk)} （${furnaceCount}座）`);
                if (!woodOk || !foodOk || !powerOk) {
                    report.warnings.push(`⚠️⚠️ 物资不足以度过明天的极寒暴风雪！必须紧急补充！`);
                }
            }
        }

        this.lastDayReport = report;

        // 重置每日统计
        this.dailyConsumed = { woodFuel: 0, food: 0, power: 0, material: 0 };
        this.dailyCollected = { woodFuel: 0, food: 0, power: 0, material: 0 };

        return report;
    }

    /** 格式化日结算报告为可展示的文本 */
    formatDayReport(report) {
        if (!report) return '无报告数据';

        let text = `\n📋 ===== 第${report.day}天结算报告 =====\n`;
        text += `\n📦 资源剩余:\n`;
        text += `  🪵 木柴: ${report.remaining.woodFuel} 单位\n`;
        text += `  🍞 食物: ${report.remaining.food} 单位\n`;
        text += `  ⚡ 电力: ${report.remaining.power} 单位\n`;
        text += `  🧱 建材: ${report.remaining.material} 单位\n`;
        text += `\n📊 今日消耗/收集:\n`;
        text += `  🪵 木柴: -${Math.round(report.consumed.woodFuel)} / +${Math.round(report.collected.woodFuel)}\n`;
        text += `  🍞 食物: -${Math.round(report.consumed.food)} / +${Math.round(report.collected.food)}\n`;
        text += `  ⚡ 电力: -${Math.round(report.consumed.power)} / +${Math.round(report.collected.power)}\n`;
        text += `  🧱 建材: -${Math.round(report.consumed.material)} / +${Math.round(report.collected.material)}\n`;
        text += `\n👥 存活人数: ${report.aliveCount}/8\n`;

        if (report.nextDay) {
            text += `\n🌡️ 明日预报: ${report.nextDay.temp}°C ${report.nextDay.weather}\n`;
            text += `  ${report.nextDay.desc}\n`;
            text += `\n📐 明日预估消耗:\n`;
            text += `  🪵 木柴: ~${report.estimated.woodNeeded} 单位\n`;
            text += `  🍞 食物: ~${report.estimated.foodNeeded} 单位\n`;
            text += `  ⚡ 电力: ~${report.estimated.powerNeeded} 单位\n`;
        }

        if (report.warnings.length > 0) {
            text += `\n🚨 预警:\n`;
            for (const w of report.warnings) {
                text += `  ${w}\n`;
            }
        }

        text += `\n===========================\n`;
        return text;
    }

    // ============ 查询接口 ============

    /** 获取资源摘要字符串 */
    getResourceSummary() {
        return `🪵${Math.round(this.woodFuel)} 🍞${Math.round(this.food)} ⚡${Math.round(this.power)} 🧱${Math.round(this.material)}`;
    }

    /** 获取某种资源当前值 */
    getResource(type) {
        return this[type] || 0;
    }

    /** 食物是否够全员吃一顿 */
    hasFoodForOneMeal() {
        const aliveCount = this.game.npcs.filter(n => !n.isDead).length;
        return this.food >= aliveCount * RESOURCE_CONSUMPTION.foodPerMealPerPerson;
    }

    /** 获取食物够吃几餐 */
    getFoodMealsRemaining() {
        const aliveCount = this.game.npcs.filter(n => !n.isDead).length;
        if (aliveCount === 0) return Infinity;
        return Math.floor(this.food / (aliveCount * RESOURCE_CONSUMPTION.foodPerMealPerPerson));
    }

    /** 获取木柴够暖炉烧几小时 */
    getWoodFuelHoursRemaining() {
        const furnaceCount = this.game.furnaceSystem ? this.game.furnaceSystem.getActiveFurnaceCount() : 1;
        if (furnaceCount === 0) return Infinity;
        return this.woodFuel / (RESOURCE_CONSUMPTION.woodPerFurnacePerHour * furnaceCount);
    }

    /** 获取电力剩余小时 */
    getPowerHoursRemaining() {
        return this.power / RESOURCE_CONSUMPTION.powerPerHour;
    }

    /** 是否有任何资源危机 */
    hasAnyCrisis() {
        return this.crisisFlags.noFood || this.crisisFlags.noPower || this.crisisFlags.noWoodFuel;
    }

    /** 资源紧张程度（0~1，用于AI prompt紧迫感） */
    getResourceTension() {
        let tension = 0;
        // 食物紧张度
        if (this.food <= 0) tension += 0.4;
        else if (this.getFoodMealsRemaining() <= 1) tension += 0.3;
        else if (this.getFoodMealsRemaining() <= 3) tension += 0.1;
        // 木柴紧张度
        if (this.woodFuel <= 0) tension += 0.3;
        else if (this.getWoodFuelHoursRemaining() <= 4) tension += 0.2;
        else if (this.getWoodFuelHoursRemaining() <= 12) tension += 0.1;
        // 电力紧张度
        if (this.power <= 0) tension += 0.2;
        else if (this.getPowerHoursRemaining() <= 4) tension += 0.15;
        else if (this.getPowerHoursRemaining() <= 12) tension += 0.05;
        return Math.min(1, tension);
    }

    /** 获取资源状态详情（给AI prompt用） */
    getResourceStatusForPrompt() {
        const woodH = this.getWoodFuelHoursRemaining();
        const foodM = this.getFoodMealsRemaining();
        const powerH = this.getPowerHoursRemaining();

        let status = `木柴${Math.round(this.woodFuel)}(够烧${woodH === Infinity ? '∞' : Math.round(woodH)}h) `;
        status += `食物${Math.round(this.food)}(够吃${foodM === Infinity ? '∞' : foodM}餐) `;
        status += `电力${Math.round(this.power)}(剩${powerH === Infinity ? '∞' : Math.round(powerH)}h) `;
        status += `建材${Math.round(this.material)}`;

        if (this.hasAnyCrisis()) {
            status += ' ⚠️危机:';
            if (this.crisisFlags.noFood) status += '无食物!';
            if (this.crisisFlags.noPower) status += '无电力!';
            if (this.crisisFlags.noWoodFuel) status += '无木柴!';
        }

        return status;
    }

    /** 【新增】获取木柴可烧小时数 */
    getWoodFuelHoursRemaining() {
        const furnaceCount = this.game.furnaceSystem ? this.game.furnaceSystem.getActiveFurnaceCount() : 1;
        const hourlyConsumption = RESOURCE_CONSUMPTION.woodPerFurnacePerHour * furnaceCount;
        return hourlyConsumption > 0 ? this.woodFuel / hourlyConsumption : 999;
    }

    /** 【新增】获取食物可供餐次 */
    getFoodMealsRemaining() {
        const aliveCount = this.game.npcs.filter(n => !n.isDead).length;
        const perMeal = RESOURCE_CONSUMPTION.foodPerMealPerPerson * aliveCount;
        return perMeal > 0 ? this.food / perMeal : 999;
    }

    /** 【新增】获取电力可用小时数 */
    getPowerHoursRemaining() {
        return RESOURCE_CONSUMPTION.powerPerHour > 0 ? this.power / RESOURCE_CONSUMPTION.powerPerHour : 999;
    }

    /** 【新增】获取各资源的紧张等级 */
    getResourceUrgency() {
        const aliveCount = this.game.npcs.filter(n => !n.isDead).length;
        const furnaceCount = this.game.furnaceSystem ? this.game.furnaceSystem.getActiveFurnaceCount() : 1;

        // 每天消耗量估算
        const dailyWood = RESOURCE_CONSUMPTION.woodPerFurnacePerHour * furnaceCount * 24;
        const dailyFood = aliveCount * RESOURCE_CONSUMPTION.foodPerMealPerPerson * RESOURCE_CONSUMPTION.mealsPerDay;
        const dailyPower = RESOURCE_CONSUMPTION.powerPerHour * 24;

        const woodHours = this.getWoodFuelHoursRemaining();
        const foodMeals = this.getFoodMealsRemaining();

        return {
            wood: woodHours <= 6 ? 'critical' : (this.woodFuel < dailyWood * 0.5 ? 'warning' : 'normal'),
            food: foodMeals <= 1 ? 'critical' : (this.food < dailyFood * 0.5 ? 'warning' : 'normal'),
            power: this.getPowerHoursRemaining() <= 6 ? 'critical' : (this.power < dailyPower * 0.5 ? 'warning' : 'normal'),
            material: this.material < 10 ? 'warning' : 'normal',
        };
    }

    /** 【新增】获取资源紧张提示（注入到NPC prompt中） */
    getUrgencyPrompt() {
        const urgency = this.getResourceUrgency();
        const alerts = [];

        if (urgency.wood === 'critical') {
            alerts.push(`🔴 木柴严重不足！仅够烧${Math.round(this.getWoodFuelHoursRemaining())}小时，必须立即安排砍柴！`);
        } else if (urgency.wood === 'warning') {
            alerts.push(`🟡 木柴储备偏低（${Math.round(this.woodFuel)}单位），需要增加砍柴力量。`);
        }

        if (urgency.food === 'critical') {
            alerts.push(`🔴 食物不够下一顿饭！必须立即安排采集食物！`);
        } else if (urgency.food === 'warning') {
            alerts.push(`🟡 食物储备偏低（${Math.round(this.food)}单位），需要增加食物采集。`);
        }

        if (urgency.power === 'critical') {
            alerts.push(`🔴 电力即将耗尽！仅剩${Math.round(this.getPowerHoursRemaining())}小时！`);
        }

        return alerts.length > 0 ? `\n【资源紧急警报】\n${alerts.join('\n')}` : '';
    }

    // ============ 序列化 ============

    serialize() {
        return {
            woodFuel: this.woodFuel,
            food: this.food,
            power: this.power,
            material: this.material,
            dailyConsumed: { ...this.dailyConsumed },
            dailyCollected: { ...this.dailyCollected },
            totalConsumed: { ...this.totalConsumed },
            totalCollected: { ...this.totalCollected },
            hungerCrisisDuration: this._hungerCrisisDuration,
        };
    }

    deserialize(data) {
        if (!data) return;
        this.woodFuel = data.woodFuel ?? RESOURCE_DEFAULTS.woodFuel;
        this.food = data.food ?? RESOURCE_DEFAULTS.food;
        this.power = data.power ?? RESOURCE_DEFAULTS.power;
        this.material = data.material ?? RESOURCE_DEFAULTS.material;
        if (data.dailyConsumed) this.dailyConsumed = data.dailyConsumed;
        if (data.dailyCollected) this.dailyCollected = data.dailyCollected;
        if (data.totalConsumed) this.totalConsumed = data.totalConsumed;
        if (data.totalCollected) this.totalCollected = data.totalCollected;
        this._hungerCrisisDuration = data.hungerCrisisDuration || 0;
    }
}
