<template>
  <div class="app-shell">
    <div class="phone-frame fade-in">
      <nav class="nav slide-in">
        <button class="nav-btn" type="button" :aria-label="t('返回')" @click="handleBack">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M15 18l-6-6 6-6"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <div class="nav-title">{{ t("选择交易券商") }}</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <header class="header slide-in">
        <h1 class="title">{{ t("选择交易券商") }}</h1>
        <p class="subtitle">{{ t("用于快捷交易跳转") }}</p>
      </header>

      <section class="search-bar-shell slide-in">
        <div class="search-bar">
          <div class="search-input-wrap">
            <input
              id="broker-search"
              v-model="searchQuery"
              class="search-input"
              type="search"
              :placeholder="t('券商搜索')"
              :aria-label="t('券商搜索')"
            />
          </div>
        </div>
      </section>

      <section class="card slide-in">
        <div class="broker-groups">
          <div v-for="group in groupedBrokers" :key="group.key" class="broker-group">
            <div class="group-title">{{ group.label }}</div>
            <div class="broker-list">
              <button
                v-for="broker in group.items"
                :key="broker.id"
                class="broker-item"
                type="button"
                @click="selectBroker(broker.id)"
              >
                <div class="broker-meta">
                  <strong>{{ broker.name }}</strong>
                  <span>{{ broker.appStoreUrl ? t("App Store") : t("可用") }}</span>
                </div>
                <span class="broker-status" :class="{ active: broker.id === selectedId }">
                  {{ broker.id === selectedId ? t("已选择") : t("选择") }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { getCurrentUserSupabase } from "../services/auth.js";
import { t } from "../services/i18n.js";
import {
  BROKERS,
  fetchBrokerPreferenceSupabase,
  saveBrokerPreferenceSupabase,
} from "../services/brokers.js";

const router = useRouter();
const brokers = BROKERS;
const selectedId = ref("");
const userId = ref("");
const searchQuery = ref("");

const GROUPS = [
  { key: "F", label: "F", brokerIds: ["fubon-ai-pro", "fugle"] },
  { key: "G", label: "G", brokerIds: ["cathay-securities", "cathay-tree-elf"] },
  { key: "T", label: "T", brokerIds: ["taishin-phoneez"] },
  { key: "Y", label: "Y", brokerIds: ["yuanta-investment-mr", "sinopac-da-hu-tou"] },
  { key: "Z", label: "Z", brokerIds: ["ctbc-bright"] },
];

const groupedBrokers = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  const brokerMap = new Map(brokers.map((broker) => [broker.id, broker]));

  return GROUPS.map((group) => {
    const items = group.brokerIds
      .map((id) => brokerMap.get(id))
      .filter(Boolean)
      .filter((broker) => !keyword || broker.name.toLowerCase().includes(keyword));

    return { ...group, items };
  }).filter((group) => group.items.length > 0);
});

onMounted(async () => {
  const user = await getCurrentUserSupabase();
  userId.value = user?.id || "";
  selectedId.value = await fetchBrokerPreferenceSupabase(userId.value);
});

const selectBroker = async (id) => {
  const result = await saveBrokerPreferenceSupabase(userId.value, id);
  selectedId.value = result.brokerId;
  router.back();
};

const handleBack = () => {
  router.back();
};
</script>

<style scoped>
.app-shell {
  max-width: 600px;
  margin: 0 auto;
  background: var(--bg);
  min-height: 100vh;
}

.phone-frame {
  width: 100%;
  min-height: 100vh;
  background: var(--bg);
  border-radius: 0;
  box-shadow: none;
  padding: 76px 16px 40px;
  position: relative;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  height: 64px;
  padding: 0 16px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: 0 1px 2px rgba(15, 20, 25, 0.04);
  z-index: 5;
}

.nav-title {
  font-weight: 500;
  font-size: 20px;
  margin-right: auto;
}

.nav-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  height: 32px;
  width: 32px;
  padding: 0;
  cursor: pointer;
  text-decoration: none;
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.nav-btn svg {
  width: 18px;
  height: 18px;
}

.nav-space {
  margin-left: auto;
}

.header {
  margin: 18px 0 14px;
}

.title {
  font-size: 24px;
  margin: 0 0 6px;
}

.subtitle {
  color: var(--muted);
  margin: 0;
  line-height: 1.5;
}

.card {
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 18px;
  border: 1px solid var(--border);
  display: grid;
  gap: 14px;
}

.search-bar-shell {
  padding: 0 4px 14px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 14px;
}

.search-bar {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
}

.search-input-wrap {
  position: relative;
  flex: 1;
}

.search-input {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  background: transparent;
  color: var(--ink);
  width: 100%;
}

.broker-groups {
  display: grid;
  gap: 16px;
}

.broker-group {
  display: grid;
  gap: 10px;
}

.group-title {
  font-weight: 600;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.broker-list {
  display: grid;
  gap: 12px;
}

.broker-item {
  border: 1px solid var(--border);
  background: var(--panel);
  border-radius: 14px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
  text-align: left;
}

.broker-meta {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: var(--muted);
}

.broker-meta strong {
  font-size: 14px;
  color: var(--ink);
}

.broker-status {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}

.broker-status.active {
  border-color: var(--ink);
  color: var(--ink);
}

.slide-in {
  animation: slideUp 500ms ease both;
}

.fade-in {
  animation: fadeIn 650ms ease both;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 420px) {
  .phone-frame {
    padding: 68px 18px 88px;
  }
}
</style>
