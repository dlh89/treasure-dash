import random
def game():
    columns = 5
    rows = 5
    treasureRow = random.randint(1,columns)
    treasureColumn = random.randint(1,rows)
    print(treasureRow,',',treasureColumn)

game()