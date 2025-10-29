import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/upload',
      name: 'upload',
      component: () => import('../views/UploadView.vue'),
    },
    {
      path: '/item/:id',
      name: 'ItemDetail',
      component: () => import('../views/ItemDetailView.vue'),
    },
    {
      path: '/my-items',
      name: 'MyItems',
      component: () => import('../views/MyItemsView.vue'),
    },
  ],
})

export default router
