<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
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
        <div class="nav-title">{{ t("完善个人资料") }}</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <header class="header">
        <h1 class="title">{{ t("完善个人资料") }}</h1>
        <p class="subtitle">{{ t("注册邮箱：{email}", { email: email || "—" }) }}</p>
        <p class="subtitle">{{ t("观点中将会展示您的昵称。") }}</p>
      </header>

      <section class="card">
        <label class="field">
          <span>{{ t("昵称") }}</span>
          <input v-model="nickname" type="text" :placeholder="t('输入你的昵称')" />
        </label>

        <label class="field">
          <span>{{ t("个人介绍（可选）") }}</span>
          <textarea v-model="bio" rows="3" :placeholder="t('介绍你的投资领域与风格')"></textarea>
        </label>

        <div class="field">
          <span>{{ t("系统语言") }}</span>
          <div class="option-group">
            <button
              class="option-btn"
              :class="{ active: language === 'zh-Hans' }"
              type="button"
              @click="setLanguage('zh-Hans')"
            >
              {{ t("简体") }}
            </button>
            <button
              class="option-btn"
              :class="{ active: language === 'zh-Hant' }"
              type="button"
              @click="setLanguage('zh-Hant')"
            >
              {{ t("繁体") }}
            </button>
          </div>
        </div>

        <div class="field">
          <span>{{ t("感兴趣行业（最多 3 个）") }}</span>
          <div class="tag-grid">
            <button
              v-for="group in groups"
              :key="group.group_id"
              class="tag-btn"
              :class="{ active: selectedGroupIds.includes(group.group_id) }"
              @click="toggleGroup(group.group_id)"
              type="button"
            >
              {{ group.name }}
            </button>
          </div>
        </div>

        <p v-if="error" class="error">{{ error }}</p>

        <button class="btn-primary" :disabled="isLoading" @click="handleSave">
          {{ isLoading ? t("保存中...") : t("保存并进入观点") }}
        </button>
      </section>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { clearAuthCache, getCurrentUserSupabase, signOutSupabase } from "../services/auth.js";
import { applyLanguagePreference, getLanguagePreference } from "../services/preferences.js";
import { t } from "../services/i18n.js";
import {
  getIndustryGroupsSupabase,
  getProfileSupabase,
  getUserGroupsSupabase,
  setUserGroupsSupabase,
  upsertProfileSupabase,
} from "../services/profile.js";

const router = useRouter();
const nickname = ref("");
const bio = ref("");
const email = ref("");
const groups = ref([]);
const selectedGroupIds = ref([]);
const language = ref(getLanguagePreference());
const isLoading = ref(false);
const error = ref("");
const userId = ref(null);
const profileCompleted = ref(false);

const fallbackGroups = [
  { group_id: 1, name: t("半导体与电子") },
  { group_id: 2, name: t("资讯服务") },
  { group_id: 3, name: t("金融") },
  { group_id: 4, name: t("航运") },
  { group_id: 5, name: t("消费") },
  { group_id: 6, name: t("医疗") },
  { group_id: 7, name: t("能源") },
  { group_id: 8, name: t("建材") },
  { group_id: 9, name: t("工业材料") },
  { group_id: 10, name: t("工业制造") },
  { group_id: 11, name: t("其他") },
];

onMounted(async () => {
  const user = await getCurrentUserSupabase();
  if (!user) {
    router.replace("/login");
    return;
  }
  userId.value = user.id;
  email.value = user.email || user.user_metadata?.email || "";

  const [profile, groupList, userGroups] = await Promise.all([
    getProfileSupabase(user.id),
    getIndustryGroupsSupabase(),
    getUserGroupsSupabase(user.id),
  ]);

  if (profile) {
    nickname.value = profile.nickname || "";
    bio.value = profile.bio || "";
    language.value = applyLanguagePreference(
      profile.language || getLanguagePreference()
    );
    profileCompleted.value = Boolean(profile.profile_completed_at);
  }

  const usableGroups = groupList.length ? groupList : fallbackGroups;
  groups.value = usableGroups;
  selectedGroupIds.value = userGroups.map((item) => item.group_id);
});

const toggleGroup = (groupId) => {
  const exists = selectedGroupIds.value.includes(groupId);
  if (exists) {
    selectedGroupIds.value = selectedGroupIds.value.filter((id) => id !== groupId);
    return;
  }
  if (selectedGroupIds.value.length >= 3) {
    error.value = t("最多选择 3 个行业。");
    return;
  }
  error.value = "";
  selectedGroupIds.value = [...selectedGroupIds.value, groupId];
};

const handleSave = async () => {
  if (!nickname.value.trim()) {
    error.value = t("请填写昵称。");
    return;
  }
  if (selectedGroupIds.value.length === 0) {
    error.value = t("请选择至少 1 个行业。");
    return;
  }
  if (!userId.value) {
    error.value = t("登录状态异常，请重新登录。");
    return;
  }
  error.value = "";
  isLoading.value = true;

  try {
    const selectedLanguage = applyLanguagePreference(language.value);
    const profile = await upsertProfileSupabase({
      userId: userId.value,
      nickname: nickname.value.trim(),
      bio: bio.value.trim(),
      language: selectedLanguage,
      completed: true,
    });

    const savedGroups = await setUserGroupsSupabase(
      userId.value,
      selectedGroupIds.value
    );

    if (profile && savedGroups) {
      clearAuthCache();
      router.replace("/feed");
      return;
    }
    error.value = t("保存失败，请稍后重试。");
  } catch (saveError) {
    console.error("保存个人信息失败:", saveError);
    error.value = t("保存失败，请稍后重试。");
  } finally {
    isLoading.value = false;
  }
};

const handleBack = async () => {
  if (profileCompleted.value) {
    router.back();
    return;
  }
  const success = await signOutSupabase();
  if (success) {
    router.replace("/login");
    return;
  }
  error.value = t("退出失败，请稍后重试。");
};

const setLanguage = (value) => {
  language.value = applyLanguagePreference(value);
  window.location.reload();
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
  margin-top: 8px;
}

.title {
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

.option-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.option-btn {
  border: 1px solid var(--border);
  background: var(--panel);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  color: var(--muted);
}

.option-btn.active {
  border-color: var(--ink);
  color: var(--ink);
  background: var(--surface);
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
