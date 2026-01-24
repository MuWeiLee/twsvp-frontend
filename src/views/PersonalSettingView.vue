<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-btn" to="/login">返回</router-link>
        <div class="nav-title">完善资料</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <header class="header">
        <h1 class="title">完成个人资料</h1>
        <p class="subtitle">昵称与感兴趣行业是进入观点流的必要信息。</p>
      </header>

      <section class="card">
        <label class="field">
          <span>昵称</span>
          <input v-model="nickname" type="text" placeholder="输入你的昵称" />
        </label>

        <label class="field">
          <span>个人介绍（可选）</span>
          <textarea v-model="bio" rows="3" placeholder="介绍你的投资领域与风格"></textarea>
        </label>

        <div class="field">
          <span>感兴趣行业（至少 1 个）</span>
          <div class="tag-grid">
            <button
              v-for="industry in industries"
              :key="industry.industry_id"
              class="tag-btn"
              :class="{ active: selectedIndustryIds.includes(industry.industry_id) }"
              @click="toggleIndustry(industry.industry_id)"
              type="button"
            >
              {{ industry.name }}
            </button>
          </div>
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button class="btn-primary" :disabled="isLoading" @click="handleSave">
          {{ isLoading ? "保存中..." : "保存并进入观点流" }}
        </button>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { getCurrentUserSupabase } from "../services/auth.js";
import {
  getIndustriesSupabase,
  getProfileSupabase,
  getUserIndustriesSupabase,
  setUserIndustriesSupabase,
  upsertProfileSupabase,
} from "../services/profile.js";

const router = useRouter();
const nickname = ref("");
const bio = ref("");
const industries = ref([]);
const selectedIndustryIds = ref([]);
const isLoading = ref(false);
const error = ref("");
const userId = ref(null);

const fallbackIndustries = [
  { industry_id: 1, name: "半导体" },
  { industry_id: 2, name: "AI 供应链" },
  { industry_id: 3, name: "金融" },
  { industry_id: 4, name: "航运" },
  { industry_id: 5, name: "电动车" },
  { industry_id: 6, name: "消费电子" },
];

onMounted(async () => {
  const user = await getCurrentUserSupabase();
  if (!user) {
    router.replace("/login");
    return;
  }
  userId.value = user.id;

  const [profile, industryList, userIndustries] = await Promise.all([
    getProfileSupabase(user.id),
    getIndustriesSupabase(),
    getUserIndustriesSupabase(user.id),
  ]);

  if (profile) {
    nickname.value = profile.nickname || "";
    bio.value = profile.bio || "";
  }

  const usableIndustries = industryList.length ? industryList : fallbackIndustries;
  industries.value = usableIndustries;
  selectedIndustryIds.value = userIndustries.map((item) => item.industry_id);
});

const toggleIndustry = (industryId) => {
  const exists = selectedIndustryIds.value.includes(industryId);
  if (exists) {
    selectedIndustryIds.value = selectedIndustryIds.value.filter((id) => id !== industryId);
    return;
  }
  if (selectedIndustryIds.value.length >= 5) {
    error.value = "最多选择 5 个行业。";
    return;
  }
  error.value = "";
  selectedIndustryIds.value = [...selectedIndustryIds.value, industryId];
};

const handleSave = async () => {
  if (!nickname.value.trim()) {
    error.value = "请填写昵称。";
    return;
  }
  if (selectedIndustryIds.value.length === 0) {
    error.value = "请选择至少 1 个行业。";
    return;
  }
  error.value = "";
  isLoading.value = true;

  const profile = await upsertProfileSupabase({
    userId: userId.value,
    nickname: nickname.value.trim(),
    bio: bio.value.trim(),
    completed: true,
  });

  const savedIndustries = await setUserIndustriesSupabase(
    userId.value,
    selectedIndustryIds.value
  );

  isLoading.value = false;
  if (profile && savedIndustries) {
    router.replace("/feed");
    return;
  }
  error.value = "保存失败，请稍后重试。";
};
</script>

<style scoped>
.app-shell {
  max-width: 480px;
  margin: 0 auto;
  background: transparent;
}

.phone-frame {
  width: 100%;
  min-height: 100vh;
  background: var(--bg);
  border-radius: 0;
  box-shadow: none;
  padding: 72px 20px 40px;
  position: relative;
}

.nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  z-index: 5;
}

.nav-title {
  font-family: "Manrope", "Noto Sans SC", sans-serif;
  font-weight: 700;
  font-size: 16px;
}

.nav-btn {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  color: var(--ink);
}

.nav-space {
  width: 46px;
}

.header {
  margin-top: 8px;
}

.title {
  font-family: "Manrope", "Noto Sans SC", sans-serif;
  font-size: 22px;
  margin: 12px 0 6px;
}

.subtitle {
  color: var(--muted);
  margin: 0 0 16px;
  line-height: 1.5;
  font-size: 13px;
}

.card {
  background: var(--surface);
  border-radius: var(--radius-card);
  padding: 18px;
  border: 1px solid var(--border);
  display: grid;
  gap: 16px;
}

.field {
  display: grid;
  gap: 8px;
  font-size: 13px;
  color: var(--muted);
}

.field span {
  color: var(--ink);
  font-weight: 600;
}

.field input,
.field textarea {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  font-family: inherit;
  font-size: 14px;
  background: var(--panel);
}

.tag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-btn {
  border: 1px solid var(--border);
  background: var(--panel);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  color: var(--ink);
}

.tag-btn.active {
  border-color: var(--ink);
  background: var(--surface);
}

.btn-primary {
  border: 0;
  background: var(--ink);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  padding: 12px 16px;
  border-radius: 10px;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: default;
}

.error {
  color: var(--negative);
  font-size: 12px;
}
</style>
