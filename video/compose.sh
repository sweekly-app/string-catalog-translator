#!/usr/bin/env bash
# Builds demo.mp4 (1920x1080) from the cards, a screen recording of the app and the narration.
# Inputs:  narration/01.mp3 … 06.mp3 (one per row of script.md, ElevenLabs)
#          footage/demo.mov (or .mp4/.webm): the real screen recording of the app in desktop Chrome
# Output:  out/demo.mp4, refused if it is 3:00 or longer.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out/parts
dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }
FOOT=$(ls footage/demo.* | head -1)
V="scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0f1420,fps=30,format=yuv420p"
card() { # $1 card png, $2 narration, $3 out
  local d; d=$(awk -v a="$(dur "$2")" 'BEGIN{print a+0.6}')
  ffmpeg -y -v error -loop 1 -t "$d" -i "$1" -i "$2" -filter_complex "[0:v]$V[v];[1:a]apad,aresample=48000[a]" \
    -map "[v]" -map "[a]" -t "$d" -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 160k "$3"
}
card cards/01-title.png   narration/01.mp3 out/parts/1.mp4
card cards/02-idea.png    narration/02.mp3 out/parts/2.mp4
# Demo: fit the recording to the narration (speed it up or slow it down, at most 2.5x faster, 0.8x slower).
ND=$(awk -v a="$(dur narration/03.mp3)" 'BEGIN{print a+0.8}')
FD=$(dur "$FOOT")
F=$(awk -v n="$ND" -v f="$FD" 'BEGIN{r=n/f; if(r<0.4)r=0.4; if(r>1.25)r=1.25; print r}')
ffmpeg -y -v error -i "$FOOT" -i narration/03.mp3 -filter_complex "[0:v]setpts=$F*PTS,$V[v];[1:a]apad,aresample=48000[a]" \
  -map "[v]" -map "[a]" -t "$ND" -c:v libx264 -preset medium -crf 20 -c:a aac -b:a 160k out/parts/3.mp4
card cards/03-how.png     narration/04.mp3 out/parts/4.mp4
card cards/04-private.png narration/05.mp3 out/parts/5.mp4
card cards/05-end.png     narration/06.mp3 out/parts/6.mp4
printf "file 'parts/%s.mp4'\n" 1 2 3 4 5 6 > out/list.txt
ffmpeg -y -v error -f concat -safe 0 -i out/list.txt -c copy out/demo.mp4
T=$(dur out/demo.mp4)
echo "demo.mp4: ${T}s"
awk -v t="$T" 'BEGIN{exit !(t < 178)}' || { echo "too long: must be under 3:00"; exit 1; }
