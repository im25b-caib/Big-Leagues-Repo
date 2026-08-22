import random
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()

class ConnectionManager:
    def __init__(self):
        self.active_lobbies = list()
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()

        self.active_connections.append(websocket)
        is_host = False

        if len(self.active_lobbies) == 0 or ((self.active_lobbies[-1].get("player_1") is not None and self.active_lobbies[-1].get("player_2") is not None)):
            self.active_lobbies.append({
                "id": len(self.active_lobbies) + 1,
                "player_1": websocket,
                "player_2": None}
            )
            is_host = True

            print(f"New lobby: {self.active_lobbies[-1].get('id')}")
            print(f"Players are: {self.active_lobbies[-1].get('player_1')}, {self.active_lobbies[-1].get('player_2')}")

        elif self.active_lobbies[-1].get('player_1') is not None:
            self.active_lobbies[-1].update({'player_2': websocket})


            print(f"Changed lobby: {self.active_lobbies[-1].get('id')}")
            print(f"Players are: {self.active_lobbies[-1].get('player_1')}, {self.active_lobbies[-1].get('player_2')}")
        
        lobby_id = len(self.active_lobbies)
        payload = self.get_lobby_payload(is_host, lobby_id)
        await websocket.send_json(payload)

        print(f"Connected new client: {websocket}")
        print(self.active_connections)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

        for lobby in self.active_lobbies:
            if (lobby.get("player_1") == websocket):
                lobby["player_1"] = "removed"
            if (lobby.get("player_2") == websocket):
                lobby["player_2"] = "removed"
        
        print(f"Client disconnected: {websocket}!")
        print(self.active_connections)
    
    async def broadcast(self, message, sender: WebSocket):
        for connection in self.active_connections:
            if connection != sender:
                await connection.send_json(message)

    def get_move_payload(self, data: dict):
        return {
            "type": "move",
            "x": data.get("x"),
            "y": data.get("y"),
            "lobbyId": data.get("lobbyId")
        }
    
    def get_lobby_payload(self, is_host, lobby_id):
        return {
            "type": "lobby_connect",
            "lobbyId": lobby_id,
            "isHost": is_host
        }

    def launch_ball(self, lobby_id):
        possible_angles = [30, 45, 60, 135, 150, 210, 315, 330]
        angle = random.randint(0, 7)
        return {
            "type": "launch_ball",
            "angle": possible_angles[angle],
            "lobby": lobby_id
        }

    async def start_full_lobby(self):
        await asyncio.sleep(2)

        for lobby in self.active_lobbies:
            if isinstance(lobby["player_2"], WebSocket) and isinstance(lobby["player_1"], WebSocket):
                payload = self.launch_ball(lobby["id"])
                
                await lobby["player_1"].send_json(payload)
                await lobby["player_2"].send_json(payload)

                print(f"Started lobby with id: {lobby['id']}")
    
    async def send_lobby_massage(self, lobby_id, message, sender : WebSocket):
        lobby = self.active_lobbies[lobby_id - 1]
        for connection in lobby.values():
            if isinstance(connection, WebSocket) and sender != connection:
                await connection.send_json(message)

manager = ConnectionManager()

@app.get("/")
async def get():
    return {
        "status": "online",
        "active_connections": len(manager.active_connections),
        "active_lobbies": len(manager.active_lobbies),
        "websocket_url": "ws://localhost:8000/ws"
    }

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    await manager.start_full_lobby()

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "ballVelocity":
                lobby = manager.active_lobbies[data.get("lobbyId") - 1]
                if isinstance(lobby["player_2"], WebSocket):
                    await lobby["player_2"].send_json(data)
            
            if data.get("type") == "score" and data.get("lobbyId"):
                lobby = manager.active_lobbies[data.get("lobbyId") - 1]

                for connection in lobby.values():
                    if isinstance(connection, WebSocket):
                        await manager.send_lobby_massage(data.get("lobbyId"), data, websocket)
                        await connection.send_json({
                            "type": "pause",
                            "freezed": True
                        })

                await asyncio.sleep(3)

                for connection in lobby.values():
                    if isinstance(connection, WebSocket):
                        await connection.send_json({
                            "type": "pause",
                            "freezed": False
                        })

                await manager.start_full_lobby()
                print(f"Sent new stats!")

            if data.get("type") == "move":
                payload = manager.get_move_payload(data)
                await manager.send_lobby_massage(payload.get("lobbyId"), payload, websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)     