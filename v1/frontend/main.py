from flask import Flask, render_template

app = Flask(__name__)

@app.route('/')
def index():
    # render_template은 자동으로 templates 폴더 안의 파일을 찾습니다.
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True, host="0.0.0.0", port=8080)