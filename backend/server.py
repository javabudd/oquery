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
from sentence_transformers import SentenceTransformer, util

from uncertain_responses import UNCERTAIN_RESPONSES

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],  # Allows GET, POST, OPTIONS, etc.
    allow_headers=["*"],  # Allows Content-Type, Authorization, etc.
)

model = SentenceTransformer("all-MiniLM-L6-v2")


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
            "Do not generate opinions, predictions, or subjective analysis—only. Present verifiable "
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

        assistant_response = ''
        for chunk in response:
            message = chunk["message"]
            if message["role"] == "assistant":
                content = message["content"]
                yield content
                assistant_response += content

            elif message["role"] == "tool":
                tool_output = _handle_tool_call(message["content"])
                messages.append({"role": "tool", "content": tool_output})

                # Let the assistant process the tool output
                follow_up_response = client.chat(model=request.model, messages=messages, stream=True)
                for follow_up_chunk in follow_up_response:
                    yield follow_up_chunk["message"]["content"]
                    messages.append(follow_up_chunk["message"])

        if _is_uncertain(assistant_response):
            ddg_results = generate_duckduckgo_search(request.message)
            yield f"\n\n<search>\nAI was unsure, so here are DuckDuckGo results:\n{ddg_results}\n</search>"

    return StreamingResponse(generate(), media_type="text/plain")


def _is_uncertain(response: str) -> bool:
    """Check if response is uncertain using sentence similarity."""
    response_embedding = model.encode(response, convert_to_tensor=True)
    uncertain_embeddings = model.encode(UNCERTAIN_RESPONSES, convert_to_tensor=True)

    similarity_scores = util.pytorch_cos_sim(response_embedding, uncertain_embeddings)
    max_similarity = similarity_scores.max().item()

    return max_similarity > 0.55


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
