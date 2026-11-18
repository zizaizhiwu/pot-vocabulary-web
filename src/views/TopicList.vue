<template>
  <main class="layout">
    <aside class="sidebar">
      <div class="side-title">收藏夹</div>

      <div class="side-row">
        <button
          class="side-item"
          :class="{ active: selectedCollectionId === null }"
          @click="selectCollection(null)"
        >
          <span class="side-name">全部</span>
          <span class="side-count">{{ totalAll }}</span>
        </button>
        <span class="side-del-ghost" aria-hidden="true">×</span>
      </div>

      <div
        v-for="c in collections"
        :key="c.id"
        class="side-row"
        :class="{ 'drop-target': draggedId !== null && dropTarget === c.id }"
        @dragover.prevent="draggedId !== null && (dropTarget = c.id)"
        @dragleave="dropTarget === c.id && (dropTarget = null)"
        @drop.prevent="onDropTo(c)"
      >
        <button
          class="side-item"
          :class="{ active: selectedCollectionId === c.id }"
          @click="selectCollection(c.id)"
        >
          <span class="side-name">{{ c.name }}</span>
          <span class="side-count">{{ c.topicCount }}</span>
        </button>
        <button
          v-if="!c.isDefault"
          class="side-del"
          title="删除收藏夹"
          @click.stop="askDeleteCollection(c)"
        >×</button>
        <span v-else class="side-del-ghost" aria-hidden="true">×</span>
      </div>

      <form v-if="adding" class="side-add" @submit.prevent="submitCollection">
        <input
          ref="newNameInput"
          v-model="newName"
          maxlength="64"
          placeholder="收藏夹名称"
          @keyup.esc="adding = false"
        />
        <div class="side-add-actions">
          <button type="button" class="btn ghost sm" @click="adding = false">取消</button>
          <button type="submit" class="btn primary sm" :disabled="creating">确定</button>
        </div>
      </form>
      <button v-else class="side-new" @click="openAdd">＋ 新建收藏夹</button>

      <p class="side-hint">拖动单词到收藏夹 = 移动</p>
    </aside>

    <section class="content">
      <div class="toolbar">
        <form class="search" @submit.prevent="search">
          <input
            v-model="keyword"
            type="search"
            placeholder="搜索单词、句子或译文…"
            @search.prevent="search"
          />
          <button v-if="submitted" type="button" class="btn ghost" @click="reset">重置</button>
          <button type="submit" class="btn primary">搜索</button>
        </form>
        <button
          class="btn ghost sm multi-toggle"
          :class="{ 'multi-on': multiMode }"
          @click="toggleMultiMode"
        >{{ multiMode ? '退出多选' : '多选' }}</button>
        <label class="size-select-wrap">
          每页
          <select v-model.number="size" class="size-select" @change="onSizeChange">
            <option v-for="s in sizeOptions" :key="s" :value="s">{{ s }}</option>
          </select>
          条
        </label>
      </div>

      <div v-if="languages.length" class="lang-bar">
        <span class="lang-label">语言</span>
        <button
          class="lang-chip"
          :class="{ active: !selectedLangs.length }"
          @click="clearLangs"
        >全部</button>
        <button
          v-for="lang in languages"
          :key="lang.code"
          class="lang-chip"
          :class="{ active: selectedLangs.includes(lang.code) }"
          @click="toggleLang(lang.code)"
        >
          {{ lang.label }}
          <span class="lang-count">{{ lang.count }}</span>
        </button>
      </div>

      <div v-if="multiMode && selectedCount > 0" class="batch-bar">
        <span class="batch-info">已选 {{ selectedCount }} 项</span>
        <div class="batch-actions">
          <button class="btn ghost sm" @click="openBatchCollect">收藏到…</button>
          <MoveMenu
            :collections="collections"
            :current-id="null"
            label="移动到…"
            @select="batchMoveTo"
          />
          <button class="btn ghost sm danger-text" @click="askBatchDelete">删除</button>
          <button class="clear-btn" @click="clearSelection">清空选择</button>
        </div>
      </div>

      <div v-if="loading" class="state">加载中…</div>

      <div v-else-if="error" class="state error">
        <p>{{ error }}</p>
        <button class="btn primary" @click="load">重试</button>
      </div>

      <div v-else-if="!records.length" class="state">
        <p>{{ submitted ? `没有找到包含 “${submitted}” 的生词` : '这个收藏夹还是空的，去 Pot 里收藏一个单词吧' }}</p>
      </div>

      <template v-else>
        <div v-if="multiMode" class="select-all-row">
          <label class="check-label">
            <input
              type="checkbox"
              :checked="allSelected"
              @change="toggleSelectAll"
            />
            全选本页
          </label>
        </div>
        <ul class="list">
          <li v-for="item in records" :key="item.id">
            <div
              class="card"
              :class="{ dragging: draggedId === item.id, checked: selectedMap[item.id] }"
              draggable="true"
              @dragstart="onDragStart(item.id)"
              @dragend="onDragEnd"
            >
              <label v-if="multiMode" class="card-check" @click.stop @dragover.stop>
                <input
                  type="checkbox"
                  :checked="selectedMap[item.id]"
                  @change="toggleSelect(item.id)"
                />
              </label>
              <button class="card-open" @click="multiMode ? toggleSelect(item.id) : open(item.id)">
                <span class="card-main">
                  <span class="word">{{ item.sourceText }}</span>
                  <span class="meta">
                    <span v-for="c in item.collections" :key="c.id" class="badge">{{ c.name }}</span>
                    <span v-if="!item.collections.length" class="badge none">未收藏</span>
                    <span v-if="item.sourceLang" class="badge lang">{{ langLabel(item.sourceLang) }}</span>
                    <span class="time">{{ item.createdAt }}</span>
                  </span>
                </span>
              </button>
              <span class="card-actions">
                <button class="collect-btn" @click.stop="openSingleCollect(item)">收藏到</button>
                <button class="del-btn" @click.stop="askDelete(item)">删除</button>
              </span>
            </div>
          </li>
        </ul>
      </template>

      <nav v-if="!loading && !error && total > 0" class="pager">
        <button class="btn ghost" :disabled="page <= 1" @click="go(page - 1)">上一页</button>
        <span class="pager-info">第 {{ page }} / {{ totalPages }} 页 · 共 {{ total }} 条</span>
        <button class="btn ghost" :disabled="page >= totalPages" @click="go(page + 1)">下一页</button>
      </nav>
    </section>

    <ConfirmDialog
      :open="confirmState.open"
      :title="confirmState.title"
      :message="confirmState.message"
      :danger="confirmState.danger"
      :confirm-text="confirmState.confirmText"
      @confirm="confirmState.onConfirm && confirmState.onConfirm()"
      @cancel="confirmState.open = false"
    />

    <CollectionsPickerDialog
      :open="picker.open"
      :collections="collections"
      :message="picker.message"
      :selected-ids="picker.selectedIds"
      confirm-text="保存"
      @confirm="doBatchCollect"
      @refresh="loadCollections"
      @cancel="picker.open = false"
    />

    <transition name="toast">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>
  </main>
