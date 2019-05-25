from flask import Flask, render_template, request
from game import game
app = Flask(__name__)


@app.route("/")
def index():
    return render_template('index.html')

@app.route("/result", methods=['POST', 'GET'])
def result():
    if request.method == 'POST':
        row = request.form['row']
        col = request.form['col']
        result = game(row, col)
        return result
