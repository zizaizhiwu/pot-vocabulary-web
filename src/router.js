import { createRouter, createWebHistory } from 'vue-router'
import TopicList from './views/TopicList.vue'
import TopicDetail from './views/TopicDetail.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'list', component: TopicList },
    { path: '/topics/:id', name: 'detail', component: TopicDetail },
  ],
})

export default router
