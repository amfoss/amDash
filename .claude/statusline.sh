#!/usr/bin/env bash
input=$(cat)
model=$(echo "$input" | jq -r ".model.display_name // \"claude\"")
dir=$(echo "$input" | jq -r ".workspace.current_dir // \"\"")
cost=$(echo "$input" | jq -r ".cost.total_cost_usd // 0")
pct=$(echo "$input" | jq -r ".context_window.used_percentage // 0" | cut -d. -f1)
duration_ms=$(echo "$input" | jq -r ".cost.total_duration_ms // 0")
cyan="\033[36m"; green="\033[32m"; yellow="\033[33m"; red="\033[31m"; reset="\033[0m"
if [ "$pct" -ge 90 ]; then bar_color="$red"
elif [ "$pct" -ge 70 ]; then bar_color="$yellow"
else bar_color="$green"; fi
filled=$((pct / 10)); empty=$((10 - filled))
printf -v fill "%${filled}s"; printf -v pad "%${empty}s"
bar="${fill// /█}${pad// /░}"
mins=$((duration_ms / 60000)); secs=$(((duration_ms % 60000) / 1000))
branch=""
git rev-parse --git-dir > /dev/null 2>&1 && branch=" | 🌿 $(git branch --show-current 2>/dev/null)"
echo -e "${cyan}[$model]${reset} 📁 $(basename "$dir")$branch"
cost_fmt=$(printf "\$%.2f" "$cost")
echo -e "${bar_color}${bar}${reset} ${pct}% | ${yellow}${cost_fmt}${reset} | ${mins}m ${secs}s"
