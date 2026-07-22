#!/bin/bash
# Currency + Cultural Victory extractor for one block dir. Read-only.
B="$1"; L="$B/latest-log.txt"
echo "### $(basename $B)"
echo "-- latest Currency Ranking Update --"
grep -h "Currency Ranking Update" "$L" | tail -1
echo "-- latest per-nation currency status (from last ranking block) --"
grep -h "\[CurrencyRanking\]" "$L" | tail -6 | grep -oE "nation=[a-z_]+ .*status=[A-Za-z]+" | sed -E 's/currency=.*symbol="[^"]*" //'
echo "-- dominance changes this block --"
grep -h "dominance changed" "$L" | grep -oE "turn.*|Currency dominance changed.*" | head
echo "-- latest Cultural Victory progress --"
grep -h -A6 "Cultural Victory progress" "$L" | tail -7
