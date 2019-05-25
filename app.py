from flask import Flask, render_template, request
app = Flask(__name__)


@app.route("/")
def index():
    return render_template('index.html')

@app.route("/result", methods=['POST', 'GET'])
def result():
    print(request)
    if request.method == 'POST':
        return 'success'
