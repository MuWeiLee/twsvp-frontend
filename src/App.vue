<template>
  <router-view />
  <AppToast />
  <AppConfirm />
</template>

<script setup>
import AppToast from "./components/AppToast.vue";
import AppConfirm from "./components/AppConfirm.vue";
</script>
