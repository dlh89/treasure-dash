from flask import Flask, render_template, request
from flask_socketio import SocketIO, send, emit
from pprint import pprint
from game import game
app = Flask(__name__)

app.config['SECRET_KEY'] = 'mysecret'
socketio = SocketIO(app)

# @app.route("/")
# def index():
#     return render_template('index.html')

# @app.route("/result", methods=['POST', 'GET'])
# def result():
#     if request.method == 'POST':
#         row = request.form['row']
#         col = request.form['col']
#         result = game(row, col)
#         return result

online_users = []

@socketio.on("connect")
def handle_connect():
    print("on connect")
    sid = request.sid
    online_users.append(sid)
    emit("user_connected", {"user": sid})

@socketio.on("dig")
def handle_json(json):
    result = game(json['row'], json['col'])
    dig_data = {'row': json['row'], 'col': json['col'], 'result': result}
    emit('dig', dig_data, broadcast=True)

if __name__ == "__main__":
    socketio.run(app)