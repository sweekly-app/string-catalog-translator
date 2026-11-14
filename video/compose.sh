#!/usr/bin/env bash
# Builds demo.mp4 (1920x1080) from one screen recording, the cards and the narration (script.md, 8 rows).
# Inputs:  narration/01.mp3 … 08.mp3 (one per row of script.md, AI voice)
#          footage/demo.mov (or .mp4/.webm): the real screen recording of the app in desktop Chrome
#          footage/cuts.txt: one line per footage row, "<row> <start seconds> <end seconds>" (rows 1-5)
# Rows 1-5 are clips of the recording, each fitted to its narration (0.4x to 1.25x of real time);
# rows 6-8 are cards/01-why.png, 02-how.png, 03-end.png. Output: out/demo.mp4, refused at 2:58 or longer.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out/parts
dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }
FOOT=$(ls footage/demo.* | head -1)
V="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0f1420,fps=30,format=yuv420p"
ENC="-c:v libx264 -preset medium -crf 20 -c:a aac -b:a 160k -ar 48000"
clip() { # $1 row, $2 start, $3 end
  local n nd fd f
  n=$(printf "%02d" "$1")
  nd=$(awk -v a="$(dur "narration/$n.mp3")" 'BEGIN{print a+0.6}')
  fd=$(awk -v s="$2" -v e="$3" 'BEGIN{print e-s}')
  f=$(awk -v n="$nd" -v f="$fd" 'BEGIN{r=n/f; if(r<0.4)r=0.4; if(r>1.25)r=1.25; print r}')
  ffmpeg -nostdin -y -v error -ss "$2" -t "$fd" -i "$FOOT" -i "narration/$n.mp3" \
    -filter_complex "[0:v]setpts=$f*(PTS-STARTPTS),$V[v];[1:a]apad,aresample=48000[a]" \
    -map "[v]" -map "[a]" -t "$nd" $ENC "out/parts/$1.mp4"
}
card() { # $1 row, $2 card png
  local n d
  n=$(printf "%02d" "$1")
  d=$(awk -v a="$(dur "narration/$n.mp3")" 'BEGIN{print a+0.6}')
  ffmpeg -nostdin -y -v error -loop 1 -t "$d" -i "$2" -i "narration/$n.mp3" \
    -filter_complex "[0:v]$V[v];[1:a]apad,aresample=48000[a]" -map "[v]" -map "[a]" -t "$d" $ENC "out/parts/$1.mp4"
}
while read -r row start end; do
  [ -z "${row:-}" ] && continue
  clip "$row" "$start" "$end"
done < footage/cuts.txt
card 6 cards/01-why.png
card 7 cards/02-how.png
card 8 cards/03-end.png
printf "file 'parts/%s.mp4'\n" 1 2 3 4 5 6 7 8 > out/list.txt
ffmpeg -nostdin -y -v error -f concat -safe 0 -i out/list.txt -c copy out/demo.mp4
T=$(dur out/demo.mp4)
echo "demo.mp4: ${T}s"
awk -v t="$T" 'BEGIN{exit !(t < 178)}' || { echo "too long: must be under 3:00"; exit 1; }
