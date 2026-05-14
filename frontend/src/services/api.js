import axios from 'axios';

const api = axios.create({ baseURL: '/api', timeout: 30000 });

api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('pharmanet_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('pharmanet_token');
    window.location.href = '/';
  }
  return Promise.reject(err);
});

export default api;
