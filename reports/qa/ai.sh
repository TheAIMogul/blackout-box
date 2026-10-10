#!/bin/bash
# QA: chat / translate / describe, sequential
cd "$(dirname "$0")"
B=https://blackoutbox.micahberkley.com
post() { # name path json
  printf '%s' "$3" > "req_$1.json"
  curl -s -o "res_$1.json" -w "$1 -> %{http_code} %{time_total}s\n" --max-time 120 \
    -H 'Content-Type: application/json' --data @"req_$1.json" "$B$2"
  python3 -I -c 'import json,sys
try:
  b=json.load(open(sys.argv[1]))
  t=b.get("text","")
  print("   model=",b.get("_model"),"call_911=",b.get("call_911"),"keys=",list(b.keys()))
  print("   text:",t[:700].replace("\n"," | "))
except Exception as e: print("   RAW",open(sys.argv[1]).read()[:400])' "res_$1.json"
}
post chat_en /api/chat '{"messages":[{"role":"user","content":"The power just went out. How long is the milk in my fridge good for, and where is the nearest shelter?"}],"lang":"en"}'
post chat_es /api/chat '{"messages":[{"role":"user","content":"¿Cuál es mi zona de evacuación y qué tan alta está la marea?"}],"lang":"es"}'
post chat_ht /api/chat '{"messages":[{"role":"user","content":"Kouran an koupe. Konbyen tan ensilin mwen ka rete deyò frijidè a?"}],"lang":"ht"}'
post chat_911 /api/chat '{"messages":[{"role":"user","content":"I smell gas in my kitchen"}],"lang":"en"}'
post chat_weather /api/chat '{"messages":[{"role":"user","content":"How hot is it outside and how windy, and how far is the closest hospital?"}],"lang":"en"}'
post tr_es /api/translate '{"text":"Keep the fridge door closed. Food stays cold for about 4 hours.","to":"es"}'
post tr_ht /api/translate '{"text":"Keep the fridge door closed. Food stays cold for about 4 hours.","to":"ht"}'
printf '{"imageBase64":"%s","mime":"image/jpeg","kind":"scene","lang":"en"}' "$(base64 -i img/fridge.jpg | tr -d '\n')" > req_desc.json
curl -s -o res_desc.json -w "describe -> %{http_code} %{time_total}s\n" --max-time 120 -H 'Content-Type: application/json' --data @req_desc.json "$B/api/vision/describe"
python3 -I -c 'import json;b=json.load(open("res_desc.json"));print("   model=",b.get("_model"),"text:",b.get("text","")[:500].replace("\n"," | "))'
