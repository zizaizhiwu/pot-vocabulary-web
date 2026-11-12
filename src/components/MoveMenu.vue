<template>
  <div ref="root" class="move-menu">
    <button class="menu-btn" :disabled="disabled" @click.stop="open = !open">{{ label }}</button>
    <div v-if="open" class="menu-pop">
      <button
        v-for="c in collections"
        :key="c.id"
        class="menu-item"
        :class="{ current: c.id === currentId }"
        @click.stop="choose(c)"
      >
        <span class="menu-name">{{ c.name }}</span>
        <span v-if="c.id === currentId" class="tick">✓</span>
      </button>
      <div v-if="!collections.length" class="menu-empty">暂无收藏夹</div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

const props = defineProps({
  collections: { type: Array, default: () => [] },
  currentId: { type: Number, default: null },
  disabled: { type: Boolean, default: false },
  label: { type: String, default: '移动' },
})

const emit = defineEmits(['select'])

const open = ref(false)
const root = ref(null)

function choose(collection) {
  open.value = false
  if (collection.id !== props.currentId) {
    emit('select', collection)
  }
}

function onDocClick(e) {
  if (root.value && !root.value.contains(e.target)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onUnmounted(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
.move-menu {
  position: relative;
  display: inline-block;
}

.menu-btn {
  font-size: 12px;
  color: var(--muted);
  padding: 3px 8px;
  border-radius: 7px;
  border: 1px solid transparent;
}

.menu-btn:hover:not(:disabled) {
  color: var(--accent);
  background: var(--accent-soft);
}

.menu-pop {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 30;
  min-width: 140px;
  max-height: 220px;
  overflow-y: auto;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(16, 24, 40, 0.14);
  padding: 4px;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
  font-size: 13px;
  padding: 7px 10px;
  border-radius: 7px;
}

.menu-item:hover {
  background: var(--accent-soft);
  color: var(--accent);
}

.menu-item.current {
  color: var(--accent);
  font-weight: 600;
}

.menu-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tick {
  flex-shrink: 0;
  font-size: 12px;
}

.menu-empty {
  font-size: 12px;
  color: var(--muted);
  text-align: center;
  padding: 10px;
}
</style>
