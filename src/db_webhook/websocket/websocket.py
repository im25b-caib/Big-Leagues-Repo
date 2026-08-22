from typing import TypedDict, Type,get_type_hints,NotRequired
from fastapi import WebSocket
import inspect
class Data_structure(TypedDict):
    func: str
    username: int
    password: NotRequired[str]

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

    def handle_json(self,data:Data_structure,func_source:object):
        if not validate_typed_dict(data,Data_structure):
            return {'error':'Invalid dictionary structure given.'}
        func = data.get('func')
        username = data.get('username')
        passowrd = data.get('password')
        attr = getattr(func_source,func)
        if not callable(attr):
            return {'error':'Invalid function name given.'}
        if not passowrd:
            if is_required_param(attr,'password'):
                return {'error':'A function was called that requires a password but no password was given.'}
            return {'result': attr(username)}
        return {'result':attr(username,passowrd)}
        
        
def is_required_param(func,param_name:str):
    return param_name in [name for name,param in inspect.signature(func).parameters.items() if param.default is inspect.Parameter.empty]
    #signature describes things like parameters their type hints, default types, etc.

def validate_typed_dict(data,typed_dict:Type[TypedDict]):#Type[x] means a subclass of x.#type:ignore
    correct = False
    hints = get_type_hints(typed_dict)
    if not isinstance(data,dict):
        return correct
    if len(list(data.keys())) != len(list(hints.keys())):
        return correct
    return all(isinstance(given_key,type(expected_value)) for expected_value,given_key in zip(hints.values(),(given_key for given_key in data.keys())))
        