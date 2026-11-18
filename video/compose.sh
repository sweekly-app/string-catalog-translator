#!/usr/bin/env bash
# Builds demo.mp4 (1920x1080) from one screen recording, the cards and the narration (script.md, 8 rows).
# Inputs:  narration/01.mp3 … 08.mp3 (one per row of script.md, AI voice)
#          footage/demo.mov (or .mp4/.webm): the real screen recording of the app in desktop Chrome
#          cuts.txt: the footage segments of rows 1-5, one per line, in play order:
#            "<row> <start s> <end s> [speed] [crop w:h:x:y]"
#          speed defaults to 1. A segment played faster than 1.5x carries a label with its real length and
#          speed (only the translation wait is sped up, never a result). crop zooms into part of the frame.
# A row's segments are joined; if they end before the narration (+0.6 s), the last frame is held; if they
# run longer, the narration is followed by silence. Rows 1-5 carry the caption written in script.md
# ("Caption: \"...\"") as a lower-third; rows 6-8 are cards/01-why.png, 02-how.png, 03-end.png.
# Output: out/demo.mp4, refused at 2:58 or longer.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf out/parts && mkdir -p out/parts
dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }
FOOT=$(ls footage/demo.* | head -1)
FIT="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0f1420,setsar=1"
V="$FIT,fps=30,format=yuv420p"
FONT=${FONT:-$(fc-match -f '%{file}' 'Inter:style=SemiBold' 2>/dev/null || true)}
caption() { # $1 row -> out/parts/<row>.txt holding the row's caption from script.md (empty if none)
  awk -v r="$1" -F'|' '$2 ~ "^ *"r" *$" { if (match($4, /Caption: "[^"]*"/)) print substr($4, RSTART+10, RLENGTH-11) }' script.md > "out/parts/$1.txt"
}
ENC="-c:v libx264 -preset medium -crf 20 -c:a aac -b:a 160k -ar 48000"
segment() { # $1 out file, $2 start, $3 end, $4 speed, $5 crop or "-"
  local real crop label="" f
  real=$(awk -v s="$2" -v e="$3" 'BEGIN{print e-s}')
  crop=""; [ "$5" != "-" ] && crop="crop=$5,"
  if awk -v s="$4" 'BEGIN{exit !(s > 1.5)}'; then
    [ -n "$FONT" ] || { echo "no font for the speed label: set FONT to a .ttf/.otf file"; exit 1; }
    f="$1.label.txt"
    awk -v r="$real" -v s="$4" 'BEGIN{printf "Real wait %d:%02d, shown %gx faster", int(r/60), int(r%60), s}' > "$f"
    label=",drawtext=fontfile=$FONT:textfile=$f:fontsize=36:fontcolor=white:box=1:boxcolor=0x0f1420@0.85:boxborderw=16:x=w-text_w-48:y=48"
  fi
  ffmpeg -nostdin -y -v error -ss "$2" -t "$real" -i "$FOOT" -an \
    -vf "${crop}setpts=(PTS-STARTPTS)/$4,$V$label" -c:v libx264 -preset medium -crf 20 "$1"
}
row() { # $1 row: joins its segments, holds the last frame to the narration, adds caption and narration
  local n nd vd i=0 list cap="" hold
  n=$(printf "%02d" "$1")
  list="out/parts/$1-segs.txt"; : > "$list"
  while read -r r s e sp cr; do
    [ "$r" = "$1" ] || continue
    segment "out/parts/$1-$i.mp4" "$s" "$e" "${sp:-1}" "${cr:--}"
    echo "file '$1-$i.mp4'" >> "$list"; i=$((i + 1))
  done < cuts.txt
  [ "$i" -gt 0 ] || { echo "row $1: no segment in cuts.txt"; exit 1; }
  ffmpeg -nostdin -y -v error -f concat -safe 0 -i "$list" -c copy "out/parts/$1-video.mp4"
  nd=$(awk -v a="$(dur "narration/$n.mp3")" 'BEGIN{print a+0.6}')
  vd=$(dur "out/parts/$1-video.mp4")
  hold=$(awk -v n="$nd" -v v="$vd" 'BEGIN{h=n-v; print (h>0?h:0)}')
  caption "$1"
  if [ -s "out/parts/$1.txt" ] && [ -n "$FONT" ]; then
    cap=",drawtext=fontfile=$FONT:textfile=out/parts/$1.txt:fontsize=44:fontcolor=white:box=1:boxcolor=0x0f1420@0.82:boxborderw=22:x=(w-text_w)/2:y=h-text_h-70"
  fi
  ffmpeg -nostdin -y -v error -i "out/parts/$1-video.mp4" -i "narration/$n.mp3" \
    -filter_complex "[0:v]tpad=stop_mode=clone:stop_duration=$hold$cap,format=yuv420p[v];[1:a]apad,aresample=48000[a]" \
    -map "[v]" -map "[a]" -t "$(awk -v n="$nd" -v v="$vd" 'BEGIN{print (n>v?n:v)}')" $ENC "out/parts/$1.mp4"
}
card() { # $1 row, $2 card png
  local n d
  n=$(printf "%02d" "$1")
  d=$(awk -v a="$(dur "narration/$n.mp3")" 'BEGIN{print a+0.6}')
  ffmpeg -nostdin -y -v error -loop 1 -t "$d" -i "$2" -i "narration/$n.mp3" \
    -filter_complex "[0:v]$V[v];[1:a]apad,aresample=48000[a]" -map "[v]" -map "[a]" -t "$d" $ENC "out/parts/$1.mp4"
}
for r in 1 2 3 4 5; do row "$r"; done
card 6 cards/01-why.png
card 7 cards/02-how.png
card 8 cards/03-end.png
printf "file 'parts/%s.mp4'\n" 1 2 3 4 5 6 7 8 > out/list.txt
ffmpeg -nostdin -y -v error -f concat -safe 0 -i out/list.txt -c copy out/demo.mp4
T=$(dur out/demo.mp4)
echo "demo.mp4: ${T}s"
awk -v t="$T" 'BEGIN{exit !(t < 178)}' || { echo "too long: must be under 3:00"; exit 1; }
