#!/bin/sh
# W74 CLG (c): no useSimActions and no `.actions` read on a Sim in the folder's production files.
E=/Users/gsp-budi/Documents/DEMS/apps/mobile/src/features/evidence
P=$(find "$E" -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.ts' ! -name '*.test.tsx' ! -path '*/testing/*' | sort)
echo "## $(date '+%H:%M:%S') CLG (c) over $(echo "$P" | wc -l | tr -d ' ') production files of features/evidence"
echo "-- grep -n useSimActions:"; grep -n "useSimActions" $P; echo "   (grep exit $?; 1 = no match)"
echo "-- grep -nE '<name containing sim/Sim>.actions':"; grep -nE "[A-Za-z_]*[sS]im[A-Za-z_]*\.actions\b" $P; echo "   (grep exit $?; 1 = no match)"
echo "-- every '.actions' outside a quoted string, styles.actions excluded:"
for f in $P; do sed -E "s/'[^']*'//g; s/\"[^\"]*\"//g" "$f" | grep -nE "\.actions\b" | grep -v "styles\.actions" | sed "s#^#   $(basename "$f"):#"; done
echo "   (end of list)"
echo "-- useCoreActions() sites:"; grep -n "useCoreActions()" $P | sed "s#$E/#   #"