</template>

<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import CollectionsPickerDialog from '../components/CollectionsPickerDialog.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import MoveMenu from '../components/MoveMenu.vue'
import {
  batchAddToCollections,
  batchDeleteTopics,
  batchMoveTopics,
  batchRemoveFromCollections,
  createCollection,
  deleteCollection,
  deleteTopic,
  fetchCollections,
  fetchLanguages,
  fetchTopicList,
  moveTopic,
} from '../api'

const router = useRouter()

const SIZE_KEY = 'vocab-page-size'
const sizeOptions = [20, 40, 60, 80, 100]

const keyword = ref('')
const submitted = ref('')
const page = ref(1)
const size = ref(validSize(parseInt(localStorage.getItem(SIZE_KEY), 10)))
const total = ref(0)
const records = ref([])
const loading = ref(true)
const error = ref('')

const collections = ref([])
const selectedCollectionId = ref(null)

const languages = ref([])
const selectedLangs = ref([])

const multiMode = ref(false)
const selectedMap = ref({})
const selectedCount = computed(
  () => Object.values(selectedMap.value).filter(Boolean).length
)
const allSelected = computed(
  () => records.value.length > 0 && records.value.every((item) => selectedMap.value[item.id])
)

const picker = ref({ open: false, message: '', selectedIds: [] })
const pickerTopicIds = ref([])

