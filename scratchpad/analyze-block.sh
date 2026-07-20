#!/bin/bash
# Per-block extractor for the aggression-memory validation run.
# Read-only: touches nothing outside the block dir it is pointed at.
B="$1"
L="$B/latest-log.txt"
echo "########## $(basename "$B") ##########"
echo "--- war declarations ---"
grep -oE "r[0-9]+.*declared war on [A-Za-z ]+" "$L" | head -40
echo "--- captures ---"
grep -iE "captured" "$L" | grep -oE "r[0-9]+.*" | head -40
echo "--- eliminations ---"
grep -iE "eliminat|destroyed|no longer" "$L" | head -20
echo "--- AggressionMemory events (count by type) ---"
grep -o "event=[a-z_]*" "$L" | sort | uniq -c
echo "--- AggressionMemory distinct aggressors ---"
grep -o "aggressor=[a-z_]*" "$L" | sort | uniq -c
echo "--- joint war proposals ---"
grep -iE "joint war|asked .* to join" "$L" | head -40
echo "--- joint war outcomes ---"
grep -icE "accepted.*(joint|join the war)" "$L" | sed 's/^/accepted: /'
grep -icE "rejected.*(joint|join the war)" "$L" | sed 's/^/rejected: /'
echo "--- council resolutions ---"
grep -iE "resolution|condemn|sanction|embargo|ceasefire|peacekeep|world council|United Nations" "$L" | head -40
