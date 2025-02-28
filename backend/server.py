import base64
import logging
import os
from datetime import datetime
from enum import Enum
from typing import Generator, List

import torch.nn.functional as F
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from ollama import Client
from pydantic import BaseModel
from transformers import AutoModelForSequenceClassification, AutoTokenizer

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
model_name = "textattack/bert-base-uncased-SST-2"
model = AutoModelForSequenceClassification.from_pretrained(model_name)
tokenizer = AutoTokenizer.from_pretrained(model_name)

logger = logging.getLogger("uvicorn")


class ModelType(Enum):
    LLAMA3_1 = 'llama3.1'
    LLAMA3_2 = 'llama3.2'
    OPENTHINKER = 'openthinker'
    PHI4 = 'phi4'
    DEEPSEEK_R1 = 'deepseek-r1'
    DEEPSEEK_R1_14B = 'deepseek-r1:14b'


class ChatRequest(BaseModel):
    model: ModelType
    message: str
    searchEngine: str = None
    history: List[dict] = []
    systemContent: str = None
    imageData: str = None


@app.get("/")
async def root():
    return {"status": "jacked"}


@app.post('/query')
def query(request: ChatRequest):
    client = Client(host=os.getenv("OLLAMA_HOST"))
    # tools = _get_tools_based_on_prompt(request.message)

    if request.systemContent:
        system_content = request.systemContent
    else:
        system_content = (
            "You are oQuery, a helpful and knowledgeable AI assistant. You were trained by some of the most intelligent"
            " people on the planet, thus you provide highly accurate and effective responses to any users input."
            f"The current date and time is: {datetime.now()}"
        )

    image_response = None
    if request.imageData:
        image_response = client.chat(
            model="llava:13b",
            messages=[
                {
                    'role': 'user',
                    'content': 'please describe this image',
                    'images': [base64.b64decode(request.imageData)]
                }
            ]
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

    if image_response:
        logger.debug(image_response)

        messages.append({"role": "user", "content": f"""
         Please attempt to assist the users request with the result of this 
          image description {image_response['message']}
        """})

    messages.append({"role": "user", "content": request.message})

    def generate() -> Generator[str, None, None]:
        response = client.chat(
            model=request.model.value,
            messages=messages,
            stream=True,
            tools=[]
        )

        for chunk in response:
            message = chunk["message"]
            if 'tool_calls' in message and message['tool_calls'] is not None:
                logger.info(message)
                for tool in message['tool_calls']:
                    if function_to_call := AVAILABLE_FUNCTIONS.get(tool.function.name):
                        logger.info(f"Calling function: {tool.function.name}")
                        logger.info(f"Arguments: {tool.function.arguments}")

                        tool_response = str(function_to_call[1](**tool.function.arguments))
                        logger.info(f"Function output: {tool_response}")
                    else:
                        tool_response = 'Could not retrieve more information.'
                        logger.info(f"Function {tool.function.name} not found")

                    if tool_response == "":
                        messages.append(
                            {'role': 'tool', 'content': f"Could not get a response from function call, ignore me."}
                        )
                    else:
                        messages.append(
                            {'role': 'tool', 'content': f"Use this response to assist the user: ${tool_response}"}
                        )
                    follow_up_response = client.chat(model=request.model.value, messages=messages, stream=True)
                    for follow_up_chunk in follow_up_response:
                        yield follow_up_chunk["message"]["content"]

            elif message["role"] == "assistant":
                content = message["content"]
                yield content

    return StreamingResponse(generate(), media_type="text/plain")


def _is_uncertain(response: str) -> bool:
    inputs = tokenizer(response, return_tensors="pt", truncation=True, padding=True, max_length=512)
    outputs = model(**inputs)  # SequenceClassifierOutput

    probabilities = F.softmax(outputs.logits, dim=-1)  # Convert logits to probabilities
    negative_prob = probabilities[0][0].item()
    positive_prob = probabilities[0][1].item()

    logger.info(f"Negative Probability: {negative_prob:.4f}, Positive Probability: {positive_prob:.4f}")

    # Uncertainty is high if neither class is dominant (close to 50/50 split)
    return negative_prob > .7 and positive_prob < .4


def _get_tools_based_on_prompt(message: str) -> list:
    # doc = nlp(request.message)
    return [t[1][0] for t in AVAILABLE_FUNCTIONS.items()]


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=6969,
    )
