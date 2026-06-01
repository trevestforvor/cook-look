#!/usr/bin/env python3
"""
TPS benchmark for a LiteLLM (OpenAI-compatible) chat-completions endpoint.

Why streaming: a single non-streamed sample (TTFT == Duration) can't separate
prompt processing from generation, so its "tok/s" is amortized and understated.
Streaming lets us measure:
  - TTFT                 time to first content token (prefill + queue)
  - decode TPS           completion_tokens / (end - TTFT)   <- the real gen speed
  - effective TPS        completion_tokens / total_duration <- end-to-end
  - total throughput     (prompt + completion) / total_duration

Token counts are taken from the server's usage block (exact) via
stream_options.include_usage, falling back to a chunk-count estimate if the
proxy doesn't return usage on streamed responses.

Usage:
  python3 tps-test.py                      # defaults below
  python3 tps-test.py --runs 5 --max-tokens 600
  python3 tps-test.py --model eagle-nothink --key sk-1234
"""

import argparse
import json
import ssl
import statistics
import time
import urllib.error
import urllib.request

DEFAULT_BASE = "https://litellm.trevestforvorolares.olares.com/v1/chat/completions"
DEFAULT_KEY = "sk-1234"
DEFAULT_MODEL = "eagle-nothink"
DEFAULT_PROMPT = (
    "Write a detailed, ~400 word step-by-step explanation of how photosynthesis "
    "works, including the light-dependent and light-independent reactions."
)


def run_once(base, key, model, prompt, max_tokens, timeout, insecure=False):
    body = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": True,
        "stream_options": {"include_usage": True},
        "max_tokens": max_tokens,
        "temperature": 0.7,
    }
    req = urllib.request.Request(
        base,
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )

    ctx = None
    if insecure:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

    t0 = time.perf_counter()
    ttft = None
    chunks = 0
    usage = None

    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        for raw in resp:
            line = raw.decode("utf-8", "replace").strip()
            if not line.startswith("data:"):
                continue
            payload = line[len("data:") :].strip()
            if payload == "[DONE]":
                break
            try:
                obj = json.loads(payload)
            except json.JSONDecodeError:
                continue
            if obj.get("usage"):
                usage = obj["usage"]
            choices = obj.get("choices") or []
            if choices:
                content = (choices[0].get("delta") or {}).get("content")
                if content:
                    if ttft is None:
                        ttft = time.perf_counter() - t0
                    chunks += 1

    total = time.perf_counter() - t0
    if ttft is None:  # no content streamed
        ttft = total

    completion = usage.get("completion_tokens") if usage else None
    prompt_toks = usage.get("prompt_tokens") if usage else None
    estimated = completion is None
    if estimated:
        completion = chunks  # ~1 token per content chunk; rough fallback

    decode_window = max(total - ttft, 1e-9)
    return {
        "ttft": ttft,
        "total": total,
        "completion": completion,
        "prompt": prompt_toks,
        "estimated": estimated,
        "decode_tps": completion / decode_window,
        "effective_tps": completion / total,
        "total_tps": ((prompt_toks or 0) + completion) / total,
    }


def fmt(x, n=1):
    return f"{x:.{n}f}" if x is not None else "n/a"


def main():
    ap = argparse.ArgumentParser(description="LiteLLM endpoint TPS benchmark")
    ap.add_argument("--base", default=DEFAULT_BASE)
    ap.add_argument("--key", default=DEFAULT_KEY)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--prompt", default=DEFAULT_PROMPT)
    ap.add_argument("--max-tokens", type=int, default=512)
    ap.add_argument("--runs", type=int, default=3)
    ap.add_argument("--warmup", type=int, default=1, help="untimed warm-up runs")
    ap.add_argument("--timeout", type=float, default=120.0)
    ap.add_argument("--insecure", action="store_true", help="skip TLS cert verification (self-signed endpoints)")
    args = ap.parse_args()

    print(f"Endpoint : {args.base}")
    print(f"Model    : {args.model}")
    print(f"max_tokens={args.max_tokens}  runs={args.runs}  warmup={args.warmup}\n")

    for i in range(args.warmup):
        try:
            run_once(args.base, args.key, args.model, args.prompt, args.max_tokens, args.timeout, args.insecure)
            print(f"warm-up {i + 1}/{args.warmup} ok")
        except Exception as e:  # noqa: BLE001
            print(f"warm-up failed: {e}")
            return 1

    rows = []
    for i in range(args.runs):
        try:
            r = run_once(args.base, args.key, args.model, args.prompt, args.max_tokens, args.timeout, args.insecure)
        except urllib.error.HTTPError as e:
            print(f"run {i + 1}: HTTP {e.code} — {e.read().decode('utf-8', 'replace')[:300]}")
            return 1
        except Exception as e:  # noqa: BLE001
            print(f"run {i + 1}: error — {e}")
            return 1
        rows.append(r)
        flag = " (tokens estimated from chunks)" if r["estimated"] else ""
        print(
            f"run {i + 1}: ttft={fmt(r['ttft'], 3)}s  total={fmt(r['total'], 3)}s  "
            f"completion={r['completion']}  decode={fmt(r['decode_tps'])} tok/s  "
            f"effective={fmt(r['effective_tps'])} tok/s{flag}"
        )

    def avg(key):
        return statistics.mean(r[key] for r in rows)

    print("\n=== averages over", len(rows), "run(s) ===")
    print(f"TTFT             : {fmt(avg('ttft'), 3)} s")
    print(f"decode TPS       : {fmt(avg('decode_tps'))} tok/s   <- generation speed")
    print(f"effective TPS    : {fmt(avg('effective_tps'))} tok/s   <- end-to-end")
    print(f"total throughput : {fmt(avg('total_tps'))} tok/s")
    if any(r["estimated"] for r in rows):
        print("\nNOTE: server did not return usage on the stream; completion counts are\n"
              "      chunk-based estimates. Numbers are approximate.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
