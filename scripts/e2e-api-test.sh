#!/usr/bin/env bash
set -euo pipefail

API="http://127.0.0.1:8787"
ORIGIN="http://localhost:3000"
TMPDIR=$(mktemp -d)
COOKIE_JAR_1="$TMPDIR/cookies1.txt"
COOKIE_JAR_2="$TMPDIR/cookies2.txt"
: > "$COOKIE_JAR_1"
: > "$COOKIE_JAR_2"

UNIQUE_SUFFIX=$(date +%s%N)
EMAIL_ALICE="alice-${UNIQUE_SUFFIX}@example.com"
EMAIL_BOB="bob-${UNIQUE_SUFFIX}@example.com"
USER_ALICE="alice_${UNIQUE_SUFFIX}"
USER_BOB="bob_${UNIQUE_SUFFIX}"
PASSWORD="C0rrect-Horse-Battery!"

cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

PASS=0
FAIL=0

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
info()  { printf "\033[36m%s\033[0m\n" "$1"; }

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    green "  PASS: $label (got: $actual)"
    PASS=$((PASS+1))
  else
    red "  FAIL: $label — expected '$expected', got '$actual'"
    FAIL=$((FAIL+1))
  fi
}

post_json() {
  local url="$1"; shift
  local cookie_jar="$1"; shift
  local payload="$1"; shift
  if [ -n "$cookie_jar" ]; then
    curl -sS -w "\n%{http_code}" -b "$cookie_jar" -c "$cookie_jar" \
      -X POST "$url" -H "Content-Type: application/json" -H "Origin: $ORIGIN" -d "$payload"
  else
    curl -sS -w "\n%{http_code}" \
      -X POST "$url" -H "Content-Type: application/json" -H "Origin: $ORIGIN" -d "$payload"
  fi
}

patch_json() {
  local url="$1"; shift
  local cookie_jar="$1"; shift
  local payload="$1"; shift
  curl -sS -w "\n%{http_code}" -b "$cookie_jar" -c "$cookie_jar" \
    -X PATCH "$url" -H "Content-Type: application/json" -H "Origin: $ORIGIN" -d "$payload"
}

put_json() {
  local url="$1"; shift
  local cookie_jar="$1"; shift
  local payload="$1"; shift
  curl -sS -w "\n%{http_code}" -b "$cookie_jar" -c "$cookie_jar" \
    -X PUT "$url" -H "Content-Type: application/json" -H "Origin: $ORIGIN" -d "$payload"
}

delete_req() {
  local url="$1"; shift
  local cookie_jar="$1"; shift
  curl -sS -w "\n%{http_code}" -b "$cookie_jar" -c "$cookie_jar" \
    -X DELETE "$url" -H "Origin: $ORIGIN"
}

get_auth() {
  local url="$1"; shift
  local cookie_jar="$1"; shift
  curl -sS -b "$cookie_jar" "$url"
}

get_with_headers() {
  local url="$1"; shift
  local cookie_jar="$1"; shift
  curl -sS -D /tmp/headers.txt -b "$cookie_jar" -o /tmp/body.txt "$url"
}

info "=== 0. Health check ==="
HEALTH=$(curl -sS "$API/health")
check "health ok=True" "True" "$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['ok'])")"

info ""
info "=== 1. Security headers present ==="
curl -sS -D /tmp/headers.txt -o /dev/null "$API/health"
check "X-Content-Type-Options: nosniff" "nosniff" "$(grep -i 'x-content-type-options' /tmp/headers.txt | awk '{print $2}' | tr -d '\r')"
check "X-Frame-Options: DENY" "DENY" "$(grep -i 'x-frame-options' /tmp/headers.txt | awk '{print $2}' | tr -d '\r')"
check "Referrer-Policy present" "strict-origin-when-cross-origin" "$(grep -i 'referrer-policy' /tmp/headers.txt | awk '{print $2}' | tr -d '\r')"
check "CSP present" "true" "$(grep -i 'content-security-policy' /tmp/headers.txt > /dev/null && echo true || echo false)"

info ""
info "=== 2. Protected route without session → 401 ==="
PROTECTED_NO_AUTH=$(curl -sS -w "%{http_code}" -o /tmp/body.txt "$API/api/seasons")
check "GET /api/seasons without auth → 401" "401" "$PROTECTED_NO_AUTH"

info ""
info "=== 3. CSRF protection: POST without Origin → 403 ==="
SIGNUP_NO_ORIGIN=$(curl -sS -w "%{http_code}" -o /tmp/body.txt \
  -X POST "$API/api/auth/sign-up/email" \
  -H "Content-Type: application/json" \
  -d '{"email":"noorigin@example.com","password":"C0rrect-Horse!","name":"No","username":"noorigin"}')
check "POST without Origin → 403" "403" "$SIGNUP_NO_ORIGIN"

