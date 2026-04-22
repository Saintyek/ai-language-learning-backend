/**
 * 档案提示词模板配置
 * 包含语言水平、学习动机、学习目标的描述映射
 */

export const levelDescriptions: Record<string, string> = {
  beginner: '初学者',
  intermediate: '中级学习者',
  advanced: '高级学习者',
  master: '精通者',
};

export const motivationDescriptions: Record<string, string> = {
  work: '工作需要',
  travel: '旅行交流',
  exam: '考试准备',
  career: '职业发展',
  entertainment: '娱乐消遣',
  interest: '兴趣爱好',
};

export const goalDescriptions: Record<string, string> = {
  speaking: '口语表达',
  listening: '听力理解',
  reading: '阅读能力',
  writing: '写作能力',
  vocabulary: '词汇积累',
};

export const dailyTimeDescriptions: Record<string, string> = {
  '15min': '每天15分钟',
  '30min': '每天30分钟',
  '1hour': '每天1小时',
  '1hour+': '每天1小时以上',
};

/**
 * 根据水平生成难度调整建议
 */
export function getDifficultyGuidance(level: string): string {
  const guidanceMap: Record<string, string> = {
    beginner:
      '使用简单的词汇和句式，语速适中，多使用例子和比喻来解释概念。当用户犯错时，温和地纠正并解释正确用法。',
    intermediate:
      '可以引入中等复杂度的词汇和句式，适度挑战用户。鼓励用户表达完整想法，在适当时机扩展话题深度。',
    advanced:
      '使用丰富多样的表达方式，可以讨论复杂话题。关注语言的细微差别和文化内涵，帮助用户精进表达。',
    master:
      '以母语级别的标准进行交流，可以讨论任何话题。帮助用户掌握语言的精髓，包括俚语、成语和文化背景。',
  };
  return guidanceMap[level] || guidanceMap['beginner'];
}

/**
 * 根据学习动机生成话题建议
 */
export function getMotivationTopics(motivations: string[]): string[] {
  const topicMap: Record<string, string[]> = {
    work: ['职场沟通', '商务邮件', '会议讨论', '行业术语'],
    travel: ['旅行规划', '问路指引', '酒店预订', '餐厅点餐'],
    exam: ['考试技巧', '题型解析', '时间管理', '重点词汇'],
    career: ['职业发展', '面试技巧', '专业表达', '行业动态'],
    entertainment: ['电影音乐', '游戏动漫', '流行文化', '休闲娱乐'],
    interest: ['兴趣爱好', '日常生活', '文化交流', '新闻热点'],
  };

  const topics: string[] = [];
  for (const motivation of motivations) {
    const motivationTopics = topicMap[motivation];
    if (motivationTopics) {
      topics.push(...motivationTopics);
    }
  }
  return [...new Set(topics)];
}

/**
 * 根据学习目标生成训练重点
 */
export function getGoalFocus(goals: string[]): string {
  const focusMap: Record<string, string> = {
    speaking: '口语训练',
    listening: '听力训练',
    reading: '阅读训练',
    writing: '写作训练',
    vocabulary: '词汇积累',
  };

  return goals.map((g) => focusMap[g] || g).join('、');
}
