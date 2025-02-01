import os
from typing import Generator

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from ollama import Client
from pydantic import BaseModel

load_dotenv()
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],  # Allows GET, POST, OPTIONS, etc.
    allow_headers=["*"],  # Allows Content-Type, Authorization, etc.
)


class ChatRequest(BaseModel):
    model: str
    message: str


@app.get("/")
async def root():
    return {"Hello": "World"}


@app.post('/query')
def query(request: ChatRequest):
    client = Client(host=os.getenv("OLLAMA_HOST"))

    def generate() -> Generator[str, None, None]:
        response = client.chat(
            model=request.model,
            messages=[
                {"role": "system", "content": "You are a helpful AI that provides concise and technical answers."},
                {"role": "user", "content": request.message}
            ],
            stream=True,
        )

        for chunk in response:
            yield chunk['message']['content']

    return StreamingResponse(generate(), media_type="text/plain")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=6969)
