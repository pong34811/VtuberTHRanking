import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

const client = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

export const rankingsAPI = {
  getList: (params = {}) => client.get('/rankings/', { params }),
}

export const directoryAPI = {
  getList: (params = {}) => client.get('/directory/', { params }),
}

export const vtubersAPI = {
  getList: (params = {}) => client.get('/vtubers/', { params }),
  getBySlug: (slug) => client.get(`/vtubers/${slug}/`),
  getHistory: (slug, months = 6) =>
    client.get(`/vtubers/${slug}/history/`, { params: { months } }),
}

export const compareAPI = {
  post: (data) => client.post('/compare/', data),
}

export const summaryAPI = {
  get: () => client.get('/summary/'),
}

export const homepageConfigAPI = {
  get: () => client.get('/homepage-config/'),
}

export default client
