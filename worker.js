export default {
  async fetch(request, env) {
    // Cloudflare 只负责前端静态文件
    // API 不经过 Worker，前端直接请求：
    // https://zenos-91.onrender.com

    return env.ASSETS.fetch(request);
  },
};
