"""
navodila za pogAnanje:
1. venv
- python -m venv venv
- venv\Scripts\activate

2. namestitev paketov
pip install fastapi uvicorn ultralytics opencv-python

pip install -r requirements.txt

3. zagon serverja
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000

4. povezava iz browserja ali aplikacije na ws://localhost:8000/ws
"""



import cv2
import json
import asyncio
from fastapi import FastAPI, WebSocket
from ultralytics import YOLO
import threading
import time

app = FastAPI()

# stranski model
model = YOLO("https://huggingface.co/ParkVerc/model_stranski/resolve/main/stranski_model_augmentiran/weights/last.pt")  # <-- replace with local path for speed

clients = set()


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.add(websocket)
    print("Client connected")

    try:
        while True:
            await asyncio.sleep(1)
    except:
        clients.remove(websocket)
        print("Client disconnected")


async def broadcast(message):
    dead = []
    for ws in clients:
        try:
            await ws.send_text(json.dumps(message))
        except:
            dead.append(ws)

    for d in dead:
        clients.remove(d)


def video_loop():
    cap = cv2.VideoCapture("video2.mp4")

    if not cap.isOpened():
        print("wrong video")
        return

    SKIP = 10

    while True:
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue

        # yolo detekcija
        result = model(frame)[0]

        # tole odkomentiraj za real time prikaz
        # annotated = result.plot()
        #preview = cv2.resize(annotated, (400, 400), interpolation=cv2.INTER_AREA)
        #cv2.imshow("Processing Preview (400x400)", preview)
        #if cv2.waitKey(1) & 0xFF == ord("q"):
        #    break

        h, w = frame.shape[:2]

        detections = []
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            cls = int(box.cls[0])
            conf = float(box.conf[0])

            # CENTER X
            center_x = (x1 + x2) / 2

            # NORMALIZED LEFT->RIGHT POSITION (0 = lev, 100 = desno)
            horizontal_pos = (center_x / w) * 100
            horizontal_pos = max(0, min(100, horizontal_pos))

            detections.append({
                "label": model.names[cls],
                "confidence": conf,
                "left_to_right": horizontal_pos
            })

        # websocket broadcast
        asyncio.run(broadcast({"detections": detections}))

        # preskočimo par frejmov da si prišparamo malo cpu časa
        current = cap.get(cv2.CAP_PROP_POS_FRAMES)
        cap.set(cv2.CAP_PROP_POS_FRAMES, current + SKIP)

        # okoli 1 na sekund
        time.sleep(1)

# v odzadju procesiramo
threading.Thread(target=video_loop, daemon=True).start()