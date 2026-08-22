import mysql.connector 
class Db_manager:
    def __init__(self,password:str,username:str='root',host:str='localhost') -> None:
        self.username = username
        self._password = password
        self.host = host

    def connect(self,db_name:str):
        self.connection = mysql.connector.connect(
            host = self.host,
            username = self.username,
            password = self._password,
            database = db_name)

    
