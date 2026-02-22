/**
 * 福音镇 - NPC 系统
 * 包含 NPC 类 + 8 个居民配置 + 日程 + AI 思考 + Sprite 渲染
 * 依赖: maps.js (TILE, C, findPath), game.js (callLLM, parseLLMJSON)
 */

// ============ NPC 配置 — 末日极寒生存 ============
const NPC_CONFIGS = [
    {
        id: 'li_shen',    name: '李婶',    age: 42, occupation: '物资总管/炊事长', gender: '女',
        role: 'support', // 后勤
        personality: '热心精明、照顾所有人，丧夫多年独自带大陆辰。末日来临后成为据点后勤管家，精打细算每一份物资，把每个人都当自己孩子照顾。',
        home: 'dorm_b', workplace: 'kitchen',
        spawnScene: 'village', spawnX: 25, spawnY: 22, // 暖炉广场南侧（避开碰撞区）
        color: '#E06080',
        spriteDir: 'asset/character/李婶',
        attrs: { stamina: 60, health: 55, wisdom: 45, charisma: 75, empathy: 80, sanity: 65, savings: 0 },
        specialties: {
            food_processing: 2.0,    // 食物加工效率×2
            inventory_waste: -0.20,  // 物资盘点减少浪费-20%
            fair_distribution: true, // 分配公平（减少冲突）
        },
        protectTarget: 'lu_chen', // 保护对象：陆辰
        weaknesses: '过度照顾他人忽视自己，体力和健康容易过低；陆辰有危险时会失控',
        goals: [
            { id: 'survive_4days', desc: '活过4天', type: 'long_term', targetKey: 'daysSurvived', targetValue: 4,
              reward: { sanity: 30 }, rewardDesc: 'San+30' },
            { id: 'daily_meal', desc: '今天至少吃到1餐', type: 'daily', targetKey: 'mealsToday', targetValue: 1,
              reward: { sanity: 5 }, rewardDesc: 'San+5' },
            { id: 'food_safe', desc: '食物储备不低于安全线', type: 'long_term', targetKey: 'foodAboveSafe', targetValue: 1,
              reward: { sanity: 15, empathy: 3 }, rewardDesc: 'San+15, 情商+3' },
            { id: 'protect_lu_chen', desc: '保护陆辰安全活过4天', type: 'long_term', targetKey: 'protectTarget_alive', targetValue: 1,
              reward: { sanity: 20 }, rewardDesc: 'San+20' },
        ],        schedule: [
            { start: 6,  end: 7,  action: 'WALK_TO', target: 'kitchen_door',  desc: '起床去炊事房准备早餐' },
            { start: 7,  end: 8,  action: 'STAY',    target: 'kitchen_inside', desc: '在炊事房做早餐给大家吃' },
            { start: 8,  end: 12, action: 'STAY',    target: 'warehouse_inside', desc: '在仓库盘点物资、整理库存' },
            { start: 12, end: 13, action: 'WALK_TO', target: 'kitchen_door',  desc: '回炊事房准备午餐食材' },
            { start: 13, end: 17, action: 'STAY',    target: 'warehouse_inside', desc: '下午继续管理物资分配' },
            { start: 17, end: 19, action: 'STAY',    target: 'kitchen_inside', desc: '准备晚餐、分配食物' },
            { start: 19, end: 22, action: 'STAY',    target: 'warehouse_inside', desc: '夜间整理物资、记录消耗' },
            { start: 22, end: 24, action: 'STAY',    target: 'kitchen_inside', desc: '准备明日食材、打扫炊事房' },
            { start: 0,  end: 6,  action: 'STAY',    target: 'dorm_b_bed_0',  desc: '在宿舍B休息睡觉' },
        ],
    },
    {
        id: 'zhao_chef',  name: '赵铁柱',  age: 38, occupation: '伐木工/锅炉工', gender: '男',
        role: 'worker', // 工人
        personality: '沉默寡言但行动力极强，危机时第一个冲出去干活。暗恋李婶已久，末日后更想保护她。',
        home: 'dorm_a', workplace: 'warehouse',
        spawnScene: 'village', spawnX: 14, spawnY: 20, // 宿舍A附近
        color: '#D08040',
        spriteDir: 'asset/character/赵大厨',
        attrs: { stamina: 90, health: 75, wisdom: 35, charisma: 55, empathy: 50, sanity: 70, savings: 0 },
        specialties: {
            chopping: 1.5,        // 砍柴×1.5
            hauling: 1.5,         // 搬运×1.5
            furnace_maintain: 2.0, // 暖炉维护×2
        },
        weaknesses: '不善表达，压力大时沉默寡言，San值下降快于常人',
        goals: [
            { id: 'survive_4days', desc: '活过4天', type: 'long_term', targetKey: 'daysSurvived', targetValue: 4,
              reward: { sanity: 30 }, rewardDesc: 'San+30' },
            { id: 'daily_meal', desc: '今天至少吃到1餐', type: 'daily', targetKey: 'mealsToday', targetValue: 1,
              reward: { sanity: 5 }, rewardDesc: 'San+5' },
            { id: 'daily_chop', desc: '每天砍够指定量木柴', type: 'daily', targetKey: 'woodChopped', targetValue: 20,
              reward: { sanity: 8, stamina: 2 }, rewardDesc: 'San+8, 体力+2' },
            { id: 'furnace_running', desc: '保持暖炉持续运行', type: 'long_term', targetKey: 'furnaceUptime', targetValue: 1,
              reward: { sanity: 15 }, rewardDesc: 'San+15' },
        ],
        schedule: [
            { start: 6,  end: 7,  action: 'WALK_TO', target: 'kitchen_door',  desc: '起床去吃早餐' },
            { start: 7,  end: 8,  action: 'WALK_TO', target: 'furnace_plaza', desc: '去暖炉广场检查暖炉状态' },
            { start: 8,  end: 12, action: 'WALK_TO', target: 'lumber_camp',   desc: '出北门去伐木场砍柴' },
            { start: 12, end: 13, action: 'WALK_TO', target: 'warehouse_door', desc: '搬运木柴回仓库' },
            { start: 13, end: 17, action: 'WALK_TO', target: 'lumber_camp',   desc: '下午继续砍柴搬运' },
            { start: 17, end: 18, action: 'WALK_TO', target: 'warehouse_door', desc: '把下午的木柴送回仓库' },
            { start: 18, end: 19, action: 'WALK_TO', target: 'kitchen_door',  desc: '去炊事房吃晚饭' },
            { start: 19, end: 22, action: 'STAY',    target: 'furnace_plaza',  desc: '维护暖炉、添加柴火' },
            { start: 22, end: 24, action: 'STAY',    target: 'workshop_inside', desc: '夜间在工坊修理工具' },
            { start: 0,  end: 6,  action: 'STAY',    target: 'dorm_a_bed_0',  desc: '在宿舍A休息睡觉' },
        ],
    },
    {
        id: 'wang_teacher', name: '王策', age: 32, occupation: '技师/规划师', gender: '男',
        role: 'engineer', // 工程师
        personality: '理性冷静、逻辑至上，末日前是哲学教师，末日后发挥动手能力成为全镇技术骨干。暗恋凌玥。可能做出"牺牲少数保全多数"的冷酷决策。',
        home: 'dorm_a', workplace: 'workshop',
        spawnScene: 'village', spawnX: 22, spawnY: 27, // 工坊附近
        color: '#5080C0',
        spriteDir: 'asset/character/王老师',
        attrs: { stamina: 50, health: 60, wisdom: 90, charisma: 65, empathy: 70, sanity: 70, savings: 0 },
        specialties: {
            generator_repair: 2.0,   // 发电机维修×2
            furnace_build: 1.5,      // 暖炉扩建×1.5
            team_planning: 0.10,     // 全队规划+10%效率
        },
        weaknesses: '过于理性可能做出牺牲少数保全多数的冷酷决策',
        goals: [
            { id: 'survive_4days', desc: '活过4天', type: 'long_term', targetKey: 'daysSurvived', targetValue: 4,
              reward: { sanity: 30 }, rewardDesc: 'San+30' },
            { id: 'daily_meal', desc: '今天至少吃到1餐', type: 'daily', targetKey: 'mealsToday', targetValue: 1,
              reward: { sanity: 5 }, rewardDesc: 'San+5' },
            { id: 'generator_up', desc: '发电机不停机', type: 'long_term', targetKey: 'generatorUptime', targetValue: 1,
              reward: { sanity: 15, wisdom: 3 }, rewardDesc: 'San+15, 智慧+3' },
            { id: 'furnace2_plan', desc: '完成暖炉扩建方案', type: 'long_term', targetKey: 'furnace2Designed', targetValue: 1,
              reward: { sanity: 20, wisdom: 5 }, rewardDesc: 'San+20, 智慧+5' },
        ],
        schedule: [
            { start: 6,  end: 7,  action: 'WALK_TO', target: 'kitchen_door',  desc: '起床去吃早餐' },
            { start: 7,  end: 8,  action: 'WALK_TO', target: 'workshop_door', desc: '去工坊检查发电机' },
            { start: 8,  end: 12, action: 'STAY',    target: 'workshop_inside', desc: '维修发电机、设计暖炉扩建方案' },
            { start: 12, end: 13, action: 'WALK_TO', target: 'kitchen_door',  desc: '去炊事房吃午饭' },
            { start: 13, end: 17, action: 'STAY',    target: 'workshop_inside', desc: '下午继续技术工作、制造工具' },
            { start: 17, end: 18, action: 'WALK_TO', target: 'furnace_plaza', desc: '去暖炉广场统筹全队进度' },
            { start: 18, end: 19, action: 'WALK_TO', target: 'kitchen_door',  desc: '去炊事房吃晚饭' },
            { start: 19, end: 22, action: 'STAY',    target: 'workshop_inside', desc: '夜间加班推进暖炉扩建设计' },
            { start: 22, end: 24, action: 'STAY',    target: 'workshop_inside', desc: '深夜整理图纸、规划明日任务' },
            { start: 0,  end: 6,  action: 'STAY',    target: 'dorm_a_bed_1',  desc: '在宿舍A休息睡觉' },
        ],
    },
    {
        id: 'old_qian',   name: '老钱',    age: 60, occupation: '镇长/精神领袖', gender: '男',
        role: 'support', // 后勤
        personality: '慈祥睿智、德高望重，清璇的爷爷。末日后成为据点决策者和精神支柱，用经验和智慧安抚民心、调解冲突。',
        home: 'dorm_b', workplace: null,
        spawnScene: 'village', spawnX: 25, spawnY: 22, // 暖炉广场南侧（避开碰撞区）
        color: '#A0A080',
        spriteDir: 'asset/character/老钱',
        attrs: { stamina: 30, health: 40, wisdom: 85, charisma: 70, empathy: 75, sanity: 80, savings: 0 },
        specialties: {
            conflict_resolve: 2.0,  // 调解冲突成功率×2
            morale_boost: 2.0,      // 安抚效果×2
            crisis_predict: true,   // 经验判断（预警资源危机）
        },
        protectTarget: 'qing_xuan', // 保护对象：清璇
        weaknesses: '体力极低不能做体力活；年事已高是最容易冻死饿死的人',
        goals: [
            { id: 'survive_4days', desc: '活过4天', type: 'long_term', targetKey: 'daysSurvived', targetValue: 4,
              reward: { sanity: 30 }, rewardDesc: 'San+30' },
            { id: 'daily_meal', desc: '今天至少吃到1餐', type: 'daily', targetKey: 'mealsToday', targetValue: 1,
              reward: { sanity: 5 }, rewardDesc: 'San+5' },
            { id: 'no_conflict', desc: '全镇无人因冲突受伤', type: 'long_term', targetKey: 'noConflictInjury', targetValue: 1,
              reward: { sanity: 15, empathy: 3 }, rewardDesc: 'San+15, 情商+3' },
            { id: 'protect_qing_xuan', desc: '保护清璇安全活过4天', type: 'long_term', targetKey: 'protectTarget_alive', targetValue: 1,
              reward: { sanity: 25 }, rewardDesc: 'San+25' },
        ],
        schedule: [
            { start: 6,  end: 7,  action: 'WALK_TO', target: 'kitchen_door',  desc: '起床去吃早餐' },
            { start: 7,  end: 8,  action: 'WALK_TO', target: 'furnace_plaza', desc: '去暖炉广场主持早会分配任务' },
            { start: 8,  end: 12, action: 'STAY',    target: 'furnace_plaza',  desc: '在暖炉广场协调各组工作、巡视据点' },
            { start: 12, end: 13, action: 'WALK_TO', target: 'kitchen_door',  desc: '去炊事房吃午饭' },
            { start: 13, end: 17, action: 'STAY',    target: 'warehouse_inside', desc: '下午在仓库协助李婶盘点、做决策' },
            { start: 17, end: 18, action: 'WALK_TO', target: 'furnace_plaza', desc: '傍晚在暖炉旁与大家谈心' },
            { start: 18, end: 19, action: 'WALK_TO', target: 'kitchen_door',  desc: '去炊事房吃晚饭' },
            { start: 19, end: 22, action: 'STAY',    target: 'furnace_plaza',  desc: '夜间在暖炉旁安抚民心、讲故事' },
            { start: 22, end: 24, action: 'WALK_TO', target: 'dorm_b_door',   desc: '回宿舍B准备休息' },
            { start: 0,  end: 6,  action: 'STAY',    target: 'dorm_b_bed_1',  desc: '在宿舍B休息睡觉' },
        ],
    },
    {
        id: 'su_doctor',  name: '苏岩',  age: 35, occupation: '医官', gender: '男',
        role: 'engineer', // 工程师
        personality: '冷静专业、内心柔软，末日前是镇医，末日后成为据点唯一医疗力量。暗恋凌玥，用医者身份默默关心她。',
        home: 'dorm_a', workplace: 'medical',
        spawnScene: 'village', spawnX: 31, spawnY: 14, // 医疗站附近
        color: '#9070B0',
        spriteDir: 'asset/character/苏医生',
        attrs: { stamina: 55, health: 80, wisdom: 75, charisma: 60, empathy: 85, sanity: 75, savings: 0 },
        specialties: {
            medical_treatment: 2.0,  // 治疗冻伤效果×2
            hypothermia_save: 0.50,  // 失温救治成功率+50%
            therapy: 1.5,            // 心理疏导San恢复×1.5
        },
        weaknesses: '过度操劳时自己San值崩溃；面对大量伤亡可能精神崩溃',
        goals: [
            { id: 'survive_4days', desc: '活过4天', type: 'long_term', targetKey: 'daysSurvived', targetValue: 4,
              reward: { sanity: 30 }, rewardDesc: 'San+30' },
            { id: 'daily_meal', desc: '今天至少吃到1餐', type: 'daily', targetKey: 'mealsToday', targetValue: 1,
              reward: { sanity: 5 }, rewardDesc: 'San+5' },
            { id: 'all_health_30', desc: '保证全员健康不低于30', type: 'long_term', targetKey: 'allHealthAbove30', targetValue: 1,
              reward: { sanity: 20, empathy: 5 }, rewardDesc: 'San+20, 情商+5' },
            { id: 'save_frostbite', desc: '成功救治1位严重冻伤患者', type: 'daily', targetKey: 'frostbiteSaved', targetValue: 1,
              reward: { sanity: 10, wisdom: 2 }, rewardDesc: 'San+10, 智慧+2' },
        ],
        schedule: [
            { start: 6,  end: 7,  action: 'WALK_TO', target: 'kitchen_door',  desc: '起床去吃早餐' },
            { start: 7,  end: 8,  action: 'WALK_TO', target: 'medical_door',  desc: '去医疗站准备药品、检查设备' },
            { start: 8,  end: 12, action: 'STAY',    target: 'medical_inside', desc: '在医疗站坐诊、治疗冻伤患者' },
            { start: 12, end: 13, action: 'WALK_TO', target: 'kitchen_door',  desc: '去炊事房吃午饭' },
            { start: 13, end: 17, action: 'STAY',    target: 'medical_inside', desc: '下午继续诊疗、心理疏导' },
            { start: 17, end: 18, action: 'WALK_TO', target: 'furnace_plaza', desc: '去暖炉旁巡查大家的健康状况' },
            { start: 18, end: 19, action: 'WALK_TO', target: 'kitchen_door',  desc: '去炊事房吃晚饭' },
            { start: 19, end: 22, action: 'STAY',    target: 'medical_inside', desc: '夜间值班、处理突发伤病' },
            { start: 22, end: 24, action: 'STAY',    target: 'medical_inside', desc: '深夜整理药品、写医疗记录' },
            { start: 0,  end: 6,  action: 'STAY',    target: 'dorm_a_bed_2',  desc: '在宿舍A休息睡觉' },
        ],
    },
    {
        id: 'lu_chen',  name: '陆辰',    age: 18, occupation: '采集工/建筑工', gender: '男',
        role: 'worker', // 工人
        personality: '冲动但勇敢，年轻不怕死。暗恋清璇。末日后成为据点最年轻的劳动力，干活卖力但容易和人起冲突。',
        home: 'dorm_a', workplace: 'warehouse',
        spawnScene: 'village', spawnX: 15, spawnY: 14, // 仓库附近（准备开工）
        color: '#60D060',
        spriteDir: 'asset/character/陆辰',
        attrs: { stamina: 95, health: 95, wisdom: 50, charisma: 65, empathy: 25, sanity: 60, savings: 0 },
        specialties: {
            gathering_material: 1.5, // 建材采集×1.5
            gathering_food: 1.3,     // 食物采集×1.3
            construction: 1.3,       // 建造×1.3
            cold_resist: 0.7,        // 耐寒：体温下降速度×0.7
        },
        weaknesses: '冲动鲁莽，可能在暴风雪中冒险外出；情商低易与人冲突',
        goals: [
            { id: 'survive_4days', desc: '活过4天', type: 'long_term', targetKey: 'daysSurvived', targetValue: 4,
              reward: { sanity: 30 }, rewardDesc: 'San+30' },
            { id: 'daily_meal', desc: '今天至少吃到1餐', type: 'daily', targetKey: 'mealsToday', targetValue: 1,
              reward: { sanity: 5 }, rewardDesc: 'San+5' },
            { id: 'gather_material', desc: '采集建材够建第二暖炉', type: 'long_term', targetKey: 'materialForFurnace2', targetValue: 1,
              reward: { sanity: 20, stamina: 5 }, rewardDesc: 'San+20, 体力+5' },
            { id: 'daily_gather', desc: '今天采集足够物资', type: 'daily', targetKey: 'gatherCount', targetValue: 10,
              reward: { sanity: 8, empathy: 1 }, rewardDesc: 'San+8, 情商+1' },
        ],
        schedule: [
            { start: 6,  end: 7,  action: 'WALK_TO', target: 'kitchen_door',  desc: '起床去吃早餐' },
            { start: 7,  end: 8,  action: 'WALK_TO', target: 'warehouse_door', desc: '去仓库领取采集工具' },
            { start: 8,  end: 12, action: 'WALK_TO', target: 'ruins_site',    desc: '出北门去废墟采集建材' },
            { start: 12, end: 13, action: 'WALK_TO', target: 'warehouse_door', desc: '搬运建材回仓库、吃午饭' },
            { start: 13, end: 17, action: 'WALK_TO', target: 'frozen_lake',   desc: '下午去冰湖捕鱼获取食物' },
            { start: 17, end: 18, action: 'WALK_TO', target: 'warehouse_door', desc: '把食物送回仓库' },
            { start: 18, end: 19, action: 'WALK_TO', target: 'kitchen_door',  desc: '去炊事房吃晚饭' },
            { start: 19, end: 22, action: 'STAY',    target: 'workshop_inside', desc: '夜间在工坊协助建造工作' },
            { start: 22, end: 24, action: 'STAY',    target: 'warehouse_inside', desc: '深夜搬运整理物资' },
            { start: 0,  end: 6,  action: 'STAY',    target: 'dorm_a_bed_3',  desc: '在宿舍A休息睡觉' },
        ],
    },
    {
        id: 'ling_yue',    name: '凌玥',    age: 22, occupation: '侦察员/急救兵', gender: '女',
        role: 'special', // 特殊
        personality: '乐观坚韧、胆大心细，被苏岩和王策同时追求。末日前是户外运动爱好者，末日后负责废墟侦察和急救。',
        home: 'dorm_b', workplace: null,
        spawnScene: 'village', spawnX: 32, spawnY: 20, // 宿舍B附近
        color: '#B080D0',
        spriteDir: 'asset/character/凌玥',
        attrs: { stamina: 60, health: 70, wisdom: 60, charisma: 85, empathy: 70, sanity: 55, savings: 0 },
        specialties: {
            scout_ruins: 2.0,        // 废墟侦察稀有物资概率×2
            field_aid: 1.5,          // 野外急救效率×1.5
            morale_inspire: 1.3,     // 鼓舞士气San恢复×1.3
            climb_explore: true,     // 可进入危险区域搜索
        },
        weaknesses: '初始San值较低，容易情绪波动；面对死亡时精神脆弱；侦察任务有受伤风险',
        goals: [
            { id: 'survive_4days', desc: '活过4天', type: 'long_term', targetKey: 'daysSurvived', targetValue: 4,
              reward: { sanity: 30 }, rewardDesc: 'San+30' },
            { id: 'daily_meal', desc: '今天至少吃到1餐', type: 'daily', targetKey: 'mealsToday', targetValue: 1,
              reward: { sanity: 5 }, rewardDesc: 'San+5' },
            { id: 'scout_rare', desc: '侦察废墟找到稀有物资', type: 'long_term', targetKey: 'rareItemsFound', targetValue: 3,
              reward: { sanity: 20, charisma: 3 }, rewardDesc: 'San+20, 魅力+3' },
            { id: 'team_sanity', desc: '全镇平均San值不低于30', type: 'long_term', targetKey: 'avgSanityAbove30', targetValue: 1,
              reward: { sanity: 15, empathy: 3 }, rewardDesc: 'San+15, 情商+3' },
        ],
        schedule: [
            { start: 6,  end: 7,  action: 'WALK_TO', target: 'kitchen_door',  desc: '起床去吃早餐' },
            { start: 7,  end: 8,  action: 'WALK_TO', target: 'furnace_plaza', desc: '去暖炉广场和大家碰头' },
            { start: 8,  end: 12, action: 'WALK_TO', target: 'ruins_site',    desc: '出北门去废墟侦察搜索物资' },
            { start: 12, end: 13, action: 'WALK_TO', target: 'warehouse_door', desc: '搬运搜获物资回仓库' },
            { start: 13, end: 15, action: 'WALK_TO', target: 'medical_door',  desc: '去医疗站协助苏岩处理伤患' },
            { start: 15, end: 17, action: 'WALK_TO', target: 'ruins_site',    desc: '下午再次出发侦察废墟深处' },
            { start: 17, end: 18, action: 'WALK_TO', target: 'warehouse_door', desc: '搬运物资回仓库' },
            { start: 18, end: 19, action: 'WALK_TO', target: 'kitchen_door',  desc: '去炊事房吃晚饭' },
            { start: 19, end: 22, action: 'STAY',    target: 'furnace_plaza',  desc: '在暖炉旁鼓舞大家士气、唱歌' },
            { start: 22, end: 24, action: 'STAY',    target: 'medical_inside', desc: '深夜协助医疗站处理伤员' },
            { start: 0,  end: 6,  action: 'STAY',    target: 'dorm_b_bed_2',  desc: '在宿舍B休息睡觉' },
        ],
    },
    {
        id: 'qing_xuan',   name: '清璇',    age: 16, occupation: '药剂师学徒/陷阱工', gender: '女',
        role: 'special', // 特殊
        personality: '聪明好学、心灵手巧，老钱的孙女。末日前就喜欢捣鼓化学实验和手工制作，末日后负责制药、陷阱和无线电修理。',
        home: 'dorm_b', workplace: 'medical',
        spawnScene: 'village', spawnX: 33, spawnY: 20, // 宿舍B附近
        color: '#E080A0',
        spriteDir: 'asset/character/清璇',
        attrs: { stamina: 40, health: 65, wisdom: 70, charisma: 60, empathy: 55, sanity: 50, savings: 0 },
        specialties: {
            herbal_craft: 1.5,       // 草药制剂产出×1.5
            trap_alarm: true,        // 陷阱/警报装置
            radio_repair: true,      // 无线电修理
            learn_others: 0.7,       // 学习他人技能效率×0.7
        },
        protectTarget: 'old_qian', // 保护对象：爷爷老钱
        weaknesses: '年龄小体力差不能做重活；老钱有危险时会失控；初始San最低',
        goals: [
            { id: 'survive_4days', desc: '活过4天', type: 'long_term', targetKey: 'daysSurvived', targetValue: 4,
              reward: { sanity: 30 }, rewardDesc: 'San+30' },
            { id: 'daily_meal', desc: '今天至少吃到1餐', type: 'daily', targetKey: 'mealsToday', targetValue: 1,
              reward: { sanity: 5 }, rewardDesc: 'San+5' },
            { id: 'craft_medkits', desc: '制作至少3份急救包', type: 'long_term', targetKey: 'medkitsCrafted', targetValue: 3,
              reward: { sanity: 15, wisdom: 3 }, rewardDesc: 'San+15, 智慧+3' },
            { id: 'repair_radio', desc: '修好无线电', type: 'long_term', targetKey: 'radioRepaired', targetValue: 1,
              reward: { sanity: 25, wisdom: 5 }, rewardDesc: 'San+25, 智慧+5' },
            { id: 'protect_grandpa', desc: '帮爷爷活到最后', type: 'long_term', targetKey: 'protectTarget_alive', targetValue: 1,
              reward: { sanity: 25 }, rewardDesc: 'San+25' },
        ],
        schedule: [
            { start: 6,  end: 7,  action: 'WALK_TO', target: 'kitchen_door',  desc: '起床去吃早餐' },
            { start: 7,  end: 8,  action: 'WALK_TO', target: 'medical_door',  desc: '去医疗站准备草药材料' },
            { start: 8,  end: 12, action: 'STAY',    target: 'medical_inside', desc: '在医疗站制作草药制剂和急救包' },
            { start: 12, end: 13, action: 'WALK_TO', target: 'kitchen_door',  desc: '去炊事房吃午饭' },
            { start: 13, end: 15, action: 'WALK_TO', target: 'south_gate',    desc: '去南门外布置警报陷阱' },
            { start: 15, end: 17, action: 'STAY',    target: 'workshop_inside', desc: '在工坊修理无线电台' },
            { start: 17, end: 18, action: 'WALK_TO', target: 'medical_door',  desc: '回医疗站整理制好的药品' },
            { start: 18, end: 19, action: 'WALK_TO', target: 'kitchen_door',  desc: '去炊事房吃晚饭' },
            { start: 19, end: 22, action: 'STAY',    target: 'workshop_inside', desc: '夜间继续修理无线电、制作陷阱' },
            { start: 22, end: 24, action: 'STAY',    target: 'medical_inside', desc: '深夜在医疗站继续制药' },
            { start: 0,  end: 6,  action: 'STAY',    target: 'dorm_b_bed_3',  desc: '在宿舍B休息睡觉' },
        ],
    },
];

// ============ 行动实效性映射表（ActionEffectMap）============
// 将日程行为描述关键词映射到具体的系统效果
// effectType: produce_resource | build_progress | craft_medkit | repair_radio | reduce_waste | medical_heal | patrol_bonus
const ACTION_EFFECT_MAP = [
    // 砍柴/伐木 → 产出木柴
    { keywords: ['砍柴', '伐木', '搬运木柴'], requiredScene: 'village', effectType: 'produce_resource', resourceType: 'woodFuel', ratePerHour: 10, bubbleText: '🪓 砍柴中' },
    // 采集食物/捕鱼 → 产出食物
    { keywords: ['采集食物', '捕鱼', '搜索罐头'], requiredScene: 'village', effectType: 'produce_resource', resourceType: 'food', ratePerHour: 8, bubbleText: '🎣 采集食物中' },
    // 采集建材/废墟 → 产出建材
    { keywords: ['采集建材', '收集建材', '废墟'], requiredScene: 'village', effectType: 'produce_resource', resourceType: 'material', ratePerHour: 5, bubbleText: '🧱 采集建材中' },
    // 维修发电机/技术工作 → 产出电力
    { keywords: ['维修发电机', '检查发电机', '技术工作', '制造工具'], requiredScene: 'workshop', effectType: 'produce_resource', resourceType: 'power', ratePerHour: 8, bubbleText: '🔧 维修发电机中（⚡+8/h）' },
    // 设计暖炉扩建方案/协助建造 → 推进建造进度
    { keywords: ['暖炉扩建', '设计暖炉', '协助建造', '扩建'], requiredScene: 'workshop', effectType: 'build_progress', ratePerHour: 1, bubbleText: '🔨 暖炉扩建设计中' },
    // 制作急救包/草药制剂 → 制作急救包
    { keywords: ['制作草药', '急救包', '草药制剂', '制药'], requiredScene: 'medical', effectType: 'craft_medkit', ratePerHour: 0.5, bubbleText: '💊 制作急救包中' },
    // 修理无线电 → 推进修理进度
    { keywords: ['修理无线电', '无线电台'], requiredScene: 'workshop', effectType: 'repair_radio', ratePerHour: 1, bubbleText: '📻 修理无线电中' },
    // 管理仓库/盘点物资/整理库存 → 减少食物浪费
    { keywords: ['盘点物资', '整理库存', '管理物资', '物资分配'], requiredScene: 'warehouse', effectType: 'reduce_waste', bubbleText: '📦 管理仓库中（浪费-20%）' },
    // 做饭/准备早餐/晚餐 → 减少食物浪费
    { keywords: ['做早餐', '准备早餐', '准备晚餐', '分配食物', '准备午餐', '准备明日食材'], requiredScene: 'kitchen', effectType: 'reduce_waste', bubbleText: '🍳 烹饪中（浪费-20%）' },
    // 坐诊/治疗冻伤/心理疏导 → 医疗效果
    { keywords: ['坐诊', '治疗冻伤', '心理疏导', '巡查伤员', '医疗救治'], requiredScene: 'medical', effectType: 'medical_heal', ratePerHour: 1, bubbleText: '🏥 医疗救治中' },
    // 维护暖炉/添加柴火 → 暖炉维护（不额外产出，但确保暖炉运转）
    { keywords: ['维护暖炉', '添加柴火'], requiredScene: null, effectType: 'furnace_maintain', bubbleText: '🔥 维护暖炉中' },
    // 巡逻/警戒 → 全队San恢复加成
    { keywords: ['巡逻', '警戒', '安全巡查'], requiredScene: 'village', effectType: 'patrol_bonus', bubbleText: '🛡️ 巡逻警戒中' },
    // 安抚/调解/统筹/鼓舞 → San恢复
    { keywords: ['安抚', '调解冲突', '统筹', '鼓舞', '讲故事', '安慰', '心理支持'], requiredScene: null, effectType: 'morale_boost', ratePerHour: 2, bubbleText: '💬 安抚鼓舞中' },
    // 修理工具 → 产出少量电力
    { keywords: ['修理工具'], requiredScene: 'workshop', effectType: 'produce_resource', resourceType: 'power', ratePerHour: 4, bubbleText: '🔧 修理工具中' },
];

// ============ 日程目标位置映射（末日据点坐标） ============
const SCHEDULE_LOCATIONS = {
    // ---- 建筑门口（村庄地图） ----
    warehouse_door:  { scene: 'village', x: 16, y: 16 },  // 仓库门口
    medical_door:    { scene: 'village', x: 33, y: 16 },  // 医疗站门口
    dorm_a_door:     { scene: 'village', x: 16, y: 24 },  // 宿舍A门口
    dorm_b_door:     { scene: 'village', x: 33, y: 24 },  // 宿舍B门口
    kitchen_door:    { scene: 'village', x: 15, y: 31 },  // 炊事房门口
    workshop_door:   { scene: 'village', x: 24, y: 31 },  // 工坊门口

    // ---- 室内默认位置 ----
    warehouse_inside:{ scene: 'warehouse', x: 5,  y: 6 },
    medical_inside:  { scene: 'medical',   x: 5,  y: 6 },
    dorm_a_inside:   { scene: 'dorm_a',    x: 6,  y: 4 },
    dorm_b_inside:   { scene: 'dorm_b',    x: 6,  y: 4 },
    kitchen_inside:  { scene: 'kitchen',   x: 3,  y: 3 },
    workshop_inside: { scene: 'workshop',  x: 4,  y: 6 },

    // ---- 宿舍床位 ----
    dorm_a_bed_0:    { scene: 'dorm_a',    x: 1,  y: 2 },  // 赵铁柱
    dorm_a_bed_1:    { scene: 'dorm_a',    x: 4,  y: 2 },  // 王策
    dorm_a_bed_2:    { scene: 'dorm_a',    x: 7,  y: 2 },  // 苏岩
    dorm_a_bed_3:    { scene: 'dorm_a',    x: 10, y: 2 },  // 陆辰
    dorm_b_bed_0:    { scene: 'dorm_b',    x: 1,  y: 2 },  // 李婶
    dorm_b_bed_1:    { scene: 'dorm_b',    x: 4,  y: 2 },  // 老钱
    dorm_b_bed_2:    { scene: 'dorm_b',    x: 7,  y: 2 },  // 凌玥
    dorm_b_bed_3:    { scene: 'dorm_b',    x: 10, y: 2 },  // 清璇

    // ---- 户外地标 ----
    furnace_plaza:   { scene: 'village', x: 25, y: 22 },  // 主暖炉广场（南侧，避开暖炉碰撞区）
    north_gate:      { scene: 'village', x: 25, y: 10 },  // 北门
    south_gate:      { scene: 'village', x: 25, y: 30 },  // 南门

    // ---- 户外资源采集区 ----
    lumber_camp:     { scene: 'village', x: 6,  y: 5 },   // 伐木场中心
    ruins_site:      { scene: 'village', x: 43, y: 5 },   // 废墟采集场中心
    frozen_lake:     { scene: 'village', x: 6,  y: 35 },  // 冰湖中心
    ore_pile:        { scene: 'village', x: 43, y: 35 },  // 矿渣堆中心

    // ---- 室内门口位置（底部出口） ----
    warehouse_indoor_door: { scene: 'warehouse', x: 4,  y: 7 },
    medical_indoor_door:   { scene: 'medical',   x: 4,  y: 7 },
    dorm_a_indoor_door:    { scene: 'dorm_a',    x: 5,  y: 7 },
    dorm_b_indoor_door:    { scene: 'dorm_b',    x: 5,  y: 7 },
    kitchen_indoor_door:   { scene: 'kitchen',   x: 3,  y: 7 },
    workshop_indoor_door:  { scene: 'workshop',  x: 5,  y: 7 },
};

// ============ 室内多座位定义 ============
const INDOOR_SEATS = {
    // 宿舍A：火盆旁 + 桌边 + 床边
    dorm_a: [
        { x: 5,  y: 6, name: '火盆旁左' },
        { x: 7,  y: 6, name: '火盆旁右' },
        { x: 2,  y: 5, name: '简易桌旁' },
        { x: 10, y: 5, name: '杂物桌旁' },
        { x: 2,  y: 2, name: '赵铁柱床边' },
        { x: 5,  y: 2, name: '王策床边' },
        { x: 8,  y: 2, name: '苏岩床边' },
    ],
    // 宿舍B：火盆旁 + 桌边
    dorm_b: [
        { x: 1,  y: 6, name: '火盆旁' },
        { x: 3,  y: 5, name: '火盆前' },
        { x: 6,  y: 5, name: '桌旁' },
        { x: 2,  y: 2, name: '李婶床边' },
        { x: 5,  y: 2, name: '老钱床边' },
        { x: 8,  y: 2, name: '凌玥床边' },
    ],
    // 医疗站：诊疗台旁 + 病床旁 + 草药架旁
    medical: [
        { x: 5,  y: 6, name: '诊疗台前' },
        { x: 7,  y: 6, name: '诊疗台旁' },
        { x: 2,  y: 3, name: '病床1旁' },
        { x: 5,  y: 3, name: '病床2旁' },
        { x: 8,  y: 3, name: '病床3旁' },
        { x: 8,  y: 6, name: '草药架旁' },
    ],
    // 仓库：各区域旁
    warehouse: [
        { x: 2,  y: 3, name: '木柴区旁' },
        { x: 7,  y: 3, name: '食物区旁' },
        { x: 2,  y: 6, name: '建材区旁' },
        { x: 7,  y: 6, name: '杂物区旁' },
        { x: 5,  y: 4, name: '仓库中央' },
    ],
    // 工坊：工作台旁 + 发电机旁 + 无线电台旁
    workshop: [
        { x: 2,  y: 3, name: '工作台前' },
        { x: 6,  y: 3, name: '发电机旁' },
        { x: 10, y: 3, name: '工具架旁' },
        { x: 2,  y: 6, name: '建材堆旁' },
        { x: 6,  y: 6, name: '无线电台旁' },
        { x: 8,  y: 6, name: '工坊南侧' },
    ],
    // 炊事房：灶台旁 + 餐桌座位
    kitchen: [
        { x: 2,  y: 2, name: '灶台旁' },
        { x: 6,  y: 2, name: '食材架旁' },
        { x: 1,  y: 4, name: '餐桌左1' },
        { x: 1,  y: 5, name: '餐桌左2' },
        { x: 6,  y: 4, name: '餐桌右1' },
        { x: 6,  y: 5, name: '餐桌右2' },
    ],
};


// ============ NPC 类 ============
class NPC {
    constructor(config, game) {
        this.id = config.id;
        this.name = config.name;
        this.age = config.age;
        this.occupation = config.occupation;
        this.personality = config.personality;
        this.homeName = config.home;
        this.workplaceName = config.workplace;
        this.color = config.color || C.NPC;
        this.scheduleTemplate = config.schedule;
        this.config = config; // 保存完整配置（含bedtime等）

        // 位置状态
        this.currentScene = config.spawnScene;
        this.x = config.spawnX * TILE;
        this.y = config.spawnY * TILE;
        this.width = TILE;
        this.height = TILE;

        // 移动
        this.speed = 100 + Math.random() * 40; // 每个 NPC 速度稍有不同
        this.facing = 0; // 0=down,1=left,2=right,3=up
        this.isMoving = false;
        this.currentPath = [];
        this.pathIndex = 0;
        this.moveTarget = null; // { x, y } 当前路点像素
        this.stuckTimer = 0;
        this.collisionStallTimer = 0;  // 被碰撞持续阻挡的累计时间
        this._yieldMove = null;         // 让路临时目标 { x, y }（格子坐标）
        this._yieldTimer = 0;           // 让路等待计时

        // 动画
        this.animFrame = 0;
        this.animTimer = 0;

        // Sprite
        this.sprite = new Image();
        this.sprite.src = config.spriteDir + '/texture.png';
        this.spriteLoaded = false;
        this.sprite.onload = () => { this.spriteLoaded = true; };

        this.portrait = new Image();
        this.portrait.src = config.spriteDir + '/portrait.png';

        // AI 状态
        this.state = 'IDLE'; // IDLE, WALKING, BUSY, CHATTING, SLEEPING
        this.stateDesc = config.schedule[0]?.desc || '闲逛';
        this.mood = '平静';
        this.expression = '';
        this.expressionTimer = 0;

        // 记忆
        this.memories = [];
        this.maxMemories = 20;

        // 好感度 (对其他 NPC)
        this.affinity = {}; // { npcId: number }

        // AI 思考节流
        this.aiCooldown = 0;
        this.aiInterval = 15 + Math.random() * 15; // 15~30 秒思考一次

        // 社交冷却
        this.chatCooldowns = {}; // { npcId: timestamp }

        // 哲学家/思考型角色特殊设定：更积极地找人聊天
        if (config.id === 'old_qian') {
            this.aiInterval = 10 + Math.random() * 10; // 10~20 秒思考一次
        }

        // 【轮回系统】世数>=2时，AI思考间隔缩短10%（NPC更"警觉"）
        if (game && game.reincarnationSystem && game.reincarnationSystem.getLifeNumber() >= 2) {
            this.aiInterval = Math.round(this.aiInterval * 0.9);
        }

        // 性别
        this.gender = config.gender || '男';

        // 初始化情感关系好感度（非对称）
        if (config.id === 'zhao_chef') {
            this.affinity = { li_shen: 75 };
        } else if (config.id === 'li_shen') {
            this.affinity = { zhao_chef: 65 };
        } else if (config.id === 'su_doctor') {
            this.affinity = { ling_yue: 70 };
        } else if (config.id === 'wang_teacher') {
            this.affinity = { ling_yue: 68 };
        } else if (config.id === 'ling_yue') {
            this.affinity = { su_doctor: 60, wang_teacher: 62 };
        } else if (config.id === 'lu_chen') {
this.affinity = { qing_xuan: 72 };
        } else if (config.id === 'qing_xuan') {
            this.affinity = { lu_chen: 65 };
        }

        // 【轮回系统】应用前世记忆加成
        this._applyReincarnationBonus(game);

        // 日程追踪
        this.currentScheduleIdx = -1;
        this.scheduleReached = false;
        this._pendingEnterScene = null;  // 到达门口后自动进入的室内场景
        this._pendingEnterKey = null;    // 对应的门口key

        // 睡眠系统
        this.isSleeping = false;
        this.sleepZTimer = 0; // "Zzz" 动画计时器

        // 下雨避雨
        this.isSeekingShelter = false;
        this.hasUmbrella = Math.random() > 0.6; // 40% 概率有伞

        // 场所经营统计（店主角色使用）
        this.shopVisitorCount = 0;       // 今天来过的客人数
        this.shopLastVisitorTime = null; // 上一个客人来的时间
        this.shopAloneMinutes = 0;       // 连续没客人的分钟数
        this.shopOutRecruitingUntil = 0; // 外出招揽截止时间（小时）

        // 饥饿系统
        this.hunger = 100;              // 饱腹值 0~100, 100=饱, 0=饿极了
        this.hungerDecayTimer = 0;      // 饥饿递减计时器
        this.isEating = false;          // 正在吃饭中
        this.eatingTimer = 0;           // 吃饭持续时间
        this._hungerOverride = false;   // 饥饿临时日程覆盖中
        this._hungerTarget = null;      // 饥饿驱动的目标场所
        this._hungerTriggerCooldown = 0; // 饥饿触发冷却计时器

        // ============ 状态驱动行为覆盖系统 ============
        // 类似饥饿覆盖，当NPC状态极差时打断日程执行紧急行为
        this._stateOverride = null;     // 当前状态覆盖类型: 'exhausted'|'sick'|'mental'|null
        this._stateOverrideTarget = null; // 状态覆盖的导航目标 (同hungerTarget格式)
        this._stateOverrideCooldown = 0;  // 状态覆盖触发冷却（秒），避免反复触发
        this._stateOverrideStuckTimer = 0; // 卡住检测计时
        this._stateOverrideTravelTimer = 0; // 超时兜底计时
        this._stateOverrideMaxTimer = 0;   // 状态覆盖最大持续时间计时（超时保护）
        this._isBeingTreated = false;   // 正在被治疗中（看病）
        this._treatmentTimer = 0;       // 治疗持续时间

        // 社交找不到人冷却
        this._noOneFoundCooldown = 0;   // 找不到人后的冷却计时（秒）

        // 进出门过渡系统
        this._walkingToDoor = false;    // 正在走向室内门口准备出门
        this._exitDoorTarget = null;    // 出门后的目标 {scene, x, y}
        this._enterWalkTarget = null;   // 进门后需要走到的室内目标位置

        // 社交走路系统：wantChat走向目标NPC后自动发起对话
        this._chatWalkTarget = null;    // 正在走向的聊天目标NPC id

        // ============ 发呆兜底检测系统 ============
        this._idleWatchdogTimer = 0;      // 发呆计时器（秒）
        this._idleWatchdogCount = 0;      // 兜底触发次数
        this._idleWatchdogResetTime = 0;  // 兜底触发计数重置时间

        // ============ 六大属性系统 ============
        const a = config.attrs || {};
        this.stamina  = a.stamina  ?? 50;  // 💪 体力 (0~100) 每天工作消耗，休息恢复
        this.savings  = a.savings  ?? 100; // 💰 存款 (0~∞) 通过工作赚取，消费花费
        this.charisma = a.charisma ?? 50;  // ✨ 魅力 (0~100) 社交吸引力，影响好感度增长
        this.wisdom   = a.wisdom   ?? 50;  // 🧠 智慧 (0~100) 认知能力，影响工作效率和决策
        this.health   = a.health   ?? 50;  // 🫀 健康 (0~100) 身体状况，低了会生病
        this.empathy  = a.empathy  ?? 50;  // 💬 情商 (0~100) 处理人际关系能力

        // San值系统（精神值，类似《饥荒》的san值）
        this.sanity = a.sanity ?? 70; // 🧠 San值 (0~100) 精神状态，通宵/劳累降低，社交/娱乐/睡眠恢复

        // 属性变化计时器（缓慢变化，每游戏小时触发一次检查）
        this._attrUpdateTimer = 0;
        // 生病状态
        this.isSick = false;
        this.sickTimer = 0; // 生病持续时间（游戏小时）

        // 发疯状态（San值过低触发）
        this.isCrazy = false;
        this.crazyTimer = 0; // 发疯持续时间

        // ============ 极寒生存属性 ============
        this.bodyTemp = 36.5;           // 🌡️ 体温 (25°C~36.5°C)，低于35失温，低于30严重失温
        this.isDead = false;            // 💀 是否死亡
        this._deathCause = null;        // 死亡原因: '冻死'|'饿死'|'精神崩溃致死'|null
        this._deathTime = null;         // 死亡时间
        this.isHypothermic = false;     // 🥶 失温状态（体温<35°C）
        this.isSevereHypothermic = false; // 🧊 严重失温（体温<30°C，倒地不起）
        this.isFrostbitten = false;     // 冻伤状态
        this._outdoorContinuousTime = 0; // 连续户外时间（秒）
        this._rescueNeeded = false;     // 是否需要救援（严重失温倒地）
        this._rescueTimer = 0;          // 救援倒计时（秒），超时冻死

        // ============ 极端状态持续计时器（用于死亡判定）============
        this._zeroStaminaDuration = 0;  // 体力=0的持续秒数
        this._zeroHungerDuration = 0;   // 饱腹=0的持续秒数
        this._zeroCrazyDuration = 0;    // San=0且发疯的持续秒数
        this._hypothermiaDuration = 0;  // 【v2.0】体温<33°C的持续秒数（用于失温致死判定）
        this._isDying = false;          // 【v2.0】濒死状态
        this._dyingTimer = 0;           // 【v2.0】濒死状态计时器（秒）

        // ============ 户外工作时间追踪 ============
        this._outdoorWorkDuration = 0;  // 当前户外连续工作秒数
        this._outdoorForceReturn = false; // 是否已触发强制回室内

        // 看演出/心理咨询状态
        this.isWatchingShow = false;  // 正在看凌玥演出
        this.isInTherapy = false;     // 正在接受苏医生心理咨询

        // ============ 任务驱动覆盖系统（三层优先级P1层） ============
        this._taskOverride = {
            taskId: null,           // 当前覆盖的任务ID
            targetLocation: null,   // 目标位置key（SCHEDULE_LOCATIONS中的key）
            isActive: false,        // 是否激活
            priority: 'normal',     // 优先级: 'urgent'|'high'|'normal'
            resourceType: null,     // 关联的资源类型（用于采集任务）
        };
        this._taskOverrideStuckTimer = 0;  // 任务覆盖卡住检测
        this._taskOverrideTravelTimer = 0; // 任务覆盖超时兜底
        this._behaviorPriority = 'P2';     // 当前行为层级标记: 'P0'|'P1'|'P2'

        // ============ 日程导航超时兜底 ============
        this._navStartTime = 0;            // 导航开始时间（Date.now()）
        this._scheduleNavTimer = 0;        // 日程导航累计时间（秒）
        this._scheduleNavTarget = null;    // 当前日程导航目标key

        // ============ LLM行动决策系统 ============
        this._actionDecisionCooldown = 0;       // 行动决策冷却计时器（秒）
        this._actionDecisionInterval = 45 + Math.random() * 30; // 45~75秒做一次行动决策
        this._pendingAction = null;             // 待执行的行动 { type, target, reason, priority, companion }
        this._currentAction = null;             // 正在执行的行动
        this._actionOverride = false;           // 是否正在覆盖日程
        this._actionTarget = null;              // 行动覆盖的导航目标
        this._actionStuckTimer = 0;             // 行动卡住检测
        this._actionTravelTimer = 0;            // 行动超时兜底
        this._companionTarget = null;           // 被邀请一起走的目标NPC id
        this._isCompanion = false;              // 当前是否作为同伴跟随中
        this._companionLeader = null;           // 正在跟随的领导者NPC id
        this._companionDestination = null;      // 同伴模式的目标位置key
        this._lastActionThought = '';           // 上一次行动决策的思考记录（供think参考）

        // ============ Debug日志系统 ============
        this._debugLog = [];            // 行动轨迹日志 [{time, type, detail}]
        this._debugDialogueLog = [];    // 对话记录日志 [{time, partner, lines}]
        this._maxDebugLog = 100;        // 最多保留100条行动日志
        this._maxDebugDialogue = 20;    // 最多保留20条对话记录
        this._lastLoggedState = '';     // 上一次记录的状态（避免重复记录相同状态）

        // ============ 目标系统 ============
        // 从config中加载目标模板，初始化每个目标的运行时状态
        this.goals = (config.goals || []).map(g => ({
            ...g,
            completed: false,       // 是否已完成
            progress: 0,            // 当前进度（0~targetValue）
            rewarded: false,        // 是否已领取奖励
            completedDay: -1,       // 完成的天数（用于daily目标重置）
        }));
        // 每日追踪计数器（每天重置）
        this._goalTrackers = {
            chatCount: 0,       // 今天聊了几个不同的人
            chatPartners: [],   // 今天聊过的人id列表（用于去重）
            workHours: 0,       // 今天工作了多少小时
            studyHours: 0,      // 今天学习了多少小时
            performCount: 0,    // 今天演出了几次
            // 【任务10】末日生存目标追踪
            mealsToday: 0,      // 今天吃了几顿
            woodChopped: 0,     // 今天砍了多少木柴
            gatherCount: 0,     // 今天采集了多少次（食物/建材/电力）
            frostbiteSaved: 0,  // 今天治疗了几人冻伤
            rareItemsFound: 0,  // 今天发现了几个稀有物品
            patrolCount: 0,     // 今天巡逻了几次
            conflictsResolved: 0, // 今天调解了几次冲突
            medkitsCrafted: 0,  // 今天制作了几个急救包
        };
        this._goalCheckTimer = 0;    // 目标检测计时器
        this._lastGoalDay = -1;      // 上次重置目标的天数

        // 游戏引用
        this.game = game;
    }

    // ============ Debug日志方法 ============
    /**
     * 记录debug行动日志
     * @param {string} type - 日志类型: 'think'|'action'|'schedule'|'state'|'override'|'chat'|'move'|'eat'|'sleep'
     * @param {string} detail - 日志详情
     */
    _logDebug(type, detail) {
        // collision类型在所有模式下都记录（调试碰撞卡死问题）
        if (type !== 'collision' && (!this.game || this.game.mode !== 'debug')) return;
        const time = this.game ? this.game.getTimeStr() : '??:??';
        const day = (this.game && this.game.dayCount) || 0;
        const realTime = new Date().toLocaleString('zh-CN', { hour12: false });
        const entry = { time, day, realTime, type, detail, timestamp: Date.now() };
        this._debugLog.unshift(entry);
        if (this._debugLog.length > this._maxDebugLog) this._debugLog.pop();
        // 同时输出到控制台，便于实时查看（含真实时间和游戏天数）
        console.log(`[DEBUG·${this.name}] [D${day} ${time}] [${realTime}] [${type}] ${detail}`);
    }

    /**
     * 记录debug对话日志
     * @param {string} partner - 对话对象
     * @param {Array} lines - 对话内容 [{speaker, text}]
     */
    _logDebugDialogue(partner, lines) {
        if (!this.game || this.game.mode !== 'debug') return;
        const time = this.game.getTimeStr();
        const day = this.game.dayCount || 0;
        const realTime = new Date().toLocaleString('zh-CN', { hour12: false });
        const entry = { time, day, realTime, partner, lines, timestamp: Date.now() };
        this._debugDialogueLog.unshift(entry);
        if (this._debugDialogueLog.length > this._maxDebugDialogue) this._debugDialogueLog.pop();
    }

    /**
     * 获取格式化的debug日志（供UI面板显示）
     */
    getDebugLogText() {
        if (this._debugLog.length === 0) return '暂无行动记录';
        return this._debugLog.slice(0, 50).map(e => {
            const icon = {
                'think': '💭', 'action': '🎯', 'schedule': '📅', 'state': '⚡',
                'override': '🔄', 'chat': '💬', 'move': '🚶', 'eat': '🍜',
                'sleep': '😴', 'sanity': '🧠', 'hunger': '🍽️', 'health': '🏥',
                'goal': '🎯', 'reward': '⚖️', 'penalty': '⚠️'
            }[e.type] || '📝';
            const dayStr = e.day !== undefined ? `D${e.day} ` : '';
            return `[${dayStr}${e.time}] ${icon} ${e.detail}`;
        }).join('\n');
    }

    /**
     * 获取格式化的debug对话日志
     */
    getDebugDialogueText() {
        if (this._debugDialogueLog.length === 0) return '暂无对话记录';
        return this._debugDialogueLog.map(d => {
            const dayStr = d.day !== undefined ? `D${d.day} ` : '';
            const realTimeStr = d.realTime ? ` (${d.realTime})` : '';
            const header = `=== [${dayStr}${d.time}]${realTimeStr} 与 ${d.partner} 的对话 ===`;
            const body = d.lines.map(l => `  ${l.speaker}: ${l.text}`).join('\n');
            return header + '\n' + body;
        }).join('\n\n');
    }

    getSortY() { return this.y + TILE - 2; }

    getGridPos() {
        return {
            x: Math.floor((this.x + this.width / 2) / TILE),
            y: Math.floor((this.y + this.height / 2) / TILE)
        };
    }

    addMemory(data) {
        const time = this.game ? this.game.getTimeStr() : '';
        // 支持结构化数据和纯文本两种格式
        if (typeof data === 'string') {
            // 兼容旧格式：纯文本
            let type = 'event';
            if (data.startsWith('[想法]')) type = 'thought';
            else if (data.startsWith('和') && data.includes('聊天')) type = 'chat';
            this.memories.push({ time, text: data, type });
        } else {
            // 新格式：结构化对象 { type, text, lines?, partner? }
            this.memories.push({ time, ...data });
        }
        if (this.memories.length > this.maxMemories) this.memories.shift();
    }

    getAffinity(otherId) {
        return this.affinity[otherId] ?? 50;
    }

    changeAffinity(otherId, delta) {
        const cur = this.getAffinity(otherId);
        this.affinity[otherId] = Math.max(0, Math.min(100, cur + delta));
    }

    /** 【轮回系统】应用前世记忆加成 */
    _applyReincarnationBonus(game) {
        if (!game || !game.reincarnationSystem) return;
        const rs = game.reincarnationSystem;
        const lifeNum = rs.getLifeNumber();
        if (lifeNum <= 1) return; // 第1世无加成

        console.log(`[NPC-轮回] ${this.name} 应用第${lifeNum}世轮回加成`);

        // 1. San值加成：min(100, 基础值 + 5 × 世数)
        if (this.sanity !== undefined) {
            const bonus = 5 * lifeNum;
            this.sanity = Math.min(100, this.sanity + bonus);
            console.log(`  San值加成: +${bonus} → ${Math.round(this.sanity)}`);
        }

        // 2. 上一世死亡同伴好感度+10
        const deathRecords = rs.getLastLifeDeathRecords();
        for (const record of deathRecords) {
            // 通过名字匹配NPC ID
            const deadNpc = (typeof NPC_CONFIGS !== 'undefined') 
                ? NPC_CONFIGS.find(c => c.name === record.name)
                : null;
            if (deadNpc && deadNpc.id !== this.id) {
                const cur = this.getAffinity(deadNpc.id);
                this.affinity[deadNpc.id] = Math.min(100, cur + 10);
                console.log(`  好感度加成: 对${record.name}(上世死亡) +10 → ${this.affinity[deadNpc.id]}`);
            }
        }

        // 3. 上一世冲突对象好感度-5
        const conflicts = rs.getLastLifeConflictEvents();
        for (const event of conflicts) {
            // 尝试从事件文本中提取NPC名字
            if (typeof NPC_CONFIGS !== 'undefined') {
                for (const cfg of NPC_CONFIGS) {
                    if (cfg.id !== this.id && event.text && event.text.includes(cfg.name) && event.text.includes(this.name)) {
                        const cur = this.getAffinity(cfg.id);
                        this.affinity[cfg.id] = Math.max(0, cur - 5);
                        console.log(`  好感度惩罚: 对${cfg.name}(上世冲突) -5 → ${this.affinity[cfg.id]}`);
                    }
                }
            }
        }

        // 4. 如果自己上一世死亡，添加初始记忆
        if (rs.wasNpcDeadLastLife(this.id)) {
            const deathCause = rs.getNpcDeathCauseLastLife(this.id);
            this.addMemory(`[前世残影] 你隐约记得自己曾经${deathCause === '冻死' ? '在极度寒冷中失去意识' : deathCause === '饿死' ? '在饥饿中慢慢衰弱' : '经历了可怕的事情'}…那种恐惧至今挥之不去。`, 'reincarnation');
        }
    }

    // ---- 更新 ----
    update(dt, game) {
        // 【场景一致性校验】确保NPC的currentScene在已知场景列表中，否则重置到village
        if (game && game.maps) {
            if (!game.maps[this.currentScene]) {
                console.warn(`[场景修正] ${this.name} 的currentScene="${this.currentScene}" 不在已知场景中，重置到village`);
                this.currentScene = 'village';
                this.x = 15 * TILE;
                this.y = 15 * TILE;
                this.currentPath = [];
                this.pathIndex = 0;
                this.isMoving = false;
            } else {
                // 【坐标边界校验】确保NPC坐标在当前场景地图范围内
                const curMap = game.maps[this.currentScene];
                const maxPx = (curMap.width - 1) * TILE;
                const maxPy = (curMap.height - 1) * TILE;
                if (this.x < 0 || this.x > maxPx || this.y < 0 || this.y > maxPy) {
                    console.warn(`[坐标修正] ${this.name} 坐标(${(this.x/TILE).toFixed(1)},${(this.y/TILE).toFixed(1)})超出${this.currentScene}边界(${curMap.width}x${curMap.height})，钳制到有效范围`);
                    this.x = Math.max(0, Math.min(this.x, maxPx));
                    this.y = Math.max(0, Math.min(this.y, maxPy));
                }
            }
        }

        // 表情计时器
        if (this.expressionTimer > 0) {
            this.expressionTimer -= dt;
            if (this.expressionTimer <= 0) this.expression = '';
        }

        // 冷却计时器递减
        if (this._noOneFoundCooldown > 0) this._noOneFoundCooldown -= dt;
        if (this._hungerTriggerCooldown > 0) this._hungerTriggerCooldown -= dt;

        // 【吵架冷淡期递减】冷淡期内不会被动增加好感度
        if (this._affinityCooldown) {
            for (const id in this._affinityCooldown) {
                if (this._affinityCooldown[id] > 0) {
                    this._affinityCooldown[id] -= dt;
                }
            }
        }

        // 【v2.0】濒死状态：停止所有活动，仅更新属性和体温
        if (this._isDying) {
            this._updateAttributes(dt, game);
            this._updateBodyTemp(dt, game);
            return; // 濒死NPC不执行任何行动逻辑
        }

        // 【进出门过渡】如果正在走向室内门口准备出门
        if (this._walkingToDoor) {
            this._updateDoorWalk(dt, game);
            return; // 出门过渡期间不执行其他逻辑
        }

        // 六大属性系统更新
        this._updateAttributes(dt, game);

        // 行动实效性系统更新（让日程行为产生实际效果）
        this._updateActionEffect(dt, game);

        // 饥饿系统更新
        this._updateHunger(dt, game);

        // 睡眠状态检查
        this._updateSleepState(game);

        // 如果在睡觉，只更新 Zzz 动画，不做其他事
        if (this.isSleeping) {
            this.sleepZTimer += dt;
            this.isMoving = false;
            this.animFrame = 0;
            return;
        }

        // 状态驱动行为覆盖（疲劳回家、生病看病、精神差求助）
        this._updateStateOverride(dt, game);

        // 【v2.0-任务7】资源紧急时强制结束聊天
        if (this.state === 'CHATTING' && game && game.resourceSystem) {
            if (!this._chatUrgencyCheckTimer) this._chatUrgencyCheckTimer = 0;
            this._chatUrgencyCheckTimer += dt;
            if (this._chatUrgencyCheckTimer >= 5) { // 每5秒检查一次
                this._chatUrgencyCheckTimer = 0;
                const urgency = game.resourceSystem.getResourceUrgency();
                const hasCritical = urgency.wood === 'critical' || urgency.food === 'critical' || urgency.power === 'critical';
                if (hasCritical) {
                    this._forceEndChat();
                    if (game.addEvent) {
                        game.addEvent(`⚡ ${this.name}因资源紧急停止聊天，准备执行任务！`);
                    }
                    this._logDebug('chat', '资源critical，强制结束聊天');
                }
            }
        }

        // LLM行动决策系统更新（覆盖检测、同伴到达检测等）
        this._updateActionOverride(dt, game);

        // 下雨避雨检查
        this._updateRainResponse(game);

        // 日程检查
        this._updateSchedule(dt, game);

        // 【兜底】发呆检测与自动恢复
        this._updateIdleWatchdog(dt, game);

        // 【增强】让路逻辑处理：如果被碰撞系统指派了让路目标，优先执行让路移动
        if (this._yieldMove) {
            this._yieldTimer = (this._yieldTimer || 0) + dt;
            const ytx = this._yieldMove.x * TILE;
            const yty = this._yieldMove.y * TILE;
            const ydx = ytx - this.x;
            const ydy = yty - this.y;
            const ydist = Math.sqrt(ydx * ydx + ydy * ydy);

            if (ydist < 3 || this._yieldTimer > 2.0) {
                // 让路完成或超时，清除让路状态
                if (ydist < 3) {
                    this.x = ytx;
                    this.y = yty;
                }
                this._yieldMove = null;
                this._yieldTimer = 0;
                this.collisionStallTimer = 0;
                // 恢复之前保存的路径
                if (this._savedPath) {
                    this.currentPath = this._savedPath.path;
                    this.pathIndex = this._savedPath.index;
                    this._savedPath = null;
                    // 重新寻路到原目标（因为位置变了）
                    if (this.currentPath.length > 0) {
                        const finalTarget = this.currentPath[this.currentPath.length - 1];
                        this.currentPath = [];
                        this.pathIndex = 0;
                        this._pathTo(finalTarget.x, finalTarget.y, game);
                    }
                }
                this.isMoving = false;
            } else {
                // 朝让路目标移动
                const ynx = ydx / ydist;
                const yny = ydy / ydist;
                const yStep = Math.min(this.speed * dt, ydist - 1);
                this.x += ynx * yStep;
                this.y += yny * yStep;
                this.isMoving = true;
                // 面向方向
                if (Math.abs(ydx) >= Math.abs(ydy)) {
                    this.facing = ydx < 0 ? 1 : 2;
                } else {
                    this.facing = ydy < 0 ? 3 : 0;
                }
            }
        }
        // 移动
        else if (this.currentPath.length > 0) {
            if (this.pathIndex < this.currentPath.length) {
                this._followPath(dt, game);
                // 【增强】走向聊天目标途中：持续检测距离和目标状态
                if (this._chatWalkTarget) {
                    const chatTarget = game.npcs.find(n => n.id === this._chatWalkTarget);
                    if (!chatTarget || chatTarget.currentScene !== this.currentScene) {
                        // 目标已离开同场景，放弃走路
                        this._chatWalkTarget = null;
                        this.currentPath = [];
                        this.pathIndex = 0;
                        this.isMoving = false;
                        this.state = 'IDLE';
                        this.expression = chatTarget ? `${chatTarget.name}走了…` : '';
                        this.expressionTimer = 4;
                        this._logDebug('chat', `聊天目标已离开同场景，放弃追踪`);
                    } else {
                        // 目标还在，检测距离——足够近时提前发起对话
                        const myPos = this.getGridPos();
                        const tPos = chatTarget.getGridPos();
                        const dist = Math.abs(myPos.x - tPos.x) + Math.abs(myPos.y - tPos.y);
                        if (dist <= 4 && chatTarget.state !== 'CHATTING' && this.state !== 'CHATTING' && this._canChatWith(chatTarget)) {
                            // 已经走到足够近，提前发起对话
                            const chatTargetId = this._chatWalkTarget;
                            this._chatWalkTarget = null;
                            this.currentPath = [];
                            this.pathIndex = 0;
                            this.isMoving = false;
                            this.state = 'IDLE';
                            game.dialogueManager && game.dialogueManager.startNPCChat(this, chatTarget);
                            if (game.addEvent) {
                                game.addEvent(`🤝 ${this.name} 走到 ${chatTarget.name} 旁边开始聊天`);
                            }
                            this._logDebug('chat', `途中检测到距离${dist}格，提前发起对话`);
                        }
                    }
                }
            } else {
                // 路径走完了（pathIndex >= length），检查是否需要进入建筑
                this.currentPath = [];
                this.pathIndex = 0;
                this.isMoving = false;
                this.state = 'IDLE';

                if (this._pendingEnterScene) {
                    // 【进门流程】到达建筑门口，传送到室内再导航到目标位置
                    const doorKey = this._pendingEnterScene + '_indoor_door';
                    const doorLoc = SCHEDULE_LOCATIONS[doorKey];
                    const insideKey = this._pendingEnterScene + '_inside';
                    let insideLoc = SCHEDULE_LOCATIONS[insideKey];
                    // 【修复】对于公寓房间已经简化为独立宿舍场景，不再需要特殊处理
                    {
                        // 【增强】非公寓场景：从多座位中随机选择未被占用的位置
                        const seatLoc = this._pickIndoorSeat(this._pendingEnterScene, game);
                        if (seatLoc) insideLoc = { scene: this._pendingEnterScene, x: seatLoc.x, y: seatLoc.y };
                    }
                    if (doorLoc) {
                        // 先传送到室内门口位置
                        this._teleportTo(doorLoc.scene, doorLoc.x, doorLoc.y, true);
                        this._arrivalAwarenessApplied = -1;
                        this.scheduleReached = false; // 还没到最终目标
                        // 然后导航到室内目标位置
                        if (insideLoc) {
                            this._enterWalkTarget = { x: insideLoc.x, y: insideLoc.y };
                            this._pathTo(insideLoc.x, insideLoc.y, game);
                        }
                    } else if (insideLoc) {
                        // 兜底：没有定义室内门口，直接传送到inside
                        this._teleportTo(insideLoc.scene, insideLoc.x, insideLoc.y);
                        this._arrivalAwarenessApplied = -1;
                        this._enterWalkTarget = null;
                        this.scheduleReached = true;
                    }
                    this._pendingEnterScene = null;
                    this._pendingEnterKey = null;
                } else if (this._enterWalkTarget) {
                    // 【修复】进门后走向室内目标的路径走完了，检查是否真正到达
                    const pos = this.getGridPos();
                    const ewt = this._enterWalkTarget;
                    const distToTarget = Math.abs(pos.x - ewt.x) + Math.abs(pos.y - ewt.y);
                    if (distToTarget <= 3) {
                        // 已到达室内目标
                        this._enterWalkTarget = null;
                        this.scheduleReached = true;
                    } else {
                        // 还没到达，可能寻路走了一段但没到位，直接传送过去
                        console.log(`[进门修复] ${this.name} 路径走完但离室内目标(${ewt.x},${ewt.y})还有${distToTarget}格，直接传送`);
                        this.x = ewt.x * TILE;
                        this.y = ewt.y * TILE;
                        this._enterWalkTarget = null;
                        this.scheduleReached = true;
                    }
                } else if (this._chatWalkTarget) {
                    // 【修复】wantChat走路到达目标附近，自动发起对话
                    const chatTargetId = this._chatWalkTarget;
                    this._chatWalkTarget = null;
                    const target = game.npcs.find(n => n.id === chatTargetId);
                    // 【关键修复】到达后再次验证同场景，防止目标已离开导致隔空对话
                    if (target && target.currentScene === this.currentScene
                        && target.state !== 'CHATTING' && this.state !== 'CHATTING' && this._canChatWith(target)) {
                        game.dialogueManager && game.dialogueManager.startNPCChat(this, target);
                        if (game.addEvent) {
                            game.addEvent(`🤝 ${this.name} 走到 ${target.name} 旁边开始聊天`);
                        }
                    } else if (target && target.currentScene !== this.currentScene) {
                        this.expression = `${target.name}已经走了…`;
                        this.expressionTimer = 4;
                    }
                    // 走完社交路径后恢复日程已到达状态（不影响日程）
                    // scheduleReached 保持之前的值不变
                } else {
                    // 普通路径走完
                    this.scheduleReached = true;
                }
            }
        } else {
            this.isMoving = false;
            // 静止时逐渐衰减碰撞累积计时器
            if (this.collisionStallTimer > 0) {
                this.collisionStallTimer = Math.max(0, this.collisionStallTimer - dt * 0.3);
            }
        }

        // 【修复】位置合法性检测：站着不动的NPC如果被碰撞推进了墙壁/实体区域，自动恢复
        if (!this.isMoving && this.currentPath.length === 0) {
            const map = game.maps[this.currentScene];
            if (map && map.isSolid(this.x + TILE / 2, this.y + TILE / 2)) {
                // NPC当前位置在实体区域内，搜索最近的可通行位置
                let found = false;
                for (let r = 1; r <= 5 && !found; r++) {
                    for (let dy = -r; dy <= r && !found; dy++) {
                        for (let dx = -r; dx <= r && !found; dx++) {
                            if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue; // 只查外圈
                            const testX = this.x + dx * TILE;
                            const testY = this.y + dy * TILE;
                            if (!map.isSolid(testX + TILE / 2, testY + TILE / 2)) {
                                console.log(`[位置修复] ${this.name} 被推进墙壁，从(${Math.floor(this.x/TILE)},${Math.floor(this.y/TILE)})恢复到(${Math.floor(testX/TILE)},${Math.floor(testY/TILE)})`);
                                this.x = testX;
                                this.y = testY;
                                found = true;
                            }
                        }
                    }
                }
            }
        }

        // AI 思考冷却
        this.aiCooldown -= dt;

        // 动画
        if (this.isMoving) {
            this.animTimer += dt * 5;
            this.animFrame = Math.floor(this.animTimer) % 3;
        } else {
            this.animFrame = 0;
            this.animTimer = 0;
        }
    }

    // ---- 天气影响日程 ----
    // 户外目标集合
    static get OUTDOOR_TARGETS() {
        return new Set(['furnace_plaza', 'lumber_yard', 'ruins', 'north_gate', 'south_gate']);
    }
    // 雨天室内替代目标池（随机选一个）
    static get RAIN_INDOOR_ALTERNATIVES() {
        return [
            { target: 'dorm_a_door',   desc: '暴风雪来了，回宿舍A躲避' },
            { target: 'dorm_b_door',   desc: '暴风雪来了，回宿舍B躲避' },
            { target: 'kitchen_door',  desc: '太冷了，去炊事房取暖' },
            { target: 'workshop_door', desc: '太冷了，去工坊取暖' },
            { target: 'warehouse_door', desc: '太冷了，去仓库躲避' },
            { target: 'medical_door',  desc: '太冷了，去医疗站取暖' },
        ];
    }

    /**
     * 获取经天气调整后的日程条目
     * 如果正在下雨且目标是户外地点，则替换为室内目标
     * @param {Object} entry - 原始日程条目 { start, end, action, target, desc }
     * @param {Object} game - 游戏实例
     * @returns {Object} 调整后的日程条目（可能是原始的，也可能是替换后的）
     */
    _getWeatherAdjustedEntry(entry, game) {
        if (!entry) return entry;
        if (!NPC.OUTDOOR_TARGETS.has(entry.target)) return entry;

        // 【v2.0修复】不仅检查下雨，还要检查极端天气禁止外出
        const ws = game.weatherSystem;
        const isRaining = game.isRaining();
        const cannotGoOutside = ws && !ws.canGoOutside();

        if (!isRaining && !cannotGoOutside) return entry;

        // 下雨或极端天气 + 户外目标 → 替换为室内
        // 用 NPC id + 时段 start 做种子，保证同一时段内替代目标稳定不变
        const seed = (this.id.charCodeAt(0) + entry.start) % NPC.RAIN_INDOOR_ALTERNATIVES.length;
        const alt = NPC.RAIN_INDOOR_ALTERNATIVES[seed];
        return {
            ...entry,
            target: alt.target,
            desc: alt.desc,
            _rainAdjusted: true, // 标记为雨天替换
        };
    }

    // ---- 睡眠状态管理 ----
    _updateSleepState(game) {
        const hour = game.getHour();
        
        // 找到当前时段的日程
        const sched = this.scheduleTemplate;
        let currentAction = null;
        for (const s of sched) {
            if (s.start <= s.end) {
                if (hour >= s.start && hour < s.end) { currentAction = s; break; }
            } else {
                if (hour >= s.start || hour < s.end) { currentAction = s; break; }
            }
        }

        // 判断是否该睡觉：日程描述包含"休息"或"睡觉"，且NPC已到达家里
        const isSleepAction = currentAction && 
            (currentAction.desc.includes('休息') || currentAction.desc.includes('睡觉'));
        const shouldSleep = isSleepAction && this._isAtHome();

        // 【修复】深夜了(23点~6点)，如果NPC还在外面且处于饥饿覆盖状态，
        // 强制清除饥饿覆盖，让回家逻辑可以接管
        if (isSleepAction && !this._isAtHome() && this._hungerOverride) {
            this._hungerOverride = false;
            this._hungerTarget = null;
            this._hungerStuckTimer = 0;
            this._hungerTravelTimer = 0;
            this.isEating = false;
            this.currentPath = [];
            this.isMoving = false;
            this.currentScheduleIdx = -1;
            this.scheduleReached = false;
        }

        // 如果该睡觉了但还不在家，强制导航回宿舍（避免在路上站着睡）
        // 【修复】CHATTING状态下不强制回家，等对话结束后再说
        if (isSleepAction && !this._isAtHome() && !this.isSleeping && this.state !== 'CHATTING') {
            if (!this.isMoving && this.currentPath.length === 0) {
                if (this.currentScene === 'village') {
                    // 在村庄里 → 走向宿舍门口，到达后自动进入
                    const homeDoorKey = this.homeName + '_door';
                    const homeDoorLoc = SCHEDULE_LOCATIONS[homeDoorKey];
                    if (homeDoorLoc) {
                        this._pendingEnterScene = this.homeName;
                        this._pendingEnterKey = homeDoorKey;
                        this._pathTo(homeDoorLoc.x, homeDoorLoc.y, this.game);
                    }
                } else if (this.currentScene !== this.homeName) {
                    // 在其他室内 → 先传送出门到村庄
                    const doorPos = this._getDoorPos();
                    this._teleportTo('village', doorPos.x, doorPos.y);
                }
            }
        }

        if (shouldSleep && !this.isSleeping && this.state !== 'CHATTING') {
            // 【修复】入睡时强制修正坐标到床位位置
            const bedLoc = SCHEDULE_LOCATIONS[this.homeName + '_inside'];
            if (bedLoc) {
                this.x = bedLoc.x * TILE;
                this.y = bedLoc.y * TILE;
            }
            this.isSleeping = true;
            this.state = 'SLEEPING';
            this.stateDesc = '正在睡觉 💤';
            this.currentPath = [];
            this.isMoving = false;
            this.expression = '';
            this._logDebug('sleep', `开始睡觉(日程) 体力:${Math.round(this.stamina)} San:${Math.round(this.sanity)}`);
        } else if (!shouldSleep && this.isSleeping) {
            // 起床了
            this.isSleeping = false;
            this.state = 'IDLE';
            this.mood = '平静';
            this.stateDesc = '刚起床';
            this.expression = '新的一天开始了~';
            this.expressionTimer = 5;
            this.sleepZTimer = 0;
            if (game.addEvent) {
                game.addEvent(`🌅 ${this.name} 起床了`);
            }
        }
    }

    _isAtHome() {
        // NPC必须真正在公寓/家的室内场景才算"在家"，不能在村庄路上就睡
        // NPC在自己宿舍中即为在家
        if (this.currentScene === this.homeName) {
            return true;
        }
        return false;
    }

    /**
     * 判断当前时间是否已经过了这个NPC的就寝时间
     * 使用NPC配置中的bedtime字段（如老钱21点、陆辰0:30）
     * @param {number} hour - 当前游戏小时（整数，getHour()返回值）
     * @returns {boolean}
     */
    _isBedtime(hour) {
        const bedtime = this.config.bedtime || 23; // 默认23点
        // bedtime可能跨午夜：如bedtime=0表示0:00, bedtime=1表示1:00
        if (bedtime >= 12) {
            // 睡觉时间在当天晚上（如21、22、23）
            return hour >= bedtime || hour < 6;
        } else {
            // 睡觉时间在凌晨（如0、1）
            return (hour >= bedtime && hour < 6) || hour >= 23; // 23点后肯定该往回走了
        }
    }

    /** 获取NPC自己的床位位置key（宿舍内部） */
    _getMyRoomKey() {
        // 新系统下直接返回宿舍内部位置
        return this.homeName + '_inside';
    }
    /** 场景名 → 中文标签 */
    getSceneLabel() {
        const SCENE_LABELS = {
            village: '据点',
            warehouse: '仓库',
            medical: '医疗站',
            dorm_a: '宿舍A',
            dorm_b: '宿舍B',
            kitchen: '炊事房',
            workshop: '工坊',
        };
        return SCENE_LABELS[this.currentScene] || this.currentScene;
    }

    /**
     * 获取角色状态摘要行（位置 + 当前意图）
     * 用于头顶显示和GLM prompt
     */
    getStatusLine() {
        const loc = this.getSceneLabel();
        let intent = '';
        if (this.isSleeping) {
            intent = '💤 睡觉中';
        } else if (this.state === 'CHATTING') {
            intent = '💬 聊天中';
        } else if (this.isEating) {
            intent = '🍜 吃饭中';
        } else if (this._isBeingTreated) {
            intent = '🏥 看病中';
        } else if (this.isInTherapy) {
            intent = '💆 咨询中';
        } else if (this._isDying) {
            intent = '⚠️ 濒死';
        } else if (this.game && this.game.furnaceSystem && this.game.furnaceSystem.isBuildingSecondFurnace && this.game.furnaceSystem.buildWorkers.includes(this.id)) {
            const pct = Math.round(this.game.furnaceSystem.buildProgress * 100);
            intent = `🔨 建造暖炉${pct}%`;
        } else if (this.isCrazy) {
            intent = '🤯 发疯中';
        } else if (this.isSick) {
            intent = '🤒 生病中';
        } else if (this.stateDesc) {
            intent = this.stateDesc;
        }
        // 截断过长的描述
        if (intent.length > 16) intent = intent.substring(0, 15) + '…';

        // 【调试增强】覆盖系统状态标识
        let debugFlags = '';
        if (this._actionOverride) debugFlags += '[AO]';
        if (this._stateOverride) debugFlags += `[SO:${this._stateOverride}]`;
        if (this._hungerOverride) debugFlags += '[HO]';
        if (this._priorityOverride) debugFlags += `[PO:${this._priorityOverride}]`;
        if (this.scheduleReached) debugFlags += '[SR]';
        if (this._taskOverride && this._taskOverride.isActive) debugFlags += `[T:${this._taskOverride.targetLocation || '?'}]`;
        if (this._idleWatchdogTimer > 3) debugFlags += `[IDLE:${Math.round(this._idleWatchdogTimer)}s]`;

        return `📍${loc}${intent ? ' · ' + intent : ''}${debugFlags ? ' ' + debugFlags : ''}`;
    }

    // ---- 下雨避雨 ----
    _updateRainResponse(game) {
        if (!game.isRaining()) {
            this.isSeekingShelter = false;
            return;
        }

        // 【增强】CHATTING状态下不打断对话，但标记需要避雨（对话结束后会重新触发）
        if (this.state === 'CHATTING') {
            return;
        }

        // 【增强】已标记避雨但NPC停住了（被聊天/其他系统打断后恢复），强制重新触发避雨
        if (this.currentScene === 'village' && !this.hasUmbrella && this.isSeekingShelter
            && !this.isMoving && this.currentPath.length === 0 && !this.isSleeping) {
            // NPC说是在避雨但已经停下来了（可能聊天结束了），重置标记重新导航
            this.isSeekingShelter = false;
        }

        // 如果正在户外 (村庄场景) 且没有伞
        if (this.currentScene === 'village' && !this.hasUmbrella && !this.isSeekingShelter) {
            this.isSeekingShelter = true;
            
            // 找最近的避雨点（优先公寓楼门口，其次最近的建筑门口）
            const pos = this.getGridPos();
            const shelterDoors = [
                { x: 40, y: 51, name: '公寓楼' },    // 公寓
                { x: 32, y: 37, name: '酒馆' },       // 酒馆
                { x: 41, y: 36, name: '杂货铺' },     // 杂货铺
                { x: 50, y: 36, name: '面包坊' },     // 面包坊
            ];
            
            // 选最近的避雨点
            let nearest = shelterDoors[0]; // 默认公寓
            let nearestDist = Infinity;
            for (const s of shelterDoors) {
                const d = Math.abs(pos.x - s.x) + Math.abs(pos.y - s.y);
                if (d < nearestDist) {
                    nearestDist = d;
                    nearest = s;
                }
            }
            
            this.stateDesc = `下雨了，跑向${nearest.name}避雨！`;
            this.expression = '下雨了！';
            this.expressionTimer = 4;
            // 【修复】避雨目标如果是建筑门口，设置pendingEnterScene以便到达后能进入建筑
            const shelterDoorMap = {
                '仓库': { enter: 'warehouse', key: 'warehouse_door' },
                '医疗站': { enter: 'medical', key: 'medical_door' },
                '宿舍A': { enter: 'dorm_a', key: 'dorm_a_door' },
                '宿舍B': { enter: 'dorm_b', key: 'dorm_b_door' },
                '炊事房': { enter: 'kitchen', key: 'kitchen_door' },
                '工坊': { enter: 'workshop', key: 'workshop_door' },
            };
            const shelterInfo = shelterDoorMap[nearest.name];
            if (shelterInfo) {
                this._pendingEnterScene = shelterInfo.enter;
                this._pendingEnterKey = shelterInfo.key;
            }
            this._pathTo(nearest.x, nearest.y, game);

            if (game.addEvent) {
                game.addEvent(`🌧️ ${this.name} 跑向${nearest.name}避雨`);
            }
        }
    }

    // ---- 日程系统 ----
    _updateSchedule(dt, game) {
        // ============ 三层行为优先级系统 ============
        // P0: 生存紧急（体温<35回暖炉、第4天室内锁定、健康<20去暖炉、体力<20暂停任务）
        // P1: 任务驱动（_taskOverride激活时覆盖日程、紧急资源任务、LLM urgent行动）
        // P2: 日程默认（scheduleTemplate日程表、LLM normal行动）
        const ws = game.weatherSystem;
        const currentDay = ws ? ws.currentDay : 1;
        const hour = game.getHour();

        // ========== P0: 生存紧急层 ==========

        // P0-1: 第4天行为锁定 — 所有NPC锁定在室内
        if (currentDay === 4 && this.currentScene === 'village') {
            this._behaviorPriority = 'P0';
            const homeDoor = this.homeName === 'dorm_a' ? 'dorm_a_door' : 'dorm_b_door';
            if (!this._priorityOverride) {
                this._priorityOverride = 'day4_lockdown';
                this.stateDesc = '大极寒！紧急返回室内';
                this._logDebug('schedule', `[P0] 第4天室外锁定，返回${homeDoor}`);
                this._navigateToScheduleTarget(homeDoor, game);
            }
            // P0同时暂停taskOverride中的户外任务
            if (this._taskOverride.isActive) {
                this._taskOverride.isActive = false;
                this._logDebug('schedule', `[P0] 第4天暂停任务覆盖`);
            }
            return;
        }

        // P0-2: 紧急避险 — 体温<35°C时立即回暖炉
        if (this.bodyTemp !== undefined && this.bodyTemp < 35 && this.currentScene === 'village') {
            this._behaviorPriority = 'P0';
            if (this._priorityOverride !== 'hypothermia') {
                this._priorityOverride = 'hypothermia';
                this.stateDesc = '体温过低！紧急返回暖炉';
                this._logDebug('schedule', `[P0] 体温${this.bodyTemp.toFixed(1)}°C，紧急返回暖炉`);
                // 【增强】体温<34°C时，优先寻找最近的室内建筑入口，而不是只去暖炉
                if (this.bodyTemp < 34) {
                    const nearestDoor = this._findNearestIndoorDoor(game);
                    if (nearestDoor) {
                        this._logDebug('schedule', `[P0] 体温极低(${this.bodyTemp.toFixed(1)}°C)，紧急前往最近室内入口: ${nearestDoor.key}`);
                        this._navigateToScheduleTarget(nearestDoor.key, game);
                    } else {
                        this._navigateToScheduleTarget('furnace_plaza', game);
                    }
                } else {
                    this._navigateToScheduleTarget('furnace_plaza', game);
                }
            } else if (!this.isMoving && this.currentPath.length === 0) {
                // 【防卡住兜底】已处于hypothermia但NPC不在移动，重新导航
                if (this.bodyTemp < 34) {
                    const nearestDoor = this._findNearestIndoorDoor(game);
                    if (nearestDoor) {
                        this._navigateToScheduleTarget(nearestDoor.key, game);
                    } else {
                        this._navigateToScheduleTarget('furnace_plaza', game);
                    }
                } else {
                    this._navigateToScheduleTarget('furnace_plaza', game);
                }
            }
            // P0同时暂停taskOverride
            if (this._taskOverride.isActive) {
                this._taskOverride.isActive = false;
                this._logDebug('schedule', `[P0] 低体温暂停任务覆盖`);
            }
            return;
        }

        // P0-3: 健康危急 — 健康<20时前往暖炉休息
        if (this.health < 20 && this.currentScene !== 'medical') {
            this._behaviorPriority = 'P0';
            if (this._priorityOverride !== 'health_critical') {
                this._priorityOverride = 'health_critical';
                this.stateDesc = '健康危急！前往暖炉休息';
                this._logDebug('schedule', `[P0] 健康${Math.round(this.health)}，紧急前往暖炉`);
                this._navigateToScheduleTarget('furnace_plaza', game);
            } else if (!this.isMoving && this.currentPath.length === 0) {
                // 【防卡住兜底】已处于health_critical但NPC不在移动，重新导航
                this._navigateToScheduleTarget('furnace_plaza', game);
            }
            // P0同时暂停taskOverride
            if (this._taskOverride.isActive) {
                this._taskOverride.isActive = false;
                this._logDebug('schedule', `[P0] 健康危急暂停任务覆盖`);
            }
            return;
        }

        // P0-4: 体力<20时暂停任务覆盖，前往暖炉休息
        if (this.stamina < 20 && this._taskOverride.isActive) {
            this._behaviorPriority = 'P0';
            this._taskOverride.isActive = false;
            if (this._priorityOverride !== 'stamina_critical') {
                this._priorityOverride = 'stamina_critical';
                this.stateDesc = '体力不支！暂停任务回暖炉休息';
                this._logDebug('schedule', `[P0] 体力${Math.round(this.stamina)}，暂停任务回暖炉`);
                this._navigateToScheduleTarget('furnace_plaza', game);
            } else if (!this.isMoving && this.currentPath.length === 0) {
                // 【防卡住兜底】已处于stamina_critical但NPC不在移动，说明导航被中断，重新导航
                this._logDebug('schedule', `[P0] 体力不支且NPC静止，重新导航暖炉`);
                this._navigateToScheduleTarget('furnace_plaza', game);
            }
            return;
        }

        // P0-5: 医疗需求 — 健康<30时前往医疗站
        if (this.health < 30 && this.currentScene !== 'medical') {
            this._behaviorPriority = 'P0';
            if (this._priorityOverride !== 'medical_urgent') {
                this._priorityOverride = 'medical_urgent';
                this.stateDesc = '健康危急！前往医疗站';
                this._logDebug('schedule', `[P0] 健康${Math.round(this.health)}，前往医疗站`);
                this._navigateToScheduleTarget('medical_door', game);
            }
            return;
        }

        // P0-6: 第2天户外任务2小时轮换机制
        if (currentDay === 2 && this.currentScene === 'village') {
            if (!this._outdoorTimer) this._outdoorTimer = 0;
            this._outdoorTimer += dt;
            if (this._outdoorTimer > 120) { // 2分钟真实时间≈游戏2小时
                this._behaviorPriority = 'P0';
                if (this._priorityOverride !== 'day2_return') {
                    this._priorityOverride = 'day2_return';
                    this.stateDesc = '户外超时2小时，必须返回室内';
                    this._logDebug('schedule', `[P0] 第2天户外超时，强制返回`);
                    this._navigateToScheduleTarget('furnace_plaza', game);
                }
                return;
            }
        } else {
            this._outdoorTimer = 0;
        }

        // P0优先级覆盖清除检测
        if (this._priorityOverride) {
            const canClear = (
                (this._priorityOverride === 'hypothermia' && (this.bodyTemp === undefined || this.bodyTemp >= 35.5)) ||
                (this._priorityOverride === 'medical_urgent' && this.health >= 40) ||
                (this._priorityOverride === 'health_critical' && this.health >= 30) ||
                (this._priorityOverride === 'stamina_critical' && this.stamina >= 40) ||
                (this._priorityOverride === 'day2_return' && this.currentScene !== 'village') ||
                (this._priorityOverride === 'day4_lockdown' && this.currentScene !== 'village')
            );
            if (canClear) {
                const clearedType = this._priorityOverride;
                this._priorityOverride = null;
                this._logDebug('schedule', `[P0] 优先级覆盖(${clearedType})已清除，恢复正常行为`);
                // P0恢复后自动重启被暂停的任务
                if (this._taskOverride.targetLocation && this._taskOverride.taskId && !this._taskOverride.isActive) {
                    this._taskOverride.isActive = true;
                    this._taskOverrideReached = false;
                    this._taskOverrideStuckTimer = 0;
                    this._taskOverrideTravelTimer = 0;
                    this._logDebug('schedule', `[P0恢复] 自动重启被暂停的任务: ${this._taskOverride.taskId} → ${this._taskOverride.targetLocation}`);
                    this._navigateToScheduleTarget(this._taskOverride.targetLocation, game);
                }
            } else {
                return; // P0行为未完成，继续执行
            }
        }

        // ========== P1: 任务驱动覆盖层 ==========
        // 当_taskOverride激活时，跳过P2日程，导航到任务目标位置

        // P1-1: 任务覆盖激活检测
        if (this._taskOverride.isActive && this._taskOverride.targetLocation) {
            this._behaviorPriority = 'P1';

            // 第4天禁止户外任务
            if (currentDay === 4) {
                const targetLoc = SCHEDULE_LOCATIONS[this._taskOverride.targetLocation];
                if (targetLoc && targetLoc.scene === 'village') {
                    // 户外目标在第4天禁止
                    this._taskOverride.isActive = false;
                    this._logDebug('schedule', `[P1] 第4天禁止户外任务，取消任务覆盖`);
                    // 继续往下执行P2
                } else {
                    // 室内任务可以执行
                    this._updateTaskOverrideNavigation(dt, game);
                    return;
                }
            } else {
                this._updateTaskOverrideNavigation(dt, game);
                return;
            }
        }

        // ========== P2: 日程默认层 ==========
        this._behaviorPriority = 'P2';

        // 【饥饿系统】检查是否到达吃饭地点（每帧都检测）
        this._checkEatingArrival(dt, game);

        // 【饥饿系统】如果正在吃饭，完全跳过日程
        if (this.isEating) return;

        // 【状态覆盖系统】状态覆盖期间完全跳过正常日程
        if (this._stateOverride || this._isBeingTreated) return;

        // 【LLM行动决策系统】行动覆盖期间完全跳过正常日程
        if (this._actionOverride && this._actionTarget) return;
        // 【LLM行动决策系统】同伴跟随期间完全跳过正常日程
        if (this._isCompanion && this._companionDestination) return;

        // 【饥饿系统】饥饿覆盖状态下，完全跳过正常日程调度
        if (this._hungerOverride && this._hungerTarget) {
            // 正在移动中 → 继续走，不干预
            if (this.isMoving || this.currentPath.length > 0) return;

            // 已到达目标场景 → _checkEatingArrival 会在上面处理
            const eatingScenes = {
                'kitchen_door': 'kitchen',
                'warehouse_door': 'warehouse',
                'dorm_a_door': 'dorm_a', 'dorm_b_door': 'dorm_b',
            };
            const targetScene = eatingScenes[this._hungerTarget.target];
            if (this.currentScene === targetScene) return; // 等待 _checkEatingArrival 处理

            // 既不在移动，也没到目标场景 → 卡住了，重新导航
            this._hungerStuckTimer = (this._hungerStuckTimer || 0) + 1;
            if (this._hungerStuckTimer > 2) {
                // 卡住超过2帧，强制重新导航
                this._hungerStuckTimer = 0;
                this._navigateToScheduleTarget(this._hungerTarget.target, game);
            }
            return; // 饥饿覆盖期间完全不执行正常日程
        }

        // hour 已在函数开头声明
        const sched = this.scheduleTemplate;
        let targetIdx = -1;

        for (let i = 0; i < sched.length; i++) {
            const s = sched[i];
            if (s.start <= s.end) {
                if (hour >= s.start && hour < s.end) { targetIdx = i; break; }
            } else {
                // 跨午夜
                if (hour >= s.start || hour < s.end) { targetIdx = i; break; }
            }
        }

        // 【天气影响】如果正在下雨，NPC在户外（village场景），且当前日程原本是户外目标，
        // 强制触发重新导航到室内（即使日程没有切换）
        if (targetIdx >= 0 && game.isRaining() && this.currentScene === 'village' && this.scheduleReached) {
            const rawTarget = sched[targetIdx].target;
            if (NPC.OUTDOOR_TARGETS.has(rawTarget)) {
                // 原始目标是户外，但下雨了，需要重新导航到室内替代目标
                const adjusted = this._getWeatherAdjustedEntry(sched[targetIdx], game);
                this.stateDesc = adjusted.desc;
                this.scheduleReached = false;
                this._navigateToScheduleTarget(adjusted.target, game);
            }
        }

        if (targetIdx !== this.currentScheduleIdx) {
            this.currentScheduleIdx = targetIdx;
            // 【关键修复】行动覆盖期间，日程切换只更新索引，不覆盖状态和导航
            // 否则NPC决定去做B事，日程切换会覆盖stateDesc并重置scheduleReached，
            // 导致NPC走一半转头去执行旧日程
            if (this._actionOverride) {
                // 行动覆盖中，仅记录日程变化，不干预当前行为
                this._logDebug('schedule', `日程切换到#${targetIdx}但行动覆盖中，不干预`);
            } else if (this._chatWalkTarget) {
                // 【修复】社交走路中，仅记录日程变化，不干预（防止日程打断走向聊天目标的路径）
                this._logDebug('schedule', `日程切换到#${targetIdx}但正在走向聊天目标，不干预`);
            } else {
                this.scheduleReached = false;
                this._enterWalkTarget = null; // 清空旧的室内走路目标
                if (targetIdx >= 0) {
                    const rawS = sched[targetIdx];
                    const s = this._getWeatherAdjustedEntry(rawS, game);
                    this.stateDesc = s.desc;
                    // 【修复】CHATTING、饥饿覆盖状态下不触发导航
                    if (this.state !== 'CHATTING' && !this._hungerOverride) {
                        this._logDebug('schedule', `日程切换→#${targetIdx}:${s.desc} 目标:${s.target}`);
                        this._navigateToScheduleTarget(s.target, game);
                    }
                }
            }
        }

        // 【任务4】日程导航超时兜底：如果导航超过30秒仍未到达，强制传送
        if (targetIdx >= 0 && !this.scheduleReached && this._scheduleNavTarget) {
            this._scheduleNavTimer += dt;
            if (this._scheduleNavTimer > 30) {
                const rawST = sched[targetIdx];
                const sT = this._getWeatherAdjustedEntry(rawST, game);
                const locT = SCHEDULE_LOCATIONS[sT.target];
                if (locT) {
                    // 【天气保护】超时传送目标为室外且天气禁止外出时，取消传送
                    const wsT = game && game.weatherSystem;
                    if (wsT && !wsT.canGoOutside() && locT.scene === 'village' && this.currentScene !== 'village') {
                        console.warn(`[NPC-${this.name}] [天气保护] 日程导航超时但目标在室外，取消传送，就地待命`);
                        this.scheduleReached = true;
                        this._scheduleNavTimer = 0;
                        this._scheduleNavTarget = null;
                        return;
                    }
                    console.warn(`[NPC-${this.name}] 日程导航超时30秒，强制传送到 ${sT.target} (${locT.scene},${locT.x},${locT.y})`);
                    this._teleportTo(locT.scene, locT.x, locT.y);
                    this.scheduleReached = true;
                    this._scheduleNavTimer = 0;
                    this._scheduleNavTarget = null;
                    this._logDebug('schedule', `[P2] 日程导航超时，强制传送到 ${sT.target}`);
                    return;
                }
                this._scheduleNavTimer = 0; // 目标无效，重置计时器
            }
        }

        // 如果日程未到达，且NPC没在移动中，可能需要重新导航
        // （处理多步传送的情况：酒馆→村庄后，还需从村庄→公寓）
        if (targetIdx >= 0 && !this.scheduleReached && !this.isMoving && this.currentPath.length === 0 && !this.isSleeping && this.state !== 'CHATTING' && !this._hungerOverride && !this._actionOverride && !this._chatWalkTarget) {
            const rawS = sched[targetIdx];
            const s = this._getWeatherAdjustedEntry(rawS, game);
            const loc = SCHEDULE_LOCATIONS[s.target];
            const isDoorTarget = s.target.endsWith('_door');
            const doorToScene = {
                warehouse_door: 'warehouse', medical_door: 'medical',
                dorm_a_door: 'dorm_a', dorm_b_door: 'dorm_b',
                kitchen_door: 'kitchen', workshop_door: 'workshop',
            };

            // 【修复】如果目标是门口类（xxx_door），NPC已经进入对应室内场景
            if (isDoorTarget) {
                const insideScene = doorToScene[s.target];
                if (insideScene && this.currentScene === insideScene) {
                    // 已在室内，检查是否到达了inside位置（而不是卡在门口）
                    const insideKey = insideScene + '_inside';
                    let insideLoc = SCHEDULE_LOCATIONS[insideKey];
                    // 【增强】优先使用已分配的目标座位，否则重新选择
                    {
                        if (this._enterWalkTarget) {
                            insideLoc = { scene: insideScene, x: this._enterWalkTarget.x, y: this._enterWalkTarget.y };
                        } else {
                            const seatLoc = this._pickIndoorSeat(insideScene, game);
                            if (seatLoc) insideLoc = { scene: insideScene, x: seatLoc.x, y: seatLoc.y };
                        }
                    }
                    if (insideLoc) {
                        const pos = this.getGridPos();
                        const distToInside = Math.abs(pos.x - insideLoc.x) + Math.abs(pos.y - insideLoc.y);
                        if (distToInside <= 3) {
                            // 已经到达inside目标附近，标记到达
                            this.scheduleReached = true;
                            return;
                        } else {
                            // 还在门口附近，继续导航到inside
                            this._enterWalkTarget = { x: insideLoc.x, y: insideLoc.y };
                            this._pathTo(insideLoc.x, insideLoc.y, game);
                            return;
                        }
                    } else {
                        this.scheduleReached = true;
                        return;
                    }
                }
            }

            // 【修复】如果NPC在村庄且已站在门口附近（5格内），进入建筑（先到室内门口再走向目标）
            if (isDoorTarget && this.currentScene === 'village' && loc) {
                const pos = this.getGridPos();
                const dist = Math.abs(pos.x - loc.x) + Math.abs(pos.y - loc.y);
                if (dist <= 5) {
                    const insideScene = doorToScene[s.target];
                    const doorKey = insideScene + '_indoor_door';
                    const doorLoc = SCHEDULE_LOCATIONS[doorKey];
                    const insideKey = insideScene + '_inside';
                    let insideLoc = SCHEDULE_LOCATIONS[insideKey];
                    // 【增强】从多座位中随机选择未被占用的位置
                    {
                        const seatLoc = this._pickIndoorSeat(insideScene, game);
                        if (seatLoc) insideLoc = { scene: insideScene, x: seatLoc.x, y: seatLoc.y };
                    }
                    if (doorLoc) {
                        this._teleportTo(doorLoc.scene, doorLoc.x, doorLoc.y, true);
                        this._arrivalAwarenessApplied = -1;
                        if (insideLoc) {
                            this._enterWalkTarget = { x: insideLoc.x, y: insideLoc.y };
                            this._pathTo(insideLoc.x, insideLoc.y, game);
                        }
                        this.scheduleReached = false;
                        return;
                    } else if (insideLoc) {
                        this._teleportTo(insideLoc.scene, insideLoc.x, insideLoc.y);
                        this._enterWalkTarget = null;
                        this.scheduleReached = true;
                        this._arrivalAwarenessApplied = -1;
                        return;
                    }
                }
            }

            if (loc && loc.scene !== this.currentScene) {
                this._navigateToScheduleTarget(s.target, game);
            } else if (loc && loc.scene === this.currentScene) {
                // 同场景但还没到达，重新导航
                this._navigateToScheduleTarget(s.target, game);
            }
        }

        // 【安全网】如果日程标记为已到达，但目标是门口类（xxx_door）且NPC仍在村庄，说明进入建筑失败，先传送到室内门口再走进去
        if (this.scheduleReached && targetIdx >= 0 && !this.isSleeping && this.state !== 'CHATTING') {
            const curTarget = this._getWeatherAdjustedEntry(sched[targetIdx], game).target;
            if (curTarget.endsWith('_door') && this.currentScene === 'village') {
                const safetyDoorToScene = {
                    warehouse_door: 'warehouse', medical_door: 'medical',
                    dorm_a_door: 'dorm_a', dorm_b_door: 'dorm_b',
                    kitchen_door: 'kitchen', workshop_door: 'workshop',
                };
                const targetScene = safetyDoorToScene[curTarget];
                if (targetScene) {
                    const doorKey = targetScene + '_indoor_door';
                    const doorLoc = SCHEDULE_LOCATIONS[doorKey];
                    const insideKey = targetScene + '_inside';
                    let insideLoc = SCHEDULE_LOCATIONS[insideKey];
                    // 【增强】座位选择
                    {
                        const seatLoc = this._pickIndoorSeat(targetScene, game);
                        if (seatLoc) insideLoc = { scene: targetScene, x: seatLoc.x, y: seatLoc.y };
                    }
                    if (doorLoc) {
                        this._teleportTo(doorLoc.scene, doorLoc.x, doorLoc.y, true);
                        this._arrivalAwarenessApplied = -1;
                        this.scheduleReached = false;
                        if (insideLoc) {
                            this._enterWalkTarget = { x: insideLoc.x, y: insideLoc.y };
                            this._pathTo(insideLoc.x, insideLoc.y, game);
                        }
                    } else if (insideLoc) {
                        this._teleportTo(insideLoc.scene, insideLoc.x, insideLoc.y);
                        this._enterWalkTarget = null;
                        this._arrivalAwarenessApplied = -1;
                    }
                    this._pendingEnterScene = null;
                    this._pendingEnterKey = null;
                }
            }
        }

        // 已到达目的地后，动态感知环境并调整状态描述
        // 【修复】CHATTING 状态下不触发环境感知，避免把正在聊天的NPC传送走
        // 【位置偏移修正】scheduleReached=true但NPC远离目标时，重新导航
        if (this.scheduleReached && targetIdx >= 0 && !this.isSleeping && this.state !== 'CHATTING' && !this.isMoving && this.currentPath.length === 0) {
            const rawSCheck = sched[targetIdx];
            const sCheck = this._getWeatherAdjustedEntry(rawSCheck, game);
            const locCheck = SCHEDULE_LOCATIONS[sCheck.target];
            if (locCheck && locCheck.scene === this.currentScene) {
                const posCheck = this.getGridPos();
                const distCheck = Math.abs(posCheck.x - locCheck.x) + Math.abs(posCheck.y - locCheck.y);
                if (distCheck > 6) {
                    console.warn(`[NPC-${this.name}] [位置偏移修正] scheduleReached=true但距目标${sCheck.target}距离=${distCheck}格(>6)，重新导航`);
                    this.scheduleReached = false;
                    this._navigateToScheduleTarget(sCheck.target, game);
                    return;
                }
            }
        }
        if (this.scheduleReached && targetIdx >= 0 && !this.isSleeping && this.state !== 'CHATTING') {
            this._postArrivalAwareness(game, this._getWeatherAdjustedEntry(sched[targetIdx], game));

            // 店主无客外出招揽机制：当在自己店里且连续无客超过30分钟，出门招揽
            if (this.workplaceName === this.currentScene && this.shopAloneMinutes > 30) {
                const hour = game.getHour();
                // 只在正常营业时间触发（不在睡觉时间）
                if (hour >= 7 && hour <= 20 && !this.isMoving && this.currentPath.length === 0) {
                    this.shopAloneMinutes = 0; // 重置计时
                    this.stateDesc = '店里太冷清了，出门转转招揽客人';
                    this.expression = '唉，今天怎么没人来呢…出门看看吧';
                    this.expressionTimer = 6;
                    this.mood = '无聊';
                    if (game.addEvent) {
                        game.addEvent(`🚶 ${this.name} 因无客外出招揽生意`);
                    }
                    // 离开店铺去广场/街上
                    this._leaveAndWander(game);
                    this.scheduleReached = false;
                    return;
                }
            }
        }
    }

    // ============ P1任务驱动覆盖导航 ============

    /**
     * 处理任务覆盖状态下的导航逻辑
     * 当_taskOverride.isActive时由_updateSchedule的P1层调用
     */
    _updateTaskOverrideNavigation(dt, game) {
        const override = this._taskOverride;
        if (!override.isActive || !override.targetLocation) return;

        let targetLoc = SCHEDULE_LOCATIONS[override.targetLocation];
        if (!targetLoc) {
            // 尝试去掉_enter后缀修正
            const stripped = override.targetLocation.replace(/_enter$/, '');
            if (SCHEDULE_LOCATIONS[stripped]) {
                override.targetLocation = stripped;
                targetLoc = SCHEDULE_LOCATIONS[stripped];
                console.warn(`[NPC-${this.name}] 自动修正任务目标: "${override.targetLocation}" → "${stripped}"`);
            } else {
                // 根据资源类型使用备用坐标
                const fallbackMap = {
                    woodFuel: 'lumber_camp',
                    food: 'frozen_lake',
                    material: 'ruins_site',
                    power: 'workshop_door'
                };
                const fallbackKey = (override.resourceType && fallbackMap[override.resourceType]) || 'furnace_plaza';
                targetLoc = SCHEDULE_LOCATIONS[fallbackKey];
                if (targetLoc) {
                    override.targetLocation = fallbackKey;
                    console.warn(`[NPC-${this.name}] 任务覆盖目标无效，回退到 "${fallbackKey}"`);
                } else {
                    console.warn(`[NPC-${this.name}] 任务覆盖目标 "${override.targetLocation}" 无法修正，取消任务`);
                    override.isActive = false;
                    return;
                }
            }
        }

        // 如果正在吃饭/治疗，不干预
        if (this.isEating || this._isBeingTreated) return;

        // CHATTING状态处理：urgent任务可以打断聊天，其他优先级等待
        if (this.state === 'CHATTING') {
            if (override.priority === 'urgent') {
                console.log(`[NPC-${this.name}] urgent任务打断聊天导航`);
                this._forceEndChat();
            } else {
                return; // 非urgent任务等待聊天结束
            }
        }

        // 检查是否已到达目标场景和位置
        if (this.currentScene === targetLoc.scene) {
            const pos = this.getGridPos();
            const dist = Math.abs(pos.x - targetLoc.x) + Math.abs(pos.y - targetLoc.y);
            if (dist <= 4) {
                // 已到达任务目标位置，标记为"正在执行任务"
                if (!this._taskOverrideReached) {
                    this._taskOverrideReached = true;
                    this._taskOverrideStuckTimer = 0;
                    this._taskOverrideTravelTimer = 0;
                    this._logDebug('schedule', `[P1] 已到达任务目标位置 ${override.targetLocation}`);
                }
                // 到达后保持在位，不执行日程导航
                this.scheduleReached = true;
                return;
            }
            // 同场景但还没到位，继续导航
            if (!this.isMoving && this.currentPath.length === 0) {
                this._pathTo(targetLoc.x, targetLoc.y, game);
            }
        } else {
            // 不同场景，需要跨场景导航
            this._taskOverrideReached = false;
            if (!this.isMoving && this.currentPath.length === 0) {
                this._navigateToScheduleTarget(override.targetLocation, game);
            }
        }

        // 更新状态描述
        const taskDesc = this._getTaskOverrideDesc();
        if (taskDesc) this.stateDesc = taskDesc;

        // 卡住检测
        this._taskOverrideTravelTimer += dt;
        if (this._taskOverrideTravelTimer > 60) { // 60秒超时
            // 强制传送到目标位置
            this._teleportTo(targetLoc.scene, targetLoc.x, targetLoc.y);
            this._taskOverrideReached = true;
            this._taskOverrideTravelTimer = 0;
            this._logDebug('schedule', `[P1] 任务导航超时，强制传送到 ${override.targetLocation}`);
        }
    }

    /**
     * 激活任务覆盖
     * @param {string} taskId - 任务ID
     * @param {string} targetLocation - 目标位置key
     * @param {string} priority - 优先级
     * @param {string} resourceType - 关联资源类型（可选）
     */
    activateTaskOverride(taskId, targetLocation, priority, resourceType) {
        // 【防卡住】P0紧急状态下拒绝接受新任务，防止与体力不支/健康危急等状态冲突导致NPC卡住
        if (this._priorityOverride) {
            this._logDebug('schedule', `[P1] 拒绝任务 ${taskId}：当前处于P0状态(${this._priorityOverride})，等待恢复后再接受`);
            return false;
        }

        // 校验targetLocation是否存在于SCHEDULE_LOCATIONS
        let validLocation = targetLocation;
        if (!SCHEDULE_LOCATIONS[validLocation]) {
            // 尝试去掉_enter后缀
            const stripped = validLocation.replace(/_enter$/, '');
            if (SCHEDULE_LOCATIONS[stripped]) {
                console.warn(`[NPC-${this.name}] 位置key "${validLocation}" 不存在，自动修正为 "${stripped}"`);
                validLocation = stripped;
            } else {
                // 根据资源类型回退到合理的采集区
                const fallbackMap = {
                    woodFuel: 'lumber_camp',
                    food: 'frozen_lake',
                    material: 'ruins_site',
                    power: 'workshop_door'
                };
                const fallback = (resourceType && fallbackMap[resourceType]) || 'furnace_plaza';
                console.warn(`[NPC-${this.name}] 位置key "${validLocation}" 无效，回退到 "${fallback}"`);
                validLocation = fallback;
            }
        }

        // 如果是urgent优先级且NPC正在聊天，强制中断聊天
        if ((priority === 'urgent') && this.state === 'CHATTING') {
            console.log(`[NPC-${this.name}] urgent任务打断聊天状态`);
            this._forceEndChat();
        }

        this._taskOverride.taskId = taskId;
        this._taskOverride.targetLocation = validLocation;
        this._taskOverride.isActive = true;
        this._taskOverride.priority = priority || 'normal';
        this._taskOverride.resourceType = resourceType || null;
        this._taskOverrideReached = false;
        this._taskOverrideStuckTimer = 0;
        this._taskOverrideTravelTimer = 0;
        this._navStartTime = Date.now(); // 记录导航开始时间
        this.scheduleReached = false;

        // 设置具体的状态描述
        const resourceNames = { woodFuel: '砍柴', food: '采集食物', material: '采集建材', power: '维护电力' };
        const actionName = (resourceType && resourceNames[resourceType]) || '执行任务';
        this.stateDesc = priority === 'urgent' ? `紧急前往${actionName}` : `前往${actionName}`;

        this._logDebug('schedule', `[P1] 激活任务覆盖: ${taskId} → ${validLocation} (${priority})`);
    }

    /**
     * 取消任务覆盖，恢复日程控制
     */
    deactivateTaskOverride() {
        if (this._taskOverride.isActive) {
            this._logDebug('schedule', `[P1] 取消任务覆盖: ${this._taskOverride.taskId}`);
        }
        this._taskOverride.taskId = null;
        this._taskOverride.targetLocation = null;
        this._taskOverride.isActive = false;
        this._taskOverride.priority = 'normal';
        this._taskOverride.resourceType = null;
        this._taskOverrideReached = false;
        this._taskOverrideStuckTimer = 0;
        this._taskOverrideTravelTimer = 0;
    }

    /**
     * 强制结束当前聊天状态
     * 用于urgent任务打断CHATTING状态
     */
    _forceEndChat() {
        if (this.state !== 'CHATTING') return;
        console.log(`[NPC-${this.name}] 强制结束聊天状态`);
        this.state = 'IDLE';
        this.stateDesc = '准备执行任务';
        // 通知对话系统移除该NPC的排队对话
        if (this.game && this.game.dialogueSystem) {
            const ds = this.game.dialogueSystem;
            // 从聊天队列中移除包含此NPC的对话
            if (ds.npcChatQueue) {
                for (let i = ds.npcChatQueue.length - 1; i >= 0; i--) {
                    const chat = ds.npcChatQueue[i];
                    if (chat.npc1 === this || chat.npc2 === this) {
                        // 释放对方的CHATTING状态
                        const other = chat.npc1 === this ? chat.npc2 : chat.npc1;
                        if (other && other.state === 'CHATTING') {
                            other.state = 'IDLE';
                            other._logDebug('chat', `对话被伙伴 ${this.name} 的urgent任务中断`);
                        }
                        ds.npcChatQueue.splice(i, 1);
                    }
                }
            }
        }
        this._logDebug('chat', `聊天被强制中断（urgent任务）`);
    }

    /**
     * 获取任务覆盖的状态描述
     */
    _getTaskOverrideDesc() {
        const override = this._taskOverride;
        if (!override.isActive) return null;
        const resourceNames = { woodFuel: '砍柴', food: '采集食物', material: '采集建材', power: '维护电力' };
        if (override.resourceType && resourceNames[override.resourceType]) {
            return this._taskOverrideReached
                ? `正在${resourceNames[override.resourceType]}中...`
                : `前往${resourceNames[override.resourceType]}`;
        }
        return this._taskOverrideReached ? '执行任务中...' : '前往任务目标...';
    }

    /** 到达目的地后的环境感知 —— 动态更新状态描述 */
    _postArrivalAwareness(game, schedItem) {
        // 只在初次到达时触发一次
        if (this._arrivalAwarenessApplied === this.currentScheduleIdx) return;
        this._arrivalAwarenessApplied = this.currentScheduleIdx;

        const desc = schedItem.desc;
        const nearby = this._getNearbyNPCs(game, 64);

        // 【饥饿系统】到达餐饮场所且日程包含吃饭相关关键词时，开始吃饭
        const eatKeywords = /吃|买.*餐|买.*吃|买.*零食|买.*点心|买早餐|买午餐|买晚餐|买面包/;
        const eatScenes = ['kitchen', 'dorm_a', 'dorm_b'];
        if (eatKeywords.test(desc) && eatScenes.includes(this.currentScene) && !this.isEating) {
            this.isEating = true;
            this.eatingTimer = 20; // 吃饭持续 20 真实秒 ≈ 20 游戏分钟
            this.stateDesc = desc;
            this.mood = '满足';
            // 吃饭结束后在 _updateHunger 中恢复饥饿值
        }

        // 如果日程描述涉及社交（聊天、找人、讨论、探讨、聊聊），但附近没人
        const socialKeywords = /聊天|找人|串门|讨论|探讨|聊聊/;
        const isSocialIntent = socialKeywords.test(desc);
        if (isSocialIntent && nearby.length === 0) {
            this.stateDesc = desc.replace(socialKeywords, '') + '（没找到人）';
            this.mood = '无聊';
            this.expression = '怎么没人啊…';
            this.expressionTimer = 6;
            // 【修复】冷却机制：30秒内只触发一次"找不到人→出门游荡"，避免刷屏
            if (this._noOneFoundCooldown <= 0) {
                this._noOneFoundCooldown = 30; // 30秒冷却
                if (game.addEvent) {
                    game.addEvent(`😕 ${this.name} 到了目的地，但发现没人`);
                }
                // 在室内场景找不到人时，先离开建筑再去别处
                if (this.currentScene !== 'village') {
                    this._leaveAndWander(game);
                } else {
                    // 在户外找不到人，随机走向附近另一个地标碰碰运气
                    this._wanderToNearbyLandmark(game);
                }
            }
        } else if (isSocialIntent && nearby.length > 0) {
            // 附近有人，更新描述
            const names = nearby.slice(0, 2).map(n => n.name).join('、');
            this.stateDesc = `正在和${names}附近闲逛`;

            // 【修复】所有NPC到达社交目的地后都主动发起对话，不仅限于哲学家
            this._tryProactiveChat(game, nearby);
        } else if (!isSocialIntent && nearby.length > 0) {
            // 【增强】非社交日程，但附近有人时也有概率主动聊天（60%概率）
            if (Math.random() < 0.6 && this.state !== 'CHATTING') {
                this._tryProactiveChat(game, nearby);
            }
        }
    }

    /** 哲学家/思考型角色主动发起对话 */
    _tryProactiveChat(game, nearby) {
        if (this.state === 'CHATTING') return;
        if (!game.dialogueManager) return;

        // 【修复】过了就寝时间禁止主动找人聊天（每个NPC就寝时间不同）
        const hour = game.getHour();
        if (this._isBedtime(hour)) return;

        // 过滤出可以聊天的、没在睡觉或对话中的NPC
        const candidates = nearby.filter(n => {
            const npc = game.npcs.find(np => np.id === n.id);
            return npc && npc.state !== 'CHATTING' && !npc.isSleeping && this._canChatWith(npc);
        });

        if (candidates.length === 0) return;

        // 随机选一个人搭话
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        const target = game.npcs.find(np => np.id === pick.id);
        if (target) {
            game.dialogueManager.startNPCChat(this, target);
            if (game.addEvent) {
                game.addEvent(`🤝 ${this.name} 主动找 ${target.name} 聊天`);
            }
        }
    }

    /** 找不到人时，随机游荡到附近另一个户外地标 */
    _wanderToNearbyLandmark(game) {
        if (this.currentScene !== 'village') return;
        // 可游荡的户外地标 + 建筑门口（可以进去找人）
        const landmarks = [
            { key: 'furnace_plaza', x: 25, y: 20, label: '暖炉广场' },
            { key: 'lumber_yard',   x: 8,  y: 8,  label: '伐木场' },
            { key: 'ruins',         x: 42, y: 8,  label: '废墟' },
            { key: 'warehouse_door', x: 18, y: 24, label: '仓库', enter: 'warehouse' },
            { key: 'medical_door',   x: 32, y: 24, label: '医疗站', enter: 'medical' },
            { key: 'dorm_a_door',    x: 14, y: 30, label: '宿舍A', enter: 'dorm_a' },
            { key: 'dorm_b_door',    x: 36, y: 30, label: '宿舍B', enter: 'dorm_b' },
            { key: 'kitchen_door',   x: 22, y: 34, label: '炊事房', enter: 'kitchen' },
            { key: 'workshop_door',  x: 30, y: 34, label: '工坊', enter: 'workshop' },
        ];
        const pos = this.getGridPos();
        // 过滤掉当前已在附近（5格内）的地标，选一个远一点的
        const candidates = landmarks.filter(l => {
            const d = Math.abs(pos.x - l.x) + Math.abs(pos.y - l.y);
            return d > 5;
        });
        if (candidates.length === 0) return;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        this.scheduleReached = false; // 重新标记为未到达，这样到达新地点后会再次触发感知
        this._arrivalAwarenessApplied = -1; // 重置感知标记
        this.stateDesc += `，去${pick.label}看看`;
        // 如果选中的是建筑门口，设置进入标记
        if (pick.enter) {
            this._pendingEnterScene = pick.enter;
            this._pendingEnterKey = pick.key;
        }
        this._pathTo(pick.x, pick.y, game);
    }

    /** 在室内找不到人时，先走到室内门口，再离开建筑回到村庄，再去别处找人 */
    _leaveAndWander(game) {
        this.scheduleReached = false;
        this._arrivalAwarenessApplied = -1;
        this._walkToDoorAndExit(game, () => {
            // 回到村庄后立刻去另一个地标
            if (this.currentScene === 'village' && !this.isSleeping && this.state !== 'CHATTING') {
                this._wanderToNearbyLandmark(game);
            }
        });
    }

    _navigateToScheduleTarget(targetKey, game) {
        // 【关键修复】对话中不执行任何导航，防止NPC被传送到其他场景导致对话中断
        // 但urgent任务覆盖可以打断聊天
        if (this.state === 'CHATTING') {
            if (this._taskOverride && this._taskOverride.isActive && this._taskOverride.priority === 'urgent') {
                console.log(`[NPC-${this.name}] urgent任务打断聊天，开始导航到 ${targetKey}`);
                this._forceEndChat();
            } else {
                return;
            }
        }

        // 记录导航开始时间和目标，用于超时兜底
        this._navStartTime = Date.now();
        this._scheduleNavTimer = 0;
        this._scheduleNavTarget = targetKey;

        const loc = SCHEDULE_LOCATIONS[targetKey];
        if (!loc) {
            console.warn(`[NPC-${this.name}] SCHEDULE_LOCATIONS中未找到key: "${targetKey}"，跳过导航`);
            return;
        }

        // 判断目标是否是门口（xxx_door 类型）
        const isDoorTarget = targetKey.endsWith('_door');
        // 从门口key推断对应的室内场景名
        const doorToScene = {
            warehouse_door: 'warehouse', medical_door: 'medical',
            dorm_a_door: 'dorm_a', dorm_b_door: 'dorm_b',
            kitchen_door: 'kitchen', workshop_door: 'workshop',
        };

        // 如果需要切换场景（目标是室内）
        if (loc.scene !== this.currentScene) {
            // 【修复】如果目标是门口类且NPC已在对应室内，检查是否到达inside位置
            if (isDoorTarget) {
                const insideScene = doorToScene[targetKey];
                if (insideScene && this.currentScene === insideScene) {
                    const insideKey = insideScene + '_inside';
                    let insideLoc = SCHEDULE_LOCATIONS[insideKey];
                    {
                        // 【增强】优先使用已分配的目标座位，否则重新选择
                        if (this._enterWalkTarget) {
                            insideLoc = { scene: insideScene, x: this._enterWalkTarget.x, y: this._enterWalkTarget.y };
                        } else {
                            const seatLoc = this._pickIndoorSeat(insideScene, game);
                            if (seatLoc) insideLoc = { scene: insideScene, x: seatLoc.x, y: seatLoc.y };
                        }
                    }
                    if (insideLoc) {
                        const pos = this.getGridPos();
                        const distToInside = Math.abs(pos.x - insideLoc.x) + Math.abs(pos.y - insideLoc.y);
                        if (distToInside <= 3) {
                            this.scheduleReached = true;
                            return;
                        } else {
                            // 卡在门口，继续导航到NPC的目标位置
                            this._enterWalkTarget = { x: insideLoc.x, y: insideLoc.y };
                            this._pathTo(insideLoc.x, insideLoc.y, game);
                            return;
                        }
                    } else {
                        this.scheduleReached = true;
                        return;
                    }
                }
            }

            if (this.currentScene === 'village') {
                // 在村庄 → 如果是门口类目标，走过去再进入（而不是直接传送）
                if (isDoorTarget) {
                    this._pendingEnterScene = doorToScene[targetKey] || null;
                    this._pendingEnterKey = targetKey;
                    this._pathTo(loc.x, loc.y, game);
                } else {
                    // 非门口的室内目标 → 直接传送
                    this._teleportTo(loc.scene, loc.x, loc.y);
                }
            } else {
                // 在其他室内 → 先走到室内门口再出门到村庄
                // 【天气保护】跨场景导航需经过室外时，检查天气是否允许外出
                const wsNav = game && game.weatherSystem;
                if (wsNav && !wsNav.canGoOutside()) {
                    console.warn(`[NPC-${this.name}] [天气保护] 跨场景导航需经过室外，但天气禁止外出，NPC留在室内待命`);
                    this.scheduleReached = true;
                    return;
                }
                this._walkToDoorAndExit(game, null);
                // 出门后下一帧日程系统会重新触发导航
            }
            return;
        }

        // 同场景
        if (this.currentScene === 'village' && isDoorTarget) {
            // 目标是门口 → 先寻路走到门口，到达后自动进入对应建筑
            this._pendingEnterScene = doorToScene[targetKey] || null;
            this._pendingEnterKey = targetKey;
            this._pathTo(loc.x, loc.y, game);
        } else {
            this._pendingEnterScene = null;
            this._pathTo(loc.x, loc.y, game);
        }
    }

    _getDoorPos() {
        // 根据当前场景返回对应的门口位置（加随机偏移避免多NPC同时出门堆叠）
        // 【修复】坐标必须与 maps.js 中建筑的 doorX/doorY 一致
        const doorMap = {
            warehouse: { x: 18, y: 25 },
            medical:   { x: 32, y: 25 },
            dorm_a:    { x: 14, y: 31 },
            dorm_b:    { x: 36, y: 31 },
            kitchen:   { x: 22, y: 35 },
            workshop:  { x: 30, y: 35 },
        };
        const base = doorMap[this.currentScene] || { x: 40, y: 27 };
        // 出门时在门口附近散开（向南偏移1~3格，左右偏移±1格）
        return {
            x: base.x + Math.floor(Math.random() * 3) - 1,
            y: base.y + 1 + Math.floor(Math.random() * 2)
        };
    }

    /**
     * 【体温安全】查找距离NPC最近的室内建筑门口
     * 用于体温极低时紧急避险，优先进入最近的建筑而非必须去暖炉
     * @returns {{ key: string, dist: number } | null}
     */
    _findNearestIndoorDoor(game) {
        if (this.currentScene !== 'village') return null;
        const pos = this.getGridPos();
        const doorTargets = [
            'warehouse_door', 'medical_door', 'dorm_a_door', 'dorm_b_door',
            'kitchen_door', 'workshop_door'
        ];
        let nearest = null;
        let minDist = Infinity;
        for (const key of doorTargets) {
            const loc = SCHEDULE_LOCATIONS[key];
            if (!loc) continue;
            const dist = Math.abs(pos.x - loc.x) + Math.abs(pos.y - loc.y);
            if (dist < minDist) {
                minDist = dist;
                nearest = { key, dist };
            }
        }
        return nearest;
    }

    /**
     * 【增强】从室内多座位中随机选择一个未被其他NPC占用的位置
     * @param {string} scene - 室内场景名（如 'kitchen'）
     * @param {object} game - game 对象，用于查询其他NPC位置
     * @returns {{ x: number, y: number } | null} 选中的座位坐标，或 null（无可用座位时回退到默认）
     */
    _pickIndoorSeat(scene, game) {
        const seats = INDOOR_SEATS[scene];
        if (!seats || seats.length === 0) return null;

        // 收集同场景中其他NPC已占据的格子
        const occupied = new Set();
        if (game && game.npcs) {
            for (const other of game.npcs) {
                if (other === this) continue;
                if (other.currentScene !== scene) continue;
                const pos = other.getGridPos();
                occupied.add(`${pos.x},${pos.y}`);
                // 也把其他NPC的目标位置标记为占用（避免两个NPC选同一个座位）
                if (other._enterWalkTarget) {
                    occupied.add(`${other._enterWalkTarget.x},${other._enterWalkTarget.y}`);
                }
            }
        }

        // 筛选未被占用的座位
        const available = seats.filter(s => !occupied.has(`${s.x},${s.y}`));

        if (available.length > 0) {
            // 随机选一个
            const pick = available[Math.floor(Math.random() * available.length)];
            return { x: pick.x, y: pick.y };
        }

        // 所有座位都被占了，随机选一个（总比都挤门口好）
        const pick = seats[Math.floor(Math.random() * seats.length)];
        return { x: pick.x, y: pick.y };
    }

    /** 获取当前室内场景的门口坐标（室内侧） */
    _getIndoorDoorPos() {
        const key = this.currentScene + '_indoor_door';
        const loc = SCHEDULE_LOCATIONS[key];
        if (loc) return { x: loc.x, y: loc.y };
        // 兜底：根据场景类型估算门口位置（底部中间）
        const sizeMap = {
            warehouse: { w: 10, h: 8 }, medical: { w: 10, h: 8 },
            dorm_a: { w: 12, h: 8 }, dorm_b: { w: 12, h: 8 },
            kitchen: { w: 8, h: 8 }, workshop: { w: 12, h: 8 },
        };
        const size = sizeMap[this.currentScene];
        if (size) return { x: Math.floor(size.w / 2), y: size.h - 1 };
        return { x: 5, y: 8 };
    }

    /** 出门过渡：先走到室内门口，到达后再传送到村庄 */
    _walkToDoorAndExit(game, onExitCallback) {
        if (this.currentScene === 'village') {
            // 已经在村庄了，直接执行回调
            if (onExitCallback) onExitCallback();
            return;
        }

        // 【天气保护】极端天气禁止出门
        const ws = game && game.weatherSystem;
        if (ws && !ws.canGoOutside()) {
            console.warn(`[NPC-${this.name}] [天气保护] 因极端天气取消出门`);
            this._logDebug('schedule', `[天气保护] ${this.name} 因极端天气取消出门`);
            // 不执行出门，也不执行回调
            return;
        }

        const indoorDoor = this._getIndoorDoorPos();
        const pos = this.getGridPos();
        const dist = Math.abs(pos.x - indoorDoor.x) + Math.abs(pos.y - indoorDoor.y);

        // 【体温安全】低温警告：室外温度极低且NPC体温偏低时发出警告
        if (ws) {
            const outdoorTemp = ws.getEffectiveTemp();
            if (outdoorTemp < -30 && this.bodyTemp < 36) {
                if (game && game.addEvent) {
                    game.addEvent(`⚠️ ${this.name} 冒着严寒出门了（室外${outdoorTemp}°C，体温${this.bodyTemp.toFixed(1)}°C）`);
                }
                this._logDebug('schedule', `[体温警告] ${this.name} 在${outdoorTemp}°C下出门，体温${this.bodyTemp.toFixed(1)}°C`);
            }
        }

        if (dist <= 2) {
            // 已经在门口附近，直接出门
            const doorPos = this._getDoorPos();
            this._teleportTo('village', doorPos.x, doorPos.y);
            if (onExitCallback) onExitCallback();
            return;
        }

        // 需要走到门口
        this._walkingToDoor = true;
        this._exitDoorCallback = onExitCallback;
        this._exitDoorTimer = 0;
        // 清除当前路径，导航到门口
        this.currentPath = [];
        this.isMoving = false;
        this._pathTo(indoorDoor.x, indoorDoor.y, game);
    }

    /** 出门过渡期间的更新逻辑 */
    _updateDoorWalk(dt, game) {
        // 【关键修复】CHATTING状态下暂停出门过渡，防止对话中被传送
        if (this.state === 'CHATTING') {
            return;
        }

        // 【天气保护】出门过程中检测天气变化，禁止传送到室外
        const ws = game && game.weatherSystem;
        if (ws && !ws.canGoOutside()) {
            console.warn(`[NPC-${this.name}] [天气保护] 出门过程中检测到极端天气，取消出门`);
            this._walkingToDoor = false;
            this._exitDoorCallback = null;
            this.currentPath = [];
            this.isMoving = false;
            return;
        }

        // 超时保护：3秒还没走到门口就直接传送出去
        this._exitDoorTimer = (this._exitDoorTimer || 0) + dt;
        if (this._exitDoorTimer > 3) {
            this._walkingToDoor = false;
            const doorPos = this._getDoorPos();
            this._teleportTo('village', doorPos.x, doorPos.y);
            if (this._exitDoorCallback) {
                const cb = this._exitDoorCallback;
                this._exitDoorCallback = null;
                cb();
            }
            return;
        }

        // 继续移动
        if (this.currentPath.length > 0 && this.pathIndex < this.currentPath.length) {
            this._followPath(dt, game);
        } else if (this.currentPath.length > 0 && this.pathIndex >= this.currentPath.length) {
            // 走到门口了！传送出去
            this.currentPath = [];
            this.pathIndex = 0;
            this.isMoving = false;
            this._walkingToDoor = false;
            const doorPos = this._getDoorPos();
            this._teleportTo('village', doorPos.x, doorPos.y);
            if (this._exitDoorCallback) {
                const cb = this._exitDoorCallback;
                this._exitDoorCallback = null;
                cb();
            }
        } else {
            // 路径为空但还在走门口状态 → 可能寻路失败，直接传送
            this._walkingToDoor = false;
            const doorPos = this._getDoorPos();
            this._teleportTo('village', doorPos.x, doorPos.y);
            if (this._exitDoorCallback) {
                const cb = this._exitDoorCallback;
                this._exitDoorCallback = null;
                cb();
            }
        }
    }

    _teleportTo(scene, gx, gy, precise) {
        // 【最终防线】对话中的NPC绝对不能被传送到其他场景
        if (this.state === 'CHATTING' && scene !== this.currentScene) {
            console.warn(`[传送阻止] ${this.name}正在CHATTING，阻止传送到${scene}`);
            return;
        }

        // 【天气保护】从室内传送到village时检查天气
        if (scene === 'village' && this.currentScene !== 'village') {
            const ws = this.game && this.game.weatherSystem;
            if (ws && !ws.canGoOutside()) {
                console.warn(`[NPC-${this.name}] [天气保护] 阻止从${this.currentScene}传送到室外village（极端天气）`);
                return;
            }
        }

        // 【场景有效性校验】确保目标场景存在于已知场景列表中
        const validScenes = this.game && this.game.maps ? Object.keys(this.game.maps) : null;
        if (validScenes && !validScenes.includes(scene)) {
            console.warn(`[传送修正] ${this.name} 目标场景 ${scene} 不存在，回退到 village`);
            scene = 'village';
        }

        this.currentScene = scene;
        // 获取目标场景的地图用于碰撞检测
        const map = this.game && this.game.maps ? this.game.maps[scene] : null;

        // 【坐标边界校验】确保传送坐标在地图有效范围内
        const mapW = map ? map.width : 30;
        const mapH = map ? map.height : 30;
        gx = Math.max(0, Math.min(gx, mapW - 1));
        gy = Math.max(0, Math.min(gy, mapH - 1));

        if (precise === true) {
            // 精确传送（用于进门/回房间等），加微小偏移避免多NPC重叠堵门
            const jitter = 0.6; // ±0.6格的小偏移（缩小避免出界）
            let finalX = gx, finalY = gy;
            // 尝试几次随机偏移，确保落在可行走位置
            for (let attempt = 0; attempt < 5; attempt++) {
                const ox = (Math.random() - 0.5) * jitter * 2;
                const oy = (Math.random() - 0.5) * jitter * 2;
                const testX = Math.floor(gx + ox);
                const testY = Math.floor(gy + oy);
                if (!map || !map.isSolid(testX * TILE + TILE / 2, testY * TILE + TILE / 2)) {
                    finalX = gx + ox;
                    finalY = gy + oy;
                    break;
                }
            }
            // 【边界钳制】确保最终像素坐标在地图范围内
            finalX = Math.max(0, Math.min(finalX, mapW - 1));
            finalY = Math.max(0, Math.min(finalY, mapH - 1));
            this.x = finalX * TILE;
            this.y = finalY * TILE;
        } else {
            // 加入随机偏移（±1~2格），防止多个NPC传送到同一个点导致重叠
            let finalX = gx, finalY = gy;
            for (let attempt = 0; attempt < 5; attempt++) {
                const ox = (Math.random() - 0.5) * 3;
                const oy = (Math.random() - 0.5) * 3;
                const testX = Math.floor(gx + ox);
                const testY = Math.floor(gy + oy);
                if (!map || !map.isSolid(testX * TILE + TILE / 2, testY * TILE + TILE / 2)) {
                    finalX = gx + ox;
                    finalY = gy + oy;
                    break;
                }
            }
            // 【边界钳制】确保最终像素坐标在地图范围内
            finalX = Math.max(0, Math.min(finalX, mapW - 1));
            finalY = Math.max(0, Math.min(finalY, mapH - 1));
            this.x = finalX * TILE;
            this.y = finalY * TILE;
        }
        this.currentPath = [];
        this.pathIndex = 0;
        this.isMoving = false;
        this._pendingEnterScene = null;
        this._pendingEnterKey = null;
    }

    _pathTo(gx, gy, game) {
        const map = game.maps[this.currentScene];
        if (!map) return;
        const pos = this.getGridPos();
        const dist = Math.abs(pos.x - gx) + Math.abs(pos.y - gy);

        // 【修复】如果NPC已经在目标格子附近（4格内），且有pendingEnterScene，传送到室内门口再走进去
        if (dist <= 4 && this._pendingEnterScene) {
            const doorKey = this._pendingEnterScene + '_indoor_door';
            const doorLoc = SCHEDULE_LOCATIONS[doorKey];
            const insideKey = this._pendingEnterScene + '_inside';
            let insideLoc = SCHEDULE_LOCATIONS[insideKey];
            // 座位选择
            {
                const seatLoc = this._pickIndoorSeat(this._pendingEnterScene, game);
                if (seatLoc) insideLoc = { scene: this._pendingEnterScene, x: seatLoc.x, y: seatLoc.y };
            }
            if (doorLoc) {
                this._teleportTo(doorLoc.scene, doorLoc.x, doorLoc.y, true);
                this._arrivalAwarenessApplied = -1;
                this.scheduleReached = false;
                if (insideLoc) {
                    this._enterWalkTarget = { x: insideLoc.x, y: insideLoc.y };
                    this._pathTo(insideLoc.x, insideLoc.y, game);
                }
            } else if (insideLoc) {
                this._teleportTo(insideLoc.scene, insideLoc.x, insideLoc.y);
                this._enterWalkTarget = null;
                this.scheduleReached = true;
                this._arrivalAwarenessApplied = -1;
            }
            this._pendingEnterScene = null;
            this._pendingEnterKey = null;
            return;
        }

        // 【增强】如果NPC被持续碰撞阻挡，寻路时把同场景其他NPC的位置标记为障碍物，强制绕路
        let extraBlocked = null;
        if (this.collisionStallTimer > 0.5 && game.npcs) {
            extraBlocked = new Set();
            for (const other of game.npcs) {
                if (other === this) continue;
                if (other.currentScene !== this.currentScene) continue;
                const ogp = other.getGridPos();
                extraBlocked.add(`${ogp.x},${ogp.y}`);
            }
        }

        const path = findPath(pos.x, pos.y, gx, gy, map, extraBlocked);
        // 如果带障碍物的寻路失败，回退到普通寻路（不绕NPC）
        const finalPath = path || (extraBlocked ? findPath(pos.x, pos.y, gx, gy, map) : null);
        if (finalPath && finalPath.length > 1) {
            this.currentPath = finalPath;
            this.pathIndex = 1; // 跳过起点
            this.state = 'WALKING';
        } else if (finalPath && finalPath.length === 1 && this._pendingEnterScene) {
            // 已在目标点上，传送到室内门口再走向目标
            const doorKey = this._pendingEnterScene + '_indoor_door';
            const doorLoc = SCHEDULE_LOCATIONS[doorKey];
            const insideKey = this._pendingEnterScene + '_inside';
            let insideLoc = SCHEDULE_LOCATIONS[insideKey];
            // 座位选择
            {
                const seatLoc = this._pickIndoorSeat(this._pendingEnterScene, game);
                if (seatLoc) insideLoc = { scene: this._pendingEnterScene, x: seatLoc.x, y: seatLoc.y };
            }
            if (doorLoc) {
                this._teleportTo(doorLoc.scene, doorLoc.x, doorLoc.y, true);
                this._arrivalAwarenessApplied = -1;
                this.scheduleReached = false;
                if (insideLoc) {
                    this._enterWalkTarget = { x: insideLoc.x, y: insideLoc.y };
                    this._pathTo(insideLoc.x, insideLoc.y, game);
                }
            } else if (insideLoc) {
                this._teleportTo(insideLoc.scene, insideLoc.x, insideLoc.y);
                this._enterWalkTarget = null;
                this.scheduleReached = true;
                this._arrivalAwarenessApplied = -1;
            }
            this._pendingEnterScene = null;
            this._pendingEnterKey = null;
        } else if (!finalPath && this._pendingEnterScene) {
            // 【修复】寻路失败（门口可能被其他NPC阻挡），传送到室内门口再走进去
            const doorKey2 = this._pendingEnterScene + '_indoor_door';
            const doorLoc2 = SCHEDULE_LOCATIONS[doorKey2];
            const insideKey2 = this._pendingEnterScene + '_inside';
            let insideLoc2 = SCHEDULE_LOCATIONS[insideKey2];
            // 座位选择
            {
                const seatLoc2 = this._pickIndoorSeat(this._pendingEnterScene, game);
                if (seatLoc2) insideLoc2 = { scene: this._pendingEnterScene, x: seatLoc2.x, y: seatLoc2.y };
            }
            if (dist <= 8) {
                if (doorLoc2) {
                    this._teleportTo(doorLoc2.scene, doorLoc2.x, doorLoc2.y, true);
                    this._arrivalAwarenessApplied = -1;
                    this.scheduleReached = false;
                    if (insideLoc2) {
                        this._enterWalkTarget = { x: insideLoc2.x, y: insideLoc2.y };
                        this._pathTo(insideLoc2.x, insideLoc2.y, game);
                    }
                } else if (insideLoc2) {
                    this._teleportTo(insideLoc2.scene, insideLoc2.x, insideLoc2.y);
                    this._enterWalkTarget = null;
                    this.scheduleReached = true;
                    this._arrivalAwarenessApplied = -1;
                }
                this._pendingEnterScene = null;
                this._pendingEnterKey = null;
            } else {
                // 距离太远寻路又失败，清除pendingEnterScene，避免反复尝试
                this._pendingEnterScene = null;
                this._pendingEnterKey = null;
            }
        } else if (!path && this.currentScene !== 'village') {
            // 【兜底】室内寻路失败（可能被传送到了实心位置），直接传送到目标格子
            console.log(`[寻路兜底] ${this.name} 在 ${this.currentScene} 室内寻路失败(${pos.x},${pos.y})->(${gx},${gy})，直接传送`);
            this.x = gx * TILE;
            this.y = gy * TILE;
            this.scheduleReached = true;
            this._arrivalAwarenessApplied = -1;
            this.state = 'IDLE';
        } else if (!finalPath && this.currentScene === 'village' && !this._pendingEnterScene) {
            // 【任务4兜底】村庄场景户外目标寻路失败（非门口目标），直接传送
            // 常见场景：赵铁柱去伐木场被围墙/栅栏挡住
            console.warn(`[寻路兜底] ${this.name} 在村庄寻路失败(${pos.x},${pos.y})->(${gx},${gy})，直接传送`);
            this.x = gx * TILE;
            this.y = gy * TILE;
            this.scheduleReached = true;
            this._arrivalAwarenessApplied = -1;
            this.state = 'IDLE';
        }
    }

    _followPath(dt, game) {
        // 【关键修复】CHATTING状态下暂停移动，防止对话中NPC继续走路被传送到其他场景
        if (this.state === 'CHATTING') {
            return;
        }
        if (this.pathIndex >= this.currentPath.length) {
            this.currentPath = [];
            this.isMoving = false;
            this.state = 'IDLE';

            // 到达门口后自动进入建筑
            if (this._pendingEnterScene) {
                const doorKey = this._pendingEnterScene + '_indoor_door';
                const doorLoc = SCHEDULE_LOCATIONS[doorKey];
                const insideKey = this._pendingEnterScene + '_inside';
                let insideLoc = SCHEDULE_LOCATIONS[insideKey];
                
                // 座位选择
                {
                    const seatLoc = this._pickIndoorSeat(this._pendingEnterScene, this.game);
                    if (seatLoc) insideLoc = { scene: this._pendingEnterScene, x: seatLoc.x, y: seatLoc.y };
                }
                
                if (doorLoc) {
                    this._teleportTo(doorLoc.scene, doorLoc.x, doorLoc.y, true);
                    this._arrivalAwarenessApplied = -1;
                    this.scheduleReached = false;
                    if (insideLoc) {
                        this._enterWalkTarget = { x: insideLoc.x, y: insideLoc.y };
                        this._pathTo(insideLoc.x, insideLoc.y, this.game);
                    }
                } else if (insideLoc) {
                    this._teleportTo(insideLoc.scene, insideLoc.x, insideLoc.y);
                    this._enterWalkTarget = null;
                    this.scheduleReached = true;
                    this._arrivalAwarenessApplied = -1;
                }
                this._pendingEnterScene = null;
                this._pendingEnterKey = null;
            } else if (this._enterWalkTarget) {
                // 【修复】进门后走向室内目标的路径走完了，检查是否真正到达
                const pos = this.getGridPos();
                const ewt = this._enterWalkTarget;
                const distToTarget = Math.abs(pos.x - ewt.x) + Math.abs(pos.y - ewt.y);
                if (distToTarget <= 3) {
                    this._enterWalkTarget = null;
                    this.scheduleReached = true;
                } else {
                    console.log(`[进门修复] ${this.name} followPath走完但离室内目标(${ewt.x},${ewt.y})还有${distToTarget}格，直接传送`);
                    this.x = ewt.x * TILE;
                    this.y = ewt.y * TILE;
                    this._enterWalkTarget = null;
                    this.scheduleReached = true;
                }
            } else {
                this.scheduleReached = true;
            }
            return;
        }

        const target = this.currentPath[this.pathIndex];
        const tx = target.x * TILE + TILE / 2 - this.width / 2;
        const ty = target.y * TILE + TILE / 2 - this.height / 2;
        const dx = tx - this.x;
        const dy = ty - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 2) {
            this.x = tx;
            this.y = ty;
            this.pathIndex++;
            return;
        }

        const nx = dx / dist;
        const ny = dy / dist;
        // 限制单帧最大移动距离，防止倍速下跳过目标点导致来回抽搐
        const maxStep = dist - 1; // 不超过到目标点的距离
        const step = Math.min(this.speed * dt, maxStep);
        this.x += nx * step;
        this.y += ny * step;
        this.isMoving = true;

        // 正常移动中，逐渐衰减碰撞累积计时器
        if (this.collisionStallTimer > 0) {
            this.collisionStallTimer = Math.max(0, this.collisionStallTimer - dt * 0.5);
        }

        // 面向方向
        if (Math.abs(dx) >= Math.abs(dy)) {
            this.facing = dx < 0 ? 1 : 2;
        } else {
            this.facing = dy < 0 ? 3 : 0;
        }

        // 卡住检测（缩短到1.5秒，碰撞推挤后更快恢复）
        // 如果被其他NPC持续碰撞阻挡（collisionStallTimer高），缩短检测阈值到0.8秒
        const stuckThreshold = this.collisionStallTimer > 0.5 ? 0.8 : 1.5;
        this.stuckTimer += dt;
        if (this.stuckTimer > stuckThreshold) {
            this.stuckTimer = 0;
            // 检查是否被碰撞推挤导致偏离路径
            if (this.pathIndex < this.currentPath.length) {
                const nextPt = this.currentPath[this.pathIndex];
                const offX = Math.abs(this.x - (nextPt.x * TILE)) / TILE;
                const offY = Math.abs(this.y - (nextPt.y * TILE)) / TILE;
                if (offX > 2 || offY > 2) {
                    // 偏离路径超过2格，重新寻路
                    const finalTarget = this.currentPath[this.currentPath.length - 1];
                    this.currentPath = [];
                    this.pathIndex = 0;
                    this.isMoving = false;
                    // 注意：不在这里重置collisionStallTimer，让_pathTo能判断是否需要绕路
                    this._pathTo(finalTarget.x, finalTarget.y, this.game);
                    this.collisionStallTimer = 0; // 寻路完成后再重置
                    return;
                }
            }
            // 否则跳过当前路点继续
            this.pathIndex++;
        }
    }

    // ---- 渲染 ----
    draw(ctx) {
        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath();
        ctx.ellipse(this.x + TILE / 2, this.y + TILE - 2, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        if (this.spriteLoaded) {
            // Sprite: 96×128, 每帧 32×32
            // 行: 0=down, 1=left, 2=right, 3=up
            // 列: walk 帧 0,1,2 (idle 用帧 1)
            const frameW = 32;
            const frameH = 32;
            const col = this.isMoving ? this.animFrame : 1; // idle 用中间帧
            const row = this.facing;
            const sx = col * frameW;
            const sy = row * frameH;

            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(
                this.sprite,
                sx, sy, frameW, frameH,
                this.x, this.y, TILE, TILE
            );
            ctx.imageSmoothingEnabled = true;
        } else {
            // 回退色块
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(this.x + TILE / 2, this.y + TILE / 2 - 2, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillRect(this.x + TILE / 2 - 6, this.y + TILE / 2 + 4, 12, 12);
        }

        // 名字
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.x + TILE / 2, this.y - 6);

        // 睡觉时显示 Zzz 动画
        if (this.isSleeping) {
            const zPhase = Math.floor(this.sleepZTimer * 2) % 3;
            const zText = ['💤', '💤💤', '💤'];
            ctx.fillStyle = 'rgba(100,150,255,0.8)';
            ctx.font = '12px sans-serif';
            ctx.fillText(zText[zPhase], this.x + TILE / 2, this.y - 16 - Math.sin(this.sleepZTimer * 2) * 4);
        }
        // 注意：expression气泡不在这里绘制，由 drawBubbleLayer() 在最上层单独绘制

        // 【新增】始终显示状态标签（位置+意图），在expression气泡上方或名字上方
        if (!this.isSleeping) {
            const statusText = this.getStatusLine();
            if (statusText) {
                const bubbleOff = this._bubbleOffset || 0;
                // 如果有expression气泡，状态标签要更往上
                const extraOff = this.expression ? 40 : 0;
                const stY = this.y - 16 - bubbleOff - extraOff;
                ctx.font = '7px sans-serif';
                const stW = ctx.measureText(statusText).width;
                // 半透明背景板
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                const padX = 3, padY = 2;
                ctx.beginPath();
                ctx.roundRect(this.x + TILE / 2 - stW / 2 - padX, stY - 7 - padY, stW + padX * 2, 10 + padY * 2, 3);
                ctx.fill();
                // 文字
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.fillText(statusText, this.x + TILE / 2, stY);
            }
        }

        ctx.textAlign = 'left';
    }

    /** 绘制对话气泡层 —— 在所有NPC/建筑绘制完后单独调用，确保气泡在最上层 */
    drawBubbleLayer(ctx) {
        if (this.expression && !this.isSleeping) {
            this._drawBubble(ctx, this.expression);
        }
    }

    _drawBubble(ctx, text) {
        const bx = this.x + TILE / 2;
        const bubbleOff = this._bubbleOffset || 0;
        const maxLineW = 140;       // 单行最大像素宽度
        const fontSize = 10;
        const lineHeight = 14;
        const padX = 8;
        const padY = 5;

        ctx.font = fontSize + 'px sans-serif';

        // —— 自动换行 ——
        const lines = [];
        let currentLine = '';
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const testLine = currentLine + ch;
            if (ctx.measureText(testLine).width > maxLineW) {
                lines.push(currentLine);
                currentLine = ch;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);
        // 最多显示3行，超出用省略号
        if (lines.length > 3) {
            lines.length = 3;
            lines[2] = lines[2].substring(0, lines[2].length - 1) + '…';
        }

        // —— 计算气泡尺寸 ——
        let bubbleTextW = 0;
        for (const ln of lines) {
            const w = ctx.measureText(ln).width;
            if (w > bubbleTextW) bubbleTextW = w;
        }
        const bubbleW = bubbleTextW + padX * 2;
        const bubbleH = lines.length * lineHeight + padY * 2;
        const by = this.y - 22 - bubbleOff;
        const bTop = by - bubbleH + 4;

        // 气泡背景
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.beginPath();
        ctx.roundRect(bx - bubbleW / 2, bTop, bubbleW, bubbleH, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // 小三角
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.beginPath();
        ctx.moveTo(bx - 4, bTop + bubbleH);
        ctx.lineTo(bx, bTop + bubbleH + 6);
        ctx.lineTo(bx + 4, bTop + bubbleH);
        ctx.fill();

        // 文字逐行绘制
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], bx, bTop + padY + (i + 1) * lineHeight - 3);
        }
    }

    // ---- AI 思考 ----
    async think(game) {
        if (this.aiCooldown > 0) return;
        if (this.state === 'CHATTING') return;
        if (this.isSleeping) return; // 睡觉时不思考
        this.aiCooldown = this.aiInterval;

        // 发疯时不正常思考，随机乱走
        if (this.isCrazy) {
            const map = game.maps[this.currentScene];
            if (map) {
                const pos = this.getGridPos();
                const dx = Math.floor(Math.random() * 7) - 3;
                const dy = Math.floor(Math.random() * 7) - 3;
                const tx = Math.max(0, Math.min(map.cols - 1, pos.x + dx));
                const ty = Math.max(0, Math.min(map.rows - 1, pos.y + dy));
                if (!map.isSolid(tx * TILE + TILE / 2, ty * TILE + TILE / 2)) {
this.currentPath = findPath(pos.x, pos.y, tx, ty, map) || [];
                    this.pathIndex = 0;
                    this.state = 'WALKING';
                }
            }
            return;
        }

        // 如果正在避雨，不需要AI思考，保持当前行为
        if (this.isSeekingShelter) return;

        const map = game.maps[this.currentScene];
        const pos = this.getGridPos();

        // 构建环境感知
        const envDesc = map.describe(pos.x, pos.y);
        const nearby = this._getNearbyNPCs(game, 16); // 附近16格内的人
        
        // 🔍 调试日志：排查NPC互相看不到的问题
        const allSameScene = game.npcs.filter(n => n.id !== this.id && n.currentScene === this.currentScene);
        console.log(`[感知调试] ${this.name}(${this.currentScene}) pos=(${pos.x},${pos.y}) nearby=${nearby.length}人 同场景总共=${allSameScene.length}人`, 
            allSameScene.map(n => `${n.name}(scene=${n.currentScene},sleeping=${n.isSleeping},pos=${JSON.stringify(n.getGridPos())})`));
        
        const nearbyStr = nearby.length > 0
            ? nearby.map(n => {
                let desc = `${n.name}(${n.dist}格，${n.state === 'CHATTING' ? '正在对话' : n.stateDesc}`;
                // 附加旁人的身心状态描述
                const statusTags = [];
                if (n.isCrazy) statusTags.push('🤯发疯中');
                if (n.isSick) statusTags.push('🤒生病中');
                if (n._isBeingTreated) statusTags.push('🏥治疗中');
                if (n._stateOverride === 'exhausted') statusTags.push('😴疲惫不堪');
                else if (n.stamina < 15) statusTags.push('😩体力极低');
                else if (n.stamina < 30) statusTags.push('疲惫');
                if (n.health < 25 && !n.isSick) statusTags.push('面色苍白');
                if (n.sanity < 25 && !n.isCrazy) statusTags.push('精神恍惚');
                else if (n.sanity < 40) statusTags.push('精神不太好');
                if (n.hunger < 20) statusTags.push('饿得不行');
                else if (n.hunger < 35) statusTags.push('肚子饿');
                if (statusTags.length > 0) desc += '，' + statusTags.join('、');
                desc += ')';
                return desc;
            }).join('、')
            : '附近没有人';
        
        // 构建旁人状态告警（明确提示NPC去关心）
        const needHelpNPCs = nearby.filter(n => 
            n.isSick || n.health < 25 || n.stamina < 15 || n.sanity < 25 || n.isCrazy || n.hunger < 20
        );
        let helpHint = '';
        if (needHelpNPCs.length > 0) {
            const helpDetails = needHelpNPCs.map(n => {
                const issues = [];
                if (n.isSick || n.health < 25) issues.push('身体不舒服');
                if (n.stamina < 15) issues.push('快累垮了');
                if (n.sanity < 25 || n.isCrazy) issues.push('精神状态很差');
                if (n.hunger < 20) issues.push('快饿坏了');
                const npcObj = game.npcs.find(np => np.id === n.id);
                const aff = npcObj ? this.getAffinity(npcObj.id) : 50;
                let relLabel = '';
                if (aff >= 90) relLabel = '（ta是你的挚友！）';
                else if (aff >= 70) relLabel = '（ta是你的好朋友！）';
                else if (aff >= 50) relLabel = '（你们关系还不错）';
                return `${n.name}${relLabel}${issues.join('、')}`;
            }).join('；');
            
            // 检查是否有挚友/好友需要帮助
            const friendsInTrouble = needHelpNPCs.filter(n => {
                const npcObj = game.npcs.find(np => np.id === n.id);
                return npcObj && this.getAffinity(npcObj.id) >= 70;
            });
            if (friendsInTrouble.length > 0) {
                helpHint = `\n🆘🆘 紧急！你的好朋友需要你！${helpDetails}。你必须主动关心他们！走过去安慰他们、陪他们去看医生、带他们去吃饭。朋友有难你不能袖手旁观！在wantChat中填写最需要帮助的朋友的名字。`;
            } else {
                helpHint = `\n🆘 注意：${helpDetails}。作为有情感的人，你可以主动关心他们、提议陪他们去看医生/吃饭/休息。`;
            }
        }
        
        // 构建附近人员的强调提示
        const nearbyEmphasis = nearby.length > 0
            ? `\n⚠️ 注意：你附近有${nearby.length}个人（${nearby.map(n => n.name).join('、')}），你不是一个人！不要说"没人"或"空无一人"之类的话。`
            : '';

        // 同场景所有人（包括远处的，让NPC知道这个地方还有谁）
        const sameSceneNPCs = game.npcs.filter(n => 
            n.id !== this.id && n.currentScene === this.currentScene && !n.isSleeping
        );
        const farNPCs = sameSceneNPCs.filter(n => !nearby.some(nb => nb.id === n.id));
        const sceneOverview = farNPCs.length > 0
            ? `\n同一区域较远处还有：${farNPCs.map(n => `${n.name}(${n.stateDesc}${n.isCrazy ? '，发疯中' : ''})`).join('、')}`
            : '';

        const recentMemories = this.memories.slice(-5).map(m => `[${m.time}] ${m.text}`).join('\n');

        // 构建场所经营上下文（店主角色专用）
        const businessCtx = this._getBusinessContext(game, nearby);

        // 构建属性相关的提示
        const attrHints = [];
        if (this.stamina < 20) attrHints.push('⚠️ 你现在体力极低，非常疲惫，应该去休息，再硬撑下去身体会出问题！');
        else if (this.stamina < 50) attrHints.push('你有点累了');
        if (this.health < 20) attrHints.push('🚨 你的健康状况非常糟糕！你能感觉到身体在告急，必须立刻去医院看病！再拖下去会更严重！');
        else if (this.health < 35) attrHints.push('⚠️ 你身体状况很差，感觉浑身乏力、头晕目眩，需要尽快去医院看病。你的体力恢复变慢了，干什么都提不起劲。');
        else if (this.health < 50) attrHints.push('你感觉身体不太舒服，有点亚健康，最好注意休息和饮食');
        if (this.isSick) attrHints.push('⚠️ 你正在生病，非常不舒服，必须去医院看病！拖着不去只会越来越严重！');
        if (this.savings < 50) attrHints.push('你最近手头很紧，需要省着点花');
        else if (this.savings >= 500) attrHints.push('你最近存款充裕，心情不错');
        if (this.charisma >= 80) attrHints.push('你很有魅力，大家都喜欢和你聊天');
        else if (this.charisma < 20) attrHints.push('你不太擅长社交，说话有些笨拙');
        if (this.wisdom >= 80) attrHints.push('你非常睿智，善于思考和分析问题');
        if (this.empathy >= 80) attrHints.push('你很善于理解他人的感受，说话总能说到心坎里');
        else if (this.empathy < 20) attrHints.push('你不太会说话，经常无意中得罪人');
        // San值提示——【增强】更强烈的焦虑感和紧迫感
        if (this.isCrazy) attrHints.push('🤯 你正在发疯！精神完全崩溃，无法正常思考，急需去找苏医生做心理咨询或者好好睡一觉');
        else if (this.sanity < 15) attrHints.push('🚨🚨 你快疯了！！脑子里全是噪音，你控制不住自己的情绪，随时可能崩溃！你现在什么都做不了，必须立刻、马上去找苏医生（医院）做心理咨询！！这是最紧急的事！');
        else if (this.sanity < 25) attrHints.push('🚨 你精神状态非常差！你感到极度焦虑、恐惧、绝望，脑子像被什么东西紧紧箍住。你的工作效率大幅下降，和人说话也容易失态。必须尽快去医院找苏医生做心理咨询，或者去看凌玥的演出缓解一下！再这样下去你就要崩溃了！');
        else if (this.sanity < 35) attrHints.push('⚠️ 你精神状态很差，经常感到莫名的焦虑和烦躁，做事难以集中注意力。你觉得自己快要撑不住了。应该去找苏医生聊聊（医院），或者看看凌玥的演出放松一下，或者好好睡一觉。');
        else if (this.sanity < 50) attrHints.push('你精神状态一般，有些疲惫和低落。可以找人聊聊天、看看凌玥的演出、或者休息一下');
        else if (this.sanity >= 80) attrHints.push('你精神状态很好，头脑清晰，充满干劲');
        // 【增强】多重负面状态叠加时的紧急警告
        const criticalCount = [this.sanity < 30, this.health < 35, this.stamina < 20, this.hunger < 25].filter(Boolean).length;
        if (criticalCount >= 2) {
            attrHints.push(`🆘 警告：你现在有${criticalCount}项指标处于危险状态！你的身心正在全面崩溃，必须立刻采取行动——去医院、去吃饭、去休息，做任何能改善现状的事！不要再犹豫了！`);
        }
        const attrHintStr = attrHints.length > 0 ? '\n你当前的身心状态：\n' + attrHints.map(h => '- ' + h).join('\n') : '';

        const systemPrompt = `你是「${this.name}」，福音镇的居民。世界末日来临，极端寒冷天气侵袭小镇，你们必须团结协作、收集物资、维持暖炉运转才能存活。
姓名：${this.name}，${this.age}岁，${this.occupation}
性格：${this.personality}
当前心情：${this.mood}
${attrHintStr}
${game.weatherSystem ? `\n【生存状况】\n${game.weatherSystem.getSurvivalSummary()}` : ''}
${game.weatherSystem && game.weatherSystem.getBlizzardUrgencyForPrompt ? `\n${game.weatherSystem.getBlizzardUrgencyForPrompt()}` : ''}
${game.resourceSystem ? `资源状况: ${game.resourceSystem.getResourceStatusForPrompt()}` : ''}
${game.resourceSystem && game.resourceSystem.getUrgencyPrompt ? game.resourceSystem.getUrgencyPrompt() : ''}
${game.furnaceSystem ? `暖炉状况: ${game.furnaceSystem.getFurnaceSummary()}` : ''}
${game.taskSystem ? `任务进度: ${game.taskSystem.getTaskSummaryForPrompt()}` : ''}
${game.taskSystem ? `你的任务: ${game.taskSystem.getNpcTaskDescForPrompt(this.id)}` : ''}
${game.deathSystem && game.deathSystem.getDeathSummaryForPrompt() ? `死亡情况: ${game.deathSystem.getDeathSummaryForPrompt()}` : ''}
${game.deathSystem && game.deathSystem.isNpcGrieving(this.id) ? '⚠️ 你正处于悲痛状态，因为有同伴刚刚死去。' : ''}
${this.bodyTemp < 35 ? `🚨 你正在失温！体温: ${this.bodyTemp.toFixed(1)}°C，必须立即回暖炉旁！` : ''}
${this.isHypothermic ? '🥶 你浑身发抖，行动迟缓，思维模糊...' : ''}
${game.reincarnationSystem && game.reincarnationSystem.getLifeNumber() > 1 ? game.reincarnationSystem.getPastLifeHintForThinking(game.mode === 'reincarnation') : ''}

重要规则：
1. 这是一个末日生存环境。你的首要目标是活下去，其次是帮助同伴活下去。
2. 你的情绪和言行必须和当前生存环境一致。如果资源紧缺，你应该焦虑；如果有人死了，你应该悲痛或恐惧。
3. expression是你真正说出口的话，应该围绕生存话题（"还有多少食物？""暖炉够不够？""今天的任务完成了吗？"）。
4. 如果你被分配了任务，你应该积极去完成它。你的专长决定了你在团队中的角色。
5. 你的思考和行为应该受到你当前身心状态和生存压力的影响。
6. 如果温度极低（<-20°C），你在户外会非常痛苦和恐惧。
7. 如果你看到有人倒下或状态很差，你应该去帮助他们。
${game.weatherSystem && !game.weatherSystem.canGoOutside() ? '🚨 今天严禁外出！-60°C！在户外会迅速冻死！' : ''}
${game.weatherSystem && game.weatherSystem.getEffectiveTemp() < -20 ? '🚨🚨 户外极度危险！温度' + game.weatherSystem.getEffectiveTemp() + '°C！尽量待在暖炉旁！' : ''}
${this.id === 'old_qian' ? `你是退休镇长/精神领袖，在末日中承担起安抚情绪、调解冲突的重任。你的领导力和人生阅历是团队的精神支柱。清璇是你的孙女，你格外牵挂她。` : ''}
${this.id === 'qing_xuan' ? `你是16岁的药剂师学徒/陷阱工，老钱的孙女。负责制作草药制剂、布置警报陷阱、修理无线电。你聪明好学、心灵手巧，在危机中逐渐展现超越年龄的能力。你暗恋陆辰。` : ''}
${this.id === 'wang_teacher' ? `你是技师/规划师，末日前是哲学教师，现在负责维修发电机、设计暖炉扩建方案、统筹全队效率。你暗恋凌玥，理性冷静但有时过于冷酷。` : ''}
${this.id === 'zhao_chef' ? `你是伐木工/锅炉工，全镇体力担当。负责砍柴、搬运、暖炉维护。你沉默寡言但行动力极强，暗恋李婶。压力大时San值下降更快。` : ''}
${this.id === 'li_shen' ? `你是物资总管/炊事长，全镇后勤管家。负责管理仓库、烹饪分配食物。你热心精明，照顾所有人。陆辰是你儿子，你会不惜一切保护他。` : ''}
${this.id === 'su_doctor' ? `你是医官，据点唯一的医疗力量。负责治疗冻伤失温、心理疏导。你暗恋凌玥，冷静专业但过度操劳时自己也会崩溃。` : ''}
${this.id === 'lu_chen' ? `你是采集工/建筑工，最年轻的劳动力。负责采集建材和食物、协助建造。你冲动勇敢但情商低，暗恋清璇。体温下降速度比常人慢。` : ''}
${this.id === 'ling_yue' ? `你是侦察员/急救兵，负责废墟侦察搜索稀有物资、急救护理、鼓舞全队士气。被苏岩和王策同时追求。你乐观坚韧但初始San值较低。` : ''}
${this.config.weaknesses ? `⚠️ 你的弱点：${this.config.weaknesses}` : ''}
${this.config.protectTarget ? `❤️ 你的保护对象：${game.npcs.find(n => n.id === this.config.protectTarget)?.name || this.config.protectTarget}，如果ta受伤或死亡，你会受到双倍San打击。` : ''}`;
        const userPrompt = `时间：第${game.dayCount}天 ${game.getTimeStr()} ${game.getTimePeriod()}
天气：${game.weather}
位置：${envDesc}
附近的人：${nearbyStr}${sceneOverview}${nearbyEmphasis}${helpHint}
最近发生的事：
${recentMemories || '（暂无）'}
当前状态：${this.stateDesc}
当前状态摘要：${this.getStatusLine()}
饱食度：${Math.round(this.hunger)}/100（${this.getHungerStatus()}）${this.hunger < 35 ? ' ⚠️ 你现在很饿，应该去吃东西！' : ''}
【你的属性】${this.getAttributeSummary()}${this.isSick ? ' 🤒生病中' : ''}
${this.getGoalsSummary() ? `【你的目标】\n${this.getGoalsSummary()}` : ''}
${businessCtx}
${this._currentAction ? `【当前行动】${this._currentAction.reason || this._currentAction.type}（${this._currentAction.priority}优先级）` : ''}
${this._pendingAction ? `【待执行行动】${this._pendingAction.reason || this._pendingAction.type}` : ''}
${this._isCompanion && this._companionLeader ? `【同伴模式】正在跟随${game.npcs.find(n => n.id === this._companionLeader)?.name || '某人'}一起行动` : ''}
${this._lastActionThought ? `【最近行动决策】${this._lastActionThought}` : ''}
请根据上面的实际情境，决定你现在的状态。
注意：
- mood（心情）必须与当前真实环境匹配（周围没人时不该因社交而高兴）
- expression只有在合适的时候才说话（周围没人时可以自言自语或留空）
- wantChat可以填写附近或同一区域的人名（你可以走过去找他们），没人时必须留空字符串
用纯 JSON 回复：
{
  "thought": "内心独白（基于真实环境的想法，必须提到当前最担忧的属性或最想推进的目标）",
  "mood": "两字心情（必须符合当前处境）",
  "expression": "说出的话（简短，或空字符串）",
  "wantChat": "同场景的人名（可以走过去找他，或空字符串）",
  "concern": "当前最担忧的事（如'San值快到危险线了'、'今天的聊天目标还没完成'、'没什么好担心的'）",
  "goalFocus": "当前最想推进的目标名称（如'今天和3个不同的人聊天'，没有就写'无'）"
}}`;

        const raw = await callLLM(systemPrompt, userPrompt, 500);  // 14B模型需要更多token空间

        // 【关键修复】await期间NPC可能已被设为CHATTING（其他NPC发起了对话）
        // 此时不应再执行think的决策，否则会覆盖CHATTING状态导致对话中断
        if (this.state === 'CHATTING') {
            this._logDebug('think', `think返回时已在CHATTING，放弃决策结果`);
            return;
        }

        const parsed = parseLLMJSON(raw);
        if (parsed) {
            if (parsed.mood) this.mood = parsed.mood;
            if (parsed.expression) {
                this.expression = parsed.expression;
                this.expressionTimer = 8;
            }
            if (parsed.thought) {
                this.addMemory(`[想法] ${parsed.thought}`);
                // 将think的想法同步给行动决策系统参考
                this._lastActionThought = parsed.thought;
            }
            // 【奖惩意识】记录NPC当前的关注和目标焦点
            if (parsed.concern) this._lastConcern = parsed.concern;
            if (parsed.goalFocus) this._lastGoalFocus = parsed.goalFocus;
            // 【Debug日志】记录think结果（含奖惩意识）
            this._logDebug('think', `想法:"${parsed.thought || ''}" 心情:${parsed.mood || ''} 说:"${parsed.expression || ''}" 想聊:${parsed.wantChat || '无'}`);
            this._logDebug('reward', `🧠 思考关注 → 担忧:「${parsed.concern || '无'}」 聚焦目标:「${parsed.goalFocus || '无'}」`);
            // 事件日志通知
            if (parsed.expression && game.addEvent) {
                game.addEvent(`💭 ${this.name}: "${parsed.expression}"`);
            }

            // ============ 【任务6】think→action强制联动 ============
            // 当NPC思考结果包含资源紧急行动关键词时，自动触发taskOverride
            if (parsed.thought || parsed.expression) {
                const thinkText = (parsed.thought || '') + ' ' + (parsed.expression || '');
                const urgentGatherKeywords = {
                    woodFuel: ['砍柴', '伐木', '砍树', '木柴', '去伐木场', '木材', '薪火'],
                    food: ['捕鱼', '采集食物', '食物', '冰湖', '打鱼', '钓鱼', '觅食'],
                    material: ['建材', '采集材料', '建筑材料', '修缮', '去废墟'],
                    power: ['发电', '维护电力', '发电机', '电力']
                };
                // 仅在资源紧急时才触发think→action联动
                if (game.resourceSystem) {
                    const _thinkUrgency = game.resourceSystem.getResourceUrgency();
                    for (const [resType, keywords] of Object.entries(urgentGatherKeywords)) {
                        const urgLevel = _thinkUrgency[resType === 'woodFuel' ? 'wood' : resType];
                        if ((urgLevel === 'critical' || urgLevel === 'warning') && keywords.some(kw => thinkText.includes(kw))) {
                            // NPC的思考匹配了紧急资源关键词，且该资源确实紧急
                            const targetMap = {
                                woodFuel: 'lumber_camp',
                                food: 'frozen_lake',
                                material: 'ruins_site',
                                power: 'workshop_door'
                            };
                            const targetLoc = targetMap[resType];
                            const priority = urgLevel === 'critical' ? 'urgent' : 'high';
                            const taskId = `think_gather_${resType}_${Date.now()}`;
                            
                            // 如果NPC当前没有活跃的taskOverride，才触发
                            if (!this._taskOverride || !this._taskOverride.isActive) {
                                console.log(`[think→action] ${this.name} 思考"${thinkText.substring(0, 30)}..." 触发${resType}采集任务(${priority})`);
                                this.activateTaskOverride(taskId, targetLoc, priority, resType);
                                
                                if (game.addEvent) {
                                    game.addEvent(`🎯 ${this.name} 思考后决定: 前往${targetLoc}${priority === 'urgent' ? '(紧急)' : ''}`);
                                }
                                this._logDebug('think', `think→action联动: "${thinkText.substring(0, 30)}..." → ${resType}/${targetLoc}(${priority})`);
                            }
                            break; // 只触发第一个匹配
                        }
                    }
                }
            }
            // 社交意愿——代码层二次校验：必须附近真的有这个人
            // 【增强】深夜/状态极差/下雨户外时强制清除社交意愿
            const _origWantChat = parsed.wantChat; // debug日志用
            const thinkHour = game.getHour();
            const isLateNight = this._isBedtime(thinkHour);
            if (isLateNight) parsed.wantChat = ''; // 过了就寝时间不社交
            if (this.stamina < 15) parsed.wantChat = ''; // 体力极低，需要休息
            if (this.health < 20 && this.isSick) parsed.wantChat = ''; // 生病且健康极低
            // 【修复】下雨+户外时不找人聊天，应该先避雨
            if (game.isRaining() && this.currentScene === 'village') {
                parsed.wantChat = '';
            }
            // 【新增】资源紧急时抑制聊天意愿
            if (game.resourceSystem) {
                const _urgency = game.resourceSystem.getResourceUrgency();
                const _hasCritical = _urgency.wood === 'critical' || _urgency.food === 'critical' || _urgency.power === 'critical';
                if (_hasCritical) {
                    parsed.wantChat = ''; // critical时完全禁止聊天
                } else {
                    const _hasWarning = _urgency.wood === 'warning' || _urgency.food === 'warning' || _urgency.power === 'warning';
                    if (_hasWarning && parsed.wantChat && Math.random() > 0.3) {
                        parsed.wantChat = ''; // warning时70%概率抑制聊天
                    }
                }
            }
            // 【Debug日志】如果wantChat被强制清除，记录原因
            if (_origWantChat && !parsed.wantChat) {
                const reasons = [];
                if (isLateNight) reasons.push('深夜');
                if (this.stamina < 15) reasons.push('体力极低');
                if (this.health < 20 && this.isSick) reasons.push('生病');
                if (game.isRaining() && this.currentScene === 'village') reasons.push('户外下雨');
                if (game.resourceSystem) {
                    const _urgCheck = game.resourceSystem.getResourceUrgency();
                    if (_urgCheck.wood === 'critical' || _urgCheck.food === 'critical' || _urgCheck.power === 'critical') reasons.push('资源critical');
                    else if (_urgCheck.wood === 'warning' || _urgCheck.food === 'warning' || _urgCheck.power === 'warning') reasons.push('资源warning');
                }
                this._logDebug('chat', `想找${_origWantChat}聊天被阻止: ${reasons.join('、')}`);
            }

            // 【挚友关心机制】自己精神还行时，主动找同场景San值低的好友/挚友关心
            if (!parsed.wantChat && this.sanity >= 40 && !isLateNight && this.state !== 'CHATTING') {
                const sameSceneAll = game.npcs.filter(n =>
                    n.id !== this.id && n.currentScene === this.currentScene && !n.isSleeping
                    && n.state !== 'CHATTING' && (n.sanity < 30 || n.isCrazy)
                );
                // 筛选出好友及以上（好感度≥70）的低San值NPC
                const friendsInNeed = sameSceneAll.filter(n => this.getAffinity(n.id) >= 70);
                if (friendsInNeed.length > 0) {
                    // 选San值最低的那个去关心
                    friendsInNeed.sort((a, b) => a.sanity - b.sanity);
                    const friendToHelp = friendsInNeed[0];
                    // 覆盖wantChat，优先去关心朋友
                    parsed.wantChat = friendToHelp.name;
                    this.mood = '担心';
                    this.expression = `${friendToHelp.name}看起来不太好…我得去看看`;
                    this.expressionTimer = 6;
                    if (game.addEvent) {
                        game.addEvent(`💕 ${this.name} 注意到 ${friendToHelp.name} 状态很差，决定去关心ta`);
                    }
                }
            }
            if (parsed.wantChat && game.dialogueManager) {
                const target = game.npcs.find(n => n.name === parsed.wantChat && n.id !== this.id);
                if (target && this._canChatWith(target)) {
                    // 检查是否在同一场景（远处也可以走过去）
                    const isSameScene = target.currentScene === this.currentScene;
                    const nearbyCheck = this._getNearbyNPCs(game, 6);
                    const isReallyNearby = nearbyCheck.some(n => n.name === parsed.wantChat);
                    if (isReallyNearby) {
                        // 附近的人，直接聊天
                        game.dialogueManager.startNPCChat(this, target);
                        if (game.addEvent) {
                            game.addEvent(`🤝 ${this.name} 找 ${target.name} 聊天`);
                        }
                    } else if (isSameScene) {
                        // 同场景但较远，先走过去
                        const tp = target.getGridPos();
                        const myPos = this.getGridPos();
                        // 走到目标附近2格的位置
                        const dx = tp.x > myPos.x ? -2 : 2;
                        const dy = tp.y > myPos.y ? -2 : 2;
                        const goalX = Math.max(0, Math.min(map.cols - 1, tp.x + dx));
                        const goalY = Math.max(0, Math.min(map.rows - 1, tp.y + dy));
                        if (!map.isSolid(goalX * TILE + TILE / 2, goalY * TILE + TILE / 2)) {
                            this.currentPath = findPath(myPos.x, myPos.y, goalX, goalY, map) || [];
                            this.pathIndex = 0;
                            this.state = 'WALKING';
                            this.stateDesc = `正在走向${target.name}`;
                            this.expression = `去找${target.name}聊聊`;
                            this.expressionTimer = 5;
                            // 【修复】记录社交走路目标，路径走完后自动发起对话
                            this._chatWalkTarget = target.id;
                            this._logDebug('chat', `想找${target.name}聊天，开始走过去(距离较远)`);
                        }
                    } else {
                        // LLM幻觉了，同场景其实没这个人
                        this.expression = `${parsed.wantChat}不在这儿啊…`;
                        this.expressionTimer = 5;
                        this.mood = '失望';
                        this._logDebug('chat', `想找${parsed.wantChat}但ta不在同场景(幻觉)`);
                    }
                }
            }
        }
    }

    // ============ 六大属性系统 ============

    /** 获取属性等级描述 */
    getStaminaLevel() {
        if (this.stamina >= 80) return '精力充沛';
        if (this.stamina >= 50) return '正常';
        if (this.stamina >= 20) return '疲惫';
        if (this.stamina >= 1) return '虚脱';
        return '倒下';
    }
    getSavingsLevel() {
        if (this.savings >= 500) return '富裕';
        if (this.savings >= 200) return '小康';
        if (this.savings >= 50) return '拮据';
        if (this.savings >= 1) return '贫困';
        return '破产';
    }
    getCharismaLevel() {
        if (this.charisma >= 80) return '万人迷';
        if (this.charisma >= 60) return '有亲和力';
        if (this.charisma >= 40) return '普通';
        if (this.charisma >= 20) return '不讨喜';
        return '社交障碍';
    }
    getWisdomLevel() {
        if (this.wisdom >= 80) return '睿智';
        if (this.wisdom >= 60) return '聪明';
        if (this.wisdom >= 40) return '正常';
        if (this.wisdom >= 20) return '迟钝';
        return '懵懂';
    }
    getHealthLevel() {
        if (this.health >= 80) return '强健';
        if (this.health >= 50) return '正常';
        if (this.health >= 30) return '亚健康';
        if (this.health >= 10) return '生病';
        return '重病';
    }
    getEmpathyLevel() {
        if (this.empathy >= 80) return '知心人';
        if (this.empathy >= 60) return '善解人意';
        if (this.empathy >= 40) return '普通';
        if (this.empathy >= 20) return '木讷';
        return '低情商';
    }
    getSanityLevel() {
        if (this.sanity >= 80) return '神清气爪';
        if (this.sanity >= 60) return '精神不错';
        if (this.sanity >= 40) return '有些疲惫';
        if (this.sanity >= 20) return '精神萌乎';
        return '精神崩溃';
    }

    /** 获取全部属性概览（用于Prompt注入） */
    getAttributeSummary() {
        return `💪体力:${Math.round(this.stamina)}(${this.getStaminaLevel()}) ` +
               `🧠San:${Math.round(this.sanity)}(${this.getSanityLevel()}) ` +
               `💰存款:${Math.round(this.savings)}(${this.getSavingsLevel()}) ` +
               `✨魅力:${Math.round(this.charisma)}(${this.getCharismaLevel()}) ` +
               `🧠智慧:${Math.round(this.wisdom)}(${this.getWisdomLevel()}) ` +
               `🫀健康:${Math.round(this.health)}(${this.getHealthLevel()}) ` +
               `💬情商:${Math.round(this.empathy)}(${this.getEmpathyLevel()})`;
    }

    // ============ 行动实效性系统 ============
    /**
     * 每帧根据NPC当前场景 + 当前日程行为类型查ACTION_EFFECT_MAP执行效果
     * 确保NPC的日程行为不再是"过家家"，而是产生实际的资源/进度效果
     */
    _updateActionEffect(dt, game) {
        if (this.isDead || this.isSleeping || this.isEating || this.state === 'CHATTING') return;

        // 获取当前日程描述
        const schedIdx = this.currentScheduleIdx;
        if (schedIdx < 0 || !this.scheduleTemplate[schedIdx]) return;
        const currentDesc = this.stateDesc || this.scheduleTemplate[schedIdx].desc || '';

        // 在ACTION_EFFECT_MAP中查找匹配的效果
        let matchedEffect = null;
        for (const entry of ACTION_EFFECT_MAP) {
            for (const keyword of entry.keywords) {
                if (currentDesc.includes(keyword)) {
                    matchedEffect = entry;
                    break;
                }
            }
            if (matchedEffect) break;
        }

        if (!matchedEffect) {
            this._currentActionEffect = null;
            return;
        }

        // 检查场景是否匹配（null表示不限场景）
        if (matchedEffect.requiredScene && this.currentScene !== matchedEffect.requiredScene) {
            this._currentActionEffect = null;
            return;
        }

        // 记录当前效果（用于UI显示）
        this._currentActionEffect = matchedEffect;

        // 计算效率系数
        const staminaEfficiency = Math.max(0.1, this.stamina / 100); // 体力效率
        const specialtyMultiplier = this._getSpecialtyMultiplier(matchedEffect); // 专长倍率

        // 根据effectType执行不同效果
        const rs = game.resourceSystem;
        switch (matchedEffect.effectType) {
            case 'produce_resource': {
                // 产出资源（每秒 = ratePerHour / 3600）
                if (rs && matchedEffect.resourceType) {
                    const rate = matchedEffect.ratePerHour / 3600 * staminaEfficiency * specialtyMultiplier;
                    const produced = rate * dt;
                    rs[matchedEffect.resourceType] = (rs[matchedEffect.resourceType] || 0) + produced;
                    // 【任务10】更新目标追踪计数器
                    if (this._goalTrackers) {
                        if (matchedEffect.resourceType === 'woodFuel') {
                            this._goalTrackers.woodChopped = (this._goalTrackers.woodChopped || 0) + produced;
                        }
                        this._goalTrackers.gatherCount = (this._goalTrackers.gatherCount || 0) + produced;
                    }
                }
                break;
            }
            case 'build_progress': {
                // 推进暖炉建造进度
                const fs = game.furnaceSystem;
                if (fs) {
                    // 如果满足建造条件且还没开始建造，自动触发
                    if (!fs.isBuildingSecondFurnace && !fs.secondFurnaceBuilt && fs.checkBuildCondition()) {
                        // 只有王策（furnace_build专长）在工坊时才自动启动建造
                        if (this.config.id === 'wang_teacher' || this.config.specialties?.furnace_build) {
                            fs.startBuildSecondFurnace();
                            this._logDebug('action', `[效果] 触发暖炉建造启动！`);
                        }
                    }
                    // 如果正在建造中，作为工人贡献进度
                    if (fs.isBuildingSecondFurnace && !fs.secondFurnaceBuilt) {
                        if (!fs.buildWorkers.includes(this.id)) {
                            fs.buildWorkers.push(this.id);
                        }
                    }
                }
                break;
            }
            case 'craft_medkit': {
                // 制作急救包（由任务5实现具体逻辑，这里标记状态）
                if (!game._medkitCraftProgress) game._medkitCraftProgress = 0;
                const craftRate = staminaEfficiency * specialtyMultiplier;
                game._medkitCraftProgress += (dt / 7200) * craftRate; // 7200秒(2游戏小时)产出1份
                if (game._medkitCraftProgress >= 1) {
                    game._medkitCraftProgress -= 1;
                    game._medkitCount = (game._medkitCount || 0) + 1;
                    // 【任务10】更新目标追踪
                    if (this._goalTrackers) {
                        this._goalTrackers.medkitsCrafted = (this._goalTrackers.medkitsCrafted || 0) + 1;
                    }
                    if (game.addEvent) {
                        game.addEvent(`💊 ${this.name}制作了1份急救包（共${game._medkitCount}份）`);
                    }
                    this._logDebug('action', `[效果] 制作急救包完成，总数:${game._medkitCount}`);
                }
                break;
            }
            case 'repair_radio': {
                // 修理无线电（由任务5实现具体逻辑，这里标记状态）
                if (game._radioRepaired) break; // 已修好
                if (!game._radioRepairProgress) game._radioRepairProgress = 0;
                const repairRate = staminaEfficiency * specialtyMultiplier;
                game._radioRepairProgress += (dt / 28800) * repairRate; // 28800秒(8游戏小时)完成
                if (game._radioRepairProgress >= 1) {
                    game._radioRepairProgress = 1;
                    game._radioRepaired = true;
                    if (game.addEvent) {
                        game.addEvent(`📻 ${this.name}修好了无线电！可以向外界求救了！`);
                    }
                    this._logDebug('action', `[效果] 无线电修理完成！`);
                }
                break;
            }
            case 'reduce_waste': {
                // 设置食物浪费减少标记（在用餐系统中使用）
                game._foodWasteReduction = true;
                game._foodWasteReductionTimer = 3600; // 标记持续1游戏小时
                break;
            }
            case 'medical_heal': {
                // 医疗效果：场景内NPC额外健康恢复
                const npcsInScene = game.npcs.filter(n =>
                    !n.isDead && n.id !== this.id && n.currentScene === this.currentScene
                );
                for (const npc of npcsInScene) {
                    if (npc.health < 100) {
                        npc.health = Math.min(100, npc.health + 0.01 * dt * specialtyMultiplier);
                    }
                }
                // 自动使用急救包（健康<40的NPC）
                if (game._medkitCount > 0) {
                    const critical = npcsInScene.filter(n => n.health < 40).sort((a, b) => a.health - b.health);
                    if (critical.length > 0 && !this._medkitUseCooldown) {
                        const target = critical[0];
                        game._medkitCount--;
                        target.health = Math.min(100, target.health + 20);
                        this._medkitUseCooldown = 30; // 30秒冷却
                        if (game.addEvent) {
                            game.addEvent(`🩹 ${this.name}使用急救包治疗了${target.name}（健康+20→${Math.round(target.health)}）`);
                        }
                        this._logDebug('action', `[效果] 使用急救包治疗${target.name}`);
                    }
                }
                if (this._medkitUseCooldown > 0) this._medkitUseCooldown -= dt;
                break;
            }
            case 'furnace_maintain': {
                // 暖炉维护——确保暖炉有木柴就运转
                // 效果：暖炉附近取暖效率+5%（通过标记）
                game._furnaceMaintained = true;
                break;
            }
            case 'patrol_bonus': {
                // 巡逻/警戒——全队San恢复加成+10%
                game._patrolBonus = true;
                game._patrolBonusTimer = 3600;
                break;
            }
            case 'morale_boost': {
                // 安抚鼓舞——当前场景内NPC San值恢复
                const npcsInScene = game.npcs.filter(n =>
                    !n.isDead && n.id !== this.id && n.currentScene === this.currentScene
                );
                for (const npc of npcsInScene) {
                    if (npc.sanity < 100) {
                        npc.sanity = Math.min(100, npc.sanity + 0.005 * dt * specialtyMultiplier);
                    }
                }
                break;
            }
        }
    }

    /**
     * 获取NPC在特定行为上的专长倍率
     */
    _getSpecialtyMultiplier(effect) {
        const specialties = this.config.specialties || {};
        switch (effect.effectType) {
            case 'produce_resource':
                if (effect.resourceType === 'woodFuel' && specialties.chop) return specialties.chop;
                if (effect.resourceType === 'food' && specialties.gather_food) return specialties.gather_food;
                if (effect.resourceType === 'power' && specialties.repair) return specialties.repair;
                if (effect.resourceType === 'material' && specialties.build) return specialties.build;
                break;
            case 'build_progress':
                if (specialties.furnace_build) return specialties.furnace_build;
                if (specialties.build) return specialties.build;
                break;
            case 'craft_medkit':
                if (specialties.medkit) return specialties.medkit;
                if (specialties.medical) return specialties.medical;
                break;
            case 'repair_radio':
                if (specialties.radio) return specialties.radio;
                if (specialties.repair) return specialties.repair;
                break;
            case 'medical_heal':
                if (specialties.medical) return specialties.medical;
                break;
        }
        return 1.0; // 默认无加成
    }

    /** 每帧更新属性（缓慢变化模式）
     *  dt = gameDt（已含倍速）
     *  设计原则：属性每游戏小时变化约 0.1~0.5 点，一天下来变化 2~8 点
     */
    _updateAttributes(dt, game) {
        if (this.isSleeping) {
            // 睡觉时：体力恢复，San值恢复，健康微恢复（不消耗体力、不会饿醒）
            const sleepSanBefore = this.sanity;
            this.stamina = Math.min(100, this.stamina + 0.06 * dt);  // 体力恢复【已调整：从0.12降为0.06】
            this.sanity = Math.min(100, this.sanity + 0.04 * dt);    // 睡觉是恢复精神的主要途径【已调整：从0.06降为0.04】
            if (this.health < 80) this.health = Math.min(100, this.health + 0.02 * dt);
            // 【Debug】睡眠San恢复日志
            if (game.mode === 'debug') {
                if (!this._sanLogCounter) this._sanLogCounter = 0;
                this._sanLogCounter += dt;
                if (this._sanLogCounter >= 60) {
                    this._sanLogCounter = 0;
                    const d = this.sanity - sleepSanBefore;
                    if (Math.abs(d) > 0.1) {
                        this._logDebug('sanity', `San: ${Math.round(sleepSanBefore)}→${Math.round(this.sanity)} (+${d.toFixed(1)}) 来源:[睡眠恢复]`);
                    }
                }
            }
            return;
        }

        const hour = game.getHour();

        // ---- 饥饿自然衰减（清醒时持续缓慢下降）----
        // 基础衰减速率：0.5/游戏小时 = 0.000139/秒
        let hungerDecayRate = 0.000139;
        const ws = game.weatherSystem;
        const currentTemp = ws ? ws.getEffectiveTemp() : 0;
        // 户外寒冷环境（温度<-20°C）时衰减加速至2倍
        if (this.currentScene === 'village' && currentTemp < -20) {
            hungerDecayRate *= 2;
        }
        // 工作中衰减加速至1.5倍
        const isWorkingForHunger = this.workplaceName && this.currentScene === this.workplaceName;
        if (isWorkingForHunger) {
            hungerDecayRate *= 1.5;
        }
        this.hunger = Math.max(0, this.hunger - hungerDecayRate * dt);

        // ---- 体力消耗（清醒时持续缓慢下降）----
        // 工作中消耗更快（在工作场所时）【体力变化快】
        const isWorking = this.workplaceName && this.currentScene === this.workplaceName;
        // 【增强】健康低时体力消耗加快（身体虚弱更容易累）
        const healthPenalty = this.health < 30 ? 1.5 : (this.health < 50 ? 1.2 : 1.0);
        const staminaDrain = (isWorking ? 0.10 : 0.05) * healthPenalty;
        this.stamina = Math.max(0, this.stamina - staminaDrain * dt);

        // 吃饭恢复体力【体力恢复快】
        // 【增强】San值低时体力恢复效率降低（精神差导致食欲不振）
        if (this.isEating) {
            const sanRecoveryPenalty = this.sanity < 25 ? 0.5 : (this.sanity < 40 ? 0.7 : 1.0);
            this.stamina = Math.min(100, this.stamina + 0.08 * sanRecoveryPenalty * dt);
        }

        // ---- 存款变化 ----
        // 工作日薪：每游戏小时在工作场所赚取收入（缓慢累积）
        if (isWorking) {
            // 店主/教师类，每游戏小时赚 2~5 元
            // 【增强】San值/健康低时工作效率大幅降低（精神差/身体差干不动活）
            const workEfficiency = Math.min(
                this.sanity < 20 ? 0.3 : (this.sanity < 40 ? 0.6 : 1.0),
                this.health < 25 ? 0.4 : (this.health < 50 ? 0.7 : 1.0)
            );
            const hourlyWage = (this.wisdom >= 60 ? 0.08 : 0.05) * workEfficiency;
            this.savings += hourlyWage * dt;
        }
// 退休金（老钱等无工作场所的成年人）
        if (!this.workplaceName && this.age >= 55) {
            this.savings += 0.02 * dt; // 退休金缓慢累积
        }
        // 吃饭扣钱（在餐饮场所吃饭时）
        if (this.isEating && this.currentScene !== this.homeName) {
            // 每次吃饭花费约 8~15 元，分散在吃饭时间(20s)内扣除
            // 0.5 * dt * 20s ≈ 10元一顿饭
            this.savings = Math.max(0, this.savings - 0.5 * dt);
            // 大厨在酒馆有客人吃饭时获得餐饮收入
        if (this.currentScene === 'kitchen') {
                const chef = game.npcs.find(n => n.id === 'li_shen');
                if (chef && chef.id !== this.id) {
                    chef.savings += 0.4 * dt; // 烊事长从每位就餐人员获得贡献点
                }
            }
        }

        // ---- 魅力变化【变化慢】----
        // 社交中缓慢提升
        if (this.state === 'CHATTING') {
            // 【增强】San值低时社交质量下降，魅力提升减半
            const socialQuality = this.sanity < 30 ? 0.5 : 1.0;
            this.charisma = Math.min(100, this.charisma + 0.005 * socialQuality * dt);
        }
        // 长期不社交缓慢下降（由 think() 后的事件驱动处理，这里不做连续扣减）
        // 生病时魅力下降
        if (this.isSick) {
            this.charisma = Math.max(0, this.charisma - 0.005 * dt);
        }
        // 【增强】San值低时魅力持续下降（精神萎靡、形象邋遢）
        if (this.sanity < 30) {
            this.charisma = Math.max(0, this.charisma - 0.008 * dt);
        }
        // 【增强】健康低时魅力下降（面色苍白、精神不振）
        if (this.health < 35) {
            this.charisma = Math.max(0, this.charisma - 0.006 * dt);
        }
        // 存款高时维护形象
        if (this.savings >= 200) {
            this.charisma = Math.min(100, this.charisma + 0.002 * dt);
        }
        // 体力过低时魅力下降
        if (this.stamina < 20) {
            this.charisma = Math.max(0, this.charisma - 0.005 * dt);
        }

        // ---- 智慧变化【变化慢】----
        // 在工坊工作/学习缓慢提升
        if (this.currentScene === 'workshop') {
            this.wisdom = Math.min(100, this.wisdom + 0.004 * dt);
        }
        // 在医疗站学习医术（苏医生的学徒等）
        if (this.currentScene === 'medical') {
            this.wisdom = Math.min(100, this.wisdom + 0.002 * dt);
        }

        // ---- 健康变化【变化慢】----
        // ============ 【任务6】生命系统升级：饥饿/体力→健康→死亡链路 ============

        // 6-1: 饱腹=0 → 每秒扣健康（【v2.0】提升为0.15/秒 → 约11分钟从100降到0）
        if (this.hunger <= 0) {
            this.health = Math.max(0, this.health - 0.15 * dt);
        }

        // 6-2: 体力=0且非睡眠 → 每秒扣健康（0.025/秒）
        if (this.stamina <= 0 && !this.isSleeping) {
            this.health = Math.max(0, this.health - 0.025 * dt);
        }

        // 6-3: 生病状态 → 每秒额外扣健康（0.033/秒）
        if (this.isSick) {
            this.health = Math.max(0, this.health - 0.033 * dt);
        }

        // 6-4: 多条件叠加——饱腹=0 + 体力=0 = 双重惩罚，上面的三个条件是独立计算的

        // 6-5: 健康自然恢复——仅在暖炉旁 + 饱腹>0 时以低速率恢复
        const isNearFurnace = (
            this.currentScene !== 'village' || // 室内默认有暖炉覆盖
            (game.furnaceSystem && game.furnaceSystem._isInAnyFurnaceRange && game.furnaceSystem._isInAnyFurnaceRange(this))
        );
        if (isNearFurnace && this.hunger > 0 && this.health < 100 && !this.isSick) {
            this.health = Math.min(100, this.health + 0.01 * dt);
        }

        // 正常作息维持健康（保留原有逻辑但降低恢复量，避免与上面重复恢复过多）
        if (hour >= 6 && hour <= 22 && this.stamina >= 30 && this.hunger > 20) {
            this.health = Math.min(100, this.health + 0.003 * dt);
        }
        // 体力过低伤害健康
        if (this.stamina < 10) {
            this.health = Math.max(0, this.health - 0.02 * dt);
        }
        // 吃饭恢复健康
        if (this.isEating) {
            this.health = Math.min(100, this.health + 0.01 * dt);
        }
        // 淋雨伤害健康
        if (this.currentScene === 'village' && game.isRaining() && !this.hasUmbrella) {
            this.health = Math.max(0, this.health - 0.03 * dt);
        }
        // 老年人健康缓慢下降
        if (this.age >= 60) {
            this.health = Math.max(0, this.health - 0.003 * dt);
        }
        // 【增强】San值低时健康加速下降（精神差导致免疫力低下）
        if (this.sanity < 30) {
            this.health = Math.max(0, this.health - 0.015 * dt);
        }
        // 【增强】San值极低+健康不满时随机触发生病（身心俱疲容易发病）
        if (!this.isSick && this.sanity < 25 && this.health < 50 && Math.random() < 0.0005 * dt) {
            this.isSick = true;
            this.sickTimer = 300; // 生病持续一段时间
            this.mood = '难受';
            this.expression = '身体突然不舒服…';
            this.expressionTimer = 6;
            if (game.addEvent) {
                game.addEvent(`🤒 ${this.name} 因为精神压力大，身体也扛不住了！(San:${Math.round(this.sanity)} 健康:${Math.round(this.health)})`);
            }
            this._logDebug('health', `精神压力导致生病! San:${Math.round(this.sanity)} 健康:${Math.round(this.health)}`);
        }
        // 深夜不睡觉伤害健康 + San值急剧下降（通宵惩罚）
        if ((hour >= 23 || hour < 5) && !this.isSleeping) {
            this.health = Math.max(0, this.health - 0.01 * dt);
            const nightSanMult = (game.mode === 'debug') ? 5 : 1;
            const nightSanBefore = this.sanity;
            this.sanity = Math.max(0, this.sanity - 0.15 * nightSanMult * dt); // 通宵不睡精神崩溃
            // 【Debug】通宵惩罚日志
            if (game.mode === 'debug' && !this._nightSanLogged) {
                this._nightSanLogged = true;
                this._logDebug('sanity', `通宵惩罚开始! San:${Math.round(this.sanity)} 下降速率:${(0.15 * nightSanMult).toFixed(2)}/dt`);
            }
        } else {
            this._nightSanLogged = false;
        }

        // ---- 情商变化【变化慢】----
        // 社交中缓慢提升
        if (this.state === 'CHATTING') {
            // 【增强】San值低时社交质量下降，情商提升减半
            const socialQualityEmp = this.sanity < 30 ? 0.5 : 1.0;
            this.empathy = Math.min(100, this.empathy + 0.004 * socialQualityEmp * dt);
        }
        // 【增强】San值极低时情商持续下降（情绪失控、说话伤人）
        if (this.sanity < 25) {
            this.empathy = Math.max(0, this.empathy - 0.006 * dt);
        }

        // ---- San值变化【变化快】----
        // debug模式下San值下降加速，方便测试低San值效果
        const sanDropMult = (game.mode === 'debug') ? 5 : 1;
        const sanBefore = this.sanity; // 【Debug】记录变化前的San值
        const sanSources = [];         // 【Debug】记录所有变化来源

        // 工作时San值下降（劳累消耗精神）
        if (isWorking) {
            this.sanity = Math.max(0, this.sanity - 0.08 * sanDropMult * dt);
            sanSources.push(`工作-${(0.08 * sanDropMult * dt).toFixed(2)}`);
        }
        // 社交恢复San值
        if (this.state === 'CHATTING') {
            this.sanity = Math.min(100, this.sanity + 0.12 * dt);
            sanSources.push(`社交+${(0.12 * dt).toFixed(2)}`);
        }
        // 【增强】San值低时额外加速下降（恶性循环：精神越差越难自控）
        if (this.sanity < 30 && this.sanity > 0) {
            const spiralRate = 0.03 * sanDropMult * dt;
            this.sanity = Math.max(0, this.sanity - spiralRate);
            sanSources.push(`恶性循环-${spiralRate.toFixed(2)}`);
        }
        // 【增强】健康低时也拖累San值（身体不好影响心情）
        if (this.health < 35) {
            const healthSanDrain = 0.03 * sanDropMult * dt;
            this.sanity = Math.max(0, this.sanity - healthSanDrain);
            sanSources.push(`健康差-${healthSanDrain.toFixed(2)}`);
        }
        // 吃饭恢复San值
        if (this.isEating) {
            this.sanity = Math.min(100, this.sanity + 0.06 * dt);
            sanSources.push(`吃饭+${(0.06 * dt).toFixed(2)}`);
        }
        // 在公园/广场散步恢复San值
        if (this.currentScene === 'village' && !isWorking) {
            this.sanity = Math.min(100, this.sanity + 0.02 * dt);
            sanSources.push(`散步+${(0.02 * dt).toFixed(2)}`);
        }
        // 体力极低时San值下降（疲惫导致精神差）
        if (this.stamina < 20) {
            this.sanity = Math.max(0, this.sanity - 0.06 * sanDropMult * dt);
            sanSources.push(`疲惫-${(0.06 * sanDropMult * dt).toFixed(2)}`);
        }
        // 生病时San值下降
        if (this.isSick) {
            this.sanity = Math.max(0, this.sanity - 0.05 * sanDropMult * dt);
            sanSources.push(`生病-${(0.05 * sanDropMult * dt).toFixed(2)}`);
        }
        // 饥饿时San值下降
        if (this.hunger < 30) {
            this.sanity = Math.max(0, this.sanity - 0.04 * sanDropMult * dt);
            sanSources.push(`饥饿-${(0.04 * sanDropMult * dt).toFixed(2)}`);
        }
        // ---- 看凌玥演出恢复San值（少量花钱）----
        // 必须NPC有主动观看标记（通过行动决策去的）或状态覆盖为entertainment
        // 凌玥演出时间：14:00-16:00广场、19:00-21:00酒馆驻唱
        const linYue = game.npcs.find(n => n.id === 'ling_yue');
        const linYuePerforming = linYue && (
            (linYue.currentScene === 'village' && hour >= 14 && hour < 16) ||  // 广场演出
            (linYue.currentScene === 'kitchen' && hour >= 19 && hour < 21)     // 炊事房驻唱
        );
        // 只有主动去看演出（通过_stateOverride=entertainment 或 行动决策到达同场景）才恢复San值
        const isActivelyWatching = this.id !== 'ling_yue' && linYuePerforming && linYue.currentScene === this.currentScene
            && (this._stateOverride === 'entertainment' || this._actionOverride === 'watch_show' || this.stateDesc?.includes('演出') || this.stateDesc?.includes('看戏'));
        if (isActivelyWatching) {
            this.isWatchingShow = true;
            this.sanity = Math.min(100, this.sanity + 0.20 * dt);  // 看演出大幅恢复San值
            sanSources.push(`看演出+${(0.20 * dt).toFixed(2)}`);
            if (this.savings >= 2) {
                this.savings -= 0.05 * dt; // 看演出少量花钱（约1元/次）
            }
            // 凌玥获得演出收入
            if (linYue) {
                linYue.savings += 0.04 * dt;
                // 【目标追踪】标记凌玥正在演出（每场演出只计一次）
                if (!linYue._performanceTrackedThisSlot) {
                    linYue._performanceTrackedThisSlot = true;
                    if (linYue.trackPerformance) linYue.trackPerformance();
                }
            }
        } else {
            this.isWatchingShow = false;
            // 【目标追踪】非演出/不在看→重置演出追踪标志，让下一场可以再计次
            if (linYue && !linYuePerforming) {
                linYue._performanceTrackedThisSlot = false;
            }
            // 非主动观看但碰巧在同场景，给微量恢复（氛围加成）
            if (this.id !== 'ling_yue' && linYuePerforming && linYue.currentScene === this.currentScene) {
                this.sanity = Math.min(100, this.sanity + 0.03 * dt);
                sanSources.push(`演出氛围+${(0.03 * dt).toFixed(2)}`);
            }
        }

        // ---- 找苏医生心理咨询恢复San值（大量花钱）----
        // 必须通过正式治疗流程（_isBeingTreated && _stateOverride === 'mental'）才有大幅恢复
        // 纯粹因为"碰巧在医院"不再自动触发高额恢复
        const suDoctor = game.npcs.find(n => n.id === 'su_doctor');
        const suDoctorAvailable = suDoctor && suDoctor.currentScene === 'medical' && !suDoctor.isSleeping;
        if (this._isBeingTreated && this._stateOverride === 'mental' && suDoctorAvailable) {
            // 正在进行正式心理咨询
            this.isInTherapy = true;
            this.sanity = Math.min(100, this.sanity + 0.30 * dt);  // 心理咨询大幅恢复San值
            sanSources.push(`心理咨询+${(0.30 * dt).toFixed(2)}`);
            this.savings -= 0.3 * dt;  // 大量花钱（约6元/次）
            // 苏医生获得咨询收入
            suDoctor.savings += 0.25 * dt;
        } else if (this.id !== 'su_doctor' && this.currentScene === 'medical' && suDoctorAvailable) {
            // 碰巧在医疗站但没有正式咨询——微量恢复（安心氛围）
            this.isInTherapy = false;
            this.sanity = Math.min(100, this.sanity + 0.03 * dt);
            sanSources.push(`医疗站氛围+${(0.03 * dt).toFixed(2)}`);
        } else {
            this.isInTherapy = false;
        }

        // 清醒时San值自然缓慢下降（需要持续获取情绪价值/休息）
        this.sanity = Math.max(0, this.sanity - 0.02 * sanDropMult * dt);
        sanSources.push(`自然-${(0.02 * sanDropMult * dt).toFixed(2)}`);

        // 【Debug】周期性记录San值变化（每60帧约2秒记录一次，避免刷屏）
        if (game.mode === 'debug') {
            if (!this._sanLogCounter) this._sanLogCounter = 0;
            this._sanLogCounter += dt;
            if (this._sanLogCounter >= 60) { // 约每2秒记录一次
                this._sanLogCounter = 0;
                const sanAfter = this.sanity;
                const delta = sanAfter - sanBefore;
                if (Math.abs(delta) > 0.1) { // 只有变化超过0.1才记录
                    this._logDebug('sanity', `San: ${Math.round(sanBefore)}→${Math.round(sanAfter)} (${delta > 0 ? '+' : ''}${delta.toFixed(1)}) 来源:[${sanSources.join(', ')}]`);
                }
                // 【奖惩日志】记录当前生效的连锁惩罚
                const penalties = [];
                if (this.health < 30) penalties.push(`健康差(${Math.round(this.health)}):体力消耗×1.5`);
                else if (this.health < 50) penalties.push(`亚健康(${Math.round(this.health)}):体力消耗×1.2`);
                if (this.sanity < 25) penalties.push(`精神极差(${Math.round(this.sanity)}):食欲-50%/工效-70%`);
                else if (this.sanity < 40) penalties.push(`精神差(${Math.round(this.sanity)}):食欲-30%/工效-40%`);
                if (this.sanity < 30 && !this.isSleeping) penalties.push(`San恶性循环加速中`);
                if (this.health < 35) penalties.push(`健康→San拖累中`);
                if (this.sanity < 30) penalties.push(`社交质量-50%/魅力持续↓`);
                if (this.sanity < 25) penalties.push(`情商持续↓`);
                if (this.health < 25) penalties.push(`移速×0.6`);
                else if (this.health < 40) penalties.push(`移速×0.8`);
                if (this.sanity < 20) penalties.push(`移速×0.7/可能发疯!`);
                if (penalties.length > 0) {
                    this._logDebug('penalty', `⚠️ 连锁惩罚生效中: ${penalties.join(' | ')}`);
                }
                // 【目标进度日志】记录当前目标进度快照
                const activeGoals = this.goals.filter(g => !g.completed);
                if (activeGoals.length > 0) {
                    const goalSnap = activeGoals.map(g => {
                        const pct = g.targetValue > 0 ? Math.round((g.progress / g.targetValue) * 100) : 0;
                        return `${g.desc}:${pct}%`;
                    }).join(' | ');
                    this._logDebug('goal', `📊 目标进度: ${goalSnap}`);
                }
            }
        }

        // ---- 发疯机制（San值过低）----
        // 【增强】发疯阈值提高到<20，概率加大，让低San的后果更严重
        if (!this.isCrazy && this.sanity < 20) {
            // San值越低，发疯概率越高
            const crazyChance = this.sanity < 10 ? 0.003 : (this.sanity < 15 ? 0.002 : 0.001);
            if (Math.random() < crazyChance * dt) {
                this.isCrazy = true;
                this.crazyTimer = 180; // 发疯持续约3游戏小时
                this.mood = '疯狂';
                this.stateDesc = '精神崩溃了 🤯';
                this.expression = ['我受不了了！', '这个世界是假的…', '别碰我！', '哈哈哈哈哈…', '我好累…好累…'][Math.floor(Math.random() * 5)];
                this.expressionTimer = 10;
                if (game.addEvent) {
                    game.addEvent(`🤯 ${this.name} 精神崩溃发疯了！(San:${Math.round(this.sanity)})`);
                }
            }
        }
        // 发疯中：随机乱走、说胡话、无法正常工作
        if (this.isCrazy) {
            this.crazyTimer -= dt;
            this.stamina = Math.max(0, this.stamina - 0.08 * dt); // 发疯大幅消耗体力
            this.health = Math.max(0, this.health - 0.03 * dt);   // 发疯大幅伤害健康
            this.charisma = Math.max(0, this.charisma - 0.02 * dt); // 发疯降低魅力（形象变差）
            this.empathy = Math.max(0, this.empathy - 0.01 * dt);  // 发疯降低情商（胡言乱语）

            // 【极寒生存】San<10 精神崩溃物理攻击：随机攻击附近NPC
            if (this.sanity < 10 && Math.random() < 0.005 * dt) {
                const attackTargets = game.npcs.filter(n =>
                    n.id !== this.id && n.currentScene === this.currentScene && !n.isSleeping && !n.isDead
                );
                if (attackTargets.length > 0) {
                    const victim = attackTargets[Math.floor(Math.random() * attackTargets.length)];
                    // 造成伤害：体力-10、健康-5、San-5、双方好感-20
                    victim.stamina = Math.max(0, victim.stamina - 10);
                    victim.health = Math.max(0, victim.health - 5);
                    victim.sanity = Math.max(0, victim.sanity - 5);
                    this.stamina = Math.max(0, this.stamina - 5); // 自己也消耗体力
                    // 双方好感大幅下降
                    const myAff = this.getAffinity(victim.id);
                    this.affinity[victim.id] = Math.max(0, myAff - 20);
                    const theirAff = victim.getAffinity(this.id);
                    victim.affinity[this.id] = Math.max(0, theirAff - 20);
                    // 事件通知
                    const violenceLines = [
                        `${this.name} 精神崩溃，猛推了 ${victim.name}！`,
                        `${this.name} 失控攻击了 ${victim.name}！`,
                        `${this.name} 对 ${victim.name} 动手了！`,
                    ];
                    const line = violenceLines[Math.floor(Math.random() * violenceLines.length)];
                    if (game.addEvent) {
                        game.addEvent(`🔴 ${line}（${victim.name} 体力-10 健康-5 San-5）`);
                    }
                    this.expression = '啊啊啊！！都滚开！！';
                    this.expressionTimer = 8;
                    victim.expression = '疼…！别打我…';
                    victim.expressionTimer = 8;
                    console.log(`[Violence] ${this.name} 攻击了 ${victim.name}`);
                }
            }

            // 随机说胡话 或 语言攻击周围的人
            if (Math.random() < 0.003 * dt) {
                const nearbyVictims = game.npcs.filter(n => 
                    n.id !== this.id && n.currentScene === this.currentScene && !n.isSleeping
                );
                if (nearbyVictims.length > 0 && Math.random() < 0.6) {
                    // 【语言攻击】发疯NPC对周围的人进行语言攻击
                    const victim = nearbyVictims[Math.floor(Math.random() * nearbyVictims.length)];
                    const affinity = this.getAffinity(victim.id);
                    // 攻击性台词——根据关系亲密度不同，攻击方式也不同
                    let attackLines;
                    if (affinity >= 70) {
                        // 对亲密的人：更刺心的话（最伤人）
                        attackLines = [
                            `${victim.name}！你从来就没真正关心过我！`,
                            `${victim.name}，你算什么朋友？我最难的时候你在哪？`,
                            `别装了${victim.name}，你跟其他人一样虚伪！`,
                            `${victim.name}你滚开！我不需要你的同情！`,
                            `哈…${victim.name}…你也觉得我疯了对吧？你们都一样…`,
                            `${victim.name}！你知道我每天过的什么日子吗？你根本不在乎！`
                        ];
                    } else if (affinity >= 40) {
                        // 对普通关系的人：敌意和指责
                        attackLines = [
                            `${victim.name}看什么看！你们都在笑话我！`,
                            `别靠近我！${victim.name}你少假惺惺的！`,
                            `${victim.name}！你是不是在背后说我坏话？！`,
                            `都是你们…都是你们害的…${victim.name}你也有份！`,
                            `${victim.name}你少管闲事！滚！`
                        ];
                    } else {
                        // 对关系冷淡的人：恶意和攻击
                        attackLines = [
                            `${victim.name}！给我滚远点！！`,
                            `我看你就不是好人！${victim.name}你别过来！`,
                            `${victim.name}你笑什么笑？！信不信我…`,
                            `你们都想害我…${victim.name}你也是…`
                        ];
                    }
                    this.expression = attackLines[Math.floor(Math.random() * attackLines.length)];
                    this.expressionTimer = 8;
                    
                    // 【核心】语言攻击降低受害者的San值——关系越亲近伤害越大
                    const intimacyMultiplier = affinity >= 70 ? 3.0 : (affinity >= 40 ? 1.5 : 1.0);
                    const sanDamage = 2.5 * intimacyMultiplier; // 基础2.5，挚友受到7.5点伤害
                    victim.sanity = Math.max(0, victim.sanity - sanDamage);
                    
                    // 受害者产生负面情绪反应
                    if (affinity >= 70) {
                        // 来自亲密的人的攻击，伤害更深，情绪影响更大
                        victim.mood = '心痛';
                        victim.expression = `${this.name}…你怎么能这样说…`;
                        victim.expressionTimer = 6;
                    } else {
                        victim.mood = '不安';
                    }
                    
                    if (game.addEvent) {
                        game.addEvent(`😡 ${this.name} 对 ${victim.name} 发起语言攻击！(${victim.name} San-${sanDamage.toFixed(1)})`);
                    }
                } else {
                    // 普通胡话
                    const crazyLines = ['嘿嘿嘿…', '别过来！', '我看到了…', '为什么…为什么…', '哈哈哈哈！', '好黑…好冷…', '谁在说话？！'];
                    this.expression = crazyLines[Math.floor(Math.random() * crazyLines.length)];
                    this.expressionTimer = 6;
                }
            }
            // 发疯持续影响周围人的San值（被动氛围压迫）——附近的人每秒缓慢掉San
            const crazyWitnesses = game.npcs.filter(n => 
                n.id !== this.id && n.currentScene === this.currentScene && !n.isSleeping
            );
            for (const witness of crazyWitnesses) {
                const aff = witness.getAffinity(this.id);
                // 关系越好，看到对方发疯越痛苦，San下降越快
                const witnessSanLoss = aff >= 70 ? 0.08 : (aff >= 40 ? 0.04 : 0.02);
                witness.sanity = Math.max(0, witness.sanity - witnessSanLoss * dt);
            }
            // 发疯影响与周围人的关系——附近目睹发疯的NPC好感度下降
            if (Math.random() < 0.003 * dt) {
                for (const witness of crazyWitnesses) {
                    // 目击者对发疯者好感度下降
                    const currentAff = witness.getAffinity(this.id);
                    witness.affinity[this.id] = Math.max(5, currentAff - 2);
                    // 发疯者对目击者好感度也下降（精神混乱导致敌意）
                    const myAff = this.getAffinity(witness.id);
                    this.affinity[witness.id] = Math.max(5, myAff - 1);
                }
                if (crazyWitnesses.length > 0 && game.addEvent) {
                    game.addEvent(`😰 ${crazyWitnesses.map(w => w.name).join('、')} 目睹了 ${this.name} 的疯狂行为，关系变差了`);
                }
            }
            // 恢复条件：San值回到30以上 或 计时结束
            if (this.sanity >= 30 || this.crazyTimer <= 0) {
                this.isCrazy = false;
                this.crazyTimer = 0;
                this.mood = '虚弱';
                this.expression = '我…刚才怎么了…';
                this.expressionTimer = 8;
                if (game.addEvent) {
                    game.addEvent(`😰 ${this.name} 恢复了神智 (San:${Math.round(this.sanity)})`);
                }
            }
        }

        // ---- 精神不稳定行为（San 15~30，未发疯但状态很差）----
        // 阴阳怪气、负面情绪传染——偶尔说尖酸刻薄的话影响周围人
        if (!this.isCrazy && this.sanity >= 15 && this.sanity < 30) {
            if (Math.random() < 0.001 * dt) {
                const nearbyPeople = game.npcs.filter(n =>
                    n.id !== this.id && n.currentScene === this.currentScene && !n.isSleeping
                );
                if (nearbyPeople.length > 0) {
                    const target = nearbyPeople[Math.floor(Math.random() * nearbyPeople.length)];
                    const aff = this.getAffinity(target.id);
                    // 阴阳怪气的台词
                    const bitterLines = aff >= 70
                        ? [
                            `哼…${target.name}你今天看起来倒是挺开心的啊…`,
                            `${target.name}，你知道被人无视是什么感觉吗？算了你不会懂。`,
                            `我还以为我们是朋友呢…${target.name}。`,
                            `${target.name}，别假装关心我了，你忙你的吧。`
                        ]
                        : [
                            `真吵…能不能安静点…`,
                            `你们都好开心啊…真好。`,
                            `哈…算了，说了你也不懂。`,
                            `别看我…我没事…`,
                            `这破地方待着真没意思…`
                        ];
                    this.expression = bitterLines[Math.floor(Math.random() * bitterLines.length)];
                    this.expressionTimer = 6;
                    // 轻微影响周围人的San值（比发疯弱得多）
                    for (const person of nearbyPeople) {
                        const personAff = person.getAffinity(this.id);
                        const sanLoss = personAff >= 70 ? 1.5 : 0.5;
                        person.sanity = Math.max(0, person.sanity - sanLoss);
                    }
                    if (game.addEvent) {
                        game.addEvent(`😤 ${this.name} 情绪低落，说了些刺耳的话`);
                    }
                }
            }
        }

        // ---- 生病机制 ----
        if (!this.isSick && this.health < 30) {
            // 健康低于30时有概率触发生病
            if (Math.random() < 0.0001 * dt) {
                this.isSick = true;
                this.sickTimer = 120; // 生病持续约120游戏秒（≈2游戏小时）
                this.health = Math.max(0, this.health - 10);
                this.stateDesc = '生病了 🤒';
                this.expression = '不太舒服…';
                this.expressionTimer = 8;
                if (game.addEvent) {
                    game.addEvent(`🤒 ${this.name} 生病了！(健康:${Math.round(this.health)})`);
                }
            }
        }
        // 生病中：持续消耗体力和魅力，计时
        if (this.isSick) {
            this.sickTimer -= dt;
            this.stamina = Math.max(0, this.stamina - 0.02 * dt);
            this.charisma = Math.max(0, this.charisma - 0.005 * dt);
            // 如果看病（到医疗站治疗，简化为：在医疗站内）
            if (this.currentScene === 'medical') {
                this.health = Math.min(100, this.health + 0.1 * dt); // 加速恢复
            }
            // 生病自然恢复或计时结束
            if (this.sickTimer <= 0 || this.health >= 50) {
                this.isSick = false;
                this.sickTimer = 0;
                this.expression = '感觉好多了~';
                this.expressionTimer = 5;
                if (game.addEvent) {
                    game.addEvent(`💊 ${this.name} 康复了！`);
                }
            }
        }

        // ---- 【极寒生存】体温系统更新 ----
        this._updateBodyTemp(dt, game);

        // ---- 体力联动效果：影响移动速度 ----
        let speedBase;
        if (this.stamina <= 0) {
            speedBase = (100 + Math.random() * 10) * 0.3; // 【新增】体力归零，移速降至30%
        } else if (this.stamina >= 80) {
            speedBase = (100 + Math.random() * 10) * 1.2; // 精力充沛，速度+20%
        } else if (this.stamina >= 50) {
            speedBase = 100 + Math.random() * 10; // 正常
        } else if (this.stamina >= 20) {
            speedBase = (100 + Math.random() * 10) * 0.7; // 疲惫，速度-30%
        } else {
            speedBase = (100 + Math.random() * 10) * 0.4; // 虚脱，速度-60%
        }
        // 【增强】健康低时额外减速（身体虚弱走不动）
        if (this.health < 25) {
            speedBase *= 0.6;
        } else if (this.health < 40) {
            speedBase *= 0.8;
        }
        // 【增强】San值极低时额外减速（神思恐性、走路踉跄）
        if (this.sanity < 20) {
            speedBase *= 0.7;
        }
        // 【极寒生存】失温减速
        if (this.isHypothermic) {
            speedBase *= 0.5;
        }
        if (this.isSevereHypothermic) {
            speedBase *= 0; // 严重失温：无法移动
        }
        this.speed = speedBase;

        // ---- 属性边界钳制 ----
        this.stamina = Math.max(0, Math.min(100, this.stamina));
        this.charisma = Math.max(0, Math.min(100, this.charisma));
        this.wisdom = Math.max(0, Math.min(100, this.wisdom));
        this.health = Math.max(0, Math.min(100, this.health));
        this.empathy = Math.max(0, Math.min(100, this.empathy));
        this.savings = Math.max(0, this.savings);
        this.bodyTemp = Math.max(25, Math.min(36.5, this.bodyTemp));
        this.sanity = Math.max(0, Math.min(100, this.sanity));

        // ---- 目标系统：追踪器更新 + 进度检测 ----
        // 工作时间追踪（在工作场所时累计）
        if (isWorking) {
            this._goalTrackers.workHours += dt / 60; // dt是游戏秒，转换为游戏分钟→除60得小时
        }
        // 学习时间追踪（在工坊或医疗站时累计）
        if (this.currentScene === 'workshop' || this.currentScene === 'medical') {
            this._goalTrackers.studyHours += dt / 60;
        }
        // 演出次数追踪由演出系统外部更新（在startPerformance中++）
        // 每日重置 daily 目标
        if (game.dayCount !== this._lastGoalDay) {
            this._lastGoalDay = game.dayCount;
            this._goalTrackers.chatCount = 0;
            this._goalTrackers.chatPartners = [];
            this._goalTrackers.workHours = 0;
            this._goalTrackers.studyHours = 0;
            this._goalTrackers.performCount = 0;
            // 【任务10】重置末日生存日目标
            this._goalTrackers.mealsToday = 0;
            this._goalTrackers.woodChopped = 0;
            this._goalTrackers.gatherCount = 0;
            this._goalTrackers.frostbiteSaved = 0;
            this._goalTrackers.rareItemsFound = 0;
            this._goalTrackers.patrolCount = 0;
            this._goalTrackers.conflictsResolved = 0;
            this._goalTrackers.medkitsCrafted = 0;
            // 重置daily目标的完成状态
            for (const g of this.goals) {
                if (g.type === 'daily') {
                    g.completed = false;
                    g.rewarded = false;
                    g.progress = 0;
                }
            }
        }
        // ---- 极端状态持续计时器（用于死亡判定）----
        // 体力=0持续计时
        if (this.stamina <= 0) {
            this._zeroStaminaDuration += dt;
        } else {
            this._zeroStaminaDuration = 0;
        }
        // 饱腹=0持续计时
        if (this.hunger <= 0) {
            this._zeroHungerDuration += dt;
        } else {
            this._zeroHungerDuration = 0;
        }
        // San=0且发疯持续计时
        if (this.sanity <= 0 && this.isCrazy) {
            this._zeroCrazyDuration += dt;
        } else {
            this._zeroCrazyDuration = 0;
        }

        // ---- 【第2天户外工作时间限制】----
        const wsDay2 = game.weatherSystem;
        const isOutdoorScene = (this.currentScene === 'village');
        if (wsDay2 && wsDay2.currentDay === 2 && isOutdoorScene) {
            this._outdoorWorkDuration += dt;
            // 超过2小时（7200游戏秒）强制回室内
            if (this._outdoorWorkDuration >= 7200 && !this._outdoorForceReturn) {
                this._outdoorForceReturn = true;
                // 强制NPC回到据点
                this._stateOverride = 'force_return';
                this._actionOverride = 'go_to';
                this._actionTarget = 'furnace_main';
                this._currentAction = { type: 'go_to', target: 'furnace_main', reason: '户外工作超时，必须回室内取暖' };
                if (game.addEvent) {
                    game.addEvent(`⚠️ ${this.name}在户外工作超过2小时，体温下降严重，强制返回室内取暖！`);
                }
                console.log(`[OutdoorLimit] ${this.name} 第2天户外工作超2小时，强制回室内`);
            }
            // 1.5小时时预警
            if (this._outdoorWorkDuration >= 5400 && this._outdoorWorkDuration < 5400 + dt + 1 && !this._outdoorForceReturn) {
                if (game.addEvent) {
                    game.addEvent(`⏰ ${this.name}已在户外工作1.5小时，请注意安排回室内休息！`);
                }
            }
        } else {
            // 回到室内后重置计时
            if (this._outdoorWorkDuration > 0 && !isOutdoorScene) {
                this._outdoorWorkDuration = 0;
                this._outdoorForceReturn = false;
            }
        }

        // 定期检测目标进度（每5秒检测一次，避免每帧都算）
        this._goalCheckTimer = (this._goalCheckTimer || 0) + dt;
        if (this._goalCheckTimer >= 5) {
            this._goalCheckTimer = 0;
            this._updateGoals(game);
        }

        // ---- 共同行为关系加成 ----
        // 每隔一段时间检查：在同一场景中一起做某事的NPC，双方关系小幅提升
        this._sharedActivityTimer = (this._sharedActivityTimer || 0) + dt;
        if (this._sharedActivityTimer >= 60) { // 每60真实秒检查一次（降低频率防止好感涨太快）
            this._sharedActivityTimer = 0;
            if (!this.isSleeping && !this.isCrazy) {
                this._checkSharedActivityBonus(game);
            }
        }
    }

    /** 共同行为关系加成：在同场景一起做事的NPC双方关系提升 */
    _checkSharedActivityBonus(game) {
        const companions = game.npcs.filter(n =>
            n.id !== this.id && n.currentScene === this.currentScene && !n.isSleeping && !n.isCrazy
        );
        if (companions.length === 0) return;

        for (const other of companions) {
            let bonusReason = null;
            let bonus = 0;

            // 一起吃饭（双方都在炊事房且至少一方在吃饭）
            if (this.currentScene === 'kitchen' &&
                (this.isEating || other.isEating)) {
                bonus = 1;
                bonusReason = '一起吃饭';
            }
            // 一起在医疗站（陪伴看病）
            else if (this.currentScene === 'medical') {
                if (this._isBeingTreated || other._isBeingTreated) {
                    bonus = 1.5;
                    bonusReason = '陪伴看病';
                } else {
                    bonus = 0.5;
                    bonusReason = '在医疗站偶遇';
                }
            }
            // 一起在工坊工作
            else if (this.currentScene === 'workshop') {
                bonus = 0.5;
                bonusReason = '一起在工坊';
            }
            // 一起在宿舍（邻居关系）
            else if (this.currentScene === 'dorm_a' || this.currentScene === 'dorm_b') {
                bonus = 0.5;
                bonusReason = '宿舍邻居';
            }
            // 一起在公园散步
            else if (this.currentScene === 'village') {
                // 两人都在公园区域（y>50）
                const myPos = this.getGridPos();
                const otherPos = other.getGridPos();
                if (myPos.y > 50 && otherPos.y > 50 &&
                    Math.abs(myPos.x - otherPos.x) + Math.abs(myPos.y - otherPos.y) < 10) {
                    bonus = 0.3;
                    bonusReason = '一起在公园散步';
                }
            }

            if (bonus > 0 && bonusReason) {
                // 【修复】冷淡期检测：吵架后一段时间内不会被动增加好感
                if (this._affinityCooldown && this._affinityCooldown[other.id] > 0) continue;
                if (other._affinityCooldown && other._affinityCooldown[this.id] > 0) continue;

                // 情商越高，社交加成越大
                const empathyMultiplier = 0.8 + (this.empathy / 100) * 0.4;
                // 【修复】好感度越高，被动增长越慢（衰减因子）
                const currentAff = this.getAffinity(other.id);
                const diminishing = currentAff >= 80 ? 0.1 : (currentAff >= 60 ? 0.3 : (currentAff >= 40 ? 0.6 : 1.0));
                const finalBonus = bonus * empathyMultiplier * diminishing;
                // 太小的增量忽略（防止无意义的高精度浮点累加）
                if (finalBonus < 0.05) continue;
                this.changeAffinity(other.id, finalBonus);
                // 双向关系：对方也获得加成（但稍弱一些）
                other.changeAffinity(this.id, finalBonus * 0.7);
            }
        }
    }

    // ============ 目标系统：进度检测 + 奖励发放 ============
    _updateGoals(game) {
        for (const goal of this.goals) {
            if (goal.completed && goal.rewarded) continue; // 已完成且已领奖，跳过

            // 计算当前进度
            let currentValue = 0;
            switch (goal.targetKey) {
                case 'chatCount':
                    currentValue = this._goalTrackers.chatCount;
                    break;
                case 'workHours':
                    currentValue = this._goalTrackers.workHours;
                    break;
                case 'studyHours':
                    currentValue = this._goalTrackers.studyHours;
                    break;
                case 'performCount':
                    currentValue = this._goalTrackers.performCount;
                    break;
                case 'savings':
                    currentValue = this.savings;
                    break;
                case 'wisdom':
                    currentValue = this.wisdom;
                    break;
                case 'charisma':
                    currentValue = this.charisma;
                    break;
                case 'empathy':
                    currentValue = this.empathy;
                    break;
                case 'health':
                    currentValue = this.health;
                    break;
                case 'allAffinity60':
                case 'allAffinity70': {
                    // 检查和所有其他NPC的好感度是否都达到阈值
                    const threshold = goal.targetKey === 'allAffinity60' ? 60 : 70;
                    const otherNPCs = game.npcs.filter(n => n.id !== this.id);
                    const allAbove = otherNPCs.every(n => this.getAffinity(n.id) >= threshold);
                    currentValue = allAbove ? 1 : 0;
                    break;
                }
                // ============ 【任务10】末日生存目标 ============
                case 'mealsToday':
                    currentValue = this._goalTrackers.mealsToday;
                    break;
                case 'woodChopped':
                    currentValue = this._goalTrackers.woodChopped;
                    break;
                case 'gatherCount':
                    currentValue = this._goalTrackers.gatherCount;
                    break;
                case 'frostbiteSaved':
                    currentValue = this._goalTrackers.frostbiteSaved;
                    break;
                case 'rareItemsFound':
                    currentValue = this._goalTrackers.rareItemsFound;
                    break;
                case 'patrolCount':
                    currentValue = this._goalTrackers.patrolCount;
                    break;
                case 'conflictsResolved':
                    currentValue = this._goalTrackers.conflictsResolved;
                    break;
                case 'medkitsCrafted':
                    currentValue = game._medkitCount || 0; // 全局急救包总数
                    break;
                case 'radioRepaired':
                    currentValue = game._radioRepaired ? 1 : 0;
                    break;
                case 'secondFurnaceBuilt':
                    currentValue = (game.furnaceSystem && game.furnaceSystem.secondFurnaceBuilt) ? 1 : 0;
                    break;
                case 'aliveCount':
                    currentValue = game.npcs.filter(n => !n.isDead).length;
                    break;
                case 'totalWoodCollected':
                    currentValue = (game.resourceSystem && game.resourceSystem.totalCollected) ? game.resourceSystem.totalCollected.woodFuel : 0;
                    break;
                case 'totalFoodCollected':
                    currentValue = (game.resourceSystem && game.resourceSystem.totalCollected) ? game.resourceSystem.totalCollected.food : 0;
                    break;
                case 'sanity':
                    currentValue = this.sanity;
                    break;
                case 'stamina':
                    currentValue = this.stamina;
                    break;
                case 'hunger':
                    currentValue = this.hunger;
                    break;
                default:
                    // 好感度目标（格式：affinity_npcId）
                    if (goal.targetKey.startsWith('affinity_')) {
                        const targetNpcId = goal.targetKey.replace('affinity_', '');
                        currentValue = this.getAffinity(targetNpcId);
                    }
                    break;
            }

            goal.progress = currentValue;

            // 检测是否完成
            if (!goal.completed && currentValue >= goal.targetValue) {
                goal.completed = true;
                goal.completedDay = game.dayCount;
                // 发放奖励
                this._grantGoalReward(goal, game);
            }
        }
    }

    /** 发放目标奖励 */
    _grantGoalReward(goal, game) {
        if (goal.rewarded) return;
        goal.rewarded = true;

        const r = goal.reward;
        if (r.sanity) this.sanity = Math.min(100, this.sanity + r.sanity);
        if (r.charisma) this.charisma = Math.min(100, this.charisma + r.charisma);
        if (r.wisdom) this.wisdom = Math.min(100, this.wisdom + r.wisdom);
        if (r.empathy) this.empathy = Math.min(100, this.empathy + r.empathy);
        if (r.health) this.health = Math.min(100, this.health + r.health);
        if (r.stamina) this.stamina = Math.min(100, this.stamina + r.stamina);
        if (r.savings) this.savings += r.savings;

        // 完成目标时产生积极情绪
        this.mood = '满足';
        this.expression = goal.type === 'daily'
            ? `今天的目标完成啦！(${goal.desc})`
            : `终于达成了！(${goal.desc})`;
        this.expressionTimer = 8;

        // 记录到记忆
        this.addMemory(`[成就] 完成了目标「${goal.desc}」! 奖励: ${goal.rewardDesc}`);

        // 事件日志
        if (game.addEvent) {
            game.addEvent(`🎯 ${this.name} 完成了目标「${goal.desc}」! 奖励: ${goal.rewardDesc}`);
        }
        this._logDebug('goal', `完成目标: ${goal.desc} 奖励: ${goal.rewardDesc}`);
    }

    /** 记录一次聊天（用于目标追踪） */
    trackChatWith(partnerId) {
        if (!this._goalTrackers.chatPartners.includes(partnerId)) {
            this._goalTrackers.chatPartners.push(partnerId);
            this._goalTrackers.chatCount = this._goalTrackers.chatPartners.length;
        }
    }

    /** 记录一次演出（用于目标追踪） */
    trackPerformance() {
        this._goalTrackers.performCount++;
    }

    /** 获取目标摘要（供Prompt使用） */
    getGoalsSummary() {
        if (!this.goals || this.goals.length === 0) return '';
        return this.goals.map(g => {
            const pct = g.targetValue > 0 ? Math.min(100, Math.round((g.progress / g.targetValue) * 100)) : 0;
            const status = g.completed ? '✅已完成' : `${pct}%`;
            const typeLabel = g.type === 'daily' ? '📅每日' : '🏆长期';
            return `${typeLabel} ${g.desc} [${status}] 奖励:${g.rewardDesc}`;
        }).join('\n');
    }

    /** 事件驱动的属性变化（由对话、冲突等离散事件触发） */
    onChatCompleted(partner, quality) {
        // quality: 'good' | 'normal' | 'bad'
        if (quality === 'good') {
            this.charisma = Math.min(100, this.charisma + 1);
            this.empathy = Math.min(100, this.empathy + 0.5);
        } else if (quality === 'bad') {
            this.charisma = Math.max(0, this.charisma - 2);
            this.empathy = Math.max(0, this.empathy - 1);
        }
        // 社交消耗体力
        this.stamina = Math.max(0, this.stamina - 1);
    }

    onHelpOther() {
        this.charisma = Math.min(100, this.charisma + 2);
        this.empathy = Math.min(100, this.empathy + 1.5);
    }

    onConflict() {
        this.charisma = Math.max(0, this.charisma - 3);
        this.stamina = Math.max(0, this.stamina - 5);
        this.health = Math.max(0, this.health - 2);
    }

    onLearnFromOther(teacherWisdom) {
        // 向更聪明的人学习
        if (teacherWisdom > this.wisdom) {
            this.wisdom = Math.min(100, this.wisdom + 1);
        }
    }

    // ============ 饥饿系统 ============

    /** 获取饥饿状态描述 */
    getHungerStatus() {
        if (this.hunger >= 80) return '饱足';
        if (this.hunger >= 60) return '正常';
        if (this.hunger >= 40) return '有点饿';
        if (this.hunger >= 20) return '很饿';
        return '饥肠辘辘';
    }

    /** 获取饥饿状态emoji */
    getHungerEmoji() {
        if (this.hunger >= 80) return '😋';
        if (this.hunger >= 60) return '🙂';
        if (this.hunger >= 40) return '😐';
        if (this.hunger >= 20) return '😣';
        return '🤤';
    }

    // ============ 【极寒生存】体温系统 ============

    /** 每帧更新体温（在_updateAttributes中调用） */
    _updateBodyTemp(dt, game) {
        if (this.isDead) return;

        const ws = game.weatherSystem;
        if (!ws) return;

        const temp = ws.getEffectiveTemp();
        const isOutdoor = this.currentScene === 'village';

        // ---- 室外：体温下降 ----
        if (isOutdoor && temp < 0) {
            // 体温下降速率【已调整：从0.000167提高到0.00025】
            // -30°C时约0.0075°C/秒=0.45°C/分钟，从36.5降到25需约25分钟
            let dropRate = Math.abs(temp) * 0.00025 * dt;

            // 失温状态下体温下降加速
            if (this.isHypothermic) {
                dropRate *= 1.5;
            }

            // 【新增风寒效应】大雪或极寒暴风雪天气时降温速率×1.5
            if (ws.currentWeather && (
                ws.currentWeather.includes('大雪') ||
                ws.currentWeather.includes('极寒暴风雪') ||
                ws.currentWeather.includes('暴风雪')
            )) {
                dropRate *= 1.5;
            }

            this.bodyTemp = Math.max(25, this.bodyTemp - dropRate);

            // 累计户外连续时间
            this._outdoorContinuousTime += dt;
        }

        // ---- 室内暖炉旁：体温恢复 ----
        if (!isOutdoor) {
            const fs = game.furnaceSystem;
            const isNearFurnace = fs && fs.isNearActiveFurnace(this);

            if (isNearFurnace) {
                // 暖炉旁恢复体温: +0.2°C/分钟 = +0.00333/秒
                this.bodyTemp = Math.min(36.5, this.bodyTemp + 0.00333 * dt);
                // 暖炉旁体力和健康微恢复（由FurnaceSystem处理）
            } else if (temp < 0) {
                // 室内但暖炉未运行/不在范围内，缓慢降温【已调整：从0.00005降为0.00003】
                const indoorDropRate = Math.abs(temp) * 0.00003 * dt;
                this.bodyTemp = Math.max(25, this.bodyTemp - indoorDropRate);
            } else {
                // 室内且温度≥0，缓慢恢复体温
                this.bodyTemp = Math.min(36.5, this.bodyTemp + 0.001 * dt);
            }

            // 室内重置户外连续时间
            this._outdoorContinuousTime = 0;
        }

        // ---- 失温状态判定 ----
        const wasHypothermic = this.isHypothermic;
        const wasSevere = this.isSevereHypothermic;

        if (this.bodyTemp < 30) {
            // 严重失温: 倒地不起，需救援
            this.isSevereHypothermic = true;
            this.isHypothermic = true;
            this._rescueNeeded = true;

            // 严重失温持续伤害【已调整：加快严重失温伤害】
            this.health = Math.max(0, this.health - 0.2 * dt);
            this.stamina = Math.max(0, this.stamina - 0.3 * dt);

            // 救援倒计时（户外30分钟=1800游戏秒，室内60分钟=3600游戏秒）
            if (isOutdoor) {
                this._rescueTimer += dt;
                if (this._rescueTimer >= 1800 && this.health > 0) {
                    // 30分钟无人救援，冻死
                    this.health = 0;
                    this._deathCause = '冻死';
                    console.log(`[BodyTemp] ${this.name} 严重失温无人救援，冻死`);
                }
            } else {
                // 室内严重失温：救援倒计时延长为60分钟
                this._rescueTimer += dt;
                if (this._rescueTimer >= 3600 && this.health > 0) {
                    this.health = 0;
                    this._deathCause = '冻死';
                    console.log(`[BodyTemp] ${this.name} 室内严重失温60分钟无人救援，冻死`);
                }
            }

            if (!wasSevere) {
                this.mood = '濒死';
                this.stateDesc = '严重失温，倒地不起 🧊';
                this.expression = '好冷…谁来…救…';
                this.expressionTimer = 15;
                if (game.addEvent) {
                    game.addEvent(`🧊 ${this.name} 严重失温倒地！(体温:${this.bodyTemp.toFixed(1)}°C) 需要救援！`);
                }
            }
        } else if (this.bodyTemp < 35) {
            // 轻度失温: 移速×0.5、体力消耗×2、无法工作
            this.isHypothermic = true;
            this.isSevereHypothermic = false;
            this._rescueNeeded = false;
            this._rescueTimer = 0;

            // 【v2.0】体温<33°C时累计失温持续时间（用于死亡判定）
            if (this.bodyTemp < 33) {
                this._hypothermiaDuration += dt;
            } else {
                this._hypothermiaDuration = Math.max(0, this._hypothermiaDuration - dt * 0.5); // 缓慢恢复
            }

            // 失温持续伤害（较轻）【已调整：加快失温伤害】
            this.health = Math.max(0, this.health - 0.05 * dt);
            this.stamina = Math.max(0, this.stamina - 0.08 * dt);

            if (!wasHypothermic) {
                this.mood = '发抖';
                this.stateDesc = '体温过低，瑟瑟发抖 🥶';
                this.expression = '好冷…浑身发抖…';
                this.expressionTimer = 10;
                if (game.addEvent) {
                    game.addEvent(`🥶 ${this.name} 开始失温！(体温:${this.bodyTemp.toFixed(1)}°C)`);
                }
            }
        } else {
            // 体温正常
            this._hypothermiaDuration = 0; // 【v2.0】重置失温持续时间
            if (wasHypothermic) {
                this.isHypothermic = false;
                this.isSevereHypothermic = false;
                this._rescueNeeded = false;
                this._rescueTimer = 0;
                this.expression = '终于暖和过来了…';
                this.expressionTimer = 5;
                if (game.addEvent) {
                    game.addEvent(`🌡️ ${this.name} 体温恢复正常 (${this.bodyTemp.toFixed(1)}°C)`);
                }
            }
        }
    }

    /** 获取体温状态描述 */
    getBodyTempStatus() {
        if (this.bodyTemp >= 36) return '正常';
        if (this.bodyTemp >= 35) return '偏低';
        if (this.bodyTemp >= 32) return '失温';
        if (this.bodyTemp >= 30) return '严重失温';
        return '濒死';
    }

    /** 获取体温颜色 (绿→黄→红→紫) */
    getBodyTempColor() {
        if (this.bodyTemp >= 36) return '#4ade80';   // 绿
        if (this.bodyTemp >= 35) return '#facc15';   // 黄
        if (this.bodyTemp >= 32) return '#f87171';   // 红
        return '#c084fc';                             // 紫
    }

    /** 每帧更新饥饿值 */
    _updateHunger(dt, game) {
        // 睡觉时不触发饥饿行为，但仍然缓慢消耗（在下方 decayRate 中处理）

        // 饥饿值随时间递减
        // dt 已经是经过倍速处理的 gameDt
        // 设计：一个完整白天（6:00~22:00 = 16 游戏小时 = 960 游戏分钟）饥饿值从 100 降到约 60
        // 每游戏分钟消耗 100/960 ≈ 0.104（清醒时）
        // 每真实秒 = timeSpeed 游戏分钟（默认10），且 dt 已含倍速
        // 所以每帧消耗 = decayRate * dt（dt已含倍速，自动加速）
        // 【极寒生存】无食物时饥饿值2倍速度下降
        const rs = game.resourceSystem;
        const noFoodCrisis = rs && rs.crisisFlags.noFood;
        const hungerMultiplier = noFoodCrisis ? 2.0 : 1.0;
        const decayRate = (this.isSleeping ? 0 : 0.4) * hungerMultiplier; // 睡觉时不掉饱食度
        this.hunger = Math.max(0, this.hunger - decayRate * dt);

        // 正在吃饭中
        if (this.isEating) {
            this.eatingTimer -= dt;
            if (this.eatingTimer <= 0) {
                this.isEating = false;
                
                // 【关键修复】吃饭时实际消耗食物存储！
                const rs2 = game.resourceSystem;
                const foodPerMeal = 1.5; // 每人每餐消耗1.5单位食物（与RESOURCE_CONSUMPTION.foodPerMealPerPerson一致）
                if (rs2) {
                    if (rs2.food >= foodPerMeal) {
                        rs2.consumeResource('food', foodPerMeal, `${this.name}吃饭`);
                        this.hunger = Math.min(100, this.hunger + 60); // 吃饱了
                        this.mood = '满足';
                        this.expression = '吃饱了，真舒服！';
                        if (game.addEvent) {
                            game.addEvent(`🍴 ${this.name} 吃饱了（-${foodPerMeal}食物，剩余${Math.round(rs2.food)}，饱食度: ${Math.round(this.hunger)}）`);
                        }
                    } else if (rs2.food > 0) {
                        // 食物不足，按比例恢复
                        const available = rs2.food;
                        const ratio = available / foodPerMeal;
                        rs2.consumeResource('food', available, `${this.name}吃饭(不足)`);
                        this.hunger = Math.min(100, this.hunger + Math.round(60 * ratio));
                        this.mood = '不太满足';
                        this.expression = '只吃了一点点...';
                        if (game.addEvent) {
                            game.addEvent(`⚠️ ${this.name} 吃了一点但食物不够（-${Math.round(available)}食物，饱食度+${Math.round(60 * ratio)}）`);
                        }
                    } else {
                        // 没有食物
                        this.hunger = Math.max(0, this.hunger - 10); // 白跑一趟还更饿了
                        this.mood = '沮丧';
                        this.expression = '没有食物...';
                        if (game.addEvent) {
                            game.addEvent(`😰 ${this.name} 到食堂发现没有食物了！`);
                        }
                    }
                } else {
                    this.hunger = Math.min(100, this.hunger + 60);
                }
                
                this.expressionTimer = 5;
                this._hungerOverride = false;
                this._hungerTarget = null;
                this._hungerStuckTimer = 0;
                this._hungerTravelTimer = 0;
                // 重置日程索引，让日程系统在下一帧重新接管
                this.currentScheduleIdx = -1;
                this.scheduleReached = false;
            }
            return;
        }

        // 饥饿驱动行为：当饥饿值低于阈值时，打断当前日程去吃饭
        // 【修复】睡觉时段（日程要求回家睡觉）不触发饥饿行为，否则会打断回家路径
        // 【优先级仲裁】体力极低/生病时不触发饥饿，让状态覆盖（回家/看病）优先
        const hour = game.getHour();
        const isLateNight = this._isBedtime(hour);
        const hasHigherPriorityNeed = this.stamina < 15 || (this.isSick && this.health < 25) || this._stateOverride;
        if (this.hunger < 35 && !this._hungerOverride && !this.isEating && this.state !== 'CHATTING' && !this.isSleeping && !isLateNight && this._hungerTriggerCooldown <= 0 && !hasHigherPriorityNeed) {
            this._hungerTriggerCooldown = 10; // 10秒冷却，避免反复触发刷屏
            this._triggerHungerBehavior(game);
        }
    }

    /** 饥饿触发：打断当前日程，去吃饭 */
    _triggerHungerBehavior(game) {
        this._hungerOverride = true;
        this._hungerStuckTimer = 0;
        this._logDebug('hunger', `触发饥饿行为 饱食度:${Math.round(this.hunger)}/100`);

        // 根据角色和时间选择去哪吃
        const hour = game.getHour();
        const eatTargets = this._chooseEatTarget(hour);
        this._hungerTarget = eatTargets;

        this.stateDesc = `肚子饿了，去${eatTargets.desc}`;
        this.mood = '烦躁';
        this.expression = this.hunger < 15 ? '饿得不行了…' : '该去吃点东西了';
        this.expressionTimer = 6;

        if (game.addEvent) {
            game.addEvent(`🍽️ ${this.name} 饿了(${Math.round(this.hunger)})，去${eatTargets.desc}`);
        }

        // 清除当前移动路径，确保新导航不会被旧路径干扰
        this.currentPath = [];
        this.isMoving = false;
        this._pendingEnterScene = null;

        // 导航到目标
        this._navigateToScheduleTarget(eatTargets.target, game);
        this.scheduleReached = false;
    }

    /** 根据时间和偏好选择吃饭地点 */
    _chooseEatTarget(hour) {
        // 各餐饮场所的可选项
        const options = [];

        // 炊事房（主要餐饮场所）
        options.push({ target: 'kitchen_door', desc: '去炊事房吃饭', weight: hour >= 11 ? 3 : 2 });
        // 仓库（拿干粮）
        options.push({ target: 'warehouse_door', desc: '去仓库拿干粮', weight: 1 });
        // 回宿舍做饭（万能选项）
        options.push({ target: this.homeName + '_door', desc: '回宿舍做饭', weight: 1 });
        // 加权随机选择
        const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
        let rand = Math.random() * totalWeight;
        for (const opt of options) {
            rand -= opt.weight;
            if (rand <= 0) return opt;
        }
        return options[options.length - 1];
    }

    /** 检查是否到达吃饭地点并开始吃饭 */
_checkEatingArrival(dt, game) {
        if (!this._hungerOverride || !this._hungerTarget) return;
        if (this.isEating) return;

        // 【关键修复】CHATTING状态下暂停饥饿覆盖的到达检测和传送，防止对话中被传送走导致隔空聊天
        if (this.state === 'CHATTING') return;

        // 判断是否到达了吃饭目标的场景
        const eatingScenes = {
            'kitchen_door': 'kitchen',
            'warehouse_door': 'warehouse',
            'dorm_a_door': 'dorm_a', 'dorm_b_door': 'dorm_b',
        };
        const targetScene = eatingScenes[this._hungerTarget.target];

        // 已经在目标室内场景中 → 直接开始吃饭
        if (this.currentScene === targetScene) {
            this._startEating(game);
            return;
        }

        // 【兜底】在村庄中已走到门口附近（5格内）但还没进入 → 强制传送进入
        if (this.currentScene === 'village' && !this.isMoving && this.currentPath.length === 0) {
            const loc = SCHEDULE_LOCATIONS[this._hungerTarget.target];
            if (loc) {
                const pos = this.getGridPos();
                const dist = Math.abs(pos.x - loc.x) + Math.abs(pos.y - loc.y);
                if (dist <= 6) {
                    // 在门口附近了，传送进入室内门口再走向目标
                    const doorKey = targetScene + '_indoor_door';
                    const doorLoc = SCHEDULE_LOCATIONS[doorKey];
                    const insideKey = targetScene + '_inside';
                    let insideLoc = SCHEDULE_LOCATIONS[insideKey];
                    // 【增强】从多座位中随机选择未被占用的位置
                    const seatLoc = this._pickIndoorSeat(targetScene, game);
                    if (seatLoc) insideLoc = { scene: targetScene, x: seatLoc.x, y: seatLoc.y };
                    if (doorLoc) {
                        this._teleportTo(doorLoc.scene, doorLoc.x, doorLoc.y, true);
                        if (insideLoc) {
                            this._enterWalkTarget = { x: insideLoc.x, y: insideLoc.y };
                            this._pathTo(insideLoc.x, insideLoc.y, game);
                        }
                    } else if (insideLoc) {
                        this._teleportTo(insideLoc.scene, insideLoc.x, insideLoc.y);
                    } else {
                        this._teleportTo(targetScene, 5, 5);
                    }
                    // 不立即开始吃饭，等下一帧检测到 currentScene === targetScene 再开始
                    return;
                }
            }
        }

        // 【超时兆底】饥饿覆盖超15秒还没吃上饭 → 传送到室内门口并走向目标
        this._hungerTravelTimer = (this._hungerTravelTimer || 0) + dt;
        if (this._hungerTravelTimer > 15) {
            this._hungerTravelTimer = 0;
            const doorKey = targetScene + '_indoor_door';
            const doorLoc = SCHEDULE_LOCATIONS[doorKey];
            const insideKey = targetScene + '_inside';
            let insideLoc = SCHEDULE_LOCATIONS[insideKey];
            // 【增强】从多座位中随机选择未被占用的位置
            const seatLoc = this._pickIndoorSeat(targetScene, game);
            if (seatLoc) insideLoc = { scene: targetScene, x: seatLoc.x, y: seatLoc.y };
            if (doorLoc) {
                this._teleportTo(doorLoc.scene, doorLoc.x, doorLoc.y, true);
                if (insideLoc) {
                    this._enterWalkTarget = { x: insideLoc.x, y: insideLoc.y };
                    this._pathTo(insideLoc.x, insideLoc.y, game);
                }
            } else if (insideLoc) {
                this._teleportTo(insideLoc.scene, insideLoc.x, insideLoc.y);
            } else {
                this._teleportTo(targetScene, 5, 5);
            }
            // 下一帧会检测到 currentScene === targetScene 然后开始吃饭
            if (game.addEvent && this._hungerTarget) {
                game.addEvent(`⚡ ${this.name} 赶到了${this._hungerTarget.desc}（传送兆底）`);
            }
        }    }

    /** 开始吃饭 */
    _startEating(game) {
        if (!this._hungerTarget) return; // 防御：饥饿目标已被清除
        this.isEating = true;
        this.eatingTimer = 20; // 吃饭持续 20 真实秒 ≈ 20 游戏分钟（dt 已含倍速，倍速下会更快吃完）
        this.stateDesc = `正在${this._hungerTarget.desc}`;
        this.expression = '开吃！🍜';
        this.expressionTimer = 4;
        this.mood = '期待';
        this._hungerStuckTimer = 0;
        this._hungerTravelTimer = 0;
        this.currentPath = []; // 停止移动
        this.isMoving = false;
        if (game.addEvent) {
            game.addEvent(`🍜 ${this.name} 开始吃饭`);
        }
    }

    // ============ 状态驱动行为覆盖系统 ============
    // 当NPC状态极差时，打断日程执行紧急行为（类似饥饿覆盖机制）

    /** 每帧检查是否需要触发状态覆盖行为 */
    _updateStateOverride(dt, game) {
        // 冷却递减
        if (this._stateOverrideCooldown > 0) this._stateOverrideCooldown -= dt;

        // 正在治疗中
        if (this._isBeingTreated) {
            this._treatmentTimer -= dt;
            if (this._treatmentTimer <= 0) {
                this._finishTreatment(game);
            }
            return;
        }

        // 如果已经在状态覆盖中，检查到达逻辑
        if (this._stateOverride) {
            // 【超时保护】stateOverride持续超过60秒且NPC静止，强制清除
            this._stateOverrideMaxTimer = (this._stateOverrideMaxTimer || 0) + dt;
            if (this._stateOverrideMaxTimer > 60 && !this.isMoving && this.currentPath.length === 0) {
                console.warn(`[NPC-${this.name}] [超时] stateOverride(${this._stateOverride})持续${Math.round(this._stateOverrideMaxTimer)}秒且静止，强制清除`);
                this._clearStateOverride();
                return;
            }
            this._checkStateOverrideArrival(dt, game);
            return;
        }

        // 不在覆盖中 → 检查是否需要触发新的状态覆盖
        if (this._stateOverrideCooldown > 0) return;
        if (this.state === 'CHATTING' || this.isSleeping || this.isEating) return;
        if (this.isCrazy) return; // 发疯中不触发（发疯有自己的逻辑）

        const hour = game.getHour();
        const isLateNight = this._isBedtime(hour);

        // 【优先级仲裁】体力极低/生病时，强制打断饥饿覆盖
        // 优先级顺序：体力极低 > 生病 > 饥饿 > 精神差
        // 优先级1：体力极低 → 回家睡觉（可打断饥饿）
        if (this.stamina < 15 && !isLateNight) {
            if (this._hungerOverride) {
                // 强制打断饥饿覆盖，因为体力太低了
                this._hungerOverride = false;
                this._hungerTarget = null;
                this._hungerStuckTimer = 0;
                this._hungerTravelTimer = 0;
                this.isEating = false;
                console.log(`[优先级仲裁] ${this.name} 体力极低(${Math.round(this.stamina)})，打断饥饿行为优先回家休息`);
            }
            this._triggerStateOverride('exhausted', game);
            return;
        }

        // 优先级2：生病或健康低 → 去医院看病（可打断饥饿）
        // 【增强】提高触发阈值：健康<35就触发（原来<25）
        if ((this.isSick || this.health < 35) && !isLateNight) {
            if (this._hungerOverride) {
                this._hungerOverride = false;
                this._hungerTarget = null;
                this._hungerStuckTimer = 0;
                this._hungerTravelTimer = 0;
                this.isEating = false;
                console.log(`[优先级仲裁] ${this.name} 生病/健康极低，打断饥饿行为优先看病`);
            }
            this._triggerStateOverride('sick', game);
            return;
        }

        // 优先级3：饥饿覆盖中 → 不打断（饥饿 > 精神差）
        if (this._hungerOverride) return;

        // 优先级4：精神状态差 → 去医院找苏医生咨询（非发疯状态下的预防行为）
        // 【增强】提高触发阈值：San<35就触发（原来<25）让NPC更早开始关注精神健康
        if (this.sanity < 35 && !this.isCrazy && !isLateNight) {
            this._triggerStateOverride('mental', game);
            return;
        }
    }

    /** 触发状态覆盖行为 */
    _triggerStateOverride(type, game) {
        this._stateOverride = type;
        this._stateOverrideStuckTimer = 0;
        this._stateOverrideTravelTimer = 0;
        this._stateOverrideMaxTimer = 0; // 超时保护计时器
        this._stateOverrideCooldown = 30; // 30秒冷却，避免反复触发

        // 【修复】清除社交走路目标（状态覆盖优先于社交意愿）
        if (this._chatWalkTarget) {
            this._logDebug('chat', `状态覆盖(${type})打断了走向聊天目标的路径`);
            this._chatWalkTarget = null;
        }

        // 清除当前移动路径
        this.currentPath = [];
        this.isMoving = false;
        this._pendingEnterScene = null;

        let target, desc, expr, moodStr;
        switch (type) {
            case 'exhausted':
                target = { target: this.homeName + '_door', desc: '回宿舍休息' };
                desc = '累坏了，赶紧回家休息';
                expr = this.stamina < 5 ? '快…快撑不住了…' : '太累了，得回去歇歇…';
                moodStr = '疲惫';
                break;
            case 'sick':
                target = { target: 'medical_door', desc: '去医疗站看病' };
                desc = '身体不舒服，去医疗站看看';
                expr = this.health < 15 ? '难受…得赶紧看医生…' : '有点不舒服，去医疗站检查一下';
                moodStr = '难受';
                break;
            case 'mental':
                target = { target: 'medical_door', desc: '去医疗站看心理' };
                desc = '精神状态不好，去找医官聊聊';
                expr = '脑子里乱糟糟的…去找苏岩聊聊吧';
                moodStr = '焦虑';
                break;
            default:
                this._stateOverride = null;
                return;
        }

        this._stateOverrideTarget = target;
        this.stateDesc = desc;
        this.mood = moodStr;
        this.expression = expr;
        this.expressionTimer = 6;

        const emojiMap = { exhausted: '😴', sick: '🤒', mental: '😰' };
        if (game.addEvent) {
            game.addEvent(`${emojiMap[type]} ${this.name} ${desc} (体力:${Math.round(this.stamina)} 健康:${Math.round(this.health)} San:${Math.round(this.sanity)})`);
        }

        // 【Debug日志】记录状态覆盖触发
        this._logDebug('override', `触发状态覆盖:${type} → ${desc} (体力:${Math.round(this.stamina)} 健康:${Math.round(this.health)} San:${Math.round(this.sanity)})`);

        // 导航到目标
        this._navigateToScheduleTarget(target.target, game);
        this.scheduleReached = false;
    }

    /** 检查状态覆盖的到达逻辑（类似_checkEatingArrival） */
    _checkStateOverrideArrival(dt, game) {
        if (!this._stateOverride || !this._stateOverrideTarget) return;

        // 【关键修复】CHATTING状态下暂停状态覆盖的到达检测和传送，防止对话中被传送走导致隔空聊天
        if (this.state === 'CHATTING') return;

        const targetKey = this._stateOverrideTarget.target;

        // 根据覆盖类型决定到达后的行为
        if (this._stateOverride === 'exhausted') {
            // 目标：回宿舍 → 到达后直接入睡
            if (this.currentScene === this.homeName) {
                // 检查是否到达了床位
                const bedLoc = SCHEDULE_LOCATIONS[this.homeName + '_inside'];
                if (bedLoc) {
                    const pos = this.getGridPos();
                    const dist = Math.abs(pos.x - bedLoc.x) + Math.abs(pos.y - bedLoc.y);
                    if (dist <= 3) {
                        // 到达房间 → 强制入睡
                        this._clearStateOverride();
                        this.isSleeping = true;
                        this.stateDesc = '累坏了，倒头就睡';
                        this._logDebug('sleep', `累坏倒头就睡 体力:${Math.round(this.stamina)} San:${Math.round(this.sanity)}`);
                        this.expression = 'Zzz...';
                        this.expressionTimer = 8;
                        this.mood = '疲惫';
                        // 重置日程索引
                        this.currentScheduleIdx = -1;
                        this.scheduleReached = false;
                        if (game.addEvent) {
                            game.addEvent(`😴 ${this.name} 累坏了，提前回家睡觉 (体力:${Math.round(this.stamina)})`);
                        }
                        return;
                    }
                }
                // 在宿舍但还没到床位 → 继续走
                if (!this.isMoving && this.currentPath.length === 0) {
                    const bedLoc2 = SCHEDULE_LOCATIONS[this.homeName + '_inside'];
                    if (bedLoc2) {
                        this._pathTo(bedLoc2.x, bedLoc2.y, game);
                    }
                }
                return;
            }
        } else if (this._stateOverride === 'sick' || this._stateOverride === 'mental') {
            // 目标：去医疗站 → 到达后开始治疗
            if (this.currentScene === 'medical') {
                this._startTreatment(game);
                return;
            }
        }

        // 还在路上：检查是否卡住
        if (this.isMoving || this.currentPath.length > 0) {
            this._stateOverrideStuckTimer = 0;
            return;
        }

        // 不在移动也没到目标 → 可能卡住了
        this._stateOverrideStuckTimer += 1;
        if (this._stateOverrideStuckTimer > 2) {
            this._stateOverrideStuckTimer = 0;
            this._navigateToScheduleTarget(targetKey, game);
        }

        // 超时兜底：15秒还没到 → 传送
        this._stateOverrideTravelTimer += dt;
        if (this._stateOverrideTravelTimer > 15) {
            this._stateOverrideTravelTimer = 0;
            const overrideType = this._stateOverride;

            if (overrideType === 'exhausted') {
                // 传送到NPC所属宿舍
                const homeDoorLoc = SCHEDULE_LOCATIONS[this.homeName + '_inside'];
                if (homeDoorLoc) {
                    this._teleportTo(this.homeName, homeDoorLoc.x, homeDoorLoc.y);
                } else {
                    this._teleportTo(this.homeName, 6, 4);
                }
            } else {
                // 传送到医疗站
                const doorLoc = SCHEDULE_LOCATIONS['medical_indoor_door'];
                if (doorLoc) {
                    this._teleportTo(doorLoc.scene, doorLoc.x, doorLoc.y, true);
                    const insideLoc = SCHEDULE_LOCATIONS['medical_inside'];
                    if (insideLoc) {
                        this._enterWalkTarget = { x: insideLoc.x, y: insideLoc.y };
                        this._pathTo(insideLoc.x, insideLoc.y, game);
                    }
                } else {
                    this._teleportTo('medical', 5, 4);
                }
            }
            if (game.addEvent) {
                game.addEvent(`⚡ ${this.name} 赶到了目的地（传送兜底）`);
            }
        }
    }

    /** 到达医院后开始治疗 */
    _startTreatment(game) {
        this._isBeingTreated = true;
        this._treatmentTimer = 15; // 治疗持续15真实秒
        this.currentPath = [];
        this.isMoving = false;

        const isMental = (this._stateOverride === 'mental');
        this.stateDesc = isMental ? '正在接受心理咨询' : '正在看病治疗';
        this.expression = isMental ? '跟苏医生聊聊，感觉好多了…' : '苏医生在给我看病…';
        this.expressionTimer = 8;
        this.mood = '期待';

        if (game.addEvent) {
            game.addEvent(`🏥 ${this.name} 开始${isMental ? '心理咨询' : '看病'}`);
        }
    }

    /** 治疗结束 */
    _finishTreatment(game) {
        const isMental = (this._stateOverride === 'mental');

        if (isMental) {
            // 心理咨询：恢复San值
            const sanBefore = this.sanity;
            this.sanity = Math.min(100, this.sanity + 30);
            this.mood = '平静';
            this.expression = '感觉好多了，谢谢苏医生';
            this.stateDesc = '咨询结束，精神好多了';
            this._logDebug('sanity', `💊 心理咨询结束! San: ${Math.round(sanBefore)}→${Math.round(this.sanity)} (+${Math.round(this.sanity - sanBefore)})`);
        } else {
            // 看病：恢复健康值，治愈疾病
            this.health = Math.min(100, this.health + 35);
            this.isSick = false;
            this.sickTimer = 0;
            this.mood = '满足';
            this.expression = '看完医生，身体舒服多了！';
            this.stateDesc = '看完病了，感觉好多了';
            // 花钱看病
            this.savings = Math.max(0, this.savings - 20);
        }

        this.expressionTimer = 6;
        this._isBeingTreated = false;
        this._treatmentTimer = 0;

        // 找到苏医生（如果在同一场景），双方关系加成
        const doctor = game.npcs.find(n => n.name === '苏医生' && n.currentScene === this.currentScene);
        if (doctor && doctor.id !== this.id) {
            this.changeAffinity(doctor.id, 5);
            doctor.changeAffinity(this.id, 3);
            if (game.addEvent) {
                game.addEvent(`💕 ${this.name} 和苏医生的关系因${isMental ? '咨询' : '看病'}变好了`);
            }
        }

        if (game.addEvent) {
            game.addEvent(`✅ ${this.name} ${isMental ? '咨询' : '治疗'}结束 (健康:${Math.round(this.health)} San:${Math.round(this.sanity)})`);
        }

        this._clearStateOverride();
        // 重置日程索引，让日程系统重新接管
        this.currentScheduleIdx = -1;
        this.scheduleReached = false;
    }

    /** 清除状态覆盖 */
    _clearStateOverride() {
        this._stateOverride = null;
        this._stateOverrideTarget = null;
        this._stateOverrideStuckTimer = 0;
        this._stateOverrideTravelTimer = 0;
        this._stateOverrideMaxTimer = 0;
    }

    // ============ 发呆兜底检测系统 ============

    /**
     * 全局发呆兜底检测与自动恢复
     * 当NPC连续10秒处于"无任何系统驱动"的空闲状态时，强制恢复行为
     */
    _updateIdleWatchdog(dt, game) {
        // 检测条件：NPC处于"黑洞状态"——没有任何系统在驱动它行动
        const isIdleBlackHole = (
            this.state !== 'CHATTING' &&
            !this.isMoving &&
            this.currentPath.length === 0 &&
            !this.isSleeping &&
            !this.isEating &&
            !(this._taskOverride && this._taskOverride.isActive) &&
            !this._actionOverride &&
            !this._stateOverride &&
            !this._hungerOverride &&
            !this._walkingToDoor &&
            !this._isBeingTreated &&
            !this._yieldMove &&
            !this._chatWalkTarget &&
            !this.isCrazy
        );

        if (isIdleBlackHole) {
            this._idleWatchdogTimer += dt;
        } else {
            this._idleWatchdogTimer = 0;
            return;
        }

        // 连续10秒发呆，触发恢复
        if (this._idleWatchdogTimer > 10) {
            // 输出详细状态快照
            console.warn(`[NPC-${this.name}] [兜底] 发呆超时${Math.round(this._idleWatchdogTimer)}秒，触发自动恢复`, {
                actionOverride: this._actionOverride,
                actionTarget: this._actionTarget,
                stateOverride: this._stateOverride,
                hungerOverride: this._hungerOverride,
                taskOverride: this._taskOverride ? {
                    isActive: this._taskOverride.isActive,
                    taskId: this._taskOverride.taskId,
                    targetLocation: this._taskOverride.targetLocation
                } : null,
                priorityOverride: this._priorityOverride,
                scheduleReached: this.scheduleReached,
                currentScheduleIdx: this.currentScheduleIdx,
                scene: this.currentScene,
                pos: this.getGridPos()
            });

            // 清除所有可能残留的覆盖状态
            this._clearActionOverride();
            this._clearStateOverride();
            this._hungerOverride = false;
            this._hungerTarget = null;
            this._hungerStuckTimer = 0;
            this._hungerTravelTimer = 0;

            // 强制日程系统重新评估
            this.currentScheduleIdx = -1;
            this.scheduleReached = false;

            // 如果有被暂停的任务，优先恢复任务
            if (this._taskOverride && this._taskOverride.targetLocation && this._taskOverride.taskId) {
                this._taskOverride.isActive = true;
                this._taskOverrideReached = false;
                this._taskOverrideStuckTimer = 0;
                this._taskOverrideTravelTimer = 0;
                this._logDebug('schedule', `[兜底] ${this.name} 恢复被暂停的任务: ${this._taskOverride.taskId}`);
                this._navigateToScheduleTarget(this._taskOverride.targetLocation, game);
            }

            // 通知事件
            if (game && game.addEvent) {
                game.addEvent(`⚠️ ${this.name} 回过神来`);
            }

            this._logDebug('schedule', `[兜底] ${this.name} 发呆超时，强制恢复日程`);
            this._idleWatchdogTimer = 0;

            // 累计触发计数
            this._idleWatchdogCount++;
            const now = Date.now();
            if (now - this._idleWatchdogResetTime > 60000) {
                // 超过60秒，重置计数
                this._idleWatchdogCount = 1;
                this._idleWatchdogResetTime = now;
            }

            // 同一NPC在60秒内连续触发超过3次，强制传送到暖炉广场
            if (this._idleWatchdogCount > 3) {
                const furnaceLoc = SCHEDULE_LOCATIONS['furnace_plaza'];
                if (furnaceLoc) {
                    console.warn(`[NPC-${this.name}] [兜底] 60秒内发呆超过3次，强制传送到暖炉广场`);
                    this._teleportTo(furnaceLoc.scene, furnaceLoc.x, furnaceLoc.y);
                    this._idleWatchdogCount = 0;
                    if (game && game.addEvent) {
                        game.addEvent(`🚨 ${this.name} 被传送到暖炉广场（反复发呆）`);
                    }
                }
            }
        }
    }

    // ============ LLM行动决策系统 ============

    /** 可选目标位置列表（供LLM选择） */
    static get ACTION_TARGETS() {
        return {
            'warehouse_door':  '仓库（领取物资、整理库存）',
            'medical_door':    '医疗站（看病、心理咨询、找苏岩）',
            'dorm_a_door':     '宿舍A（休息、睡觉）',
            'dorm_b_door':     '宿舍B（休息、睡觉）',
            'kitchen_door':    '炊事房（吃饭、聊天、取暖）',
            'workshop_door':   '工坊（维修、制作工具、学习）',
            'furnace_plaza':   '暖炉广场（取暖、看演出、和人聊天）',
            'lumber_yard':     '伐木场（砂柴、伐木）',
            'ruins':           '废墟（探索、搜寻物资）',
        };
    }

    /** 行动类型列表 */
    static get ACTION_TYPES() {
        return ['go_to', 'rest', 'eat', 'work', 'accompany', 'stay', 'wander'];
    }

    /**
     * LLM行动决策 — 独立的AI调用，决定NPC下一步行动
     * 与think()是两个独立调用，信息汇总后决策
     */
    async _actionDecision(game) {
        if (this._actionDecisionCooldown > 0) return;
        if (this.state === 'CHATTING') return;
        if (this.isSleeping) return;
        if (this.isCrazy) return; // 发疯中不做决策
        if (this.isSeekingShelter) return;
        if (this._isBeingTreated) return;
        if (this.isEating) return;
        // 如果已有行动在执行中，跳过决策（防止新决策打断正在执行的行动，导致"走一半转头"）
        if (this._actionOverride && this._currentAction) return;
        // 【修复】正在走向聊天目标时，不做新的行动决策（防止打断社交走路）
        if (this._chatWalkTarget) return;

        this._actionDecisionCooldown = this._actionDecisionInterval;

        const map = game.maps[this.currentScene];
        const pos = this.getGridPos();
        const hour = game.getHour();
        const isLateNight = this._isBedtime(hour);

        // 构建环境信息
        const envDesc = map ? map.describe(pos.x, pos.y) : this.currentScene;
        const nearby = this._getNearbyNPCs(game, 16);
        const nearbyStr = nearby.length > 0
            ? nearby.map(n => {
                const tags = [];
                if (n.isSick) tags.push('生病');
                if (n.health < 25) tags.push('健康差');
                if (n.stamina < 15) tags.push('疲惫');
                if (n.sanity < 25) tags.push('精神差');
                if (n.hunger < 20) tags.push('很饿');
                if (n.isCrazy) tags.push('发疯');
                const tagStr = tags.length > 0 ? `(${tags.join('、')})` : '';
                return `${n.name}${tagStr}`;
            }).join('、')
            : '附近没有人';

        // 当前日程信息
        const sched = this.scheduleTemplate;
        let currentScheduleDesc = '无日程';
        for (let i = 0; i < sched.length; i++) {
            const s = sched[i];
            const inRange = s.start <= s.end
                ? (hour >= s.start && hour < s.end)
                : (hour >= s.start || hour < s.end);
            if (inRange) {
                currentScheduleDesc = `${s.start}:00-${s.end}:00 ${s.desc}（目标：${s.target}）`;
                break;
            }
        }

        // 最近记忆
        const recentMemories = this.memories.slice(-5).map(m => `[${m.time}] ${m.text}`).join('\n');

        // think方法上次的思考
        const lastThought = this._lastActionThought || '暂无';

        // 可选目标列表
        const targetList = Object.entries(NPC.ACTION_TARGETS)
            .map(([key, desc]) => `  "${key}": ${desc}`)
            .join('\n');

        // 同场景所有NPC状态
        const allNPCStatus = game.npcs
            .filter(n => n.id !== this.id)
            .map(n => {
                const tags = [];
                if (n.isSick) tags.push('生病');
                if (n.health < 25) tags.push('健康差');
                if (n.stamina < 20) tags.push('疲惫');
                if (n.sanity < 30) tags.push('精神差');
                if (n.hunger < 25) tags.push('饿');
                if (n.isCrazy) tags.push('发疯');
                if (n.isSleeping) tags.push('睡觉中');
                const tagStr = tags.length > 0 ? `[${tags.join('、')}]` : '[正常]';
                // 标注关系
                const aff = this.getAffinity(n.id);
                let relTag = '';
                if (aff >= 90) relTag = '❤️挚友';
                else if (aff >= 70) relTag = '💛好友';
                else if (aff >= 50) relTag = '友好';
                return `${n.name}(${n.getStatusLine()}) ${tagStr} 关系:${relTag || '一般'}`;
            }).join('\n');

        // 【挚友紧急告警】检测好友/挚友中是否有人精神状态极差
        const friendsInCrisis = game.npcs.filter(n => 
            n.id !== this.id && !n.isSleeping && this.getAffinity(n.id) >= 70
            && (n.sanity < 25 || n.isCrazy)
        );
        let friendCrisisHint = '';
        if (friendsInCrisis.length > 0 && this.sanity >= 40) {
            friendCrisisHint = `\n\n🚨🚨 紧急关心提醒：你的好朋友${friendsInCrisis.map(f => {
                const aff = this.getAffinity(f.id);
                const rel = aff >= 90 ? '挚友' : '好友';
                return `${f.name}（${rel}，San值:${Math.round(f.sanity)}${f.isCrazy ? '，正在发疯！' : ''}，在${f.getSceneLabel()}）`;
            }).join('、')}状态非常差！作为ta的朋友，你应该立刻去找ta，关心ta、安慰ta、陪ta去看医生。请在action中选择go_to前往ta所在的位置！`;
        }

        const systemPrompt = `你是「${this.name}」的行动决策AI。世界末日来临，极端寒冷天气侵袭小镇。你需要根据角色的当前状态、生存环境和人际关系，决定角色下一步应该做什么。

角色信息：
- 姓名：${this.name}，${this.age}岁，${this.occupation}
- 性格：${this.personality}
- 当前心情：${this.mood}
${game.weatherSystem ? `\n【生存状况】${game.weatherSystem.getSurvivalSummary()}` : ''}
${game.weatherSystem && game.weatherSystem.getBlizzardUrgencyForPrompt ? `\n${game.weatherSystem.getBlizzardUrgencyForPrompt()}` : ''}
${game.resourceSystem ? `资源: ${game.resourceSystem.getResourceStatusForPrompt()}` : ''}
${game.resourceSystem && game.resourceSystem.getUrgencyPrompt ? game.resourceSystem.getUrgencyPrompt() : ''}
${game.taskSystem ? `你的任务: ${game.taskSystem.getNpcTaskDescForPrompt(this.id)}` : ''}
${this.bodyTemp < 35 ? `🚨 你正在失温！体温: ${this.bodyTemp.toFixed(1)}°C` : ''}
${game.reincarnationSystem && game.reincarnationSystem.getLifeNumber() > 1 ? game.reincarnationSystem.getPastLifeHintForThinking(game.mode === 'reincarnation') : ''}

决策规则：
1. 你的首要目标是在末日中存活。其次是帮助同伴存活。
2. 你有被分配的生存任务（见「你的任务」），应该优先完成任务。任务完成情况直接影响全镇生存。
3. 🚨如果体力<30/健康<30/体温<35°C，必须立即回暖炉旁休息！priority=urgent！
4. 🚨如果精神<20，必须立刻恢复精神！否则你会发疯攻击朋友！priority=urgent！
5. 如果很饿，应该去吃饭，priority=urgent。
6. ${game.weatherSystem && !game.weatherSystem.canGoOutside() ? '🚨🚨 今天-60°C严禁外出！所有行动必须在室内！选择任何户外目标都等于去送死！' : ''}
7. ${game.weatherSystem && game.weatherSystem.currentDay === 2 ? '⚠️ 户外连续工作不得超过2小时！超时会严重冻伤！' : ''}
8. 如果有同伴倒下（严重失温/昏厥），你应该去救援他们。
9. 优先级：生存紧急需求 > 任务完成 > 健康恢复 > 日常日程。
10. type="work"表示你按当前日程/任务行动。但身心状态差时绝不要选work！
11. priority说明：urgent=生存紧急（生死相关）, normal=立即执行, low=仅记录意向。
12. 下雨/大雪/暴风雪时不要去户外，应该选择室内场所。

可选目标位置：
${targetList}

行动类型说明：
- go_to: 前往某地（必须指定target）
- rest: 回家休息/睡觉
- eat: 去炊事房吃饭（target选kitchen_door）
- work: 继续按日程/任务行动（不需要target）
- accompany: 陪伴某人去某地（必须指定target和companion）
- stay: 留在原地
- wander: 随便走走`;

        const userPrompt = `当前时间：第${game.dayCount}天 ${game.getTimeStr()} ${game.getTimePeriod()}
天气：${game.weatherSystem ? game.weatherSystem.getWeatherStr() : game.weather}
温度：${game.weatherSystem ? game.weatherSystem.getEffectiveTemp() + '°C' : '未知'}
位置：${envDesc}
附近的人：${nearbyStr}

【你的状态】
当前位置：${this.getSceneLabel()}（${this.currentScene}）
状态摘要：${this.getStatusLine()}
体力：${Math.round(this.stamina)}/100（${this.getStaminaLevel()}）${this.stamina < 20 ? ' 🚨极低！' : ''}
健康：${Math.round(this.health)}/100${this.isSick ? ' 🤒生病中' : ''}${this.health < 35 ? ' 🚨危险！' : ''}
精神：${Math.round(this.sanity)}/100${this.sanity < 25 ? ' 🚨极度危险！可能随时发疯！' : (this.sanity < 35 ? ' ⚠️警告！' : '')}
饱食：${Math.round(this.hunger)}/100（${this.getHungerStatus()}）${this.hunger < 25 ? ' 🚨很饿！' : ''}
体温：${this.bodyTemp ? this.bodyTemp.toFixed(1) + '°C' : '36.5°C'}${this.bodyTemp < 35 ? ' 🚨失温！' : ''}${this.bodyTemp < 30 ? ' 🧊严重失温！' : ''}
${game.deathSystem && game.deathSystem.isNpcGrieving(this.id) ? '⚠️ 你正处于悲痛状态（效率降低）' : ''}
存款：${Math.round(this.savings)}元
${this.getGoalsSummary() ? `\n【你的目标】\n${this.getGoalsSummary()}\n→ 完成目标可以获得属性奖励（包括San值、魅力等），请主动朝目标努力！` : ''}

【当前日程（仅供参考，你可以自由决定是否遵循）】${currentScheduleDesc}
【最近想法】${lastThought}
【最近记忆】
${recentMemories || '（暂无）'}

【全镇NPC状态】
${allNPCStatus}
${friendCrisisHint}

请决定你的下一步行动。先分析当前面临的奖励机会和惩罚威胁，再做决策。用纯JSON回复：
{
  "threat_analysis": "当前面临的最大威胁/惩罚是什么？（如：San值过低即将发疯、健康差体力恢复慢、饥饿等；如果没有就写'无明显威胁'）",
  "opportunity_analysis": "当前最接近完成的目标奖励机会是什么？（如：还差1人就完成聊天目标、工作时长快达标等；如果没有就写'无特别机会'）",
  "reasoning": "综合奖惩分析的决策理由（一句话）",
  "action": {
    "type": "go_to|rest|eat|work|accompany|stay|wander",
    "target": "目标位置key（从可选列表选，type为work/stay/wander时可省略）",
    "reason": "行动原因（简短）",
    "priority": "urgent|normal|low",
    "companion": "想邀请同行的人名（可选，没有就不填这个字段）"
  }
}}`;

        try {
            const raw = await callLLM(systemPrompt, userPrompt, 500);  // 14B模型需要更多token空间

            // 【关键修复】await期间NPC可能已被设为CHATTING，不应再执行行动决策
            if (this.state === 'CHATTING') {
                this._logDebug('action', `行动决策返回时已在CHATTING，放弃决策结果`);
                return;
            }

            const parsed = parseLLMJSON(raw);
            if (parsed && parsed.action) {
                const action = parsed.action;

                // 校验action.type
                if (!NPC.ACTION_TYPES.includes(action.type)) {
                    console.warn(`[行动决策] ${this.name} 返回无效action.type: ${action.type}`);
                    return;
                }

                // 校验target（如果需要）
                if (['go_to', 'eat', 'accompany'].includes(action.type)) {
                    if (!action.target || !NPC.ACTION_TARGETS[action.target]) {
                        // 允许 rest 不需要target（自动导航到家）
                        if (action.type !== 'rest') {
                            console.warn(`[行动决策] ${this.name} 返回无效target: ${action.target}`);
                            return;
                        }
                    }
                }

                // 过了就寝时间强制rest（每个NPC就寝时间不同）
                if (isLateNight && action.type !== 'rest' && action.type !== 'stay') {
                    action.type = 'rest';
                    action.target = this.homeName + '_door';
                    action.reason = '该回宿舍睡觉了';
                    action.priority = 'normal';
                }

                // 【修复】白天(6:00~21:00)拦截rest决策，除非体力极低或生病
                if (!isLateNight && action.type === 'rest') {
                    const reallyNeedRest = this.stamina < 15 || this.isSick || this.health < 20;
                    if (!reallyNeedRest) {
                        console.log(`[行动决策] ${this.name} 白天想rest但身体状况良好，改为stay`);
                        action.type = 'stay';
                        action.reason = '继续当前活动';
                    }
                }

                // 下雨时修正户外目标
                if (game.isRaining() && action.target && NPC.OUTDOOR_TARGETS.has(action.target)) {
                    const alts = NPC.RAIN_INDOOR_ALTERNATIVES;
                    const alt = alts[Math.floor(Math.random() * alts.length)];
                    action.target = alt.target;
                    action.reason += '（下雨了，改去室内）';
                }

                // 记录决策理由
                if (parsed.reasoning) {
                    this._lastActionThought = parsed.reasoning;
                }

                // 【奖惩分析日志】记录LLM的威胁/机会分析
                const threatStr = parsed.threat_analysis || '未分析';
                const oppoStr = parsed.opportunity_analysis || '未分析';
                this._logDebug('reward', `⚖️ 奖惩分析 → 威胁:「${threatStr}」 机会:「${oppoStr}」`);

                console.log(`[行动决策] ${this.name}: type=${action.type} target=${action.target} priority=${action.priority} companion=${action.companion || '无'} 理由：${action.reason}`);
                console.log(`[奖惩分析] ${this.name}: 威胁="${threatStr}" 机会="${oppoStr}"`);
                // 【Debug日志】记录行动决策
                this._logDebug('action', `决策:${action.type} 目标:${action.target || '无'} 优先级:${action.priority} 同伴:${action.companion || '无'} 理由:${action.reason}${parsed.reasoning ? ' 思考:' + parsed.reasoning : ''}`);

                // 根据优先级处理
                // 【优化】urgent和normal都立即执行，让GLM决策优先于普通日程
                if (action.priority === 'urgent' || action.priority === 'normal') {
                    // 如果当前有其他覆盖状态（饥饿/生病等），normal降级为pending
                    if (action.priority === 'normal' && (this._stateOverride || this._hungerOverride || this._isBeingTreated)) {
                        this._pendingAction = action;
                    } else {
                        this._executeAction(action, game);
                    }
                } else {
                    // low优先级：仅记录意向
                    this.addMemory(`[意向] ${action.reason}`);
                }

                // 事件日志
                if (game.addEvent) {
                    const emoji = action.priority === 'urgent' ? '🚨' : '🤔';
                    game.addEvent(`${emoji} ${this.name} 决定：${action.reason}`);
                }
            }
        } catch (err) {
            console.error(`[行动决策] ${this.name} 调用失败:`, err);
        }
    }

    /**
     * 执行行动指令 — 将LLM返回的action转化为实际的NPC行为
     */
    _executeAction(action, game) {
        // 【关键修复】对话中不执行行动决策（但urgent可以打断）
        if (this.state === 'CHATTING') {
            if (action.priority === 'urgent') {
                console.log(`[行动决策] ${this.name} urgent行动打断CHATTING`);
                this._forceEndChat();
            } else {
                this._logDebug('action', `CHATTING中，放弃执行行动: ${action.type}`);
                return;
            }
        }

        // 【任务6】go_to采集区时自动转化为taskOverride（P1层）
        const gatherTargets = {
            'lumber_camp': 'woodFuel',
            'lumber_camp_door': 'woodFuel',
            'frozen_lake': 'food',
            'frozen_lake_door': 'food',
            'ruins_site': 'material',
            'ruins_site_door': 'material',
            'workshop_door': 'power'
        };
        if (action.type === 'go_to' && action.target && gatherTargets[action.target]) {
            const resType = gatherTargets[action.target];
            const targetLoc = action.target.replace(/_door$/, '');
            const validTarget = SCHEDULE_LOCATIONS[targetLoc] ? targetLoc : action.target;
            const taskId = `action_gather_${resType}_${Date.now()}`;
            const priority = action.priority === 'urgent' ? 'urgent' : 'high';
            
            console.log(`[action→taskOverride] ${this.name}: go_to ${action.target} → taskOverride(${validTarget}, ${priority}, ${resType})`);
            this.activateTaskOverride(taskId, validTarget, priority, resType);
            return; // taskOverride会接管后续导航
        }

        // 清除之前的行动状态
        this._clearActionOverride();

        // 【修复】清除社交走路目标（行动执行优先于社交意愿）
        if (this._chatWalkTarget) {
            this._logDebug('chat', `行动执行(${action.type})打断了走向聊天目标的路径`);
            this._chatWalkTarget = null;
        }

        this._currentAction = action;
        this._actionOverride = true;
        this._actionStuckTimer = 0;
        this._actionTravelTimer = 0;
        // 【Debug日志】记录行动执行
        this._logDebug('action', `执行行动: ${action.type} → ${action.target || '无目标'} 理由:${action.reason}`);

        // 清除当前移动路径
        this.currentPath = [];
        this.isMoving = false;
        this._pendingEnterScene = null;

        switch (action.type) {
            case 'go_to':
                this._actionTarget = { target: action.target, desc: action.reason };
                this.stateDesc = action.reason;
                this._navigateToScheduleTarget(action.target, game);
                this.scheduleReached = false;
                break;

            case 'rest':
                this._actionTarget = { target: this.homeName + '_door', desc: '回宿舍休息' };
                this.stateDesc = '回宿舍休息';
                this._navigateToScheduleTarget(this.homeName + '_door', game);
                this.scheduleReached = false;
                break;

            case 'eat':
                // 复用饥饿系统
                this._actionTarget = { target: action.target || 'kitchen_door', desc: action.reason || '去吃饭' };
                this.stateDesc = action.reason || '去吃饭';
                this._hungerOverride = true;
                this._hungerTarget = { target: action.target || 'kitchen_door', desc: action.reason || '去吃饭' };
                this._navigateToScheduleTarget(action.target || 'kitchen_door', game);
                this.scheduleReached = false;
                break;

            case 'accompany':
                if (action.companion) {
                    this._initiateCompanion(action, game);
                } else {
                    // 没有companion，退化为go_to
                    this._actionTarget = { target: action.target, desc: action.reason };
                    this.stateDesc = action.reason;
                    this._navigateToScheduleTarget(action.target, game);
                    this.scheduleReached = false;
                }
                break;

            case 'work':
                // 恢复日程
                this._clearActionOverride();
                this.currentScheduleIdx = -1; // 强制日程系统重新评估
                this.scheduleReached = false;
                return;

            case 'stay':
                this.stateDesc = action.reason || '待在原地';
                this._clearActionOverride();
                return;

            case 'wander': {
                // 在当前场景随机走
                this.stateDesc = action.reason || '随便走走';
                const map = game.maps[this.currentScene];
                if (map) {
                    const pos = this.getGridPos();
                    const dx = Math.floor(Math.random() * 9) - 4;
                    const dy = Math.floor(Math.random() * 9) - 4;
                    const tx = Math.max(0, Math.min(map.cols - 1, pos.x + dx));
                    const ty = Math.max(0, Math.min(map.rows - 1, pos.y + dy));
                    if (!map.isSolid(tx * TILE + TILE / 2, ty * TILE + TILE / 2)) {
                        this.currentPath = findPath(pos.x, pos.y, tx, ty, map) || [];
                        this.pathIndex = 0;
                        this.state = 'WALKING';
                    }
                }
                this._clearActionOverride();
                return;
            }
        }

        // 处理companion邀请
        if (action.companion && action.type !== 'accompany') {
            // 非accompany类型但指定了companion，也尝试邀请
            this._tryInviteCompanion(action.companion, action.target, game);
        }

        // 设置表情
        if (action.reason) {
            this.expression = action.reason;
            this.expressionTimer = 6;
        }

        this.addMemory(`[行动] ${action.reason}`);
    }

    /**
     * 发起陪伴行动 — 邀请另一个NPC一起去某地
     */
    _initiateCompanion(action, game) {
        const companion = game.npcs.find(n => n.name === action.companion && n.id !== this.id);
        if (!companion) {
            // 找不到这个人，退化为独自前往
            this._actionTarget = { target: action.target, desc: action.reason };
            this.stateDesc = action.reason;
            this._navigateToScheduleTarget(action.target, game);
            this.scheduleReached = false;
            return;
        }

        // 检查companion是否可被邀请（不在聊天、不在睡觉、不在治疗中、不在发疯）
        const canInvite = !companion.isSleeping && companion.state !== 'CHATTING' 
            && !companion._isBeingTreated && !companion.isCrazy
            && !companion._isCompanion; // 不能连锁邀请

        if (!canInvite) {
            // companion不可用，独自前往
            this.expression = `想叫${companion.name}一起，但${companion.name}现在不方便…`;
            this.expressionTimer = 5;
            this._actionTarget = { target: action.target, desc: action.reason };
            this.stateDesc = action.reason;
            this._navigateToScheduleTarget(action.target, game);
            this.scheduleReached = false;
            return;
        }

        // 检查距离（同场景或相邻才能邀请）
        const isSameScene = companion.currentScene === this.currentScene;
        if (!isSameScene) {
            this.expression = `${companion.name}不在附近，只好自己去了`;
            this.expressionTimer = 5;
            this._actionTarget = { target: action.target, desc: action.reason };
            this.stateDesc = action.reason;
            this._navigateToScheduleTarget(action.target, game);
            this.scheduleReached = false;
            return;
        }

        // 成功邀请！
        this._companionTarget = companion.id;
        this._actionTarget = { target: action.target, desc: action.reason };
        this.stateDesc = `和${companion.name}一起${action.reason}`;
        this.expression = `${companion.name}，一起去${NPC.ACTION_TARGETS[action.target] || action.target}吧！`;
        this.expressionTimer = 6;

        // 给companion注入跟随任务
        companion._isCompanion = true;
        companion._companionLeader = this.id;
        companion._companionDestination = action.target;
        companion._actionOverride = true;
        companion._currentAction = { ...action, type: 'go_to', reason: `陪${this.name}一起去` };
        companion._actionTarget = { target: action.target, desc: `陪${this.name}去${action.reason}` };
        companion.stateDesc = `跟着${this.name}一起走`;
        companion.expression = `好啊，一起去！`;
        companion.expressionTimer = 5;
        companion.currentPath = [];
        companion.isMoving = false;
        companion._pendingEnterScene = null;
        companion.scheduleReached = false;

        // 双方都导航到目标
        this._navigateToScheduleTarget(action.target, game);
        this.scheduleReached = false;
        companion._navigateToScheduleTarget(action.target, game);

        // 好感度增加
        this.changeAffinity(companion.id, 3);
        companion.changeAffinity(this.id, 3);

        // 事件日志
        if (game.addEvent) {
            game.addEvent(`🤝 ${this.name} 邀请 ${companion.name} 一起去${NPC.ACTION_TARGETS[action.target] || action.target}`);
        }

        this.addMemory(`[同行] 邀请${companion.name}一起去${action.reason}`);
        companion.addMemory(`[同行] 被${this.name}邀请一起去${action.reason}`);
    }

    /**
     * 尝试邀请某人同行（非accompany类型时的简化版）
     */
    _tryInviteCompanion(companionName, targetKey, game) {
        const companion = game.npcs.find(n => n.name === companionName && n.id !== this.id);
        if (!companion) return;
        if (companion.currentScene !== this.currentScene) return;
        if (companion.isSleeping || companion.state === 'CHATTING' || companion._isBeingTreated || companion.isCrazy || companion._isCompanion) return;

        // 简化版邀请：给companion设置跟随
        companion._isCompanion = true;
        companion._companionLeader = this.id;
        companion._companionDestination = targetKey;
        companion._actionOverride = true;
        companion._actionTarget = { target: targetKey, desc: `跟${this.name}同行` };
        companion.stateDesc = `跟着${this.name}一起走`;
        companion.currentPath = [];
        companion.isMoving = false;
        companion.scheduleReached = false;
        companion._navigateToScheduleTarget(targetKey, game);

        this.changeAffinity(companion.id, 2);
        companion.changeAffinity(this.id, 2);

        if (game.addEvent) {
            game.addEvent(`🤝 ${companion.name} 跟着 ${this.name} 一起走`);
        }
    }

    /**
     * 更新行动覆盖状态 — 在update循环中调用
     * 检查行动是否到达、是否卡住、是否超时
     */
    _updateActionOverride(dt, game) {
        // 冷却递减
        if (this._actionDecisionCooldown > 0) this._actionDecisionCooldown -= dt;

        // 检查pending action（被降级的行动，在覆盖状态解除后立即执行）
        if (this._pendingAction && !this._actionOverride && !this._stateOverride && !this._hungerOverride && !this._isBeingTreated) {
            const pa = this._pendingAction;
            this._pendingAction = null;
            this._executeAction(pa, game);
        }

        // 同伴模式到达检测
        if (this._isCompanion && this._companionDestination) {
            this._checkCompanionArrival(dt, game);
        }

        // 行动覆盖中 → 检查到达和卡住
        // 【一致性保护】检测_actionOverride与_actionTarget状态不一致
        if (this._actionOverride && !this._actionTarget) {
            console.warn(`[NPC-${this.name}] [一致性修复] _actionOverride=true但_actionTarget=null，自动清除`);
            this._clearActionOverride();
            return;
        }
        if (!this._actionOverride && this._actionTarget) {
            console.warn(`[NPC-${this.name}] [一致性修复] _actionOverride=false但_actionTarget存在，清理_actionTarget`);
            this._actionTarget = null;
        }
        if (!this._actionOverride || !this._actionTarget) return;

        // 【关键修复】CHATTING状态下暂停行动覆盖的到达检测和传送，防止对话中被传送走导致隔空聊天
        if (this.state === 'CHATTING') return;

        const targetKey = this._actionTarget.target;
        const loc = SCHEDULE_LOCATIONS[targetKey];
        if (!loc) {
            this._clearActionOverride();
            return;
        }

        // 检查是否到达
        const isDoorTarget = targetKey.endsWith('_door');
        const doorToScene = {
            warehouse_door: 'warehouse', medical_door: 'medical',
            dorm_a_door: 'dorm_a', dorm_b_door: 'dorm_b',
            kitchen_door: 'kitchen', workshop_door: 'workshop',
        };

        if (isDoorTarget) {
            const insideScene = doorToScene[targetKey];
            if (insideScene && this.currentScene === insideScene) {
                // 已在目标室内场景，但不能立即判定到达
                // 需要检查是否走到了室内座位（否则NPC会卡在门口）
                const insideKey = insideScene + '_inside';
                let insideLoc = SCHEDULE_LOCATIONS[insideKey];
                
                // 优先使用已分配的座位目标
                if (this._enterWalkTarget) {
                    insideLoc = { scene: insideScene, x: this._enterWalkTarget.x, y: this._enterWalkTarget.y };
                } else {
                    const seatLoc = this._pickIndoorSeat(insideScene, game);
                    if (seatLoc) insideLoc = { scene: insideScene, x: seatLoc.x, y: seatLoc.y };
                }
                
                if (insideLoc) {
                    const pos = this.getGridPos();
                    const distToInside = Math.abs(pos.x - insideLoc.x) + Math.abs(pos.y - insideLoc.y);
                    if (distToInside <= 3) {
                        // 已到达室内座位，标记行动完成
                        this._onActionArrived(game);
                        return;
                    } else if (!this.isMoving && this.currentPath.length === 0) {
                        // 在门口但没在移动，导航到座位
                        this._enterWalkTarget = { x: insideLoc.x, y: insideLoc.y };
                        this._pathTo(insideLoc.x, insideLoc.y, game);
                        return;
                    } else {
                        // 正在走向座位，等待
                        return;
                    }
                } else {
                    // 没有座位定义，直接标记到达
                    this._onActionArrived(game);
                    return;
                }
            }
        } else {
            // 户外目标：检查距离
            if (this.currentScene === loc.scene) {
                const pos = this.getGridPos();
                const dist = Math.abs(pos.x - loc.x) + Math.abs(pos.y - loc.y);
                if (dist <= 4) {
                    this._onActionArrived(game);
                    return;
                }
            }
        }

        // 卡住检测
        if (this.isMoving || this.currentPath.length > 0) {
            this._actionStuckTimer = 0;
            return;
        }

        this._actionStuckTimer += 1;
        if (this._actionStuckTimer > 2) {
            this._actionStuckTimer = 0;
            this._navigateToScheduleTarget(targetKey, game);
        }

        // 超时兜底（20秒）
        this._actionTravelTimer += dt;
        if (this._actionTravelTimer > 20) {
            this._actionTravelTimer = 0;
            // 直接传送到目标
            if (isDoorTarget) {
                const insideScene = doorToScene[targetKey];
                if (insideScene) {
                    const doorKey = insideScene + '_indoor_door';
                    const doorLoc = SCHEDULE_LOCATIONS[doorKey];
                    if (doorLoc) {
                        this._teleportTo(doorLoc.scene, doorLoc.x, doorLoc.y, true);
                        // 传送到门口后，导航到座位（不立即标记到达，下一帧由到达检测处理）
                        let insideLoc = SCHEDULE_LOCATIONS[insideScene + '_inside'];
                        {
                            const seatLoc = this._pickIndoorSeat(insideScene, game);
                            if (seatLoc) insideLoc = { scene: insideScene, x: seatLoc.x, y: seatLoc.y };
                        }
                        if (insideLoc) {
                            this._enterWalkTarget = { x: insideLoc.x, y: insideLoc.y };
                            this._pathTo(insideLoc.x, insideLoc.y, game);
                        }
                    } else {
                        const insideLoc = SCHEDULE_LOCATIONS[insideScene + '_inside'];
                        if (insideLoc) this._teleportTo(insideLoc.scene, insideLoc.x, insideLoc.y);
                        this._onActionArrived(game);
                    }
                }
            } else if (loc) {
                this._teleportTo(loc.scene, loc.x, loc.y);
                this._onActionArrived(game);
            }
            if (game.addEvent) {
                game.addEvent(`⚡ ${this.name} 赶到了目的地（行动传送兜底）`);
            }
        }
    }

    /**
     * 行动到达回调 — 执行到达后的特殊逻辑
     */
    _onActionArrived(game) {
        const action = this._currentAction;
        if (!action) {
            this._clearActionOverride();
            return;
        }

        console.log(`[行动到达] ${this.name} 到达: ${action.target} (类型: ${action.type})`);

        // 根据行动类型执行到达后逻辑
        switch (action.type) {
            case 'rest':
                // 到达宿舍 → 检查是否在睡觉时段
                if (this.currentScene === this.homeName) {
                    // 已在宿舍，检查是否到达床位
                    const bedLoc = SCHEDULE_LOCATIONS[this.homeName + '_inside'];
                    if (bedLoc) {
                        const pos = this.getGridPos();
                        const dist = Math.abs(pos.x - bedLoc.x) + Math.abs(pos.y - bedLoc.y);
                        if (dist > 3) {
                            this._pathTo(bedLoc.x, bedLoc.y, game);
                            return;
                        }
                    }                    // 【修复】只在睡觉时段才真正入睡，否则只是休息恢复体力
                    const restHour = game.getHour();
                    const isNightTime = this._isBedtime(restHour);
                    if (isNightTime) {
                        this.isSleeping = true;
                        this.stateDesc = '回家睡觉了';
                        this.expression = 'Zzz...';
                        this.expressionTimer = 8;
                    } else {
                        // 白天只是休息，恢复一些体力，不进入睡眠状态
                        this.stamina = Math.min(100, this.stamina + 15);
                        this.stateDesc = '在家休息了一会儿';
                        this.expression = '休息一下，恢复精力~';
                        this.expressionTimer = 5;
                        console.log(`[行动到达] ${this.name} 白天到家休息，恢复体力但不入睡`);
                    }
                }
                break;

            case 'eat':
                // 到达餐饮场所 → 触发吃饭（复用饥饿系统的_startEating）
                if (!this.isEating) {
                    this._startEating(game);
                }
                break;

            case 'accompany':
            case 'go_to':
                // 普通到达
                this.expression = action.reason || '到了';
                this.expressionTimer = 5;
                // 【修复】accompany到达后自动和companion发起对话
                if (action.type === 'accompany' && this._companionTarget && game.dialogueManager) {
                    const comp = game.npcs.find(n => n.id === this._companionTarget);
                    if (comp && comp.currentScene === this.currentScene 
                        && comp.state !== 'CHATTING' && this.state !== 'CHATTING'
                        && this._canChatWith(comp)) {
                        setTimeout(() => {
                            if (comp.state !== 'CHATTING' && this.state !== 'CHATTING') {
                                game.dialogueManager.startNPCChat(this, comp);
                                if (game.addEvent) {
                                    game.addEvent(`🤝 ${this.name} 到达后和 ${comp.name} 开始聊天`);
                                }
                            }
                        }, 1000);
                    }
                }
                break;
        }

        // 清除行动覆盖，让日程系统重新接管
        this._clearActionOverride();
        this.currentScheduleIdx = -1;
        this.scheduleReached = false;

        if (game.addEvent) {
            game.addEvent(`✅ ${this.name} 完成行动：${action.reason || action.type}`);
        }
    }

    /**
     * 同伴到达检测 — 跟随者到达目的地后的处理
     */
    _checkCompanionArrival(dt, game) {
        if (!this._companionDestination) return;

        const targetKey = this._companionDestination;
        const isDoorTarget = targetKey.endsWith('_door');
        const doorToScene = {
            warehouse_door: 'warehouse', medical_door: 'medical',
            dorm_a_door: 'dorm_a', dorm_b_door: 'dorm_b',
            kitchen_door: 'kitchen', workshop_door: 'workshop',
        };

        let arrived = false;
        if (isDoorTarget) {
            const insideScene = doorToScene[targetKey];
            if (insideScene && this.currentScene === insideScene) arrived = true;
        } else {
            const loc = SCHEDULE_LOCATIONS[targetKey];
            if (loc && this.currentScene === loc.scene) {
                const pos = this.getGridPos();
                const dist = Math.abs(pos.x - loc.x) + Math.abs(pos.y - loc.y);
                if (dist <= 4) arrived = true;
            }
        }

        if (arrived) {
            const leader = game.npcs.find(n => n.id === this._companionLeader);
            if (leader) {
                this.expression = `和${leader.name}一起到了！`;
                this.expressionTimer = 5;
                // 额外好感度奖励
                this.changeAffinity(leader.id, 2);
                leader.changeAffinity(this.id, 2);
                // 【修复】companion到达后自动和leader发起对话
                if (game.dialogueManager && leader.currentScene === this.currentScene
                    && leader.state !== 'CHATTING' && this.state !== 'CHATTING'
                    && this._canChatWith(leader)) {
                    const self = this;
                    setTimeout(() => {
                        if (leader.state !== 'CHATTING' && self.state !== 'CHATTING') {
                            game.dialogueManager.startNPCChat(self, leader);
                            if (game.addEvent) {
                                game.addEvent(`🤝 ${self.name} 和 ${leader.name} 到达后开始聊天`);
                            }
                        }
                    }, 1500);
                }
            }
            this._clearCompanionState();
            this._clearActionOverride();
            this.currentScheduleIdx = -1;
            this.scheduleReached = false;
        }
    }

    /** 清除行动覆盖状态 */
    _clearActionOverride() {
        this._actionOverride = false;
        this._currentAction = null;
        this._actionTarget = null;
        this._actionStuckTimer = 0;
        this._actionTravelTimer = 0;
    }

    /** 清除同伴状态 */
    _clearCompanionState() {
        this._isCompanion = false;
        this._companionLeader = null;
        this._companionDestination = null;
        this._companionTarget = null;
    }

    /** 构建经营上下文信息（店主角色专用） */
    _getBusinessContext(game, nearby) {
        // 只有在工作场所（仓库/工坊/医疗站/炊事房）内才生成经营上下文
        const workplaceScenes = { 'warehouse': '仓库', 'workshop': '工坊', 'medical': '医疗站', 'kitchen': '炊事房' };
        const placeName = workplaceScenes[this.currentScene];
        if (!placeName) return '';
        
        // 检查当前NPC是否是这个场所的主人
        if (this.workplaceName !== this.currentScene) return '';

        // 统计当前场所内除自己外的人数
        const othersHere = game.npcs.filter(n => 
            n.id !== this.id && n.currentScene === this.currentScene && !n.isSleeping
        );
        const customerCount = othersHere.length;
        
        // 更新客流统计
        if (customerCount > 0) {
            this.shopVisitorCount += customerCount; // 累计（简化统计）
            this.shopLastVisitorTime = game.getTimeStr();
            this.shopAloneMinutes = 0;
        } else {
            this.shopAloneMinutes += Math.round(this.aiInterval / 60 * 10); // 每次think约增加对应分钟
        }

        let ctx = `\n【${placeName}经营状况】\n`;
        if (customerCount > 0) {
            ctx += `- 店里目前有${customerCount}位客人：${othersHere.map(n => n.name).join('、')}\n`;
        } else {
            ctx += `- 店里目前没有客人，空无一人\n`;
        }
        ctx += `- 今天累计接待约${this.shopVisitorCount}人次\n`;
        if (this.shopAloneMinutes > 20) {
            ctx += `- 已经连续约${this.shopAloneMinutes}分钟没有客人了\n`;
            ctx += `- 你应该考虑出门到广场/街上招揽客人或找人聊天\n`;
        }
        if (this.shopLastVisitorTime) {
            ctx += `- 上一个客人来的时间：${this.shopLastVisitorTime}\n`;
        } else {
            ctx += `- 今天还没有客人来过\n`;
        }
        return ctx;
    }

    _canChatWith(other) {
        const now = Date.now();
        const lastChat = this.chatCooldowns[other.id] || 0;
        // 哲学家/思考型角色更积极地找人聊天，冷却时间减半
        const cooldown = (this.id === 'old_qian') ? 30000 : 60000;
        if ((now - lastChat) <= cooldown) return false;

        // 【新增】资源紧急度检查 — critical时禁止聊天，warning时大幅降低概率
        const game = this.game || (typeof window !== 'undefined' && window.game);
        if (game && game.resourceSystem) {
            const urgency = game.resourceSystem.getResourceUrgency();
            const hasCritical = urgency.wood === 'critical' || urgency.food === 'critical' || urgency.power === 'critical';
            if (hasCritical) {
                this._logDebug && this._logDebug('chat', `资源critical，禁止与${other.name}聊天`);
                return false;
            }
            const hasWarning = urgency.wood === 'warning' || urgency.food === 'warning' || urgency.power === 'warning';
            if (hasWarning && Math.random() > 0.3) {
                this._logDebug && this._logDebug('chat', `资源warning，聊天概率降低，跳过与${other.name}聊天`);
                return false;
            }
        }
        return true;
    }

    _getNearbyNPCs(game, radius) {
        const pos = this.getGridPos();
        const result = [];
        for (const npc of game.npcs) {
            if (npc.id === this.id) continue;
            if (npc.currentScene !== this.currentScene) continue;
            if (npc.isSleeping) continue; // 跳过睡觉中的NPC
            const np = npc.getGridPos();
            const d = Math.abs(pos.x - np.x) + Math.abs(pos.y - np.y);
            if (d <= radius) {
                // 只提取需要的属性，避免展开整个NPC复杂对象
                result.push({
                    id: npc.id,
                    name: npc.name,
                    dist: d,
                    state: npc.state,
                    stateDesc: npc.stateDesc,
                    isCrazy: npc.isCrazy,
                    isSleeping: npc.isSleeping,
                    occupation: npc.occupation,
                    mood: npc.mood,
                    currentScene: npc.currentScene,
                    // 状态感知：让NPC能感知旁人的身心状态
                    stamina: npc.stamina,
                    health: npc.health,
                    sanity: npc.sanity,
                    isSick: npc.isSick,
                    hunger: npc.hunger,
                    isEating: npc.isEating,
                    _stateOverride: npc._stateOverride,
                    _isBeingTreated: npc._isBeingTreated,
                    // 极寒生存状态感知
                    bodyTemp: npc.bodyTemp,
                    isDead: npc.isDead,
                    isHypothermic: npc.isHypothermic,
                    isSevereHypothermic: npc.isSevereHypothermic,
                    _rescueNeeded: npc._rescueNeeded
                });
            }
        }
        return result.sort((a, b) => a.dist - b.dist);
    }

    // ---- 存档 ----
    serialize() {
        return {
            id: this.id,
            scene: this.currentScene,
            x: this.x,
            y: this.y,
            mood: this.mood,
            memories: this.memories.slice(-10),
            affinity: this.affinity,
            // 六大属性 + San值
            stamina: this.stamina,
            savings: this.savings,
            charisma: this.charisma,
            wisdom: this.wisdom,
            health: this.health,
            empathy: this.empathy,
            sanity: this.sanity,
            isSick: this.isSick,
            isCrazy: this.isCrazy,
            crazyTimer: this.crazyTimer,
            // 极寒生存属性
            bodyTemp: this.bodyTemp,
            isDead: this.isDead,
            _deathCause: this._deathCause,
            _deathTime: this._deathTime,
            isHypothermic: this.isHypothermic,
            isSevereHypothermic: this.isSevereHypothermic,
            hunger: this.hunger,
            // 极端状态持续计时器
            _zeroStaminaDuration: this._zeroStaminaDuration,
            _zeroHungerDuration: this._zeroHungerDuration,
            _zeroCrazyDuration: this._zeroCrazyDuration,
            _hypothermiaDuration: this._hypothermiaDuration,
            _isDying: this._isDying,
            _dyingTimer: this._dyingTimer,
            // 任务驱动覆盖系统
            _taskOverride: { ...this._taskOverride },
            _behaviorPriority: this._behaviorPriority,
        };
    }

    deserialize(data) {
        if (!data) return;
        this.currentScene = data.scene || this.currentScene;
        this.x = data.x ?? this.x;
        this.y = data.y ?? this.y;
        this.mood = data.mood || this.mood;
        if (data.memories) this.memories = data.memories;
        if (data.affinity) this.affinity = data.affinity;
        // 六大属性 + San值恢复
        if (data.stamina !== undefined) this.stamina = data.stamina;
        if (data.savings !== undefined) this.savings = data.savings;
        if (data.charisma !== undefined) this.charisma = data.charisma;
        if (data.wisdom !== undefined) this.wisdom = data.wisdom;
        if (data.health !== undefined) this.health = data.health;
        if (data.empathy !== undefined) this.empathy = data.empathy;
        if (data.sanity !== undefined) this.sanity = data.sanity;
        if (data.isSick !== undefined) this.isSick = data.isSick;
        if (data.isCrazy !== undefined) this.isCrazy = data.isCrazy;
        if (data.crazyTimer !== undefined) this.crazyTimer = data.crazyTimer;
        // 极寒生存属性恢复
        if (data.bodyTemp !== undefined) this.bodyTemp = data.bodyTemp;
        if (data.isDead !== undefined) this.isDead = data.isDead;
        if (data._deathCause !== undefined) this._deathCause = data._deathCause;
        if (data._deathTime !== undefined) this._deathTime = data._deathTime;
        if (data.isHypothermic !== undefined) this.isHypothermic = data.isHypothermic;
        if (data.isSevereHypothermic !== undefined) this.isSevereHypothermic = data.isSevereHypothermic;
        if (data.hunger !== undefined) this.hunger = data.hunger;
        // 极端状态持续计时器恢复
        if (data._zeroStaminaDuration !== undefined) this._zeroStaminaDuration = data._zeroStaminaDuration;
        if (data._zeroHungerDuration !== undefined) this._zeroHungerDuration = data._zeroHungerDuration;
        if (data._zeroCrazyDuration !== undefined) this._zeroCrazyDuration = data._zeroCrazyDuration;
        if (data._hypothermiaDuration !== undefined) this._hypothermiaDuration = data._hypothermiaDuration;
        if (data._isDying !== undefined) this._isDying = data._isDying;
        if (data._dyingTimer !== undefined) this._dyingTimer = data._dyingTimer;
        // 任务驱动覆盖系统恢复
        if (data._taskOverride) {
            this._taskOverride = { ...this._taskOverride, ...data._taskOverride };
        }
        if (data._behaviorPriority) this._behaviorPriority = data._behaviorPriority;
    }
}
