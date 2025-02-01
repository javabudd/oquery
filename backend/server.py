import os
from typing import Generator
from typing import List

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
    history: List[dict] = []


@app.get("/")
async def root():
    return {"Hello": "World"}


@app.post('/query')
def query(request: ChatRequest):
    client = Client(host=os.getenv("OLLAMA_HOST"))

    def generate() -> Generator[str, None, None]:
        messages = [
                       {
                           "role": "system",
                           "content": "You are a helpful AI that provides concise and technical answers. "
                                      "When you are not sure of a response you always reply back with just the word "
                                      "\"UNFOUND\".",
                       }
                   ] + request.history

        messages.append({"role": "user", "content": request.message})

        response = client.chat(
            model=request.model,
            messages=messages + request.history,
            stream=True,
        )

        for chunk in response:
            message = chunk["message"]

            # Ensure we capture the assistant's response
            if message["role"] == "assistant":
                yield message["content"]
                messages.append(message)

            # Handle tool calls dynamically
            elif message["role"] == "tool":
                tool_output = _handle_tool_call(message["content"])
                messages.append({"role": "tool", "content": tool_output})

                # Let the assistant process the tool output
                follow_up_response = client.chat(model=request.model, messages=messages, stream=True)
                for follow_up_chunk in follow_up_response:
                    yield follow_up_chunk["message"]["content"]
                    messages.append(follow_up_chunk["message"])

    return StreamingResponse(generate(), media_type="text/plain")


def _handle_tool_call(tool_request: str) -> str:
    """Process tool calls (e.g., API requests) and return data."""

    if 'UNFOUND' in tool_request:
        print('detected UNFOUND in assistant response, lets dig deeper...')
        return '{"deep_dive": "1"}'
    elif "stock price" in tool_request:
        return '{"AAPL": "178.90 USD"}'
    elif "weather" in tool_request:
        return '{"NYC": {"temp": "72°F", "condition": "Sunny"}}'
    return "Unknown tool response"


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=6969)
