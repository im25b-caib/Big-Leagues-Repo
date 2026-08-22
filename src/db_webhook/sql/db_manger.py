import mysql.connector 
class Db_manager:
    def __init__(self,db_name:str,password:str,username:str='root',host:str='localhost') -> None:
        self.username = username
        self._password = password
        self.host = host
        self.conection = self._get_connection(db_name)
        self.cursor = self.conection.cursor()

    def _get_connection(self,db_name:str):
        return mysql.connector.connect(
            host = self.host,
            username = self.username,
            password = self._password,
            database = db_name)

    def get_score(self,username:str):
        self.cursor.execute('select score from user where username = %s ',(username,))
        return self.cursor[0]
    
    def create_user(self,username:str,password:str):
        ...
        
    def verify_user(self,username:str,password:str):
        ...
    
    
    
        