const confirmState = ref({
  open: false,
  title: '确认操作',
  message: '',
  confirmText: '确定',
  danger: false,
  onConfirm: null,
})

const adding = ref(false)
const newName = ref('')
const creating = ref(false)
const newNameInput = ref(null)

const draggedId = ref(null)
const dropTarget = ref(null)

const toast = ref('')
let toastTimer = null

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / size.value)))
const totalAll = computed(() => collections.value.reduce((sum, c) => sum + c.topicCount, 0))

function validSize(value) {
  return sizeOptions.includes(value) ? value : 20
}

function showToast(message) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}

function openConfirm({ title, message, confirmText = '确定', danger = false, onConfirm }) {
  confirmState.value = { open: true, title, message, confirmText, danger, onConfirm }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await fetchTopicList({
      page: page.value,
      size: size.value,
      keyword: submitted.value,
      collectionId: selectedCollectionId.value,
      sourceLangs: selectedLangs.value,
    })
    records.value = data.records
    total.value = data.total
    // 清掉已不在当前页的选择
    const ids = new Set(records.value.map((item) => item.id))
    const next = {}
    for (const [id, checked] of Object.entries(selectedMap.value)) {
      if (checked && ids.has(Number(id))) next[id] = true
    }
    selectedMap.value = next
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function loadCollections() {
  try {
    collections.value = await fetchCollections()
  } catch {
    /* 侧边栏加载失败不阻塞主列表 */
  }
}

async function loadLanguages() {
  try {
    languages.value = await fetchLanguages()
  } catch {
    /* 语言筛选条加载失败不阻塞主列表 */
  }
}

function langLabel(code) {
  const found = languages.value.find((item) => item.code === code)
  return found ? found.label : code.toUpperCase()
}

function toggleLang(code) {
  const index = selectedLangs.value.indexOf(code)
  if (index >= 0) {
    selectedLangs.value.splice(index, 1)
  } else {
    selectedLangs.value.push(code)
  }
  page.value = 1
  load()
}

function clearLangs() {
  selectedLangs.value = []
  page.value = 1
  load()
}

function selectCollection(id) {
  selectedCollectionId.value = id
  page.value = 1
  load()
}

function search() {
  submitted.value = keyword.value.trim()
  page.value = 1
  load()
}

function reset() {
  keyword.value = ''
  submitted.value = ''
  page.value = 1
  load()
}

function go(p) {
  if (p < 1 || p > totalPages.value || p === page.value) return
  page.value = p
  load()
}

function onSizeChange() {
  localStorage.setItem(SIZE_KEY, String(size.value))
  page.value = 1
  load()
}

function open(id) {
  router.push(`/topics/${id}`)
}

/* ---------- 勾选与批量操作 ---------- */

function toggleMultiMode() {
  multiMode.value = !multiMode.value
  // 退出多选时清空选择，避免隐藏的选中状态残留
  if (!multiMode.value) {
    clearSelection()
  }
}

function toggleSelect(id) {
  selectedMap.value = { ...selectedMap.value, [id]: !selectedMap.value[id] }
}

function toggleSelectAll() {
  const target = !allSelected.value
  const next = { ...selectedMap.value }
  for (const item of records.value) {
    next[item.id] = target
  }
  selectedMap.value = next
}

function clearSelection() {
  selectedMap.value = {}
}

function selectedIds() {
  return Object.entries(selectedMap.value)
    .filter(([, checked]) => checked)
    .map(([id]) => Number(id))
}

function openBatchCollect() {
  pickerTopicIds.value = selectedIds()
  picker.value = {
    open: true,
    message: `为选中的 ${selectedCount.value} 个单词勾选收藏夹（批量操作不预勾选，新增勾选即收藏）`,
    selectedIds: [],
  }
}

function openSingleCollect(topic) {
  pickerTopicIds.value = [topic.id]
  picker.value = {
    open: true,
    message: `「${topic.sourceText}」已在勾选的收藏夹中；取消勾选会取消收藏`,
    selectedIds: topic.collections.map((c) => c.id),
  }
}

async function doBatchCollect(payload) {
  const ids = pickerTopicIds.value
  picker.value = { open: false, message: '', selectedIds: [] }
  try {
    if (payload.added.length) {
      await batchAddToCollections(ids, payload.added)
    }
    if (payload.removed.length) {
      await batchRemoveFromCollections(ids, payload.removed)
    }
    if (payload.added.length && payload.removed.length) {
      showToast('已更新收藏')
    } else if (payload.removed.length) {
      showToast('已取消收藏')
    } else {
      showToast(ids.length > 1 ? `已收藏 ${ids.length} 个单词` : '已收藏')
    }
    clearSelection()
    await Promise.all([load(), loadCollections()])
  } catch (e) {
    showToast(e.message)
  }
}

async function batchMoveTo(collection) {
  try {
    await batchMoveTopics(selectedIds(), collection.id)
    showToast(`已移动到「${collection.name}」`)
    clearSelection()
    await Promise.all([load(), loadCollections()])
  } catch (e) {
    showToast(e.message)
  }
}

function askBatchDelete() {
  const count = selectedCount.value
  openConfirm({
    title: '批量删除',
    message: `确定删除选中的 ${count} 个单词吗？它们的全部翻译结果会一并删除，且不可恢复。`,
    confirmText: '删除',
    danger: true,
    onConfirm: doBatchDelete,
  })
}

async function doBatchDelete() {
  const ids = selectedIds()
  confirmState.value = { ...confirmState.value, open: false }
  try {
    await batchDeleteTopics(ids)
    showToast(`已删除 ${ids.length} 个单词`)
    clearSelection()
    if (records.value.length === ids.length && page.value > 1) {
      page.value -= 1
    }
    await Promise.all([load(), loadCollections()])
  } catch (e) {
    showToast(e.message)
  }
}

/* ---------- 拖拽移动 / 单个操作 ---------- */

function onDragStart(id) {
  draggedId.value = id
}

function onDragEnd() {
  draggedId.value = null
  dropTarget.value = null
}

async function onDropTo(collection) {
  const id = draggedId.value
  dropTarget.value = null
  draggedId.value = null
  if (id === null) return
  try {
    await moveTopic(id, collection.id)
    showToast(`已移动到「${collection.name}」`)
    await Promise.all([load(), loadCollections()])
  } catch (e) {
    showToast(e.message)
  }
}

async function moveTo(item, collection) {
  try {
    await moveTopic(item.id, collection.id)
    showToast(`已移动到「${collection.name}」`)
    await Promise.all([load(), loadCollections()])
  } catch (e) {
    showToast(e.message)
  }
}

function askDelete(topic) {
  openConfirm({
    title: '删除单词',
    message: `确定删除「${topic.sourceText}」吗？其全部翻译结果会一并删除，且不可恢复。`,
    confirmText: '删除',
    danger: true,
    onConfirm: () => doDelete(topic),
  })
}

async function doDelete(topic) {
  confirmState.value = { ...confirmState.value, open: false }
  try {
    await deleteTopic(topic.id)
    showToast(`已删除「${topic.sourceText}」`)
    if (records.value.length === 1 && page.value > 1) {
      page.value -= 1
    }
    await Promise.all([load(), loadCollections()])
  } catch (e) {
    showToast(e.message)
  }
}

/* ---------- 收藏夹管理 ---------- */

function openAdd() {
  adding.value = true
  newName.value = ''
  nextTick(() => newNameInput.value && newNameInput.value.focus())
}

async function submitCollection() {
  const name = newName.value.trim()
  if (!name) return
  creating.value = true
  try {
    await createCollection(name)
    adding.value = false
    newName.value = ''
    showToast(`已创建「${name}」`)
    await loadCollections()
  } catch (e) {
    showToast(e.message)
  } finally {
    creating.value = false
  }
}

function askDeleteCollection(collection) {
  openConfirm({
    title: '删除收藏夹',
    message: `确定删除收藏夹「${collection.name}」吗？单词在其它收藏夹中的归属不受影响。`,
    confirmText: '删除',
    danger: true,
    onConfirm: () => doDeleteCollection(collection),
  })
}

async function doDeleteCollection(collection) {
  confirmState.value = { ...confirmState.value, open: false }
  try {
    await deleteCollection(collection.id)
    showToast(`已删除「${collection.name}」`)
    if (selectedCollectionId.value === collection.id) {
      selectedCollectionId.value = null
    }
    await Promise.all([load(), loadCollections()])
  } catch (e) {
    showToast(e.message)
  }
}

onMounted(() => {
  load()
  loadCollections()
  loadLanguages()
})
</script>

<style scoped>
.layout {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  display: flex;
  gap: 18px;
  align-items: flex-start;
}

/* ---------- 侧边栏 ---------- */

.sidebar {
  flex-shrink: 0;
  width: 180px;
  position: sticky;
  top: 76px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.side-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 10px 6px;
}

.side-row {
  display: flex;
  align-items: stretch;
  border-radius: 9px;
}

.side-row .side-item {
  flex: 1;
  min-width: 0;
}

.side-row.drop-target {
  outline: 2px dashed var(--accent);
  outline-offset: -2px;
  background: var(--accent-soft);
}

.side-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  text-align: left;
  font-size: 14px;
  padding: 7px 10px;
  border-radius: 9px;
  color: var(--text);
}

