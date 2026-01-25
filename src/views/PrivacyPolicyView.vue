<template>
  <div class="app-shell">
    <div class="phone-frame">
      <nav class="nav">
        <button class="nav-btn" type="button" aria-label="返回" @click="handleBack">
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
        <div class="nav-title">隐私政策</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <article class="doc">
        <h1>隐私政策</h1>
        <p class="meta">生效日期：2026年01月24日</p>
        <p>
          我们非常重视您的个人信息和隐私保护。本《隐私政策》将向您说明我们如何收集、使用、存储和保护您的个人信息。
        </p>

        <h2>一、我们收集的信息类型</h2>
        <p>在您使用本产品过程中，我们可能会收集以下信息：</p>
        <ul>
          <li>账户与身份信息：昵称、头像、第三方登录信息（如 Google OAuth 提供的基础信息）。</li>
          <li>使用行为信息：浏览记录、搜索记录、发布的观点、评论、互动行为。</li>
          <li>设备与日志信息：设备类型、操作系统、浏览器信息、IP 地址、访问时间、操作日志。</li>
        </ul>

        <h2>二、信息的使用目的</h2>
        <ul>
          <li>提供和维护产品核心功能；</li>
          <li>进行身份验证与安全风控；</li>
          <li>改进产品体验和服务质量；</li>
          <li>遵守法律法规及监管要求。</li>
        </ul>

        <h2>三、信息的存储与保护</h2>
        <p>
          您的个人信息将存储在安全的服务器中，并采取合理的技术和管理措施进行保护。
          我们会在实现本政策所述目的所必需的期限内保留您的信息，法律法规另有规定的除外。
        </p>

        <h2>四、信息的共享与披露</h2>
        <ul>
          <li>我们不会出售或出租您的个人信息。</li>
          <li>仅在以下情况下，可能共享或披露信息：取得您的明确同意；根据法律法规、监管要求或司法机关要求；为保障用户或公众的合法权益。</li>
        </ul>

        <h2>五、第三方服务说明</h2>
        <p>本产品可能接入第三方服务（如登录、统计、云服务）。第三方将按照其自身隐私政策处理相关信息，我们建议您查阅其隐私政策。</p>

        <h2>六、您的权利</h2>
        <ul>
          <li>查询、更正或删除您的个人信息；</li>
          <li>注销账户；</li>
          <li>撤回授权（可能影响部分功能使用）。</li>
        </ul>

        <h2>七、未成年人保护</h2>
        <p>如您为未成年人，请在监护人指导下使用本产品。我们不会主动收集未成年人个人信息。</p>

        <h2>八、隐私政策的更新</h2>
        <p>我们可能不定期更新本隐私政策，并在产品内进行提示。更新后继续使用即视为您已接受新的隐私政策。</p>

        <h2>九、联系我们</h2>
        <p>如您对隐私政策有任何疑问、建议或投诉，请联系我们：</p>
        <p>联系邮箱：pai.product.manager@gmail.com</p>
      </article>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";

const router = useRouter();

const handleBack = () => {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  router.replace("/login");
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

.doc {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  padding: 16px;
  display: grid;
  gap: 12px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--ink);
}

.doc h1 {
  margin: 0;
  font-size: 18px;
}

.doc h2 {
  margin: 8px 0 0;
  font-size: 15px;
}

.doc ul {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 6px;
}

.meta {
  font-size: 12px;
  color: var(--muted);
  margin: 0;
}
</style>
