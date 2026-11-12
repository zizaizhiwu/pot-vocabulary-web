<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @click.self="$emit('cancel')">
      <div class="dialog" role="dialog" aria-modal="true">
        <h3 class="title">{{ title }}</h3>
        <p class="message">{{ message }}</p>
        <div class="actions">
          <button class="btn ghost" @click="$emit('cancel')">{{ cancelText }}</button>
          <button class="btn" :class="danger ? 'danger' : 'primary'" @click="$emit('confirm')">
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '确认操作' },
  message: { type: String, required: true },
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' },
  danger: { type: Boolean, default: false },
})

defineEmits(['confirm', 'cancel'])
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(15, 18, 25, 0.45);
  display: grid;
  place-items: center;
  padding: 16px;
}

.dialog {
  width: 100%;
  max-width: 380px;
  background: var(--card);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(16, 24, 40, 0.18);
  padding: 20px;
}

.title {
  font-size: 16px;
  font-weight: 700;
}

.message {
  margin-top: 8px;
  color: var(--muted);
  font-size: 14px;
  word-break: break-word;
}

.actions {
  margin-top: 18px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
