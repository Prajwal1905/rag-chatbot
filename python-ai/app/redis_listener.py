import json
import redis
import threading
from app.config import REDIS_URL
from app.pdf_processor import save_base64_pdf, load_and_split_pdf
from app.rag import add_document_chunks, delete_document
from app.graph import rag_graph

REQUEST_CHANNEL = "ai:request"
RESPONSE_CHANNEL = "ai:response"

r = redis.from_url(REDIS_URL)


def handle_chat(data: dict) -> dict:
    result = rag_graph.invoke({
        "question": data["question"],
        "chat_history": data.get("chatHistory", []),
        "context": [],
        "answer": "",
        "sources": [],
        "suggested_questions": [],
    })
    return {
        "answer": result["answer"],
        "sources": result["sources"],
        "suggestedQuestions": result["suggested_questions"],
    }


def handle_upload(data: dict) -> dict:
    file_path = save_base64_pdf(data["fileBase64"], data["fileName"])
    chunks = load_and_split_pdf(file_path)
    add_document_chunks(chunks, data["documentId"], data["fileName"])
    return {"chunksCreated": len(chunks)}


def handle_delete(data: dict) -> dict:
    delete_document(data["documentId"])
    return {"status": "deleted"}


def process_message(message):
    try:
        payload = json.loads(message["data"])
        request_id = payload["requestId"]
        req_type = payload["type"]
        data = payload["data"]

        print(f"[redis] received {req_type} request {request_id}")

        if req_type == "chat":
            result = handle_chat(data)
        elif req_type == "upload":
            result = handle_upload(data)
        elif req_type == "delete":
            result = handle_delete(data)
        else:
            result = {"error": f"Unknown request type: {req_type}"}

        response = {"requestId": request_id, **result}
        r.publish(RESPONSE_CHANNEL, json.dumps(response))
        print(f"[redis] responded to {request_id}")

    except Exception as e:
        print(f"[redis] error processing message: {e}")
        try:
            payload = json.loads(message["data"])
            request_id = payload.get("requestId")
            if request_id:
                r.publish(RESPONSE_CHANNEL, json.dumps({
                    "requestId": request_id,
                    "error": str(e),
                }))
        except Exception:
            pass


def start_listener():
    pubsub = r.pubsub()
    pubsub.subscribe(REQUEST_CHANNEL)
    print(f"[redis] subscribed to {REQUEST_CHANNEL}")

    for message in pubsub.listen():
        if message["type"] == "message":
            process_message(message)


def start_listener_in_thread():
    thread = threading.Thread(target=start_listener, daemon=True)
    thread.start()