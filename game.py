import random
def game(row, col):
    columns = 5
    rows = 5
    treasureRow = random.randint(1,columns)
    treasureColumn = random.randint(1,rows)
    if col == treasureColumn and row == treasureRow:
        return 'true'
    else:
        return 'false'