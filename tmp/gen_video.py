import subprocess
import os

print("Starting generation of party_noir.mp4...")

# Shot 1: Ken Burns slow zoom-in on the official party visual (Glamour nocturno en estelas de luz)
cmd1 = [
    'ffmpeg', '-y', '-loop', '1',
    '-i', 'public/assets/aistudio/Glamour_nocturno_en_estelas_de_luz_376432af.png',
    '-vf', "scale=1440:810,zoompan=z='min(zoom+0.0012,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=100:s=1280x720:fps=25,hue=s=0,eq=contrast=1.2:brightness=-0.04",
    '-t', '4',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast', '-crf', '20', '-an',
    '/tmp/shot1.mp4'
]
subprocess.run(cmd1, check=True)

# Shot 2: Club crowd dancing in slow motion
cmd2 = [
    'ffmpeg', '-y', '-ss', '00:00:03', '-t', '4',
    '-i', '/tmp/pulverturm.webm',
    '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setpts=1.3*PTS,hue=s=0,eq=contrast=1.22:brightness=-0.03',
    '-r', '25',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast', '-crf', '20', '-an',
    '/tmp/shot2.mp4'
]
subprocess.run(cmd2, check=True)

# Shot 3: Ken Burns pan on party lights
cmd3 = [
    'ffmpeg', '-y', '-loop', '1',
    '-i', 'public/assets/aistudio/Glamour_nocturno_en_estelas_de_luz_376432af.png',
    '-vf', "scale=1500:844,zoompan=z=1.08:x='iw/6+on*1.2':y='ih/3':d=100:s=1280x720:fps=25,hue=s=0,eq=contrast=1.24:brightness=-0.03",
    '-t', '4',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast', '-crf', '20', '-an',
    '/tmp/shot3.mp4'
]
subprocess.run(cmd3, check=True)

# Shot 4: Techno party dance floor & light strobes in slow motion
cmd4 = [
    'ffmpeg', '-y', '-ss', '00:00:09', '-t', '4',
    '-i', '/tmp/pulverturm.webm',
    '-vf', 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setpts=1.35*PTS,hue=s=0,eq=contrast=1.25:brightness=-0.04',
    '-r', '25',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'fast', '-crf', '20', '-an',
    '/tmp/shot4.mp4'
]
subprocess.run(cmd4, check=True)

# Concat shots
with open('/tmp/concat.txt', 'w') as f:
    f.write("file '/tmp/shot1.mp4'\n")
    f.write("file '/tmp/shot2.mp4'\n")
    f.write("file '/tmp/shot3.mp4'\n")
    f.write("file '/tmp/shot4.mp4'\n")

cmd_concat = [
    'ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', '/tmp/concat.txt',
    '-c', 'copy', '/tmp/party_raw.mp4'
]
subprocess.run(cmd_concat, check=True)

# Final grade: subtle organic grain + faststart for instant web buffering
cmd_final = [
    'ffmpeg', '-y', '-i', '/tmp/party_raw.mp4',
    '-vf', 'noise=alls=10:allf=t+u,eq=contrast=1.18:brightness=-0.02',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-movflags', '+faststart', '-an',
    'public/assets/videos/party_noir.mp4'
]
subprocess.run(cmd_final, check=True)

print("party_noir.mp4 successfully created! Size:", os.path.getsize('public/assets/videos/party_noir.mp4'))
