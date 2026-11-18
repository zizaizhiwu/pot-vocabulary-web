<template>
  <main class="page">
    <div class="topbar">
      <div class="topbar-left">
        <button class="back" @click="router.push('/')">← 返回列表</button>
        <span v-if="topic" class="topbar-pager">
          <button class="pager-btn" :disabled="!prevAvailable" @click="go('prev')">← 上一个</button>
          <button class="pager-btn" :disabled="!nextAvailable" @click="go('next')">下一个 →</button>
        </span>
      </div>
      <div v-if="topic" class="topbar-actions">
        <button class="collect-btn" @click="pickerOpen = true">收藏到…</button>
        <MoveMenu
          :collections="collections"
          :current-id="null"
          @select="moveTo"
        />
        <button class="del-btn" @click="deleteConfirm = true">删除</button>
      </div>
    </div>

    <div v-if="loading" class="state">加载中…</div>

    <div v-else-if="error" class="state error">
      <p>{{ error }}</p>
      <button class="btn primary" @click="load">重试</button>
    </div>

    <template v-else-if="topic">
      <div class="detail-layout">
        <div class="detail-main">
          <section class="detail-card">
            <h1 class="word">{{ topic.sourceText }}</h1>
            <div class="meta">
              <span v-for="c in topic.collections" :key="c.id" class="badge">{{ c.name }}</span>
              <span v-if="!topic.collections.length" class="badge none">未收藏</span>
              <span v-if="topic.sourceLang || topic.targetLang" class="badge">
                {{ topic.sourceLang || '?' }} → {{ topic.targetLang || '?' }}
              </span>
              <span class="badge">{{ topic.resultCount }} 条翻译</span>
              <span class="time">收藏于 {{ topic.createdAt }}</span>
            </div>
          </section>

          <div v-if="topic.results.length" class="blur-toggle">
            <button class="link-btn" @click="toggleAll">
              {{ allRevealed ? '隐藏全部翻译' : '显示全部翻译' }}
            </button>
          </div>

          <section v-if="topic.results.length" class="results">
            <article v-for="item in topic.results" :key="item.id" class="result-card">
              <header>
                <span v-if="item.provider" class="provider">{{ item.provider }}</span>
                <span v-else class="provider-fallback">翻译结果</span>
                <span class="time">{{ item.updatedAt }}</span>
              </header>
              <div
                class="result-body"
                :class="{ blurred: isBlurred(item.id) }"
                @click="reveal(item.id)"
              >
                <p class="content">{{ item.contentText }}</p>
                <details v-if="item.contentJson">
                  <summary>原始数据</summary>
                  <pre>{{ item.contentJson }}</pre>
                </details>
                <span v-if="isBlurred(item.id)" class="blur-hint">点击查看翻译</span>
              </div>
            </article>
          </section>

          <div v-else class="state">暂无翻译结果</div>

          <nav class="pager">
            <button class="btn ghost" :disabled="!prevAvailable" @click="go('prev')">← 上一个</button>
            <button class="btn primary" :disabled="!nextAvailable" @click="go('next')">下一个 →</button>
          </nav>
          <p class="hint">键盘 ← / → 也可以切换</p>
        </div>

        <aside class="similar-panel">
          <div class="similar-head">
            <span class="similar-title">
              相似词
              <span class="similar-count">{{ similarTopics.length }}</span>
            </span>
            <button class="similar-add" @click="similarPickerOpen = true">＋ 关联</button>
          </div>

          <ul v-if="similarTopics.length" class="similar-list">
            <li v-for="item in similarTopics" :key="item.id" class="similar-item">
              <div class="similar-row" @click="toggleSimilar(item.id)">
                <span class="similar-word">{{ item.sourceText }}</span>
                <span class="similar-chev">{{ expandedSimilar[item.id] ? '▴' : '▾' }}</span>
                <button
                  class="similar-del"
                  title="解除关联"
                  @click.stop="unlinkSimilar(item)"
                >×</button>
              </div>
              <p v-if="expandedSimilar[item.id]" class="similar-preview">
                {{ item.preview || '暂无译文' }}
              </p>
            </li>
          </ul>
          <p v-else class="similar-empty">暂无相似词，点「关联」添加</p>
        </aside>
      </div>
    </template>

    <CollectionsPickerDialog
      :open="pickerOpen"
      :collections="collections"
      :selected-ids="currentCollectionIds"
      message="已在勾选的收藏夹中；取消勾选会取消收藏，也可以在下方新建收藏夹"
      confirm-text="保存"
      @confirm="doCollectTo"
      @refresh="loadCollections"
      @cancel="pickerOpen = false"
    />

    <SimilarPickerDialog
      :open="similarPickerOpen"
      :current-id="topic ? topic.id : null"
      :linked-ids="similarTopics.map((s) => s.id)"
      @confirm="doAddSimilar"
      @cancel="similarPickerOpen = false"
    />

    <ConfirmDialog
      :open="deleteConfirm"
      title="删除单词"
      :message="topic ? `确定删除「${topic.sourceText}」吗？其全部翻译结果会一并删除，且不可恢复。` : ''"
      confirm-text="删除"
      danger
      @confirm="doDelete"
      @cancel="deleteConfirm = false"
    />

    <transition name="toast">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>
  </main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import CollectionsPickerDialog from '../components/CollectionsPickerDialog.vue'
