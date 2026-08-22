create database game_data;
use game_data;
create table user(
	id int primary key auto_increment,
    username varchar(255),
    score int
);