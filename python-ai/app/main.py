import os
import shutil
import uuid
from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional

from app.pdf_processor import load_and_split_pdf
from app.rag import add_document_chunks, delete_document
from app.graph import rag_graph
from app.redis_listener import start_listener_in_thread

app = FastAPI(title="RAG AI Service")

@app.on_event("startup")
def startup_event():
    start_listener_in_thread()

UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class ChatRequest(BaseModel):
    question: str
    chat_history: Optional[List[dict]] = []


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    document_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{document_id}_{file.filename}")

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    chunks = load_and_split_pdf(file_path)
    add_document_chunks(chunks, document_id, file.filename)

    return {
        "document_id": document_id,
        "file_name": file.filename,
        "chunks_created": len(chunks),
        "status": "processed",
    }


@app.delete("/document/{document_id}")
async def remove_document(document_id: str):
    delete_document(document_id)
    return {"status": "deleted", "document_id": document_id}


@app.post("/chat")
async def chat(req: ChatRequest):
    result = rag_graph.invoke({
        "question": req.question,
        "chat_history": req.chat_history,
        "context": [],
        "answer": "",
        "sources": [],
        "suggested_questions": [],
    })

    return {
        "answer": result["answer"],
        "sources": result["sources"],
        "suggested_questions": result["suggested_questions"],
    }