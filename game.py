import random
def game(row, col):
    columns = 5
    rows = 5
    treasureRow = str(random.randint(1,columns))
    treasureColumn = str(random.randint(1,rows))
    if col == treasureColumn and row == treasureRow:
        return 'success'
    else:
        # TODO: return cold, warm or hot
        return 'cold'