.side-item:hover {
  background: #eceef1;
}

.side-item.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.side-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.side-count {
  flex-shrink: 0;
  min-width: 20px;
  text-align: center;
  font-size: 12px;
  color: var(--muted);
  background: #f1f2f4;
  border-radius: 999px;
  padding: 0 7px;
  line-height: 18px;
}

.side-item.active .side-count {
  color: var(--accent);
  background: #dde3ff;
}

.side-del,
.side-del-ghost {
  flex-shrink: 0;
  width: 22px;
  color: var(--muted);
  font-size: 15px;
  border-radius: 7px;
  margin-right: 2px;
}

/* 占位：让没有删除按钮的行也保留同样的右侧空间，保证收藏夹数字对齐 */
.side-del-ghost {
  visibility: hidden;
}

.side-del:hover {
  color: var(--danger);
  background: #fee2e2;
}

.side-add {
  margin-top: 6px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
}

.side-add input {
  width: 100%;
  font-size: 13px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 7px;
  outline: none;
}

.side-add input:focus {
  border-color: var(--accent);
}

.side-add-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 8px;
}

.side-new {
  margin-top: 6px;
  text-align: left;
  font-size: 13px;
  color: var(--muted);
  padding: 7px 10px;
  border-radius: 9px;
}

.side-new:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

