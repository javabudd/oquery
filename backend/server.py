import logging
import os
from typing import Generator, List

import uvicorn
from dotenv import load_dotenv
from duckduckgo_search import DDGS
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from ollama import Client
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, util

from tools.map import AVAILABLE_FUNCTIONS

load_dotenv()

# Initialize FastAPI app
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],  # Allows GET, POST, OPTIONS, etc.
    allow_headers=["*"],  # Allows Content-Type, Authorization, etc.
)

# Load sentence similarity model
model = SentenceTransformer("all-MiniLM-L6-v2")

logger = logging.getLogger("uvicorn")

UNCERTAIN_RESPONSES = [
    "I am unsure about that. You may need to search externally for more information.",
    "I'm not able to provide a direct answer",
]


class ChatRequest(BaseModel):
    model: str
    message: str
    searchEngine: str = None
    history: List[dict] = []
    systemContent: str = None
    imageData: str = None


@app.get("/")
async def root():
    return {"Hello": "World"}


def generate_duckduckgo_search(search_query: str) -> str:
    """Query DuckDuckGo and return formatted search results."""
    try:
        with DDGS() as ddgs:
            results = ddgs.text(search_query, max_results=3)  # Get top 3 results
        if results:
            return "\n".join([f"{r['title']} - {r['href']}" for r in results])
        return "No relevant DuckDuckGo results found."
    except Exception as e:
        return f"Failed to search with DuckDuckGo: {str(e)}"


def _is_uncertain(response: str) -> bool:
    """Check if response is uncertain using sentence similarity."""
    response_embedding = model.encode(response[:70], convert_to_tensor=True)
    uncertain_embeddings = model.encode(UNCERTAIN_RESPONSES, convert_to_tensor=True)

    similarity_scores = util.pytorch_cos_sim(response_embedding, uncertain_embeddings)
    max_similarity = similarity_scores.max().item()

    logger.info(f"Sentence uncertainty: {max_similarity}")

    return max_similarity > 0.53


@app.post('/query')
def query(request: ChatRequest):
    client = Client(host=os.getenv("OLLAMA_HOST"))

    if request.systemContent:
        system_content = request.systemContent
    else:
        system_content = (
            "You are oQuery, a helpful and knowledgeable AI assistant. You provide clear, concise, "
            "and accurate answers while maintaining a conversational and engaging tone. You adapt your "
            "responses to the user’s style and preferences. You prioritize useful and actionable "
            "information. You Follow ethical guidelines, avoid biases, and respect privacy."
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

    def generate() -> Generator[str, None, None]:
        response = client.chat(
            model=request.model,
            messages=messages,
            stream=True,
            tools=[]
        )

        assistant_response = ""

        for chunk in response:
            message = chunk["message"]
            if 'tool_calls' in message and message['tool_calls'] is not None:
                logger.info(message)
                for tool in message['tool_calls']:
                    if function_to_call := AVAILABLE_FUNCTIONS.get(tool.function.name):
                        logger.info(f"Calling function: {tool.function.name}")
                        logger.info(f"Arguments: {tool.function.arguments}")

                        tool_response = function_to_call(**tool.function.arguments)
                        logger.info(f"Function output: {tool_response}")
                    else:
                        tool_response = 'Could not retrieve more information.'
                        logger.info(f"Function {tool.function.name} not found")

                    # Append tool response and let AI process it
                    messages.append({'role': 'tool', 'content': str(tool_response), 'name': tool.function.name})
                    follow_up_response = client.chat(model=request.model, messages=messages, stream=True)
                    for follow_up_chunk in follow_up_response:
                        yield follow_up_chunk["message"]["content"]
                        assistant_response += follow_up_chunk["message"]["content"]

            elif message["role"] == "assistant":
                content = message["content"]
                yield content
                assistant_response += content

        if _is_uncertain(assistant_response):
            ddg_results = generate_duckduckgo_search(request.message)
            yield f"\n\n<search>\nAI was unsure, so here are DuckDuckGo results:\n{ddg_results}\n</search>"

    return StreamingResponse(generate(), media_type="text/plain")


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=6969,
    )
