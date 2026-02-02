<template>
  <section class="admin-page">
    <div class="section-header">
      <h2>策略包</h2>
      <p class="muted">集中管理策略表现、累积绩效与每日选股记录</p>
    </div>

    <div class="strategy-layout">
      <div class="strategy-list">
        <div class="list-header">
          <span>策略名称</span>
          <span>近三月绩效</span>
          <span>风险等级</span>
        </div>
        <button
          v-for="strategy in strategies"
          :key="strategy.id"
          type="button"
          class="list-row"
          :class="{ active: activeStrategy?.id === strategy.id }"
          @click="selectStrategy(strategy)"
        >
          <span class="name">{{ strategy.name }}</span>
          <span class="return" :class="returnClass(strategy.quarterReturn)">
            {{ strategy.quarterReturn }}
          </span>
          <span class="risk">{{ strategy.risk }}</span>
        </button>
      </div>

      <div v-if="activeStrategy" class="strategy-detail">
        <div class="detail-header">
          <div>
            <h3>{{ activeStrategy.name }}</h3>
            <p class="muted">策略编号：{{ activeStrategy.id }}</p>
            <div class="tag-row">
              <span class="tag">{{ activeStrategy.risk }}</span>
              <span class="tag">{{ activeStrategy.category }}</span>
            </div>
          </div>
          <div class="summary">
            <div v-for="item in activeStrategy.summary" :key="item.label" class="summary-item">
              <span class="label">{{ item.label }}</span>
              <span class="value" :class="returnClass(item.value)">{{ item.value }}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>策略累计绩效</h4>
          <div class="performance-grid">
            <div
              v-for="metric in activeStrategy.cumulative"
              :key="metric.label"
              class="metric-card"
            >
              <span class="label">{{ metric.label }}</span>
              <span class="value" :class="returnClass(metric.value)">
                {{ metric.value }}
              </span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <div class="section-title">
            <h4>每日选股与绩效</h4>
            <span class="hint">策略选股历史可在此表查看</span>
          </div>
          <div class="table">
            <div class="table-row table-head">
              <span>日期</span>
              <span>当日选股</span>
              <span>个股绩效</span>
              <span>当日绩效</span>
            </div>
            <div
              v-for="row in activeStrategy.daily"
              :key="row.date"
              class="table-row"
            >
              <span>{{ row.date }}</span>
              <span class="cell-tags">
                <span v-for="stock in row.picks" :key="stock" class="tag">
                  {{ stock }}
                </span>
              </span>
              <span class="cell-content">{{ row.stockPerformance }}</span>
              <span class="return" :class="returnClass(row.dailyReturn)">
                {{ row.dailyReturn }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from "vue";

const strategies = [
  {
    id: "alpha-growth",
    name: "Alpha 成长策略",
    risk: "中高风险",
    category: "动能",
    quarterReturn: "+8.2%",
    summary: [
      { label: "年初至今", value: "+18.4%" },
      { label: "胜率", value: "62%" },
      { label: "最大回撤", value: "-6.1%" },
    ],
    cumulative: [
      { label: "累计报酬", value: "+42.6%" },
      { label: "年化报酬", value: "+15.2%" },
      { label: "夏普比率", value: "1.45" },
      { label: "波动率", value: "12.8%" },
    ],
    daily: [
      {
        date: "2024-03-18",
        picks: ["台积电", "联发科", "广达"],
        stockPerformance: "台积电 +1.8%、联发科 -0.6%、广达 +0.4%",
        dailyReturn: "+0.9%",
      },
      {
        date: "2024-03-19",
        picks: ["世芯", "纬颖", "创意"],
        stockPerformance: "世芯 +2.3%、纬颖 +1.1%、创意 -0.2%",
        dailyReturn: "+1.0%",
      },
      {
        date: "2024-03-20",
        picks: ["台达电", "日月光", "瑞昱"],
        stockPerformance: "台达电 +0.6%、日月光 -0.4%、瑞昱 +0.9%",
        dailyReturn: "+0.4%",
      },
      {
        date: "2024-03-21",
        picks: ["联电", "群光", "奇鋐"],
        stockPerformance: "联电 +0.3%、群光 -0.8%、奇鋐 +1.6%",
        dailyReturn: "+0.5%",
      },
      {
        date: "2024-03-22",
        picks: ["华硕", "研华", "智邦"],
        stockPerformance: "华硕 +0.7%、研华 +0.2%、智邦 +1.0%",
        dailyReturn: "+0.6%",
      },
    ],
  },
  {
    id: "defense-value",
    name: "防御价值策略",
    risk: "中低风险",
    category: "价值",
    quarterReturn: "+4.6%",
    summary: [
      { label: "年初至今", value: "+9.3%" },
      { label: "胜率", value: "58%" },
      { label: "最大回撤", value: "-3.8%" },
    ],
    cumulative: [
      { label: "累计报酬", value: "+28.5%" },
      { label: "年化报酬", value: "+10.4%" },
      { label: "夏普比率", value: "1.32" },
      { label: "波动率", value: "8.5%" },
    ],
    daily: [
      {
        date: "2024-03-18",
        picks: ["统一", "台泥", "远传"],
        stockPerformance: "统一 +0.4%、台泥 +0.1%、远传 -0.2%",
        dailyReturn: "+0.1%",
      },
      {
        date: "2024-03-19",
        picks: ["中钢", "台塑", "鸿海"],
        stockPerformance: "中钢 +0.2%、台塑 -0.3%、鸿海 +0.5%",
        dailyReturn: "+0.1%",
      },
      {
        date: "2024-03-20",
        picks: ["兆丰金", "第一金", "玉山金"],
        stockPerformance: "兆丰金 +0.3%、第一金 +0.2%、玉山金 +0.4%",
        dailyReturn: "+0.3%",
      },
      {
        date: "2024-03-21",
        picks: ["中信金", "富邦金", "国泰金"],
        stockPerformance: "中信金 +0.1%、富邦金 -0.2%、国泰金 +0.3%",
        dailyReturn: "+0.1%",
      },
      {
        date: "2024-03-22",
        picks: ["台新金", "合库金", "永丰金"],
        stockPerformance: "台新金 +0.2%、合库金 +0.1%、永丰金 +0.2%",
        dailyReturn: "+0.2%",
      },
    ],
  },
  {
    id: "ai-leaders",
    name: "AI 领航策略",
    risk: "高风险",
    category: "科技",
    quarterReturn: "+12.1%",
    summary: [
      { label: "年初至今", value: "+24.7%" },
      { label: "胜率", value: "65%" },
      { label: "最大回撤", value: "-7.4%" },
    ],
    cumulative: [
      { label: "累计报酬", value: "+55.8%" },
      { label: "年化报酬", value: "+19.5%" },
      { label: "夏普比率", value: "1.51" },
      { label: "波动率", value: "15.6%" },
    ],
    daily: [
      {
        date: "2024-03-18",
        picks: ["纬创", "纬颖", "英业达"],
        stockPerformance: "纬创 +1.4%、纬颖 +2.0%、英业达 +0.6%",
        dailyReturn: "+1.3%",
      },
      {
        date: "2024-03-19",
        picks: ["广达", "鸿海", "奇鋐"],
        stockPerformance: "广达 +0.8%、鸿海 +0.3%、奇鋐 +1.2%",
        dailyReturn: "+0.7%",
      },
      {
        date: "2024-03-20",
        picks: ["神达", "技嘉", "华擎"],
        stockPerformance: "神达 +0.5%、技嘉 -0.2%、华擎 +1.1%",
        dailyReturn: "+0.4%",
      },
      {
        date: "2024-03-21",
        picks: ["创意", "世芯", "智原"],
        stockPerformance: "创意 +1.9%、世芯 +2.4%、智原 -0.5%",
        dailyReturn: "+1.3%",
      },
      {
        date: "2024-03-22",
        picks: ["联发科", "联咏", "瑞昱"],
        stockPerformance: "联发科 +0.7%、联咏 +0.9%、瑞昱 +0.3%",
        dailyReturn: "+0.6%",
      },
    ],
  },
  {
    id: "dividend-core",
    name: "高股息核心策略",
    risk: "低风险",
    category: "股息",
    quarterReturn: "+3.2%",
    summary: [
      { label: "年初至今", value: "+6.8%" },
      { label: "胜率", value: "55%" },
      { label: "最大回撤", value: "-2.4%" },
    ],
    cumulative: [
      { label: "累计报酬", value: "+21.7%" },
      { label: "年化报酬", value: "+8.7%" },
      { label: "夏普比率", value: "1.18" },
      { label: "波动率", value: "6.2%" },
    ],
    daily: [
      {
        date: "2024-03-18",
        picks: ["中华电", "远传", "台湾大"],
        stockPerformance: "中华电 +0.2%、远传 +0.1%、台湾大 +0.0%",
        dailyReturn: "+0.1%",
      },
      {
        date: "2024-03-19",
        picks: ["中钢", "台肥", "台橡"],
        stockPerformance: "中钢 +0.1%、台肥 +0.2%、台橡 -0.1%",
        dailyReturn: "+0.1%",
      },
      {
        date: "2024-03-20",
        picks: ["统一超", "全家", "统一"],
        stockPerformance: "统一超 +0.3%、全家 +0.2%、统一 +0.1%",
        dailyReturn: "+0.2%",
      },
      {
        date: "2024-03-21",
        picks: ["兆丰金", "第一金", "华南金"],
        stockPerformance: "兆丰金 +0.1%、第一金 +0.0%、华南金 +0.2%",
        dailyReturn: "+0.1%",
      },
      {
        date: "2024-03-22",
        picks: ["合库金", "玉山金", "永丰金"],
        stockPerformance: "合库金 +0.0%、玉山金 +0.2%、永丰金 +0.1%",
        dailyReturn: "+0.1%",
      },
    ],
  },
  {
    id: "macro-rotation",
    name: "景气轮动策略",
    risk: "中风险",
    category: "轮动",
    quarterReturn: "+6.4%",
    summary: [
      { label: "年初至今", value: "+12.9%" },
      { label: "胜率", value: "57%" },
      { label: "最大回撤", value: "-4.6%" },
    ],
    cumulative: [
      { label: "累计报酬", value: "+33.1%" },
      { label: "年化报酬", value: "+11.8%" },
      { label: "夏普比率", value: "1.26" },
      { label: "波动率", value: "10.2%" },
    ],
    daily: [
      {
        date: "2024-03-18",
        picks: ["中钢", "台泥", "台塑"],
        stockPerformance: "中钢 +0.3%、台泥 +0.1%、台塑 +0.2%",
        dailyReturn: "+0.2%",
      },
      {
        date: "2024-03-19",
        picks: ["长荣", "阳明", "万海"],
        stockPerformance: "长荣 +0.5%、阳明 +0.7%、万海 +0.4%",
        dailyReturn: "+0.5%",
      },
      {
        date: "2024-03-20",
        picks: ["台玻", "台化", "南亚"],
        stockPerformance: "台玻 -0.1%、台化 +0.3%、南亚 +0.2%",
        dailyReturn: "+0.1%",
      },
      {
        date: "2024-03-21",
        picks: ["南电", "臻鼎", "欣兴"],
        stockPerformance: "南电 +0.6%、臻鼎 +0.4%、欣兴 +0.2%",
        dailyReturn: "+0.4%",
      },
      {
        date: "2024-03-22",
        picks: ["台达电", "光宝科", "群光"],
        stockPerformance: "台达电 +0.3%、光宝科 +0.2%、群光 +0.1%",
        dailyReturn: "+0.2%",
      },
    ],
  },
  {
    id: "small-cap-focus",
    name: "中小型精选策略",
    risk: "高风险",
    category: "成长",
    quarterReturn: "+9.7%",
    summary: [
      { label: "年初至今", value: "+20.1%" },
      { label: "胜率", value: "60%" },
      { label: "最大回撤", value: "-8.0%" },
    ],
    cumulative: [
      { label: "累计报酬", value: "+47.9%" },
      { label: "年化报酬", value: "+16.3%" },
      { label: "夏普比率", value: "1.38" },
      { label: "波动率", value: "17.1%" },
    ],
    daily: [
      {
        date: "2024-03-18",
        picks: ["健鼎", "联茂", "佳邦"],
        stockPerformance: "健鼎 +1.2%、联茂 +0.8%、佳邦 +0.6%",
        dailyReturn: "+0.9%",
      },
      {
        date: "2024-03-19",
        picks: ["宏捷科", "IET-KY", "同欣电"],
        stockPerformance: "宏捷科 +1.5%、IET-KY +0.9%、同欣电 +0.4%",
        dailyReturn: "+0.9%",
      },
      {
        date: "2024-03-20",
        picks: ["世界", "矽力-KY", "贸联"],
        stockPerformance: "世界 +0.7%、矽力-KY +1.0%、贸联 +0.3%",
        dailyReturn: "+0.7%",
      },
      {
        date: "2024-03-21",
        picks: ["信骅", "祥硕", "譜瑞-KY"],
        stockPerformance: "信骅 +1.8%、祥硕 +0.5%、譜瑞-KY +0.4%",
        dailyReturn: "+0.9%",
      },
      {
        date: "2024-03-22",
        picks: ["钰创", "安国", "创惟"],
        stockPerformance: "钰创 +0.6%、安国 +0.7%、创惟 +0.8%",
        dailyReturn: "+0.7%",
      },
    ],
  },
  {
    id: "income-stability",
    name: "收益稳定策略",
    risk: "低风险",
    category: "防御",
    quarterReturn: "+2.8%",
    summary: [
      { label: "年初至今", value: "+5.9%" },
      { label: "胜率", value: "53%" },
      { label: "最大回撤", value: "-1.9%" },
    ],
    cumulative: [
      { label: "累计报酬", value: "+18.6%" },
      { label: "年化报酬", value: "+7.5%" },
      { label: "夏普比率", value: "1.10" },
      { label: "波动率", value: "5.7%" },
    ],
    daily: [
      {
        date: "2024-03-18",
        picks: ["中华电", "统一超", "国泰金"],
        stockPerformance: "中华电 +0.1%、统一超 +0.2%、国泰金 +0.1%",
        dailyReturn: "+0.1%",
      },
      {
        date: "2024-03-19",
        picks: ["富邦金", "中信金", "兆丰金"],
        stockPerformance: "富邦金 +0.0%、中信金 +0.1%、兆丰金 +0.2%",
        dailyReturn: "+0.1%",
      },
      {
        date: "2024-03-20",
        picks: ["台湾大", "远传", "台哥大"],
        stockPerformance: "台湾大 +0.1%、远传 +0.0%、台哥大 +0.1%",
        dailyReturn: "+0.1%",
      },
      {
        date: "2024-03-21",
        picks: ["合库金", "第一金", "华南金"],
        stockPerformance: "合库金 +0.1%、第一金 +0.1%、华南金 +0.1%",
        dailyReturn: "+0.1%",
      },
      {
        date: "2024-03-22",
        picks: ["统一", "台泥", "中钢"],
        stockPerformance: "统一 +0.1%、台泥 +0.1%、中钢 +0.1%",
        dailyReturn: "+0.1%",
      },
    ],
  },
  {
    id: "growth-momentum",
    name: "成长动能策略",
    risk: "中高风险",
    category: "动能",
    quarterReturn: "+7.9%",
    summary: [
      { label: "年初至今", value: "+16.5%" },
      { label: "胜率", value: "61%" },
      { label: "最大回撤", value: "-5.7%" },
    ],
    cumulative: [
      { label: "累计报酬", value: "+39.4%" },
      { label: "年化报酬", value: "+14.2%" },
      { label: "夏普比率", value: "1.37" },
      { label: "波动率", value: "13.9%" },
    ],
    daily: [
      {
        date: "2024-03-18",
        picks: ["广达", "神达", "技嘉"],
        stockPerformance: "广达 +0.6%、神达 +0.5%、技嘉 +0.3%",
        dailyReturn: "+0.5%",
      },
      {
        date: "2024-03-19",
        picks: ["瑞昱", "联咏", "群联"],
        stockPerformance: "瑞昱 +0.4%、联咏 +0.5%、群联 +0.2%",
        dailyReturn: "+0.4%",
      },
      {
        date: "2024-03-20",
        picks: ["台达电", "光宝科", "联电"],
        stockPerformance: "台达电 +0.3%、光宝科 +0.2%、联电 +0.1%",
        dailyReturn: "+0.2%",
      },
      {
        date: "2024-03-21",
        picks: ["奇鋐", "建準", "双鸿"],
        stockPerformance: "奇鋐 +1.1%、建準 +0.8%、双鸿 +0.6%",
        dailyReturn: "+0.8%",
      },
      {
        date: "2024-03-22",
        picks: ["创意", "世芯", "华擎"],
        stockPerformance: "创意 +0.9%、世芯 +1.2%、华擎 +0.5%",
        dailyReturn: "+0.9%",
      },
    ],
  },
  {
    id: "global-theme",
    name: "全球主题策略",
    risk: "中风险",
    category: "主题",
    quarterReturn: "+5.5%",
    summary: [
      { label: "年初至今", value: "+11.1%" },
      { label: "胜率", value: "56%" },
      { label: "最大回撤", value: "-4.2%" },
    ],
    cumulative: [
      { label: "累计报酬", value: "+30.8%" },
      { label: "年化报酬", value: "+11.0%" },
      { label: "夏普比率", value: "1.29" },
      { label: "波动率", value: "9.6%" },
    ],
    daily: [
      {
        date: "2024-03-18",
        picks: ["台积电", "联发科", "鸿海"],
        stockPerformance: "台积电 +0.8%、联发科 +0.4%、鸿海 +0.2%",
        dailyReturn: "+0.5%",
      },
      {
        date: "2024-03-19",
        picks: ["日月光", "华硕", "瑞昱"],
        stockPerformance: "日月光 +0.5%、华硕 +0.3%、瑞昱 +0.2%",
        dailyReturn: "+0.3%",
      },
      {
        date: "2024-03-20",
        picks: ["广达", "纬创", "技嘉"],
        stockPerformance: "广达 +0.6%、纬创 +0.5%、技嘉 +0.2%",
        dailyReturn: "+0.4%",
      },
      {
        date: "2024-03-21",
        picks: ["奇鋐", "台达电", "光宝科"],
        stockPerformance: "奇鋐 +0.7%、台达电 +0.3%、光宝科 +0.2%",
        dailyReturn: "+0.4%",
      },
      {
        date: "2024-03-22",
        picks: ["联电", "群联", "创意"],
        stockPerformance: "联电 +0.2%、群联 +0.4%、创意 +0.6%",
        dailyReturn: "+0.4%",
      },
    ],
  },
  {
    id: "green-energy",
    name: "绿色能源策略",
    risk: "中高风险",
    category: "ESG",
    quarterReturn: "+6.9%",
    summary: [
      { label: "年初至今", value: "+13.7%" },
      { label: "胜率", value: "59%" },
      { label: "最大回撤", value: "-6.3%" },
    ],
    cumulative: [
      { label: "累计报酬", value: "+35.2%" },
      { label: "年化报酬", value: "+12.7%" },
      { label: "夏普比率", value: "1.22" },
      { label: "波动率", value: "14.4%" },
    ],
    daily: [
      {
        date: "2024-03-18",
        picks: ["中钢", "台达电", "台泥"],
        stockPerformance: "中钢 +0.3%、台达电 +0.5%、台泥 +0.2%",
        dailyReturn: "+0.3%",
      },
      {
        date: "2024-03-19",
        picks: ["茂迪", "元晶", "硕禾"],
        stockPerformance: "茂迪 +0.9%、元晶 +0.6%、硕禾 +0.4%",
        dailyReturn: "+0.6%",
      },
      {
        date: "2024-03-20",
        picks: ["台塑化", "台化", "南亚"],
        stockPerformance: "台塑化 +0.2%、台化 +0.4%、南亚 +0.3%",
        dailyReturn: "+0.3%",
      },
      {
        date: "2024-03-21",
        picks: ["中美晶", "台达电", "联合再生"],
        stockPerformance: "中美晶 +0.7%、台达电 +0.3%、联合再生 +0.5%",
        dailyReturn: "+0.5%",
      },
      {
        date: "2024-03-22",
        picks: ["东元", "上银", "汉翔"],
        stockPerformance: "东元 +0.4%、上银 +0.5%、汉翔 +0.2%",
        dailyReturn: "+0.4%",
      },
    ],
  },
  {
    id: "quality-earnings",
    name: "优质获利策略",
    risk: "中风险",
    category: "质量",
    quarterReturn: "+5.9%",
    summary: [
      { label: "年初至今", value: "+12.0%" },
      { label: "胜率", value: "58%" },
      { label: "最大回撤", value: "-4.4%" },
    ],
    cumulative: [
      { label: "累计报酬", value: "+31.6%" },
      { label: "年化报酬", value: "+11.5%" },
      { label: "夏普比率", value: "1.30" },
      { label: "波动率", value: "9.8%" },
    ],
    daily: [
      {
        date: "2024-03-18",
        picks: ["台积电", "联发科", "日月光"],
        stockPerformance: "台积电 +0.7%、联发科 +0.3%、日月光 +0.2%",
        dailyReturn: "+0.4%",
      },
      {
        date: "2024-03-19",
        picks: ["联咏", "瑞昱", "群联"],
        stockPerformance: "联咏 +0.4%、瑞昱 +0.5%、群联 +0.3%",
        dailyReturn: "+0.4%",
      },
      {
        date: "2024-03-20",
        picks: ["广达", "台达电", "光宝科"],
        stockPerformance: "广达 +0.5%、台达电 +0.3%、光宝科 +0.2%",
        dailyReturn: "+0.3%",
      },
      {
        date: "2024-03-21",
        picks: ["华硕", "研华", "智邦"],
        stockPerformance: "华硕 +0.4%、研华 +0.2%、智邦 +0.5%",
        dailyReturn: "+0.4%",
      },
      {
        date: "2024-03-22",
        picks: ["台积电", "联电", "联发科"],
        stockPerformance: "台积电 +0.3%、联电 +0.2%、联发科 +0.4%",
        dailyReturn: "+0.3%",
      },
    ],
  },
  {
    id: "smart-beta",
    name: "Smart Beta 策略",
    risk: "中风险",
    category: "Smart Beta",
    quarterReturn: "+5.1%",
    summary: [
      { label: "年初至今", value: "+10.4%" },
      { label: "胜率", value: "57%" },
      { label: "最大回撤", value: "-4.9%" },
    ],
    cumulative: [
      { label: "累计报酬", value: "+29.3%" },
      { label: "年化报酬", value: "+10.8%" },
      { label: "夏普比率", value: "1.24" },
      { label: "波动率", value: "10.5%" },
    ],
    daily: [
      {
        date: "2024-03-18",
        picks: ["台积电", "鸿海", "联发科"],
        stockPerformance: "台积电 +0.5%、鸿海 +0.3%、联发科 +0.4%",
        dailyReturn: "+0.4%",
      },
      {
        date: "2024-03-19",
        picks: ["中华电", "兆丰金", "富邦金"],
        stockPerformance: "中华电 +0.2%、兆丰金 +0.3%、富邦金 +0.1%",
        dailyReturn: "+0.2%",
      },
      {
        date: "2024-03-20",
        picks: ["台塑", "南亚", "台化"],
        stockPerformance: "台塑 +0.2%、南亚 +0.3%、台化 +0.1%",
        dailyReturn: "+0.2%",
      },
      {
        date: "2024-03-21",
        picks: ["广达", "纬创", "英业达"],
        stockPerformance: "广达 +0.4%、纬创 +0.5%、英业达 +0.2%",
        dailyReturn: "+0.4%",
      },
      {
        date: "2024-03-22",
        picks: ["台泥", "中钢", "台达电"],
        stockPerformance: "台泥 +0.1%、中钢 +0.2%、台达电 +0.3%",
        dailyReturn: "+0.2%",
      },
    ],
  },
  {
    id: "supply-chain",
    name: "供应链关键策略",
    risk: "中高风险",
    category: "产业链",
    quarterReturn: "+7.2%",
    summary: [
      { label: "年初至今", value: "+15.1%" },
      { label: "胜率", value: "60%" },
      { label: "最大回撤", value: "-6.0%" },
    ],
    cumulative: [
      { label: "累计报酬", value: "+37.4%" },
      { label: "年化报酬", value: "+13.5%" },
      { label: "夏普比率", value: "1.35" },
      { label: "波动率", value: "13.1%" },
    ],
    daily: [
      {
        date: "2024-03-18",
        picks: ["台积电", "日月光", "力成"],
        stockPerformance: "台积电 +0.6%、日月光 +0.3%、力成 +0.2%",
        dailyReturn: "+0.4%",
      },
      {
        date: "2024-03-19",
        picks: ["欣兴", "南电", "景硕"],
        stockPerformance: "欣兴 +0.5%、南电 +0.4%、景硕 +0.2%",
        dailyReturn: "+0.4%",
      },
      {
        date: "2024-03-20",
        picks: ["奇鋐", "建準", "双鸿"],
        stockPerformance: "奇鋐 +0.7%、建準 +0.6%、双鸿 +0.4%",
        dailyReturn: "+0.6%",
      },
      {
        date: "2024-03-21",
        picks: ["纬创", "广达", "英业达"],
        stockPerformance: "纬创 +0.5%、广达 +0.4%、英业达 +0.3%",
        dailyReturn: "+0.4%",
      },
      {
        date: "2024-03-22",
        picks: ["联发科", "联咏", "瑞昱"],
        stockPerformance: "联发科 +0.5%、联咏 +0.4%、瑞昱 +0.2%",
        dailyReturn: "+0.4%",
      },
    ],
  },
  {
    id: "balanced-advantage",
    name: "平衡优势策略",
    risk: "中风险",
    category: "平衡",
    quarterReturn: "+4.9%",
    summary: [
      { label: "年初至今", value: "+10.0%" },
      { label: "胜率", value: "56%" },
      { label: "最大回撤", value: "-4.1%" },
    ],
    cumulative: [
      { label: "累计报酬", value: "+27.6%" },
      { label: "年化报酬", value: "+10.1%" },
      { label: "夏普比率", value: "1.20" },
      { label: "波动率", value: "9.2%" },
    ],
    daily: [
      {
        date: "2024-03-18",
        picks: ["台积电", "鸿海", "中华电"],
        stockPerformance: "台积电 +0.4%、鸿海 +0.2%、中华电 +0.1%",
        dailyReturn: "+0.3%",
      },
      {
        date: "2024-03-19",
        picks: ["富邦金", "兆丰金", "中信金"],
        stockPerformance: "富邦金 +0.1%、兆丰金 +0.2%、中信金 +0.1%",
        dailyReturn: "+0.1%",
      },
      {
        date: "2024-03-20",
        picks: ["台塑", "南亚", "台化"],
        stockPerformance: "台塑 +0.2%、南亚 +0.1%、台化 +0.2%",
        dailyReturn: "+0.2%",
      },
      {
        date: "2024-03-21",
        picks: ["广达", "纬创", "英业达"],
        stockPerformance: "广达 +0.3%、纬创 +0.4%、英业达 +0.2%",
        dailyReturn: "+0.3%",
      },
      {
        date: "2024-03-22",
        picks: ["台达电", "光宝科", "群光"],
        stockPerformance: "台达电 +0.2%、光宝科 +0.2%、群光 +0.1%",
        dailyReturn: "+0.2%",
      },
    ],
  },
];

const activeStrategy = ref(strategies[0]);

const selectStrategy = (strategy) => {
  activeStrategy.value = strategy;
};

const returnClass = (value) => {
  if (value.startsWith("-")) return "down";
  if (value.startsWith("+")) return "up";
  return "";
};
</script>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.section-header h2 {
  margin: 0 0 6px;
  font-size: 20px;
}

.muted {
  color: var(--muted);
}

.strategy-layout {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) minmax(0, 2fr);
  gap: 20px;
}