.side-hint {
  margin-top: 12px;
  font-size: 11px;
  color: #b3b9c2;
  padding: 0 10px;
}

/* ---------- 内容区 ---------- */

.content {
  flex: 1;
  min-width: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.search {
  display: flex;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.search input {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.search input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.multi-toggle {
  flex-shrink: 0;
}

.multi-toggle.multi-on {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.size-select-wrap {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--muted);
}

.size-select {
  padding: 7px 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  font-size: 13px;
  outline: none;
  cursor: pointer;
}

.size-select:focus {
  border-color: var(--accent);
}

/* ---------- 语言筛选 ---------- */

.lang-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.lang-label {
  font-size: 12px;
  color: var(--muted);
  margin-right: 2px;
}

.lang-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--text);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 11px;
  transition: border-color 0.12s, background 0.12s, color 0.12s;
}

.lang-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.lang-chip.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.lang-count {
  font-size: 11px;
  color: var(--muted);
}

.lang-chip.active .lang-count {
  color: rgba(255, 255, 255, 0.8);
}

/* ---------- 批量操作条 ---------- */

.batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: var(--accent-soft);
  border: 1px solid var(--accent);
  border-radius: 10px;
  padding: 8px 14px;
  margin-bottom: 12px;
}

.batch-info {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  flex-shrink: 0;
}

