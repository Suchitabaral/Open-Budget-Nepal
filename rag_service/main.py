from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .rag import ChatBot

from fastapi import Request
from fastapi.responses import JSONResponse
import traceback

origins = [ ]

app = FastAPI()

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"ERROR: {exc}")
    traceback.print_exc()
    # Explicitly return JSON with CORS headers if needed
    # Note: CORSMiddleware normally handles this, but custom handlers might skip it
    # depending on how they are registered. But FastAPI's middleware usually wraps everything.
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "traceback": traceback.format_exc()},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/")
def hello_world():
    return {"message": "Hello World"}


@app.post("/api/v1/chat")
def chat(query):
    content, context = ChatBot.llm_invoke(query=query)
    return {"query": query, "content": content, "context":context}