info ""
info "=== 4. Sign up account #1 (alice) ==="
SIGNUP1_PAYLOAD=$(python3 -c "import json; print(json.dumps({'email':'$EMAIL_ALICE','password':'$PASSWORD','name':'Alice','username':'$USER_ALICE'}))")
SIGNUP1=$(post_json "$API/api/auth/sign-up/email" "$COOKIE_JAR_1" "$SIGNUP1_PAYLOAD")
SIGNUP1_CODE=$(echo "$SIGNUP1" | tail -n1)
check "signup alice HTTP 200" "200" "$SIGNUP1_CODE"

info ""
info "=== 5. Sign up account #2 (bob) ==="
SIGNUP2_PAYLOAD=$(python3 -c "import json; print(json.dumps({'email':'$EMAIL_BOB','password':'$PASSWORD','name':'Bob','username':'$USER_BOB'}))")
SIGNUP2=$(post_json "$API/api/auth/sign-up/email" "$COOKIE_JAR_2" "$SIGNUP2_PAYLOAD")
SIGNUP2_CODE=$(echo "$SIGNUP2" | tail -n1)
check "signup bob HTTP 200" "200" "$SIGNUP2_CODE"

info ""
info "=== 6. Alice creates a project ==="
PROJECT_BODY=$(curl -sS -b "$COOKIE_JAR_1" -X POST "$API/api/projects" \
  -H "Content-Type: application/json" -H "Origin: $ORIGIN" \
  -d '{"name":"Alice Project","color":"#7c5cff"}')