.batch-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.danger-text:hover {
  color: var(--danger) !important;
  border-color: var(--danger) !important;
}

.clear-btn {
  font-size: 13px;
  color: var(--muted);
  padding: 5px 8px;
  border-radius: 7px;
}

.clear-btn:hover {
  color: var(--text);
}

/* ---------- 列表 ---------- */

.select-all-row {
  margin-bottom: 8px;
}

.check-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
  padding: 2px 4px;
}

.check-label input {
  width: 15px;
  height: 15px;
  accent-color: var(--accent);
  cursor: pointer;
}

.list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.card {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 14px 12px 10px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  transition: transform 0.12s, border-color 0.12s, opacity 0.12s, background 0.12s;
}

.card:hover {
  border-color: var(--accent);
}

.card.checked {
  background: #f5f7ff;
  border-color: var(--accent);
}

.card.dragging {
  opacity: 0.45;
}

.card-check {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  padding: 4px;
  cursor: pointer;
}

.card-check input {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
  cursor: pointer;
}

.card-open {
  flex: 1;
  min-width: 0;
  display: flex;
  text-align: left;
}

.card-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.word {
  font-size: 17px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.badge {
  font-size: 12px;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 1px 9px;
}

.collect-btn {
  font-size: 12px;
  color: var(--accent);
  padding: 3px 8px;
  border-radius: 7px;
  white-space: nowrap;
}

.collect-btn:hover {
  background: var(--accent-soft);
}

.badge.none {
  color: #b3b9c2;
  background: #f5f6f8;
  border: 1px dashed #d8dce2;
}

.badge.lang {
  color: #6b7280;
  background: #f1f2f4;
}

.time {
  font-size: 12px;
  color: var(--muted);
}

.card-actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 2px;
}

.del-btn {
  font-size: 12px;
  color: var(--muted);
  padding: 3px 8px;
  border-radius: 7px;
}

.del-btn:hover {
  color: var(--danger);
  background: #fee2e2;
}

.pager {
  margin-top: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
}

.pager-info {
  color: var(--muted);
  font-size: 13px;
}

.state {
  padding: 56px 16px;
  text-align: center;
  color: var(--muted);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.state.error p {
  color: var(--danger);
}

/* ---------- 轻提示 ---------- */

.toast {
  position: fixed;
  left: 50%;
  bottom: 36px;
  transform: translateX(-50%);
  z-index: 120;
  background: rgba(31, 35, 40, 0.92);
  color: #fff;
  font-size: 13px;
  padding: 9px 18px;
  border-radius: 999px;
  box-shadow: 0 8px 24px rgba(16, 24, 40, 0.25);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

@media (max-width: 720px) {
  .layout {
    flex-direction: column;
  }

  .sidebar {
    position: static;
    width: 100%;
  }

  .side-hint {
    display: none;
  }
}
</style>
