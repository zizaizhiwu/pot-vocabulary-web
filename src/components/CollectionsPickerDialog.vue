<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @click.self="$emit('cancel')">
      <div class="dialog" role="dialog" aria-modal="true">
        <h3 class="title">{{ title }}</h3>
        <p class="message">{{ message }}</p>
        <div class="collection-list">
          <label v-for="c in collections" :key="c.id" class="collection-item">
            <input
              type="checkbox"
              :value="c.id"
              v-model="checked"
            />
            <span class="name">{{ c.name }}</span>
            <span class="count">{{ c.topicCount }}</span>
          </label>
          <div v-if="!collections.length" class="empty">暂无收藏夹</div>
        </div>
        <div class="actions">
          <button class="btn ghost" @click="$emit('cancel')">{{ cancelText }}</button>
          <button
            class="btn primary"
            :disabled="!checked.length"
            @click="confirm"
          >{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '收藏到' },
  message: { type: String, default: '' },
  /** 预勾选的收藏夹 id */
  selectedIds: { type: Array, default: () => [] },
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' },
  collections: { type: Array, default: () => [] },
})

const emit = defineEmits(['confirm', 'cancel'])

const checked = ref([])

watch(
  () => props.open,
  (open) => {
    if (open) {
      checked.value = [...props.selectedIds]
    }
  }
)

function confirm() {
  if (!checked.value.length) return
  emit('confirm', [...checked.value])
  emit('cancel')
}
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
  max-width: 360px;
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
  margin-top: 6px;
  color: var(--muted);
  font-size: 13px;
}

.collection-list {
  margin-top: 12px;
  max-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.collection-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.collection-item:hover {
  background: #f2f4f7;
}

.collection-item input[type='checkbox'] {
  width: 15px;
  height: 15px;
  accent-color: var(--accent);
  cursor: pointer;
}

.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  font-size: 12px;
  color: var(--muted);
  background: #f1f2f4;
  border-radius: 999px;
  padding: 0 7px;
  line-height: 18px;
}

.empty {
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  padding: 16px;
}

.actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
