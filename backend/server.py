import os
from typing import Generator
from typing import List

import uvicorn
from dotenv import load_dotenv
from duckduckgo_search import DDGS
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
    searchEngine: str = None
    history: List[dict] = []
    systemContent: str = None


@app.get("/")
async def root():
    return {"Hello": "World"}


@app.post('/query')
def query(request: ChatRequest):
    client = Client(host=os.getenv("OLLAMA_HOST"))

    if request.systemContent:
        system_content = request.systemContent
    else:
        system_content = (
            "You are an AI-powered search engine that provides factual, concise, and highly "
            "relevant answers based on known information."
            "You prioritize accuracy, direct responses, and trusted sources. "
            "When possible, summarize key points for clarity. "
            "Do not speculate or provide unverified claims. "
            "If an answer requires real-time data, indicate that external sources are necessary. "
            "If you cannot find a reliable answer, respond with 'UNSURE'. "
            "Do not generate opinions, predictions, or subjective analysis—only present verifiable "
            "facts."
        )

    for history_item in request.history:
        if "role" not in history_item:
            history_item["role"] = "user"

    messages = [
                   {
                       "role": "system",
                       "content": system_content
                   }
               ] + request.history

    messages.append({"role": "user", "content": request.message})

    def generate_duckduckgo_search(ddg_query: str) -> str:
        """Query DuckDuckGo and return formatted search results."""
        try:
            with DDGS() as ddgs:
                results = ddgs.text(ddg_query, max_results=3)  # Get top 3 results
            if results:
                return "\n".join([f"{r['title']} - {r['href']}" for r in results])
            return "No relevant DuckDuckGo results found."
        except Exception as e:
            return f"Failed to search with DuckDuckGo: {str(e)}"

    def generate() -> Generator[str, None, None]:
        response = client.chat(
            model=request.model,
            messages=messages,
            stream=True,
        )

        for chunk in response:
            message = chunk["message"]
            if message["role"] == "assistant":
                content = message["content"]
                if "I don't know" in response or "I'm not sure" in content:
                    ddg_results = generate_duckduckgo_search(request.message)
                    yield f"\nAI was unsure, so here are DuckDuckGo results:\n{ddg_results}"
                else:
                    yield content

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

    if 'UNSURE' in tool_request:
        print('detected UNSURE in assistant response, lets dig deeper...')
        return '{"deep_dive": "1"}'
    elif "stock price" in tool_request:
        return '{"AAPL": "178.90 USD"}'
    elif "weather" in tool_request:
        return '{"NYC": {"temp": "72°F", "condition": "Sunny"}}'
    return "Unknown tool response"


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=6969,
    )
