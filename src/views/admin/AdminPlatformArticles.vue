<template>
  <section class="admin-page">
    <div class="section-header">
      <h2>资讯管理</h2>
      <p class="muted">关联个股与隐藏资讯统一在此处理</p>
    </div>

    <div class="table">
      <div class="table-row table-head">
        <span>资讯id</span>
        <span>资讯标题</span>
        <span>资讯摘要</span>
        <span>关联个股（名称 代码）</span>
        <span>更多</span>
      </div>
      <div v-for="row in rows" :key="row.article_id" class="table-row">
        <span class="cell-id">{{ row.article_id }}</span>
        <span class="cell-content">{{ displayArticleText(row.title, row.source_id) }}</span>
        <span class="cell-content">{{ displayArticleText(row.description, row.source_id) }}</span>
        <span class="cell-tags">
          <span
            v-for="stock in row.stocks"
            :key="stock.stock_id"
            class="tag"
          >
            {{ stock.name }} {{ stock.stock_id }}
          </span>
          <span v-if="!row.stocks.length" class="tag muted">暂无关联</span>
        </span>
        <button class="more-btn" type="button" @click="openSheet(row)">⋯</button>
      </div>
    </div>

    <div v-if="status" class="status">{{ status }}</div>

    <AdminActionSheet
      :open="sheetOpen"
      title="更多操作"
      :safe-actions="safeActions"
      :danger-actions="dangerActions"
      @close="closeSheet"
      @action="handleAction"
    />

    <AdminConfirmDialog
      :open="confirmOpen"
      :message="confirmMessage"
      @close="closeConfirm"
      @confirm="confirmDangerAction"
    />

    <div v-if="editOpen" class="drawer-backdrop" @click.self="closeEdit">
      <div class="drawer">
        <div class="drawer-header">
          <span>编辑关联个股</span>
          <button type="button" @click="closeEdit">关闭</button>
        </div>
        <div class="drawer-section">
          <div class="drawer-title">已关联</div>
          <div class="tag-list">
            <button
              v-for="stock in selectedStocks"
              :key="stock.stock_id"
              type="button"
              class="tag removable"
              @click="removeStock(stock)"
            >
              {{ stock.name }} {{ stock.stock_id }} ✕
            </button>
            <span v-if="!selectedStocks.length" class="tag muted">暂无关联</span>
          </div>
        </div>
        <div class="drawer-section">
          <div class="drawer-title">搜索添加</div>
          <input
            v-model="searchQuery"
            class="search-input"
            type="text"
            placeholder="输入代码或名称"
            @input="handleSearch"
          />
          <div class="search-results">
            <button
              v-for="stock in searchResults"
              :key="stock.stock_id"
              type="button"
              class="result-item"
              @click="addStock(stock)"
            >
              {{ stock.name }} ({{ stock.stock_id }})
            </button>
            <div v-if="searchQuery && !searchResults.length" class="empty">
              没有找到匹配结果
            </div>
          </div>
        </div>
        <button class="save-btn" type="button" @click="saveStocks">保存</button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import AdminActionSheet from "../../components/admin/AdminActionSheet.vue";
import AdminConfirmDialog from "../../components/admin/AdminConfirmDialog.vue";
import {
  fetchArticleStocks,
  fetchArticles,
  hideRecord,
  replaceArticleStocks,
  writeAuditLog,
} from "../../services/admin";
import { searchStocksSupabase } from "../../services/stocks";

const rows = ref([]);
const status = ref("");
const sheetOpen = ref(false);
const activeRow = ref(null);
const confirmOpen = ref(false);
const pendingDanger = ref(null);
const confirmMessage = ref("该操作不可撤销，确定继续吗？");
const editOpen = ref(false);
const selectedStocks = ref([]);
const searchQuery = ref("");
const searchResults = ref([]);

const safeActions = computed(() => [
  {
    label: "编辑关联个股",
    action: "edit-stocks",
  },
]);

const dangerActions = computed(() => [
  {
    label: "隐藏资讯",
    action: "hide-article",
  },
]);

const isMojibake = (value) => typeof value === "string" && value.includes("�");

const displayArticleText = (value, sourceId) => {
  if (!value) return "—";
  if (!isMojibake(value)) return value;
  if (sourceId === "mops") {
    return "[编码异常，执行一次 /api/sync-mops-rss 可修复新数据]";
  }
  return "[编码异常]";
};

const openSheet = (row) => {
  activeRow.value = row;
  sheetOpen.value = true;
};

