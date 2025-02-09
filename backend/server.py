import logging
import os
from typing import Generator, List

import requests
import uvicorn
from dotenv import load_dotenv
from duckduckgo_search import DDGS
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from ollama import Client
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer, util

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


def lookup_nba_schedule(date: str, team_name: str) -> str:
    """Fetch NBA schedule from an API."""
    url = f"https://api.sportsdata.io/v3/nba/scores/json/GamesByDate/{date}?key=YOUR_NBA_API_KEY"

    try:
        response = requests.get(url)
        response.raise_for_status()
        games = response.json()

        logger.info(games)

        # Filter games by team if provided
        if team_name:
            games = [game for game in games if game["HomeTeam"] == team_name or game["AwayTeam"] == team_name]

        if not games:
            return f"No games found for {team_name} on {date}."

        return "\n".join([f"{game['AwayTeam']} vs {game['HomeTeam']} at {game['DateTime']}" for game in games])

    except Exception as e:
        return f"Failed to fetch NBA schedule: {str(e)}"


@app.post('/query')
def query(request: ChatRequest):
    client = Client(host=os.getenv("OLLAMA_HOST"))

    if request.systemContent:
        system_content = request.systemContent
    else:
        system_content = (
            "You are an AI-powered search assistant that provides factual, concise, and highly relevant answers."
            "Key Principles:"
            "Accuracy First: Prioritize accuracy and direct responses using only known information."
            "External Functionality with Caution: Only use external functions when absolutely necessary. These include:"
            "Explicit user requests for specific information (e.g., \"Define 'artificial intelligence'\")"
            "Situations where real-time data or external knowledge is required (e.g., current events, breaking news)"
            "Transparency and Honesty: If you're unsure about an answer or need real-time data but cannot call a "
            "function, respond with:"
            "\"I am unsure about that. You may need to search externally for more information.\""
            "Never provide made-up answers. Instead, explicitly say you are uncertain."
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

    available_functions = {
        'lookup_nba_schedule': lookup_nba_schedule,
    }

    def generate() -> Generator[str, None, None]:
        response = client.chat(
            model=request.model,
            messages=messages,
            stream=True,
            tools=[lookup_nba_schedule]

        )

        assistant_response = ""

        for chunk in response:
            message = chunk["message"]
            if 'tool_calls' in message and message['tool_calls'] is not None:
                logger.info(message)
                for tool in message['tool_calls']:
                    if function_to_call := available_functions.get(tool.function.name):
                        logger.info('Calling function:', tool.function.name)
                        logger.info('Arguments:', tool.function.arguments)
                        tool_response = function_to_call(**tool.function.arguments)
                        logger.info('Function output:', tool_response)
                    else:
                        tool_response = 'Could not retrieve more information.'
                        logger.info('Function', tool.function.name, 'not found')

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
