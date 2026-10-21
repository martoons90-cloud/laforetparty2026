import subprocess
import os

print("Generating 15s party_noir.mp4...")

# Shot 1: Pulverturm party dancing crowd (B&W with slight slow motion and bright, crisp highlights)
cmd1 = [
    'ffmpeg', '-y', '-ss', '00:00:01', '-t', '4.8',
    '-i', '/tmp/pulverturm.webm',
    '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setpts=1.25*PTS,hue=s=0,eq=contrast=1.12:brightness=0.04',
    '-r', '25',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast', '-crf', '22', '-an',
    '/tmp/shot1_v2.mp4'
]
subprocess.run(cmd1, check=True)

# Glitch Transition 1 (0.2s): Glitch slice with horizontal shift and luminous highlights
cmd_g1 = [
    'ffmpeg', '-y', '-ss', '00:00:05.8', '-t', '0.2',
    '-i', '/tmp/pulverturm.webm',
    '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,hue=s=0,eq=contrast=1.5:brightness=0.12,curves=lighter',
    '-r', '25',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast', '-crf', '22', '-an',
    '/tmp/glitch1.mp4'
]
subprocess.run(cmd_g1, check=True)

# Shot 2: Club crowd & night lights (00:00:02 -> 00:00:06.8)
cmd2 = [
    'ffmpeg', '-y', '-ss', '00:00:02', '-t', '4.8',
    '-i', '/tmp/revs.webm',
    '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setpts=1.25*PTS,hue=s=0,eq=contrast=1.1:brightness=0.05',
    '-r', '25',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast', '-crf', '22', '-an',
    '/tmp/shot2_v2.mp4'
]
subprocess.run(cmd2, check=True)

# Glitch Transition 2 (0.2s):
cmd_g2 = [
    'ffmpeg', '-y', '-ss', '00:00:07', '-t', '0.2',
    '-i', '/tmp/revs.webm',
    '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,hue=s=0,eq=contrast=1.6:brightness=0.15',
    '-r', '25',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast', '-crf', '22', '-an',
    '/tmp/glitch2.mp4'
]
subprocess.run(cmd_g2, check=True)

# Shot 3: Pulverturm party lights & DJ booth
cmd3 = [
    'ffmpeg', '-y', '-ss', '00:00:07', '-t', '4.8',
    '-i', '/tmp/pulverturm.webm',
    '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setpts=1.25*PTS,hue=s=0,eq=contrast=1.12:brightness=0.04',
    '-r', '25',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast', '-crf', '22', '-an',
    '/tmp/shot3_v2.mp4'
]
subprocess.run(cmd3, check=True)

lines = [
    "file '/tmp/shot1_v2.mp4'",
    "file '/tmp/glitch1.mp4'",
    "file '/tmp/shot2_v2.mp4'",
    "file '/tmp/glitch2.mp4'",
    "file '/tmp/shot3_v2.mp4'"
]
with open('/tmp/concat_v2.txt', 'w') as f:
    f.write('\n'.join(lines) + '\n')

cmd = [
    'ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', '/tmp/concat_v2.txt',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '21',
    '-movflags', '+faststart', '-an',
    'public/assets/videos/party_noir.mp4'
]
subprocess.run(cmd, check=True)

print("Finished successfully! Video size:", os.path.getsize('public/assets/videos/party_noir.mp4'))
