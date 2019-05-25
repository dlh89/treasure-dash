import random

grid_columns = 10
grid_rows = 10

treasureRow = random.randint(1, grid_columns)
treasureCol = random.randint(1, grid_rows)

def game(row, col):
    global treasureRow
    global treasureCol

    print('treasureRow: ' + str(treasureRow))
    print('treasureCol: ' + str(treasureCol))
    row = int(row)
    col = int(col)
    if col == treasureCol and row == treasureRow:
        return 'success'
    elif row in range(treasureRow - 1, treasureRow + 2) and col in range(treasureCol - 1, treasureCol + 2):
        return 'warm'
    else:
        return 'cold'