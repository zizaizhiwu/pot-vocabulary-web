const BASE = '/api'

async function request(path, options = {}) {
  let res
  try {
    res = await fetch(`${BASE}${path}`, options)
  } catch {
    throw new Error('无法连接生词本服务，请确认后端已启动')
  }

  let body = null
  try {
    body = await res.json()
  } catch {
    /* 非 JSON 响应 */
  }

  if (!res.ok || !body || body.code !== 200) {
    const err = new Error(body && body.message ? body.message : `请求失败（HTTP ${res.status}）`)
    err.status = res.status
    throw err
  }
  return body.data
}

function jsonBody(method, data) {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }
}

export function fetchTopicList({
  page = 1,
  size = 20,
  keyword = '',
  collectionId = null,
  sourceLangs = [],
  excludeIds = [],
} = {}) {
  return request(
    '/topics/list',
    jsonBody('POST', { page, size, keyword, collectionId, sourceLangs, excludeIds })
  )
}

/** 库中已有单词的语言分布 */
export function fetchLanguages() {
  return request('/topics/languages')
}

/** 为存量数据补全源/目标语言（幂等） */
export function backfillLanguages() {
  return request('/topics/languages/backfill', { method: 'POST' })
}

export function fetchTopicDetail(id) {
  return request(`/topics/${id}`)
}

export function fetchTopicNext(id) {
  return request(`/topics/${id}/next`)
}

export function fetchTopicPrev(id) {
  return request(`/topics/${id}/prev`)
}

/** 移动到收藏夹：覆盖该单词的全部收藏夹归属 */
export function moveTopic(id, collectionId) {
  return request(`/topics/${id}/collection`, jsonBody('PUT', { collectionId }))
}

/** 收藏到多个收藏夹：只增不减 */
export function addToCollections(id, collectionIds) {
  return request(`/topics/${id}/collections`, jsonBody('POST', { collectionIds }))
}

/** 从多个收藏夹取消收藏：只减不增 */
export function removeFromCollections(id, collectionIds) {
  return request(`/topics/${id}/collections/remove`, jsonBody('POST', { collectionIds }))
}

export function deleteTopic(id) {
  return request(`/topics/${id}`, { method: 'DELETE' })
}

/** 某个词的相似词列表 */
export function fetchSimilarTopics(id) {
  return request(`/topics/${id}/similar`)
}

/** 建立相似词关联（无向、幂等），返回最新相似词列表 */
export function addSimilarTopics(id, similarTopicIds) {
  return request(`/topics/${id}/similar`, jsonBody('POST', { similarTopicIds }))
}

/** 解除相似词关联，返回最新相似词列表 */
export function removeSimilarTopic(id, similarId) {
  return request(`/topics/${id}/similar/${similarId}`, { method: 'DELETE' })
}

/** 批量收藏到多个收藏夹（只增不减） */
export function batchAddToCollections(topicIds, collectionIds) {
  return request('/topics/batch/collections', jsonBody('POST', { topicIds, collectionIds }))
}

/** 批量从多个收藏夹取消收藏（只减不增） */
export function batchRemoveFromCollections(topicIds, collectionIds) {
  return request('/topics/batch/collections/remove', jsonBody('POST', { topicIds, collectionIds }))
}

/** 批量移动到指定收藏夹（覆盖归属） */
export function batchMoveTopics(topicIds, collectionId) {
  return request('/topics/batch/move', jsonBody('POST', { topicIds, collectionId }))
}

/** 批量删除单词 */
export function batchDeleteTopics(topicIds) {
  return request('/topics/batch/delete', jsonBody('POST', { topicIds }))
}

export function fetchCollections() {
  return request('/collections')
}

export function createCollection(name) {
  return request('/collections', jsonBody('POST', { name }))
}

export function deleteCollection(id) {
  return request(`/collections/${id}`, { method: 'DELETE' })
}
