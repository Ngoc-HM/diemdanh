#!/bin/sh
# Máy quét wifi văn phòng (service scanner trong docker-compose.yml, chạy với
# network_mode: host để nhìn thấy bảng ARP của máy chủ).
#
# Mỗi SCAN_INTERVAL giây: ping cả dải SCAN_SUBNET (chỉ hỗ trợ dải /24) để làm
# tươi bảng ARP, rồi lấy các máy đang trả lời và ghi đè vào bảng WifiPresence:
# một dòng mỗi địa chỉ MAC, chỉ giữ lần thấy gần nhất. Không lưu lịch sử quét,
# nên bảng này không bao giờ phình to.
#
# Biến môi trường (từ .env qua env_file):
#   SCAN_SUBNET       dải wifi văn phòng, mặc định 192.168.1.0/24
#   SCAN_INTERVAL     số giây giữa hai lần quét, mặc định 60
#   DB_PORT           cổng Postgres mở trên 127.0.0.1 của máy chủ, mặc định 5433
#   POSTGRES_PASSWORD mật khẩu Postgres (bắt buộc)
set -u

subnet=${SCAN_SUBNET:-192.168.1.0/24}
interval=${SCAN_INTERVAL:-60}
base=${subnet%.*}
export PGPASSWORD=${POSTGRES_PASSWORD:?Thiếu POSTGRES_PASSWORD}
psql_cmd="psql -h 127.0.0.1 -p ${DB_PORT:-5433} -U postgres -d company_mana -v ON_ERROR_STOP=1 -q"

echo "[wifi-scan] quét $base.1-254 mỗi ${interval}s"

while true; do
  for i in $(seq 1 254); do
    ping -c 1 -W 1 "$base.$i" >/dev/null 2>&1 &
  done
  wait

  # Chỉ lấy máy vừa trả lời (REACHABLE/DELAY/PROBE), đúng dải, MAC và IP hợp lệ
  # — awk lọc chặt để không có gì lạ lọt vào câu SQL.
  # Mỗi MAC chỉ lấy một IP: máy vừa đổi IP có thể còn cả IP cũ trong bảng ARP,
  # MAC lặp trong cùng câu INSERT ... ON CONFLICT làm Postgres từ chối cả lượt
  # (không ai được ghi). Ưu tiên dòng REACHABLE (IP đang dùng).
  values=$(ip -4 neigh show \
    | awk -v base="$base." '
        index($1, base) == 1 && $4 == "lladdr" \
          && $5 ~ /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/ \
          && $1 ~ /^[0-9.]+$/ \
          && $NF ~ /^(REACHABLE|DELAY|PROBE)$/ {
          if (!($5 in ip) || ($NF == "REACHABLE" && state[$5] != "REACHABLE")) {
            if (!($5 in ip)) order[++n] = $5
            ip[$5] = $1
            state[$5] = $NF
          }
        }
        END {
          for (i = 1; i <= n; i++) {
            printf "%s(%c%s%c,%c%s%c,now())", sep, 39, order[i], 39, 39, ip[order[i]], 39
            sep = ","
          }
        }')

  if [ -n "$values" ]; then
    if ! $psql_cmd -c "INSERT INTO \"WifiPresence\" (\"mac\", \"ip\", \"seenAt\") VALUES $values
      ON CONFLICT (\"mac\") DO UPDATE SET \"ip\" = EXCLUDED.\"ip\", \"seenAt\" = EXCLUDED.\"seenAt\";
      DELETE FROM \"WifiPresence\" WHERE \"seenAt\" < now() - interval '30 days';"; then
      echo "[wifi-scan] không ghi được vào database"
    fi
  else
    echo "[wifi-scan] không thấy máy nào trong $subnet"
  fi

  sleep "$interval"
done
