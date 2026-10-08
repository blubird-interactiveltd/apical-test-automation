# Media fixtures

Small files the Speaking create suite (AP-807) uploads. Each is under the 50 KB
limit of hook [2e]. The MP3 clips are longer than that allows, so
`utils/speakingMedia.ts` builds them at run time instead (constant-bitrate
silence, into `test-results/.media/`).

| File                   | Content                                          | Used by                 |
| ---------------------- | ------------------------------------------------ | ----------------------- |
| `speaking-lecture.mp4` | 20 s, 96×72 H.264 test pattern + 440 Hz AAC tone | RL video tab            |
| `speaking-short.wav`   | 5 s, 8 kHz mono 8-bit PCM tone                   | RS "WAV accepted"       |
| `speaking-short.aac`   | 5 s, 16 kHz mono AAC-LC tone, ADTS               | RS "AAC accepted"       |
| `describe-image.png`   | 64×48 solid colour                               | DI upload               |
| `describe-image.jpg`   | 64×48 solid colour                               | DI "JPEG accepted"      |
| `describe-image.gif`   | 64×48 solid colour                               | DI "GIF accepted"       |
| `describe-image.webp`  | 64×48 solid colour                               | DI "WEBP accepted"      |
| `invalid.pdf`          | a one-page empty PDF                             | wrong-type upload cases |

They were produced once with FFmpeg, which is **not** a dependency of this repo
(its npm builds are GPL, which hook [12] blocks). To recreate them with any
local FFmpeg:

```bash
ffmpeg -f lavfi -i testsrc=size=96x72:rate=8:duration=20 -f lavfi -i sine=frequency=440:duration=20 -c:v libx264 -preset veryslow -crf 40 -pix_fmt yuv420p -c:a aac -b:a 8k -ac 1 -ar 8000 -shortest -movflags +faststart speaking-lecture.mp4
ffmpeg -f lavfi -i sine=frequency=440:duration=5 -ac 1 -ar 8000 -c:a pcm_u8 speaking-short.wav
ffmpeg -f lavfi -i sine=frequency=440:duration=5 -ac 1 -ar 16000 -c:a aac -b:a 16k -f adts speaking-short.aac
ffmpeg -f lavfi -i color=c=navy:s=64x48 -frames:v 1 describe-image.png
ffmpeg -f lavfi -i color=c=teal:s=64x48 -frames:v 1 describe-image.jpg
ffmpeg -f lavfi -i color=c=maroon:s=64x48 -frames:v 1 describe-image.gif
ffmpeg -f lavfi -i color=c=olive:s=64x48 -frames:v 1 -c:v libwebp describe-image.webp
```

`invalid.pdf` is plain text written by hand.