PROJECT_ID=$(echo "$PROJECT_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "  alice project: $PROJECT_ID"

info ""
info "=== 7. Cross-account isolation: bob cannot see alice's project ==="
BOB_PROJECTS=$(curl -sS -b "$COOKIE_JAR_2" "$API/api/projects")
check "bob sees empty project list" "[]" "$(echo "$BOB_PROJECTS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'])")"

info ""
info "=== 8. Cross-account isolation: bob cannot delete alice's project ==="
BOB_DELETE=$(delete_req "$API/api/projects/$PROJECT_ID" "$COOKIE_JAR_2")
BOB_DELETE_CODE=$(echo "$BOB_DELETE" | tail -n1)
check "bob delete alice's project → 404" "404" "$BOB_DELETE_CODE"

info ""
info "=== 9. Alice creates a task ==="
TASK_PAYLOAD=$(python3 -c "import json; print(json.dumps({'projectId':'$PROJECT_ID','title':'Run 5km','targetValue':5,'unit':'km','importanceWeight':3,'scheduledStart':'06:00','scheduledEnd':'07:00'}))")
TASK_BODY=$(post_json "$API/api/tasks" "$COOKIE_JAR_1" "$TASK_PAYLOAD")
TASK_ID=$(echo "$TASK_BODY" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
TASK_CODE=$(echo "$TASK_BODY" | tail -n1)
check "alice create task HTTP 201" "201" "$TASK_CODE"
echo "  alice task: $TASK_ID"

info ""
info "=== 10. Task immutability: PATCH with targetValue → 403 ==="
IMMUTABLE_PATCH=$(patch_json "$API/api/tasks/$TASK_ID" "$COOKIE_JAR_1" '{"targetValue":10}')
IMMUTABLE_CODE=$(echo "$IMMUTABLE_PATCH" | tail -n1)
check "PATCH targetValue → 403" "403" "$IMMUTABLE_CODE"

info ""
info "=== 11. Task immutability: PATCH with unit → 403 ==="
IMMUTABLE_UNIT=$(patch_json "$API/api/tasks/$TASK_ID" "$COOKIE_JAR_1" '{"unit":"hours"}')
IMMUTABLE_UNIT_CODE=$(echo "$IMMUTABLE_UNIT" | tail -n1)
check "PATCH unit → 403" "403" "$IMMUTABLE_UNIT_CODE"

info ""
info "=== 12. Task immutability: PATCH with importanceWeight → 403 ==="
IMMUTABLE_WEIGHT=$(patch_json "$API/api/tasks/$TASK_ID" "$COOKIE_JAR_1" '{"importanceWeight":5}')
IMMUTABLE_WEIGHT_CODE=$(echo "$IMMUTABLE_WEIGHT" | tail -n1)
check "PATCH importanceWeight → 403" "403" "$IMMUTABLE_WEIGHT_CODE"

info ""
info "=== 13. Alice updates task title (allowed) ==="
TITLE_PATCH=$(patch_json "$API/api/tasks/$TASK_ID" "$COOKIE_JAR_1" '{"title":"Run 10km"}')
TITLE_CODE=$(echo "$TITLE_PATCH" | tail -n1)
check "PATCH title → 200" "200" "$TITLE_CODE"

info ""
info "=== 14. Cross-account: bob cannot PATCH alice's task ==="
BOB_PATCH=$(patch_json "$API/api/tasks/$TASK_ID" "$COOKIE_JAR_2" '{"title":"Hacked"}')
BOB_PATCH_CODE=$(echo "$BOB_PATCH" | tail -n1)
check "bob PATCH alice's task → 404" "404" "$BOB_PATCH_CODE"

info ""
info "=== 15. Alice creates a season ==="
SEASON_PAYLOAD=$(python3 -c "import json; print(json.dumps({'startDate':'2024-01-01','endDate':'2024-01-31','targetRating':8.0,'rewardText':'New keyboard','includedDays':62}))")
SEASON_BODY=$(post_json "$API/api/seasons" "$COOKIE_JAR_1" "$SEASON_PAYLOAD")
SEASON_ID=$(echo "$SEASON_BODY" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
SEASON_CODE=$(echo "$SEASON_BODY" | tail -n1)
check "alice create season HTTP 201" "201" "$SEASON_CODE"

info ""
info "=== 16. Alice upserts a task log (server computes taskScore) ==="
LOG_PAYLOAD=$(python3 -c "import json; print(json.dumps({'taskId':'$TASK_ID','date':'2024-01-15','actualValue':5}))")
LOG_BODY=$(put_json "$API/api/task-logs" "$COOKIE_JAR_1" "$LOG_PAYLOAD")
LOG_CODE=$(echo "$LOG_BODY" | tail -n1)
LOG_SCORE=$(echo "$LOG_BODY" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['taskScore'])")
check "upsert task log HTTP 200" "200" "$LOG_CODE"
check "taskScore server-computed = 3" "3" "$LOG_SCORE"

info ""
info "=== 17. Cross-account: bob cannot read alice's task log ==="
BOB_LOGS=$(curl -sS -b "$COOKIE_JAR_2" "$API/api/task-logs/by-date/2024-01-15")
check "bob sees empty log list" "[]" "$(echo "$BOB_LOGS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'])")"

info ""
info "=== 18. Cross-account: bob cannot upsert log for alice's task ==="
BOB_LOG_PAYLOAD=$(python3 -c "import json; print(json.dumps({'taskId':'$TASK_ID','date':'2024-01-16','actualValue':1}))")
BOB_LOG=$(put_json "$API/api/task-logs" "$COOKIE_JAR_2" "$BOB_LOG_PAYLOAD")
BOB_LOG_CODE=$(echo "$BOB_LOG" | tail -n1)
check "bob upsert log for alice's task → 404" "404" "$BOB_LOG_CODE"

info ""
info "=== 19. Daily rating with per-task breakdown ==="
DAILY=$(curl -sS -b "$COOKIE_JAR_1" "$API/api/task-logs/daily-rating/2024-01-15")
DAILY_RATING=$(echo "$DAILY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['rating'])")
DAILY_TASK_COUNT=$(echo "$DAILY" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['taskCount'])")
DAILY_BREAKDOWN_LEN=$(echo "$DAILY" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['tasks']))")
check "daily rating = 10" "10" "$DAILY_RATING"
check "daily taskCount = 1" "1" "$DAILY_TASK_COUNT"
check "daily breakdown has 1 task" "1" "$DAILY_BREAKDOWN_LEN"

info ""
info "=== 20. Season rating endpoint ==="
SEASON_RATING=$(curl -sS -b "$COOKIE_JAR_1" "$API/api/seasons/$SEASON_ID/rating")
SEASON_RATING_VAL=$(echo "$SEASON_RATING" | python3 -c "import sys,json; print(round(json.load(sys.stdin)['data']['rating'], 4))")
check "season rating > 0" "true" "$(echo "$SEASON_RATING_VAL" | python3 -c "import sys; v=float(sys.stdin.read()); print('true' if v > 0 else 'false')")"

info ""
info "=== 21. Analytics: daily-rating time series ==="
TS=$(curl -sS -b "$COOKIE_JAR_1" "$API/api/analytics/daily-rating-time-series?seasonId=$SEASON_ID")
TS_LEN=$(echo "$TS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['points']))")
check "time series has points" "true" "$(echo "$TS_LEN" | python3 -c "import sys; v=int(sys.stdin.read()); print('true' if v > 0 else 'false')")"

info ""
info "=== 22. Analytics: project completion stats ==="
PCS=$(curl -sS -b "$COOKIE_JAR_1" "$API/api/analytics/project-completion-stats?seasonId=$SEASON_ID")
PCS_LEN=$(echo "$PCS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['projects']))")
check "project stats has 1 project" "1" "$PCS_LEN"

info ""
info "=== 23. Leaderboard: only username + seasonRating exposed ==="
LB=$(curl -sS -b "$COOKIE_JAR_1" "$API/api/leaderboard?startDate=2024-01-01&endDate=2024-01-31&limit=10")
LB_ENTRIES=$(echo "$LB" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(len(d['entries']))")
LB_FIRST_KEYS=$(echo "$LB" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; e=d['entries'][0] if d['entries'] else {}; print(sorted(e.keys()) if e else [])")
echo "  entries: $LB_ENTRIES"
echo "  first entry keys: $LB_FIRST_KEYS"
check "leaderboard has entries" "true" "$(echo "$LB_ENTRIES" | python3 -c "import sys; v=int(sys.stdin.read()); print('true' if v > 0 else 'false')")"
check "leaderboard entry only has rank,username,seasonRating" "['rank', 'seasonRating', 'username']" "$LB_FIRST_KEYS"

info ""
info "=== 24. Leaderboard: no userId or email leaked ==="
LB_BODY=$(echo "$LB" | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)))")
USERID_COUNT=$(echo "$LB_BODY" | grep -c 'userId' || true)
EMAIL_COUNT=$(echo "$LB_BODY" | grep -c '@example.com' || true)
check "no userId in response" "0" "$USERID_COUNT"
check "no email in response" "0" "$EMAIL_COUNT"

info ""
info "=== 25. Leaderboard pagination: limit clamp ==="
LB_LIMIT=$(curl -sS -b "$COOKIE_JAR_1" "$API/api/leaderboard?startDate=2024-01-01&endDate=2024-01-31&limit=500")
LB_LIMIT_VAL=$(echo "$LB_LIMIT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['limit'])")
check "limit clamped to 100" "100" "$LB_LIMIT_VAL"

info ""
info "=== 26. Task reorder ==="
TASK2_PAYLOAD=$(python3 -c "import json; print(json.dumps({'projectId':'$PROJECT_ID','title':'Read','targetValue':30,'unit':'pages','importanceWeight':2,'scheduledStart':'20:00','scheduledEnd':'21:00'}))")
TASK2_BODY=$(post_json "$API/api/tasks" "$COOKIE_JAR_1" "$TASK2_PAYLOAD")
TASK2_ID=$(echo "$TASK2_BODY" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
REORDER_PAYLOAD=$(python3 -c "import json; print(json.dumps({'projectId':'$PROJECT_ID','taskIds':['$TASK2_ID','$TASK_ID']}))")
REORDER=$(post_json "$API/api/tasks/reorder" "$COOKIE_JAR_1" "$REORDER_PAYLOAD")
REORDER_CODE=$(echo "$REORDER" | tail -n1)
check "reorder HTTP 200" "200" "$REORDER_CODE"
REORDERED_FIRST_ID=$(echo "$REORDER" | head -n -1 | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")
check "first task is now TASK2" "$TASK2_ID" "$REORDERED_FIRST_ID"

info ""
info "=== 27. Error response: no stack trace leaked ==="
ERR_BODY=$(curl -sS -b "$COOKIE_JAR_1" "$API/api/seasons/invalid-uuid/rating")
STACK_COUNT=$(echo "$ERR_BODY" | grep -c 'at /' || true)
ERROR_PREFIX_COUNT=$(echo "$ERR_BODY" | grep -c 'Error:' || true)
check "error has no stack trace" "0" "$STACK_COUNT"
check "error has no 'Error:' prefix" "0" "$ERROR_PREFIX_COUNT"

info ""
info "=== 28. Rate limit headers on mutating endpoint ==="
curl -sS -D /tmp/headers.txt -o /dev/null -b "$COOKIE_JAR_1" \
  -X POST "$API/api/projects" -H "Content-Type: application/json" -H "Origin: $ORIGIN" \
  -d '{"name":"Test"}'
check "X-RateLimit-Limit present" "true" "$(grep -i 'x-ratelimit-limit' /tmp/headers.txt > /dev/null && echo true || echo false)"
check "X-RateLimit-Remaining present" "true" "$(grep -i 'x-ratelimit-remaining' /tmp/headers.txt > /dev/null && echo true || echo false)"

info ""
info "=== 29. Auth endpoint rate limiting (brute-force protection) ==="
HIT_LIMIT=0
for i in $(seq 1 15); do
  WRONG_PAYLOAD=$(python3 -c "import json; print(json.dumps({'email':'$EMAIL_ALICE','password':'WrongPass$i!'}))")
  CODE=$(post_json "$API/api/auth/sign-in/email" "" "$WRONG_PAYLOAD" | tail -n1)
  if [ "$CODE" = "429" ]; then
    HIT_LIMIT=1
    break
  fi
done
check "auth rate limit hit (429) after 11 attempts" "1" "$HIT_LIMIT"

info ""
echo "===================="
if [ "$FAIL" -eq 0 ]; then
  green "ALL $PASS CHECKS PASSED"
else
  red "$PASS passed, $FAIL FAILED"
  exit 1
fi
