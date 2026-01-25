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
        <div class="nav-title">用户协议</div>
        <span class="nav-space" aria-hidden="true"></span>
      </nav>

      <article class="doc">
        <h1>用户协议</h1>
        <p class="meta">生效日期：2026年01月24日</p>
        <p>
          欢迎使用 TWSVP（以下简称“本产品”或“我们”）。
          在您注册、登录或使用本产品前，请您务必仔细阅读并充分理解本《用户协议》（以下简称“本协议”）。
          您点击“同意”、注册或实际使用本产品，即视为您已阅读并同意本协议的全部内容。
        </p>

        <h2>一、协议的适用范围</h2>
        <p>本协议适用于您通过网页、移动网页、App 等形式使用 TWSVP 提供的全部产品和服务。</p>
        <p>如我们另行发布单独的服务规则、公告或补充协议，该等内容构成本协议不可分割的一部分，与本协议具有同等法律效力。</p>

        <h2>二、账户注册与使用</h2>
        <ul>
          <li>您需使用真实、合法、有效的信息完成注册，并对账户下的所有行为负责。</li>
          <li>您应妥善保管账户信息，不得将账户出借、转让或出售给他人。</li>
          <li>因您自身原因导致账户信息泄露、被盗用的，由您自行承担相应责任。</li>
        </ul>

        <h2>三、用户行为规范</h2>
        <p>您在使用本产品过程中，不得从事以下行为：</p>
        <ul>
          <li>违反法律法规、监管规定或公共秩序的行为；</li>
          <li>发布虚假、误导性、欺诈性信息；</li>
          <li>传播淫秽、暴力、恐怖、仇恨、歧视等内容；</li>
          <li>未经授权收集、使用他人个人信息；</li>
          <li>利用本产品从事任何形式的商业推广、刷量、作弊行为；</li>
          <li>干扰、破坏本产品的正常运行。</li>
        </ul>
        <p>如您违反上述规定，我们有权视情节采取包括但不限于：警告、限制功能、暂停或终止账户服务等措施。</p>

        <h2>四、内容与观点声明</h2>
        <ul>
          <li>本产品中的用户观点、评论、分析内容均由用户自行发布，仅代表其个人立场。</li>
          <li>本产品不构成任何形式的投资建议、要约或保证。</li>
          <li>用户应基于自身判断进行投资决策，并自行承担相关风险。</li>
        </ul>

        <h2>五、知识产权</h2>
        <p>
          本产品及其相关内容（包括但不限于文字、图形、界面设计、程序代码等）的知识产权归我们或相关权利人所有。
          未经许可，任何个人或组织不得擅自复制、修改、传播、商业使用。
        </p>

        <h2>六、服务的变更、中断与终止</h2>
        <ul>
          <li>我们有权根据业务发展需要对服务内容进行调整、升级或终止。</li>
          <li>因系统维护、网络故障、不可抗力等原因造成的服务中断，我们将尽合理努力减少影响，但不承担由此产生的责任。</li>
        </ul>

        <h2>七、免责声明</h2>
        <ul>
          <li>我们不保证服务的持续性、及时性、准确性和完全无误。</li>
          <li>因用户自身操作、第三方原因或不可抗力导致的损失，我们不承担责任。</li>
          <li>用户因使用本产品进行投资或交易所产生的任何损失，由用户自行承担。</li>
        </ul>

        <h2>八、协议的修改</h2>
        <p>我们有权不定期更新本协议内容。协议更新后将在产品内或官网公示，如您继续使用本产品，即视为接受修改后的协议。</p>

        <h2>九、适用法律与争议解决</h2>
        <p>
          本协议的订立、执行与解释适用中华人民共和国法律（不含冲突法规则）。
          如发生争议，双方应友好协商解决；协商不成的，提交有管辖权的人民法院解决。
        </p>

        <h2>十、联系我们</h2>
        <p>如您对本协议有任何疑问，可通过以下方式联系我们：</p>
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
  max-width: 375px;
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
  max-width: 375px;
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
