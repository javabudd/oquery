import os

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from ollama import ChatResponse
from ollama import Client
from pydantic import BaseModel

load_dotenv()
app = FastAPI()


class ChatRequest(BaseModel):
    model: str
    messages: list[dict[str, str]]


@app.post('/query')
async def root(request: ChatRequest):
    client = Client(
        host=os.getenv("OLLAMA_HOST")
    )

    response: ChatResponse = client.chat(model=request.model, messages=request.messages, stream=False)

    return {"message": response['message']['content']}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
