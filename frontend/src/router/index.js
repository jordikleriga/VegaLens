import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue')
  },
  {
    path: '/builder',
    name: 'builder',
    component: () => import('@/views/BuilderView.vue')
  },
  {
    path: '/builder/:id',
    name: 'builder-edit',
    component: () => import('@/views/BuilderView.vue')
  },
  {
    path: '/library',
    name: 'library',
    component: () => import('@/views/LibraryView.vue')
  },
  {
    path: '/templates',
    redirect: '/library'
  },
  {
    path: '/dashboards',
    redirect: '/library'
  },
  {
    path: '/explore',
    name: 'explore',
    component: () => import('@/views/ExploreView.vue')
  },
  {
    path: '/help',
    name: 'help',
    component: () => import('@/views/HelpView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router

