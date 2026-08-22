from fastapi import FastAPI, WebSocket,WebSocketDisconnect
from websocket.websocket import Websocket
from sql.db_manger import Db_manager
from dotenv import load_dotenv
import os
load_dotenv()
app = FastAPI()

@app.websocket('/wb')
async def connection(websocket_obj:WebSocket):
    wb= Websocket(websocket_obj)
    del websocket_obj#TODO controll if nescessary later
    password = os.getenv('PASSWORD')
    if password is None:
        raise AttributeError('The .env file does not contain the variable PASSWORD.')
    db_manager = Db_manager('game_data',password)
    async with wb:
        try:
            websocket = wb.websocket
            while True:
                data = await websocket.receive_json()
                result = wb.handle_json(data,db_manager)
                await websocket.send_json(result)
        except WebSocketDisconnect:
            pass
        except Exception as e:
            print(f'An error occoured: {e}')
