const RENDER_API = "https://zenos-91.onrender.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ==============================
    // 1. CORS 预检
    // ==============================
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods":
            "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Requested-With",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // ==============================
    // 2. /api 和 /api/* 转发到 Render
    //
    // 例如：
    // /api/health
    // ↓
    // https://zenos-91.onrender.com/api/health
    // ==============================
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const targetUrl =
        RENDER_API + url.pathname + url.search;

      // 复制原请求 Headers
      const headers = new Headers(request.headers);

      // 告诉 Render 原始请求来自哪里
      headers.set("X-Forwarded-Host", url.host);
      headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));

      // 构造新的转发请求
      const proxyRequest = new Request(targetUrl, {
        method: request.method,
        headers,
        body:
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : request.body,
        redirect: "follow",
      });

      try {
        const response = await fetch(proxyRequest);

        // 复制 Render 返回的 Headers
        const responseHeaders = new Headers(response.headers);

        // CORS
        responseHeaders.set(
          "Access-Control-Allow-Origin",
          "*"
        );

        responseHeaders.set(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        );

        responseHeaders.set(
          "Access-Control-Allow-Headers",
          "Content-Type, Authorization, X-Requested-With"
        );

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            ok: false,
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
    // 3. 其他请求交给静态资源
    // ==============================
    return env.ASSETS.fetch(request);
  },
};
