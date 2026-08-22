import asyncio
from typing import List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()


class ConnectionManager:
    def __init__(self):
        self.active_lobbies = []
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

        lobby = self._waiting_lobby()
        is_host = lobby is None
        if is_host:
            lobby = {
                "id": len(self.active_lobbies) + 1,
                "player_1": websocket,
                "player_2": None,
                "score_a": 0,
                "score_b": 0,
                "paused": False,
            }
            self.active_lobbies.append(lobby)
        else:
            lobby["player_2"] = websocket

        await websocket.send_json({
            "type": "lobby_connect",
            "lobbyId": lobby["id"],
            "isHost": is_host,
            "scoreA": lobby["score_a"],
            "scoreB": lobby["score_b"],
        })

        if self.is_full(lobby):
            await self.send_to_lobby(lobby, {"type": "game_start"})

    def _waiting_lobby(self):
        for lobby in reversed(self.active_lobbies):
            if isinstance(lobby["player_1"], WebSocket) and lobby["player_2"] is None:
                return lobby
        return None

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        for lobby in self.active_lobbies:
            if lobby["player_1"] == websocket:
                lobby["player_1"] = None
            if lobby["player_2"] == websocket:
                lobby["player_2"] = None

    def get_lobby(self, lobby_id):
        if not isinstance(lobby_id, int) or not 1 <= lobby_id <= len(self.active_lobbies):
            return None
        return self.active_lobbies[lobby_id - 1]

    @staticmethod
    def is_full(lobby):
        return isinstance(lobby["player_1"], WebSocket) and isinstance(lobby["player_2"], WebSocket)

    @staticmethod
    def role_for(lobby, websocket):
        if lobby["player_1"] == websocket:
            return "player_1"
        if lobby["player_2"] == websocket:
            return "player_2"
        return None

    async def send_to_lobby(self, lobby, message, exclude=None):
        for key in ("player_1", "player_2"):
            connection = lobby[key]
            if isinstance(connection, WebSocket) and connection != exclude:
                await connection.send_json(message)

    async def finish_goal_pause(self, lobby):
        await asyncio.sleep(2)
        lobby["paused"] = False
        await self.send_to_lobby(lobby, {"type": "pause", "freezed": False})
        await self.send_to_lobby(lobby, {"type": "game_start"})


manager = ConnectionManager()


@app.get("/")
async def get_status():
    return {
        "status": "online",
        "active_connections": len(manager.active_connections),
        "active_lobbies": len(manager.active_lobbies),
        "websocket_url": "ws://localhost:8000/ws",
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)

    try:
        while True:
            data = await websocket.receive_json()
            lobby = manager.get_lobby(data.get("lobbyId"))
            if lobby is None:
                continue

            sender_role = manager.role_for(lobby, websocket)
            if sender_role is None:
                continue

            message_type = data.get("type")
            if message_type == "move":
                payload = {
                    "type": "move",
                    "x": data.get("x"),
                    "y": data.get("y"),
                    "nx": data.get("nx"),
                    "ny": data.get("ny"),
                    "dx": data.get("dx"),
                    "dy": data.get("dy"),
                }
                await manager.send_to_lobby(lobby, payload, exclude=websocket)

            elif message_type == "ball_state" and sender_role == "player_1":
                payload = {
                    "type": "ball_state",
                    "x": data.get("x"),
                    "y": data.get("y"),
                    "nx": data.get("nx"),
                    "ny": data.get("ny"),
                    "vx": data.get("vx"),
                    "vy": data.get("vy"),
                    "owner": data.get("owner"),
                }
                await manager.send_to_lobby(lobby, payload, exclude=websocket)

            elif message_type == "kick_request" and sender_role == "player_2":
                payload = {
                    "type": "kick_request",
                    "dx": data.get("dx", 0),
                    "dy": data.get("dy", 0),
                }
                await manager.send_to_lobby(lobby, payload, exclude=websocket)

            elif message_type == "goal" and sender_role == "player_1" and not lobby["paused"]:
                goal = data.get("goal")
                if goal not in ("left", "right"):
                    continue
                # Player 1 defends the left goal; player 2 defends the right goal.
                if goal == "right":
                    lobby["score_a"] += 1
                else:
                    lobby["score_b"] += 1
                lobby["paused"] = True
                await manager.send_to_lobby(lobby, {
                    "type": "score",
                    "scoreA": lobby["score_a"],
                    "scoreB": lobby["score_b"],
                })
                await manager.send_to_lobby(lobby, {"type": "pause", "freezed": True})
                asyncio.create_task(manager.finish_goal_pause(lobby))

    except WebSocketDisconnect:
        manager.disconnect(websocket)
