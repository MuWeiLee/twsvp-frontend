<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <router-link class="nav-logo" to="/feed" aria-label="TWSVP">T</router-link>
        <div class="nav-title">通知</div>
        <router-link class="nav-btn" to="/search">搜索</router-link>
      </nav>

      <section class="list">
        <div class="item">
          <strong>观点已到期</strong>
          <span>你的观点「2330 台积电」已进入结算。</span>
        </div>
        <div class="item">
          <strong>新互动</strong>
          <span>有用户收藏了你的观点。</span>
        </div>
        <div class="item">
          <strong>热门话题更新</strong>
          <span>#AI概念股 讨论热度上升。</span>
        </div>
      </section>

      <nav class="tabbar">
        <router-link class="tab-item" active-class="active" to="/feed">广场</router-link>
        <router-link class="tab-item" active-class="active" to="/search">搜索</router-link>
        <router-link class="tab-item" :to="{ path: '/feed', hash: '#publish' }">
          发布
        </router-link>
        <router-link class="tab-item" active-class="active" to="/notifications">通知</router-link>
        <router-link class="tab-item" active-class="active" to="/profile">我的</router-link>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  max-width: 480px;
  margin: 0 auto;
  background: var(--card);
}

.phone-frame {
  width: 100%;
  min-height: 100vh;
  background: var(--card);
  border-radius: 0;
  box-shadow: none;
  padding: 72px 20px 96px;
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
  background: var(--card);
  border-bottom: 1px solid var(--border);
  z-index: 5;
}

.nav-title {
  font-family: "Manrope", "Noto Sans SC", sans-serif;
  font-weight: 700;
  font-size: 16px;
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
}

.nav-btn {
  border: 1px solid var(--border);
  background: #fff;
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  color: var(--ink);
}

.nav-logo {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  background: #111;
  display: grid;
  place-items: center;
  font-family: "Manrope", "Noto Sans SC", sans-serif;
  font-weight: 700;
  color: #fff;
  border: 0;
  text-decoration: none;
}

.list {
  display: grid;
  gap: 12px;
}

.item {
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 12px 14px;
  display: grid;
  gap: 4px;
  background: #fff;
}

.item span {
  font-size: 12px;
  color: var(--muted);
}

.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  bottom: 0;
  margin-top: 0;
  min-height: 48px;
  padding: 12px 6px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  background: #fff;
  border-top: 1px solid var(--border);
  z-index: 5;
}

.tab-item {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
  text-decoration: none;
  display: block;
  width: 100%;
}

.tab-item.active {
  color: var(--ink);
  font-weight: 600;
}

@media (max-width: 480px) {
  .phone-frame {
    padding: 68px 16px 88px;
  }
}
</style>
