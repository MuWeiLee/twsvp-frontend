<template>
  <section class="dashboard">
    <div class="section-header">
      <h2>数据总览</h2>
      <p class="muted">今日新增 & 最近 7 天趋势</p>
    </div>

    <div class="cards">
      <div class="card">
        <div class="card-label">用户量</div>
        <div class="card-value">{{ metrics.users.today }}</div>
      </div>
      <div class="card">
        <div class="card-label">观点量</div>
        <div class="card-value">{{ metrics.feeds.today }}</div>
      </div>
      <div class="card">
        <div class="card-label">资讯量</div>
        <div class="card-value">{{ metrics.articles.today }}</div>
      </div>
    </div>

    <div class="chart-card">
      <div class="chart-header">
        <span>近 7 天游览</span>
      </div>
      <div class="chart-grid">
        <div v-for="metric in chartItems" :key="metric.key" class="chart-item">
          <div class="chart-label">{{ metric.label }}</div>
          <svg class="chart" viewBox="0 0 140 40" aria-hidden="true">
            <polyline :points="metric.points" fill="none" stroke="currentColor" stroke-width="2" />
            <circle
              v-for="point in metric.pointList"
              :key="point.x"
              :cx="point.x"
              :cy="point.y"
              r="2.5"
              fill="currentColor"
            />
          </svg>
          <div class="chart-values">
            <span v-for="item in metric.series" :key="item.key">{{ item.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="status" class="status">{{ status }}</div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { fetchDashboardMetrics } from "../../services/admin";

const metrics = ref({
  users: { today: 0, series: [] },
  feeds: { today: 0, series: [] },
  articles: { today: 0, series: [] },
});
const status = ref("");

const buildPoints = (series = []) => {
  const max = Math.max(1, ...series.map((item) => item.count));
  const step = series.length > 1 ? 140 / (series.length - 1) : 140;
  const points = series.map((item, index) => {
    const x = index * step;
    const y = 36 - (item.count / max) * 30;
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });
  return {
    points: points.map((point) => `${point.x},${point.y}`).join(" "),
    pointList: points,
  };
};

const chartItems = computed(() => {
  const metricsMap = [
    { key: "users", label: "用户" },
    { key: "feeds", label: "观点" },
    { key: "articles", label: "资讯" },
  ];
  return metricsMap.map((item) => {
    const series = metrics.value[item.key].series || [];
    const { points, pointList } = buildPoints(series);
    return { ...item, series, points, pointList };
  });
});

const loadMetrics = async () => {
  status.value = "加载中...";
  metrics.value = await fetchDashboardMetrics();
  status.value = "";
};

onMounted(loadMetrics);
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header h2 {
  margin: 0;
  font-size: 20px;
}

.section-header .muted {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.cards {
  display: grid;
  gap: 12px;
}

.card {
  background: var(--surface);
  border-radius: 18px;
  padding: 14px 16px;
  box-shadow: var(--shadow);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-label {
  font-size: 13px;
  color: var(--muted);
}

.card-value {
  font-size: 20px;
  font-weight: 600;
}

.chart-card {
  background: var(--surface);
  border-radius: 18px;
  padding: 14px 16px;
  box-shadow: var(--shadow);
}

.chart-header {
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 8px;
}

.chart-grid {
  display: grid;
  gap: 12px;
}

.chart-item {
  background: var(--panel);
  border-radius: 14px;
  padding: 10px 12px;
  display: grid;
  gap: 6px;
}

.chart-label {
  font-size: 12px;
  color: var(--muted);
}

.chart {
  width: 100%;
  height: 40px;
  color: var(--ink);
}

.chart-values {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  font-size: 10px;
  color: var(--muted);
  text-align: center;
}

.status {
  font-size: 12px;
  color: var(--muted);
  text-align: center;
}
</style>