import MoveMenu from '../components/MoveMenu.vue'
import SimilarPickerDialog from '../components/SimilarPickerDialog.vue'
import {
  addSimilarTopics,
  addToCollections,
  deleteTopic,
  fetchCollections,
  fetchSimilarTopics,
  fetchTopicDetail,
  fetchTopicNext,
  fetchTopicPrev,
  moveTopic,
  removeFromCollections,
  removeSimilarTopic,
} from '../api'

const route = useRoute()
const router = useRouter()

const topic = ref(null)
const loading = ref(true)
const error = ref('')
// { available: boolean, data: detail | null }，预取相邻主题，切换时直接复用
const nextInfo = ref(null)
const prevInfo = ref(null)

const collections = ref([])
// 每条结果默认模糊，key 为结果 id，false 表示已展开
const revealed = ref({})
const deleteConfirm = ref(false)
const pickerOpen = ref(false)
const similarPickerOpen = ref(false)
const similarTopics = ref([])
// 相似词译文默认收起，key 为相似词 id
const expandedSimilar = ref({})

const toast = ref('')
let toastTimer = null

const nextAvailable = computed(() => nextInfo.value?.available === true)
const prevAvailable = computed(() => prevInfo.value?.available === true)
// 当前单词已在的收藏夹，用于弹窗预勾选
const currentCollectionIds = computed(
  () => (topic.value ? topic.value.collections.map((c) => c.id) : [])
)
const allRevealed = computed(
  () => topic.value?.results.length > 0
    && topic.value.results.every((item) => isBlurred(item.id) === false)
)

const id = computed(() => route.params.id)

function showToast(message) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}

function isBlurred(resultId) {
  return revealed.value[resultId] !== false
}

function reveal(resultId) {
  revealed.value = { ...revealed.value, [resultId]: false }
}

function toggleAll() {
  const next = {}
  // 当前未全部展开 → 全部展开（isBlurred 的约定是值等于 false 才算已展开）
  if (!allRevealed.value) {
    for (const item of topic.value.results) {
      next[item.id] = false
    }
  }
  // 已全部展开 → 回到默认模糊（键缺省即视为模糊）
  revealed.value = next
}

