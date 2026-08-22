from fastapi import FastAPI, WebSocket
from websocket.websocket import Websocket
app = FastAPI()



@app.websocket('/wb')
async def connection(websocket_obj:WebSocket):
    wb= Websocket(websocket_obj)
    del websocket_obj#TODO controll if nescessary later
    async with wb:
        websocket = wb.websocket
        while True:
            await websocket.receive_json()
            

