import mysql.connector 
import typing
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

    def add_score(self,username:str,score:int):
        self.set_score(username,self.get_score(username)+score)

    def set_score(self,username:str,score:int):
        self.cursor.execute('update user set score = %s where username = %s;',(score,username))

    def get_score(self,username:str):
        self.cursor.execute('select score from user where username = %s;',(username,))
        return typing.cast(int,self._format_result(self.cursor.fetchall()))
         
    
    def create_user(self,username:str,password:str):
        if self._user_exists(username):
            return False
        self.cursor.execute('insert into user(username,password,score) values (%s,%s,%s);',(username,password,0))
        self.conection.commit()
        return True
    
    def verify_user(self,username:str,password:str):
        return bool(self._get_password(username) == password)

    def _get_password(self,username:str):
        self.cursor.execute('select password from user where username = %s;',(username,))
        return self._format_result(self.cursor.fetchall())
        

    def _user_exists(self,username:str):
        self.cursor.execute('select username from user where username = %s;',(username,))
        result = self._format_result(self.cursor.fetchall())
        return bool(result)
    
    def _format_result(self,result):
        return result if not result or not isinstance(result[0],tuple) else result[0][0] if result[0] else result[0]#type:ignore
         
if __name__ == '__main__':
    db_manager = Db_manager('game_data','hello12345')
    username = 'hello'
    password = 'hello12'
    # assert db_manager.create_user(username,pasword) == True
    assert db_manager.verify_user(username,'hello13') == False
    # assert db_manager.verify_user(username,pasword) == True
    print(db_manager.verify_user(username,password))
    print(db_manager._get_password(username))
    # assert db_manager.get_score(username) == 0
    print(db_manager.get_score(username))