const closeSheet = () => {
  sheetOpen.value = false;
};

const closeConfirm = () => {
  confirmOpen.value = false;
  pendingDanger.value = null;
};

const openConfirm = (action) => {
  pendingDanger.value = action;
  confirmOpen.value = true;
  confirmMessage.value = "确认隐藏该资讯并记录审计日志？";
};

const handleAction = (action) => {
  if (!activeRow.value) return;
  if (action.action === "edit-stocks") {
    selectedStocks.value = [...(activeRow.value.stocks || [])];
    searchQuery.value = "";
    searchResults.value = [];
    editOpen.value = true;
    closeSheet();
    return;
  }
  openConfirm(action.action);
};

const confirmDangerAction = async () => {
  if (!activeRow.value || !pendingDanger.value) return;
  status.value = "处理中...";
  await hideRecord({
    table: "news_articles",
    idField: "article_id",
    id: activeRow.value.article_id,
  });
  await writeAuditLog({
    actor: "admin",
    action: "隐藏资讯",
    targetType: "article",
    targetId: activeRow.value.article_id,
    summary: activeRow.value.title || "资讯",
  });
  closeConfirm();
  closeSheet();
  await loadRows();
  status.value = "";
};

const closeEdit = () => {
  editOpen.value = false;
};

const addStock = (stock) => {
  if (selectedStocks.value.some((item) => item.stock_id === stock.stock_id)) return;
  selectedStocks.value = [...selectedStocks.value, stock];
};

const removeStock = (stock) => {
  selectedStocks.value = selectedStocks.value.filter(
    (item) => item.stock_id !== stock.stock_id
  );
};

const handleSearch = async () => {
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }
  searchResults.value = await searchStocksSupabase(searchQuery.value, 6);
};

const saveStocks = async () => {
  if (!activeRow.value) return;
  status.value = "保存中...";
  await replaceArticleStocks(activeRow.value.article_id, selectedStocks.value);
  await writeAuditLog({
    actor: "admin",
    action: "编辑关联个股",
    targetType: "article",
    targetId: activeRow.value.article_id,
    summary: `${activeRow.value.title || "资讯"} (${selectedStocks.value.length} 项)`
      .slice(0, 60),
  });
  editOpen.value = false;
  await loadRows();
  status.value = "";
};

const loadRows = async () => {
  status.value = "加载中...";
  const articles = await fetchArticles();
  const links = await fetchArticleStocks(articles.map((item) => item.article_id));
  const map = new Map();
  links.forEach((link) => {
    if (!map.has(link.article_id)) {
      map.set(link.article_id, []);
    }
    map.get(link.article_id).push({
      stock_id: link.stock_id,
      name: link.stocks?.name || link.stock_id,
    });
  });
  rows.value = articles.map((article) => ({
    ...article,
    stocks: map.get(article.article_id) || [],
  }));
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
  grid-template-columns: 0.9fr 1.4fr 1.4fr 1.4fr 0.4fr;
  gap: 8px;
  align-items: center;
  background: var(--surface);
  border-radius: 16px;
  padding: 10px 12px;
  font-size: 12px;
  box-shadow: var(--shadow);
}

.table-head {
  background: transparent;
  box-shadow: none;
  font-weight: 600;
  color: var(--muted);
}

.cell-id {
  font-family: "Manrope", sans-serif;
  font-size: 11px;
  color: var(--muted);
}

.cell-content {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
}

.tag.muted {
  color: var(--muted);
}

.tag.removable {
  border: 1px solid var(--border);
  background: var(--surface);
}

.more-btn {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  padding: 2px 6px;
  font-size: 14px;
  cursor: pointer;
}

.status {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
}

.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 20, 25, 0.3);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  z-index: 45;
  padding: 24px 16px calc(24px + env(safe-area-inset-bottom, 0px));
}

.drawer {
  width: min(440px, 100%);
  background: var(--surface);
  border-radius: 20px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
}

.drawer-header button {
  border: 0;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
}

.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drawer-title {
  font-size: 12px;
  color: var(--muted);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.search-input {
  border-radius: 12px;
  border: 1px solid var(--border);
  padding: 8px 10px;
  font-size: 13px;
}

.search-results {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.result-item {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 6px 10px;
  background: var(--surface);
  font-size: 12px;
  text-align: left;
}

.empty {
  font-size: 12px;
  color: var(--muted);
}

.save-btn {
  border: 0;
  border-radius: 12px;
  padding: 10px 12px;
  background: var(--ink);
  color: #fff;
  font-size: 14px;
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
