<template>
  <section class="admin-page">
    <div class="section-header">
      <h2>个股管理</h2>
      <p class="muted">来自最新一日行情（{{ latestDateLabel }}）</p>
    </div>

    <div class="table">
      <div class="table-row table-head">
        <span>个股名称</span>
        <span>个股代码</span>
        <span>最新收盘</span>
        <span>最新开盘</span>
        <span>最新涨跌幅</span>
      </div>
      <button
        v-for="row in rows"
        :key="row.stock_id"
        class="table-row link-row"
        type="button"
        @click="goDetail(row)"
      >
        <span>{{ row.name || "—" }}</span>
        <span>{{ row.stock_id }}</span>
        <span>{{ formatNumber(row.latest_close) }}</span>
        <span>{{ formatNumber(row.latest_open) }}</span>
        <span :class="changeClass(row.latest_change_pct)">
          {{ formatChange(row.latest_change_pct) }}
        </span>
      </button>
    </div>

    <div v-if="status" class="status">{{ status }}</div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { fetchStocksWithLatestPrice } from "../../services/admin";

const rows = ref([]);
const status = ref("");
const router = useRouter();

const latestDateLabel = computed(() => rows.value[0]?.latest_date || "暂无行情");

const formatNumber = (value) => {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return num.toFixed(2);
};

const formatChange = (value) => {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  if (Number.isNaN(num)) return "—";
  return `${num > 0 ? "+" : ""}${num}%`;
};

const changeClass = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return "";
  if (num > 0) return "positive";
  if (num < 0) return "negative";
  return "";
};

const goDetail = (row) => {
  router.push(`/admin/backend/stocks/${row.stock_id}`);
};

const loadRows = async () => {
  status.value = "加载中...";
  rows.value = await fetchStocksWithLatestPrice();
  status.value = "";
};

onMounted(loadRows);
</script>

<style scoped>
.admin-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.table {
  display: grid;
  gap: 8px;
}

.table-row {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr 0.8fr 0.8fr 0.8fr;
  gap: 8px;
  align-items: center;
  background: var(--surface);
  border-radius: 16px;
  padding: 10px 12px;
  font-size: 12px;
  box-shadow: var(--shadow);
  border: 0;
  text-align: left;
}

.table-head {
  background: transparent;
  box-shadow: none;
  font-weight: 600;
  color: var(--muted);
}

.link-row {
  cursor: pointer;
}

.positive {
  color: var(--price-up);
  font-weight: 600;
}

.negative {
  color: var(--price-down);
  font-weight: 600;
}

.status {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
}

@media (max-width: 520px) {
  .table-row {
    grid-template-columns: 1fr;
  }
  .table-head {
    display: none;
  }
}
</style>
