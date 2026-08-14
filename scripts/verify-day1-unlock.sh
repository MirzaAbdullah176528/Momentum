#!/usr/bin/env bash
# Verifies the first-day-of-season task-edit exception:
#  - On the season's start date (today, PKT), PATCHing a locked field
#    (targetValue/unit/importanceWeight) SUCCEEDS (200) and persists.
#  - On any other day of an active season (start date in the past), the same
#    PATCH is rejected with 403 "immutable".
#  - With no active season, the PATCH is also rejected with 403.
# NOTE: this script is a throwaway verification harness, not committed.
set -uo pipefail

API="http://127.0.0.1:8787"
ORIGIN="http://localhost:3000"
TMPDIR=$(mktemp -d)
JAR="$TMPDIR/cookies.txt"; : > "$JAR"
UNIQUE=$(date +%s%N)
EMAIL="unlock-${UNIQUE}@example.com"
USER="unlock_${UNIQUE}"
PASS="C0rrect-Horse-Battery!"
TODAY=$(date -u -d "+5 hours" +%Y-%m-%d)   # PKT "today"
YESTERDAY=$(date -u -d "+5 hours -1 day" +%Y-%m-%d)
TOMORROW=$(date -u -d "+5 hours +1 day" +%Y-%m-%d)
END=$(date -u -d "+5 hours +27 days" +%Y-%m-%d)
DB=./apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/9ba2b04bf514d9facfd57ed57d849e77241a7adc99d1c1545d06688b43d84248.sqlite

PASS_N=0; FAIL_N=0
green(){ printf "\033[32m%s\033[0m\n" "$1"; }
red(){ printf "\033[31m%s\033[0m\n" "$1"; }
info(){ printf "\033[36m%s\033[0m\n" "$1"; }
check(){ if [ "$2" = "$3" ]; then green "  PASS: $1 (got $3)"; PASS_N=$((PASS_N+1)); else red "  FAIL: $1 — expected '$2', got '$3'"; FAIL_N=$((FAIL_N+1)); fi; }

post(){ curl -sS -w "\n%{http_code}" -b "$JAR" -c "$JAR" -X POST "$1" -H "Content-Type: application/json" -H "Origin: $ORIGIN" -d "$2"; }
patch(){ curl -sS -w "\n%{http_code}" -b "$JAR" -c "$JAR" -X PATCH "$1" -H "Content-Type: application/json" -H "Origin: $ORIGIN" -d "$2"; }
get(){ curl -sS -b "$JAR" "$1"; }
set_season_start(){ python3 -c "import sqlite3,sys; db=sqlite3.connect('$DB'); db.execute('UPDATE season SET start_date=? WHERE user_id=(SELECT id FROM user WHERE email=?)',(sys.argv[1],sys.argv[2])); db.commit()" "$1" "$EMAIL"; }
delete_season(){ python3 -c "import sqlite3,sys; db=sqlite3.connect('$DB'); db.execute('DELETE FROM season WHERE user_id=(SELECT id FROM user WHERE email=?)',(sys.argv[1],)); db.execute('DELETE FROM season_weekly_reward WHERE season_id NOT IN (SELECT id FROM season)'); db.execute('DELETE FROM season_final_goal WHERE season_id NOT IN (SELECT id FROM season)'); db.commit()" "$EMAIL"; }

info "PKT today = $TODAY ; yesterday = $YESTERDAY ; end = $END"

info "=== 1. Sign up ==="
S=$(post "$API/api/auth/sign-up/email" "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"name\":\"Unlock\",\"username\":\"$USER\"}")
check "signup HTTP 200" "200" "$(echo "$S" | tail -n1)"

info "=== 2. Create project + task ==="
P=$(post "$API/api/projects" '{"name":"P","color":"#ffffff"}')
PID=$(echo "$P" | head -n -1 | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])")
T=$(post "$API/api/tasks" "{\"projectId\":\"$PID\",\"title\":\"Run\",\"targetValue\":5,\"unit\":\"km\",\"importanceWeight\":3,\"scheduledStart\":\"06:00\",\"scheduledEnd\":\"07:00\"}")
check "create task HTTP 201" "201" "$(echo "$T" | tail -n1)"
TID=$(echo "$T" | head -n -1 | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])")

info "=== 3. Create ACTIVE season starting TODAY ($TODAY) ==="
SE=$(post "$API/api/seasons" "{\"startDate\":\"$TODAY\",\"endDate\":\"$END\",\"targetRating\":8.0,\"rewardText\":\"R\",\"includedDays\":127}")
check "create season HTTP 201" "201" "$(echo "$SE" | tail -n1)"

info "=== 4. DAY-1 (start date == today): PATCH locked fields should SUCCEED ==="
R1=$(patch "$API/api/tasks/$TID" '{"targetValue":10}')
check "PATCH targetValue on day-1 → 200" "200" "$(echo "$R1" | tail -n1)"
V1=$(get "$API/api/tasks/$TID" | python3 -c "import sys,json;print(float(json.load(sys.stdin)['data']['targetValue']))")
check "targetValue persisted = 10" "10.0" "$V1"

R2=$(patch "$API/api/tasks/$TID" '{"unit":"hours"}')
check "PATCH unit on day-1 → 200" "200" "$(echo "$R2" | tail -n1)"
R3=$(patch "$API/api/tasks/$TID" '{"importanceWeight":5}')
check "PATCH importanceWeight on day-1 → 200" "200" "$(echo "$R3" | tail -n1)"
V3=$(get "$API/api/tasks/$TID" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['importanceWeight'])")
check "importanceWeight persisted = 5" "5" "$V3"

info "=== 5. current season exposes canEditLockedFields=true ==="
CE=$(get "$API/api/seasons/current" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['canEditLockedFields'])")
check "canEditLockedFields == True on day-1" "True" "$CE"

info "=== 6. OTHER DAY: move season start to YESTERDAY (still active, day 2) ==="
set_season_start "$YESTERDAY"
CE2=$(get "$API/api/seasons/current" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['canEditLockedFields'])")
check "canEditLockedFields == False on day-2" "False" "$CE2"
R4=$(patch "$API/api/tasks/$TID" '{"targetValue":20}')
check "PATCH targetValue on day-2 → 403" "403" "$(echo "$R4" | tail -n1)"
R5=$(patch "$API/api/tasks/$TID" '{"unit":"pages"}')
check "PATCH unit on day-2 → 403" "403" "$(echo "$R5" | tail -n1)"
R6=$(patch "$API/api/tasks/$TID" '{"importanceWeight":2}')
check "PATCH importanceWeight on day-2 → 403" "403" "$(echo "$R6" | tail -n1)"

info "=== 7. title still editable on day-2 ==="
R7=$(patch "$API/api/tasks/$TID" '{"title":"Still editable"}')
check "PATCH title on day-2 → 200" "200" "$(echo "$R7" | tail -n1)"

info "=== 8. NO ACTIVE SEASON: delete season, PATCH locked → 403 ==="
delete_season
CUR=$(get "$API/api/seasons/current" | python3 -c "import sys,json;print(json.load(sys.stdin)['data'])")
check "current season == null" "None" "$CUR"
R8=$(patch "$API/api/tasks/$TID" '{"targetValue":99}')
check "PATCH targetValue with no season → 403" "403" "$(echo "$R8" | tail -n1)"

info ""
info "RESULTS: $PASS_N passed, $FAIL_N failed"
rm -rf "$TMPDIR"
[ "$FAIL_N" = "0" ]
