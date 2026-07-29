"""
Anthropic API proxy — run this on a machine with Claude API access.
The HK VM sets ANTHROPIC_BASE_URL=http://<your-ip>:5010 and calls the SDK normally.

Usage:
    pip install flask requests
    ANTHROPIC_API_KEY=sk-ant-... python proxy.py

Optional env vars:
    PROXY_PORT      — port to listen on (default 5010)
    PROXY_SECRET    — if set, clients must send X-Proxy-Secret header with this value
"""

import os
import requests
from flask import Flask, request, Response, abort

app = Flask(__name__)

ANTHROPIC_BASE = "https://api.anthropic.com"
API_KEY = os.environ.get("ANTHROPIC_API_KEY")
PORT = int(os.environ.get("PROXY_PORT", 5010))
SECRET = os.environ.get("PROXY_SECRET")

if not API_KEY:
    raise RuntimeError("ANTHROPIC_API_KEY must be set")


@app.before_request
def check_secret():
    if SECRET and request.headers.get("X-Proxy-Secret") != SECRET:
        abort(403)


@app.route("/<path:path>", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
def proxy(path):
    url = f"{ANTHROPIC_BASE}/{path}"

    # Forward headers, injecting the real API key
    headers = {
        k: v for k, v in request.headers
        if k.lower() not in ("host", "content-length", "x-proxy-secret")
    }
    headers["x-api-key"] = API_KEY

    stream = request.args.get("stream") == "true" or (
        request.is_json and request.json and request.json.get("stream") is True
    )

    resp = requests.request(
        method=request.method,
        url=url,
        headers=headers,
        params=request.args,
        data=request.get_data(),
        stream=stream,
        timeout=120,
    )

    if stream:
        def generate():
            for chunk in resp.iter_content(chunk_size=None):
                yield chunk
        return Response(
            generate(),
            status=resp.status_code,
            headers=dict(resp.headers),
        )

    return Response(resp.content, status=resp.status_code, headers=dict(resp.headers))


if __name__ == "__main__":
    print(f"Proxy listening on :{PORT}")
    app.run(host="0.0.0.0", port=PORT)
