const RENDER_API = "https://zenos-91.onrender.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ==============================
    // 1. /api 和 /api/* 转发到 Render
    // ==============================
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      // 保留原来的 /api/... 路径和 ?query=...
      const targetUrl =
        RENDER_API +
        url.pathname +
        url.search;

      // 创建转发请求
      const proxyRequest = new Request(targetUrl, request);

      // 告诉 Render 请求来自 Cloudflare
      proxyRequest.headers.set("X-Forwarded-Host", url.host);
      proxyRequest.headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));

      try {
        const response = await fetch(proxyRequest);

        // 复制 Render 返回的响应头
        const headers = new Headers(response.headers);

        // 允许浏览器访问 API
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        headers.set(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, X-Requested-With"
        );

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "API 服务器连接失败",
            message: String(error),
          }),
          {
            status: 502,
            headers: {
              "Content-Type": "application/json; charset=UTF-8",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // ==============================
    // 2. CORS 预检请求
    // ==============================
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Requested-With",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // ==============================
    // 3. 其他请求交给 Cloudflare 静态文件
    // ==============================
    return env.ASSETS.fetch(request);
  },
};
