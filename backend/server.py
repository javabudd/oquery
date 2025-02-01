import uvicorn
from fastapi import FastAPI

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello, Python 3.14 Web Server!"}


@app.post('/')
async def root():
    return {"message": "Hello, Python 3.14 Web Server!"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
