#!/usr/bin/env python3
"""Usage: gen.py JOBFILE [--only name,name] [--image SRC]
Job lines: name|aspect|prompt  (optional 4th field: source image path for edit mode).
Runs Grok Imagine (grok-imagine skill script), max 4 at once, outputs originals/<name>.jpg, skips existing."""
import os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
DIR = os.path.dirname(os.path.abspath(__file__))
GEN = os.path.expanduser("~/.claude/skills/grok-imagine/scripts/generate.py")
jobs = []
for line in open(sys.argv[1]):
    line = line.strip()
    if not line or line.startswith("#"): continue
    parts = line.split("|")
    jobs.append(parts)
only = None
if "--only" in sys.argv: only = set(sys.argv[sys.argv.index("--only")+1].split(","))
res = "1k" if "--1k" in sys.argv else "2k"
def run(p):
    name, aspect, prompt = p[0], p[1], p[2]
    if only and name not in only: return
    out = os.path.join(DIR, "originals", name.replace("/", "_") + ".jpg")
    if os.path.exists(out) and os.path.getsize(out) > 0:
        print("skip", name, flush=True); return
    cmd = ["python3", GEN, prompt, "--out", out, "--aspect", aspect, "--resolution", res, "--quality", "medium"]
    if len(p) > 3 and p[3]: cmd += ["--image", p[3]]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if r.returncode == 0 and os.path.exists(out): print("ok", name, flush=True)
    else: print("FAIL", name, (r.stderr or r.stdout)[-400:], flush=True)
with ThreadPoolExecutor(4) as ex: list(ex.map(run, jobs))
