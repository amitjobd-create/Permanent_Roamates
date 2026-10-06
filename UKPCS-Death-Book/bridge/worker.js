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
      "User-Agent": "permanent-roamates-ukpcs-death-book",
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
      return response({ error: "GitHub read failed", details: await current.text() }, 502);
    }

    const existingIds = new Set(existing.map(x => x && x.event_id).filter(Boolean));
    const fresh = incoming.filter(x => {
      if (!x || typeof x !== "object") return false;
      if (!x.event_id) return true;
      if (existingIds.has(x.event_id)) return false;
      existingIds.add(x.event_id);
      return true;
    });

    if (!fresh.length) {
      return response({
        ok: true,
        saved: 0,
        skipped_duplicates: incoming.length,
        total_records: existing.length,
        commit: null
      });
    }

    const merged = [...existing, ...fresh];
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
      saved: fresh.length,
      skipped_duplicates: incoming.length - fresh.length,
      total_records: merged.length,
      commit: result.commit?.sha || null
    });
  }
};
