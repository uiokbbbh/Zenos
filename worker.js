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
            "GET, POST, PUT, DELETE, PATCH, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, X-Requested-With",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // ==============================
    // 2. /api 和 /api/* 转发到 Render
    // ==============================
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const targetUrl =
        RENDER_API +
        url.pathname +
        url.search;

      try {
        // 重新构造请求，避免直接修改原始 Request
        const headers = new Headers(request.headers);

        headers.set("X-Forwarded-Host", url.host);
        headers.set(
          "X-Forwarded-Proto",
          url.protocol.replace(":", "")
        );

        const proxyRequest = new Request(targetUrl, {
          method: request.method,
          headers,
          body:
            request.method === "GET" ||
            request.method === "HEAD"
              ? undefined
              : request.body,
          redirect: "follow",
        });

        const response = await fetch(proxyRequest);

        // 复制 Render 响应头
        const responseHeaders = new Headers(response.headers);

        // CORS
        responseHeaders.set(
          "Access-Control-Allow-Origin",
          "*"
        );

        responseHeaders.set(
          "Access-Control-Allow-Methods",
          "GET, POST, PUT, DELETE, PATCH, OPTIONS"
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
            error: "API_PROXY_ERROR",
            message: String(error),
          }),
          {
            status: 502,
            headers: {
              "Content-Type":
                "application/json; charset=UTF-8",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // ==============================
    // 3. 其他请求交给 Cloudflare Assets
    // ==============================
    try {
      return await env.ASSETS.fetch(request);
    } catch (error) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "ASSETS_ERROR",
          message: String(error),
        }),
        {
          status: 500,
          headers: {
            "Content-Type":
              "application/json; charset=UTF-8",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  },
};
