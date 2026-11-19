#!/usr/bin/env bash
# Builds demo.mp4 (1920x1080) from one screen recording, a replay capture, the cards and the narration
# (script.md, 8 rows).
# Inputs:  narration/01.mp3 … 08.mp3 and 01.json … 08.json (one per row of script.md: the AI voice take and the
#          character alignment ElevenLabs returned with it)
#          footage/demo.mov (or .mp4/.webm): the real screen recording of the app in desktop Chrome
#          footage/replay-export.webm: the app replaying the bundled recorded run and exporting (capture-export.cjs)
#          cuts.txt: the footage segments of rows 1-5, one per line, in play order:
#            "<row> <start s> <end s> [speed] [crop w:h:x:y or -] [source file, default the recording]"
#          speed defaults to 1. A segment played faster than 1.5x carries a label with its real length and
#          speed (only the translation wait is sped up, never a result). crop zooms into part of the frame.
#          A segment taken from a file whose name contains "replay" is labelled "Replay of a recorded run".
# A row's segments are joined; if they end before the narration (+0.6 s), the last frame is held; if they
# run longer, the narration is followed by silence. Every row carries captions built by captions.cjs from
# the take's alignment (the narration word for word); rows 6-8 are cards/01-why.png, 02-how.png, 03-end.png.
# Output: out/demo.mp4, refused at 2:58 or longer.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf out/parts && mkdir -p out/parts
dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }
FOOT=$(ls footage/demo.* | head -1)
FIT="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0f1420,setsar=1"
V="$FIT,fps=30,format=yuv420p"
FONT=${FONT:-$(fc-match -f '%{file}' 'Inter:style=SemiBold' 2>/dev/null || true)}
[ -n "$FONT" ] || { echo "no font for captions and labels: set FONT to a .ttf/.otf file"; exit 1; }
FONTDIR=$(dirname "$FONT")
ENC="-c:v libx264 -preset medium -crf 20 -c:a aac -b:a 160k -ar 48000"
label() { # $1 text file -> drawtext filter for a top-right label
  echo ",drawtext=fontfile=$FONT:textfile=$1:fontsize=36:fontcolor=white:box=1:boxcolor=0x0f1420@0.85:boxborderw=16:x=w-text_w-48:y=48"
}
segment() { # $1 out file, $2 start, $3 end, $4 speed, $5 crop or "-", $6 source file
  local real crop lab=""
  real=$(awk -v s="$2" -v e="$3" 'BEGIN{print e-s}')
  crop=""; [ "$5" != "-" ] && crop="crop=$5,"
  if awk -v s="$4" 'BEGIN{exit !(s > 1.5)}'; then
    awk -v r="$real" -v s="$4" 'BEGIN{printf "Real wait %d:%02d, shown %gx faster", int(r/60), int(r%60), s}' > "$1.label.txt"
    lab=$(label "$1.label.txt")
  elif [[ "$6" == *replay* ]]; then
    printf "Replay of a recorded run" > "$1.label.txt"
    lab=$(label "$1.label.txt")
  fi
  ffmpeg -nostdin -y -v error -ss "$2" -t "$real" -i "$6" -an \
    -vf "${crop}setpts=(PTS-STARTPTS)/$4,$V$lab" -c:v libx264 -preset medium -crf 20 "$1"
}
finish() { # $1 row, $2 video without sound: holds its last frame to the narration, adds captions and the take
  local n nd vd hold
  n=$(printf "%02d" "$1")
  node captions.cjs "$1" "out/parts/$1.ass"
  nd=$(awk -v a="$(dur "narration/$n.mp3")" 'BEGIN{print a+0.6}')
  vd=$(dur "$2")
  hold=$(awk -v n="$nd" -v v="$vd" 'BEGIN{h=n-v; print (h>0?h:0)}')
  ffmpeg -nostdin -y -v error -i "$2" -i "narration/$n.mp3" \
    -filter_complex "[0:v]tpad=stop_mode=clone:stop_duration=$hold,subtitles=out/parts/$1.ass:fontsdir=$FONTDIR,format=yuv420p[v];[1:a]apad,aresample=48000[a]" \
    -map "[v]" -map "[a]" -t "$(awk -v n="$nd" -v v="$vd" 'BEGIN{print (n>v?n:v)}')" $ENC "out/parts/$1.mp4"
}
row() { # $1 row: joins its segments from cuts.txt
  local i=0 list="out/parts/$1-segs.txt"
  : > "$list"
  while read -r r s e sp cr src; do
    [ "$r" = "$1" ] || continue
    segment "out/parts/$1-$i.mp4" "$s" "$e" "${sp:-1}" "${cr:--}" "${src:-$FOOT}"
    echo "file '$1-$i.mp4'" >> "$list"; i=$((i + 1))
  done < cuts.txt
  [ "$i" -gt 0 ] || { echo "row $1: no segment in cuts.txt"; exit 1; }
  ffmpeg -nostdin -y -v error -f concat -safe 0 -i "$list" -c copy "out/parts/$1-video.mp4"
  finish "$1" "out/parts/$1-video.mp4"
}
card() { # $1 row, $2 card png
  ffmpeg -nostdin -y -v error -loop 1 -t 1 -i "$2" -vf "$V" -c:v libx264 -preset medium -crf 20 "out/parts/$1-video.mp4"
  finish "$1" "out/parts/$1-video.mp4"
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
