#!/usr/bin/env bash
# Verifies the "calories" task unit: a task can be created with unit=calories,
# logged against, and server-scored exactly like any other numeric unit.
# Throwaway verification harness (not part of the test suite). Requires the
# local API (wrangler dev) on 127.0.0.1:8787.
set -uo pipefail
API="http://127.0.0.1:8787"; ORIGIN="http://localhost:3000"
JAR=$(mktemp); : > "$JAR"
U="cal$(date +%s%N)"; EMAIL="cal-${U}@example.com"; PASS="C0rrect-Horse-Battery!"
P=0; F=0
green(){ printf "\033[32m%s\033[0m\n" "$1"; }
red(){ printf "\033[31m%s\033[0m\n" "$1"; }
info(){ printf "\033[36m%s\033[0m\n" "$1"; }
check(){ if [ "$2" = "$3" ]; then green "  PASS: $1 (got $3)"; P=$((P+1)); else red "  FAIL: $1 — expected '$2', got '$3'"; F=$((F+1)); fi; }
post(){ curl -sS -w "\n%{http_code}" -b "$JAR" -c "$JAR" -X POST "$1" -H "Content-Type: application/json" -H "Origin: $ORIGIN" -d "$2"; }
put(){ curl -sS -w "\n%{http_code}" -b "$JAR" -c "$JAR" -X PUT "$1" -H "Content-Type: application/json" -H "Origin: $ORIGIN" -d "$2"; }
get(){ curl -sS -b "$JAR" "$1"; }

info "=== 1. Sign up ==="
check "signup HTTP 200" "200" "$(post "$API/api/auth/sign-up/email" "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Cal\",\"username\":\"$U\"}" | tail -n1)"

info "=== 2. Create project ==="
PR=$(post "$API/api/projects" '{"name":"P","color":"#ffffff"}')
PID=$(echo "$PR" | head -n -1 | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])")

info "=== 3. Create task with unit=calories (limit-scale: target 2000) ==="
T=$(post "$API/api/tasks" "{\"projectId\":\"$PID\",\"title\":\"Limit daily intake\",\"targetValue\":2000,\"unit\":\"calories\",\"importanceWeight\":3,\"scheduledStart\":\"06:00\",\"scheduledEnd\":\"07:00\"}")
check "create task unit=calories → 201" "201" "$(echo "$T" | tail -n1)"
TID=$(echo "$T" | head -n -1 | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])")
UNIT=$(get "$API/api/tasks/$TID" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['unit'])")
check "task unit persisted = calories" "calories" "$UNIT"
TV=$(get "$API/api/tasks/$TID" | python3 -c "import sys,json;print(float(json.load(sys.stdin)['data']['targetValue']))")
check "task targetValue persisted = 2000" "2000.0" "$TV"

info "=== 4. Upsert a task log for calories task (server computes taskScore) ==="
TODAY=$(date -u -d "+5 hours" +%Y-%m-%d)
L=$(put "$API/api/task-logs" "{\"taskId\":\"$TID\",\"date\":\"$TODAY\",\"actualValue\":1500}")
check "upsert task log → 200" "200" "$(echo "$L" | tail -n1)"
SCORE=$(echo "$L" | head -n -1 | python3 -c "import sys,json;print(float(json.load(sys.stdin)['data']['taskScore']))")
check "taskScore server-computed & numeric (>0)" "1" "$(python3 -c "print(1 if isinstance($SCORE,(int,float)) and $SCORE > 0 else 0)")"

info "=== 5. Daily rating reflects the calories task ==="
DR=$(get "$API/api/task-logs/daily-rating/$TODAY")
RT=$(echo "$DR" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print(float(d['rating']))")
check "daily rating present (number > 0)" "1" "$(python3 -c "print(1 if isinstance($RT,(int,float)) and $RT > 0 else 0)")"
TC=$(echo "$DR" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['taskCount'])")
check "daily taskCount = 1" "1" "$TC"

info ""
info "RESULTS: $P passed, $F failed"
rm -f "$JAR"
[ "$F" = "0" ]
