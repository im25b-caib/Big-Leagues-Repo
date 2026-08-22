from typing import TypedDict, Type,get_type_hints
from fastapi import WebSocket

class Data_structure(TypedDict):
    func: str
    username: int



class Websocket:
    def __init__(self,websocket:WebSocket):
        self.websocket = websocket

    async def __aenter__(self):
        await self.websocket.accept()

    async def __aexit__(self, exc_type, exc, tb):
        await self.websocket.close()

    # def __getattribute__(self, name: str) -> Any:
    #     return getattr(self.websocket,name)

    # async def wait(self):
    #     await self.websocket.receive_json()

    def handle_json(self,data:Data_structure):
        if not validate_typed_dict(data,Data_structure):
            return data
        func = data.get('func')
        username = data.get('username')
        
        

def validate_typed_dict(data,typed_dict:Type[TypedDict]):#Type[x] means a subclass of x.#type:ignore
    correct = False
    hints = get_type_hints(typed_dict)
    if not isinstance(data,dict):
        return correct
    if len(list(data.keys())) != len(list(hints.keys())):
        return correct
    return all(isinstance(given_key,type(expected_value)) for expected_value,given_key in zip(hints.values(),(given_key for given_key in data.keys())))
        