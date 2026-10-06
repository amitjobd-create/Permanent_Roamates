const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (request.method === "GET") {
      return response({
        ok: true,
        service: "UKPCS Death Book GitHub bridge",
        repo: env.GITHUB_REPO
      });
    }

    if (request.method !== "POST") {
      return response({ error: "Method not allowed" }, 405);
    }

    if (!env.GITHUB_TOKEN) {
      return response({ error: "GITHUB_TOKEN secret is not configured" }, 500);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return response({ error: "Request body must be valid JSON" }, 400);
    }

    const incoming = Array.isArray(payload) ? payload : [payload];
    const repo = env.GITHUB_REPO || "amitjobd-create/Permanent_Roamates";
    const branch = env.GITHUB_BRANCH || "main";
    const path = "UKPCS-Death-Book/error_queue.json";

    const headers = {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };

    const fileUrl = `https://api.github.com/repos/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
    const current = await fetch(fileUrl, { headers });

    let existing = [];
    let sha = null;

    if (current.ok) {
      const data = await current.json();
      sha = data.sha;
      try {
        existing = JSON.parse(atob(data.content.replace(/\n/g, "")));
        if (!Array.isArray(existing)) existing = [];
      } catch {
        existing = [];
      }
    } else if (current.status !== 404) {
      const details = await current.text();
      return response({
        error: "GitHub read failed",
        github_status: current.status,
        github_status_text: current.statusText,
        github_request_id: current.headers.get("x-github-request-id"),
        github_rate_limit_remaining: current.headers.get("x-ratelimit-remaining"),
        github_api_version: current.headers.get("x-github-api-version"),
        details
      }, 502);
    }

    const merged = [...existing, ...incoming];
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(merged, null, 2))));

    const body = {
      message: "Update UKPCS Death Book error queue",
      content,
      branch
    };
    if (sha) body.sha = sha;

    const updated = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!updated.ok) {
      return response({ error: "GitHub write failed", details: await updated.text() }, 502);
    }

    const result = await updated.json();
    return response({
      ok: true,
      saved: incoming.length,
      total_records: merged.length,
      commit: result.commit?.sha || null
    });
  }
};
