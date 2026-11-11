#!/bin/sh
# Máy quét wifi văn phòng (service scanner trong docker-compose.yml, chạy với
# network_mode: host để nhìn thấy bảng ARP của máy chủ).
#
# Mỗi SCAN_INTERVAL giây: hỏi ARP trực tiếp cả dải SCAN_SUBNET (arping, chỉ hỗ
# trợ dải /24) — máy chặn ping vẫn trả lời ARP — cộng thêm các mục còn hiệu lực
# trong bảng ARP của máy chủ, rồi ghi đè vào bảng WifiPresence: một dòng mỗi
# địa chỉ MAC, chỉ giữ lần thấy gần nhất. Không lưu lịch sử quét, nên bảng này
# không bao giờ phình to.
#
# Không chỉ dựa vào bảng ARP sau khi ping: mục REACHABLE hết hạn sau ~30 giây
# mà ping không làm mới, nên quét dày (30 giây) thì cứ lượt thứ hai lại bỏ sót
# gần hết máy.
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

iface=$(ip -4 route get "$base.1" | awk '{ for (i = 1; i < NF; i++) if ($i == "dev") { print $(i + 1); exit } }')
echo "[wifi-scan] quét $base.1-254 qua ${iface:-?} mỗi ${interval}s"

while true; do
  started=$(date +%s)

  # Mỗi dòng chuẩn hoá về "IP lladdr MAC TRẠNG_THÁI": arping trả lời thì coi
  # như REACHABLE; bảng ARP chỉ lấy mục REACHABLE/DELAY/PROBE.
  # awk lọc chặt (đúng dải, MAC và IP hợp lệ) để không có gì lạ lọt vào câu SQL.
  # Mỗi MAC chỉ lấy một IP: máy vừa đổi IP có thể còn cả IP cũ, MAC lặp trong
  # cùng câu INSERT ... ON CONFLICT làm Postgres từ chối cả lượt (không ai được
  # ghi). Ưu tiên dòng REACHABLE (IP đang dùng).
  values=$({
    for i in $(seq 1 254); do
      arping -f -w 5 -I "$iface" "$base.$i" 2>/dev/null \
        | awk '/reply from/ { gsub(/[][]/, "", $5); print $4, "lladdr", tolower($5), "REACHABLE" }' &
    done
    wait
    ip -4 neigh show | awk '{ print $1, $4, $5, $NF }'
  } | awk -v base="$base." '
        index($1, base) == 1 && $2 == "lladdr" \
          && $3 ~ /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/ \
          && $1 ~ /^[0-9.]+$/ \
          && $4 ~ /^(REACHABLE|DELAY|PROBE)$/ {
          if (!($3 in ip) || ($4 == "REACHABLE" && state[$3] != "REACHABLE")) {
            if (!($3 in ip)) order[++n] = $3
            ip[$3] = $1
            state[$3] = $4
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

  # Giữ đúng nhịp SCAN_INTERVAL dù mỗi lượt quét mất vài giây.
  elapsed=$(( $(date +%s) - started ))
  sleep $(( interval > elapsed ? interval - elapsed : 1 ))
done