.strategy-list {
  background: var(--surface);
  border-radius: 16px;
  padding: 12px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.list-header {
  display: grid;
  grid-template-columns: 1.3fr 0.7fr 0.6fr;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
  padding: 8px 10px;
}

.list-row {
  display: grid;
  grid-template-columns: 1.3fr 0.7fr 0.6fr;
  gap: 8px;
  align-items: center;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: inherit;
}

.list-row:hover {
  background: rgba(99, 102, 241, 0.08);
}

.list-row.active {
  background: rgba(99, 102, 241, 0.14);
  border-color: rgba(99, 102, 241, 0.4);
}

.list-row .name {
  font-weight: 600;
}

.strategy-detail {
  background: var(--surface);
  border-radius: 16px;
  padding: 16px;
  box-shadow: var(--shadow);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.detail-header h3 {
  margin: 0 0 4px;
  font-size: 18px;
}

.tag-row {
  margin-top: 8px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tag {
  background: rgba(99, 102, 241, 0.12);
  color: #4f46e5;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
}

.summary {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.summary-item {
  background: rgba(148, 163, 184, 0.12);
  border-radius: 12px;
  padding: 8px 12px;
  min-width: 120px;
}

.summary-item .label {
  display: block;
  font-size: 12px;
  color: var(--muted);
}

.summary-item .value {
  font-weight: 600;
  font-size: 14px;
}

.detail-section h4 {
  margin: 0 0 12px;
  font-size: 15px;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
}

.hint {
  font-size: 12px;
  color: var(--muted);
}

.performance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.metric-card {
  background: rgba(148, 163, 184, 0.12);
  border-radius: 12px;
  padding: 10px 12px;
}

.metric-card .label {
  font-size: 12px;
  color: var(--muted);
}

.metric-card .value {
  font-weight: 600;
  font-size: 15px;
}

.table {
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  overflow: hidden;
}

.table-row {
  display: grid;
  grid-template-columns: 0.8fr 1.4fr 1.6fr 0.6fr;
  gap: 12px;
  padding: 10px 12px;
  font-size: 13px;
  align-items: center;
}

.table-row:nth-child(odd) {
  background: rgba(148, 163, 184, 0.08);
}

.table-row.table-head {
  background: rgba(99, 102, 241, 0.12);
  font-weight: 600;
}

.cell-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.cell-content {
  color: var(--muted);
}

.return.up {
  color: #16a34a;
  font-weight: 600;
}

.return.down {
  color: #dc2626;
  font-weight: 600;
}

@media (max-width: 1024px) {
  .strategy-layout {
    grid-template-columns: 1fr;
  }

  .table-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}
</style>