async function load() {
  loading.value = true
  error.value = ''
  topic.value = null
  nextInfo.value = null
  prevInfo.value = null
  revealed.value = {}

  try {
    topic.value = await fetchTopicDetail(id.value)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
  if (topic.value) {
    loadSimilar()
    prefetch('next')
    prefetch('prev')
  }
}

async function loadSimilar() {
  expandedSimilar.value = {}
  try {
    similarTopics.value = await fetchSimilarTopics(id.value)
  } catch {
    /* 相似词加载失败不阻塞详情 */
    similarTopics.value = []
  }
}

function toggleSimilar(similarId) {
  expandedSimilar.value = {
    ...expandedSimilar.value,
    [similarId]: !expandedSimilar.value[similarId],
  }
}

async function doAddSimilar(similarIds) {
  similarPickerOpen.value = false
  try {
    similarTopics.value = await addSimilarTopics(id.value, similarIds)
    showToast(`已关联 ${similarIds.length} 个相似词`)
  } catch (e) {
    showToast(e.message)
  }
}

async function unlinkSimilar(item) {
  try {
    similarTopics.value = await removeSimilarTopic(id.value, item.id)
    expandedSimilar.value = { ...expandedSimilar.value, [item.id]: false }
    showToast('已解除关联')
  } catch (e) {
    showToast(e.message)
  }
}

async function loadCollections() {
  try {
    collections.value = await fetchCollections()
  } catch {
    /* 非关键数据，失败不阻塞 */
  }
}

async function prefetch(dir) {
  const fetcher = dir === 'next' ? fetchTopicNext : fetchTopicPrev
  const currentId = id.value
  try {
    const data = await fetcher(currentId)
    setNeighbor(dir, currentId, { available: true, data })
  } catch (e) {
    // 404 表示已是端点，其余错误视为未知，点击时再处理
    setNeighbor(dir, currentId, { available: e.status !== 404, data: null })
  }
}

function setNeighbor(dir, currentId, info) {
  // 防止快速翻页时旧请求覆盖新数据
  if (currentId !== id.value) return
  if (dir === 'next') {
    nextInfo.value = info
  } else {
    prevInfo.value = info
  }
}

function go(dir) {
  const info = dir === 'next' ? nextInfo.value : prevInfo.value
  if (!info || !info.available) return
  if (info.data) {
    router.push(`/topics/${info.data.id}`)
  } else {
    load()
  }
}

async function moveTo(collection) {
  try {
    const updated = await moveTopic(id.value, collection.id)
    topic.value = updated
    // 移动会改变各收藏夹的单词计数，刷新侧栏数据
    await loadCollections()
    showToast(`已移动到「${collection.name}」`)
  } catch (e) {
    showToast(e.message)
  }
}

async function doCollectTo(payload) {
  pickerOpen.value = false
  try {
    if (payload.added.length) {
      await addToCollections(id.value, payload.added)
    }
    if (payload.removed.length) {
      await removeFromCollections(id.value, payload.removed)
    }
    if (!payload.added.length && !payload.removed.length) {
      return
    }
    // 重新拉取：单词的收藏夹徽章和各收藏夹计数都要更新
    topic.value = await fetchTopicDetail(id.value)
    await loadCollections()
    showToast('已更新收藏')
  } catch (e) {
    showToast(e.message)
  }
}

async function doDelete() {
  deleteConfirm.value = false
  if (!topic.value) return
  try {
    await deleteTopic(topic.value.id)
    showToast(`已删除「${topic.value.sourceText}」`)
    router.push('/')
  } catch (e) {
    showToast(e.message)
  }
}

function onKeydown(e) {
  if (loading.value || error.value) return
  if (e.key === 'ArrowRight') go('next')
  if (e.key === 'ArrowLeft') go('prev')
}

watch(id, load)

onMounted(() => {
  load()
  loadCollections()
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.topbar {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.back {
  color: var(--muted);
  font-size: 14px;
  padding: 4px 8px;
  margin-left: -8px;
  border-radius: 8px;
}

.back:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.topbar-pager {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pager-btn {
  font-size: 13px;
  color: var(--muted);
  padding: 4px 10px;
  border-radius: 8px;
  white-space: nowrap;
}

.pager-btn:hover:not(:disabled) {
  color: var(--accent);
  background: var(--accent-soft);
}

.pager-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.del-btn {
  font-size: 13px;
  color: var(--muted);
  padding: 4px 10px;
  border-radius: 8px;
}

.del-btn:hover {
  color: var(--danger);
  background: #fee2e2;
}

/* 主列保持页面原有的居中宽度，相似词面板定位到内容列右侧的空白区 */
.detail-layout {
  position: relative;
}

.detail-main {
  min-width: 0;
}

/* ---------- 相似词面板 ---------- */

.similar-panel {
  position: absolute;
  top: 0;
  left: calc(100% + 24px);
  width: 236px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 12px 12px 8px;
}

.similar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.similar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.similar-count {
  font-size: 11px;
  color: var(--muted);
  background: #f1f2f4;
  border-radius: 999px;
  padding: 1px 7px;
  margin-left: 2px;
}

.similar-add {
  font-size: 12px;
  color: var(--accent);
  padding: 3px 8px;
  border-radius: 7px;
  white-space: nowrap;
}

.similar-add:hover {
  background: var(--accent-soft);
}

.similar-list {
  list-style: none;
  display: flex;
  flex-direction: column;
}

.similar-item {
  border-bottom: 1px dashed #eef0f3;
}

.similar-item:last-child {
  border-bottom: none;
}

.similar-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 2px;
  cursor: pointer;
  border-radius: 7px;
}

.similar-row:hover {
  background: #f7f8fa;
}

.similar-word {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.similar-chev {
  font-size: 10px;
  color: var(--muted);
}

.similar-del {
  font-size: 14px;
  color: var(--muted);
  width: 20px;
  line-height: 1;
  border-radius: 6px;
  opacity: 0;
  transition: opacity 0.12s;
}

.similar-item:hover .similar-del {
  opacity: 1;
}

.similar-del:hover {
  color: var(--danger);
  background: #fee2e2;
}

.similar-preview {
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted);
  padding: 0 2px 8px;
  white-space: pre-wrap;
  word-break: break-word;
}

.similar-empty {
  font-size: 12px;
  color: var(--muted);
  padding: 14px 2px;
  line-height: 1.6;
}

.detail-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 20px;
}

.word {
  font-size: 26px;
  font-weight: 700;
  word-break: break-word;
}

.meta {
  margin-top: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.badge {
  font-size: 12px;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 2px 10px;
}

.badge.none {
  color: #b3b9c2;
  background: #f5f6f8;
  border: 1px dashed #d8dce2;
}

.collect-btn {
  font-size: 13px;
  color: var(--accent);
  padding: 4px 10px;
  border-radius: 8px;
}

.collect-btn:hover {
  background: var(--accent-soft);
}

.time {
  font-size: 12px;
  color: var(--muted);
}

.blur-toggle {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}

.link-btn {
  font-size: 12px;
  color: var(--muted);
  padding: 2px 6px;
  border-radius: 6px;
}

.link-btn:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

.results {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 14px 16px;
}

.result-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.provider {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 1px 10px;
}

.provider-fallback {
  font-size: 13px;
  color: var(--muted);
}

/* ---------- 模糊化 ---------- */

.result-body {
  position: relative;
  cursor: pointer;
}

.result-body.blurred .content,
.result-body.blurred pre,
.result-body.blurred summary {
  filter: blur(8px);
  user-select: none;
  pointer-events: none;
}

.result-body.blurred details[open] pre {
  filter: blur(8px);
}

.blur-hint {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 13px;
  color: var(--muted);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 40%, rgba(255, 255, 255, 0.7));
}

.content {
  white-space: pre-wrap;
  word-break: break-word;
  transition: filter 0.2s;
}

details {
  margin-top: 8px;
  font-size: 13px;
  color: var(--muted);
}

summary {
  cursor: pointer;
  user-select: none;
}

pre {
  margin-top: 6px;
  padding: 10px;
  background: #f7f8fa;
  border-radius: 8px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
  line-height: 1.5;
  transition: filter 0.2s;
}

.pager {
  margin-top: 22px;
  display: flex;
  justify-content: center;
  gap: 12px;
}

.hint {
  margin-top: 10px;
  text-align: center;
  color: var(--muted);
  font-size: 12px;
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

/* 视口不够宽时（内容列右侧放不下面板），改为堆叠到内容下方 */
@media (max-width: 1260px) {
  .similar-panel {
    position: static;
    width: 100%;
    max-height: none;
    overflow: visible;
    margin-top: 16px;
  }

  .similar-del {
    opacity: 1;
  }
}
</style>
