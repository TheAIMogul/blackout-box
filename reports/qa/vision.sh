#!/bin/bash
# QA: post each sample image to /api/vision/items, sequentially
cd "$(dirname "$0")"
B=https://blackoutbox.micahberkley.com
for spec in "fridge.jpg image/jpeg fridge" "freezer.jpg image/jpeg fridge" "meds-label.png image/png meds"; do
  set -- $spec
  printf '{"imageBase64":"%s","mime":"%s","hint":"%s"}' "$(base64 -i "img/$1" | tr -d '\n')" "$2" "$3" > "body_$1.json"
  curl -s -o "vision_$1.json" -w "$1 -> %{http_code} %{time_total}s\n" --max-time 120 \
    -H 'Content-Type: application/json' --data @"body_$1.json" "$B/api/vision/items"
  python3 -I -c 'import json,sys
b=json.load(open(sys.argv[1]))
its=b.get("items",[]) if isinstance(b,dict) else []
print("  ",len(its),"items",b.get("_model") if isinstance(b,dict) else b,[(i.get("name"),i.get("foodClass") or i.get("kind")) for i in its])' "vision_$1.json"
done
