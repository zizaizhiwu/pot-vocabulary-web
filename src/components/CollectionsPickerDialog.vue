<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @click.self="cancel">
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

        <div class="create-row">
          <input
            v-model="newName"
            class="create-input"
            type="text"
            maxlength="64"
            placeholder="新建收藏夹…"
            @keyup.enter="doCreate"
          />
          <button class="btn ghost sm create-btn" :disabled="!newName.trim() || creating" @click="doCreate">
            {{ creating ? '创建中…' : '新建' }}
          </button>
        </div>
        <p v-if="createError" class="create-error">{{ createError }}</p>

        <div class="actions">
          <button class="btn ghost" @click="cancel">{{ cancelText }}</button>
          <button
            class="btn primary"
            :disabled="!changed"
            @click="confirm"
          >{{ confirmText }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { createCollection } from '../api'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '收藏到' },
  message: { type: String, default: '' },
  /** 打开时预勾选的收藏夹 id（通常是该单词已在的收藏夹） */
  selectedIds: { type: Array, default: () => [] },
  confirmText: { type: String, default: '确定' },
  cancelText: { type: String, default: '取消' },
  collections: { type: Array, default: () => [] },
})

const emit = defineEmits(['confirm', 'cancel', 'refresh'])

const checked = ref([])
const newName = ref('')
const creating = ref(false)
const createError = ref('')

// 本次相对打开时的勾选变化
const added = computed(() =>
  checked.value.filter((id) => !props.selectedIds.includes(id))
)
const removed = computed(() =>
  props.selectedIds.filter((id) => !checked.value.includes(id))
)
const changed = computed(() => added.value.length > 0 || removed.value.length > 0)

watch(
  () => props.open,
  (open) => {
    if (open) {
      checked.value = [...props.selectedIds]
      newName.value = ''
      createError.value = ''
    }
  }
)

// 父组件刷新收藏夹列表后，把新建的收藏夹自动勾选上
watch(
  () => props.collections.length,
  () => {
    const known = new Set(props.collections.map((c) => c.id))
    checked.value = checked.value.filter((id) => known.has(id))
    for (const c of props.collections) {
      if (justCreatedId.value === c.id && !checked.value.includes(c.id)) {
        checked.value.push(c.id)
      }
    }
  }
)

const justCreatedId = ref(null)

function cancel() {
  emit('cancel')
}

async function doCreate() {
  const name = newName.value.trim()
  if (!name || creating.value) return
  creating.value = true
  createError.value = ''
  try {
    const created = await createCollection(name)
    justCreatedId.value = created.id
    newName.value = ''
    emit('refresh')
  } catch (e) {
    createError.value = e.message
  } finally {
    creating.value = false
  }
}

function confirm() {
  if (!changed.value) return
  emit('confirm', {
    added: [...added.value],
    removed: [...removed.value],
    checked: [...checked.value],
  })
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

.create-row {
  margin-top: 10px;
  display: flex;
  gap: 8px;
}

.create-input {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  padding: 7px 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fff;
}

.create-input:focus {
  outline: none;
  border-color: var(--accent);
}

.create-btn {
  flex-shrink: 0;
}

.create-error {
  margin-top: 6px;
  font-size: 12px;
  color: var(--danger);
}

.actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
