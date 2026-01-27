<template>
  <div class="app-shell">
    <div class="phone-frame">
      <CreateFeedPanel @close="handleClose" @published="handlePublished" />
      <BottomTabbar />
    </div>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router";
import BottomTabbar from "../components/BottomTabbar.vue";
import CreateFeedPanel from "../components/CreateFeedPanel.vue";

const router = useRouter();

const handleClose = () => {
  router.replace("/feed");
};

const handlePublished = () => {
  router.replace("/feed");
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
  padding: 76px 16px 170px;
  position: relative;
}
</style>
