from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from app.config import GROQ_API_KEY, CHROMA_DIR, EMBEDDING_MODEL, CHAT_MODEL

embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
llm = ChatGroq(model=CHAT_MODEL, api_key=GROQ_API_KEY, temperature=0.2)

vectorstore = Chroma(
    collection_name="knowledge_base",
    embedding_function=embeddings,
    persist_directory=CHROMA_DIR,
)

def add_document_chunks(chunks, document_id: str, file_name: str):
    for c in chunks:
        c.metadata["document_id"] = document_id
        c.metadata["file_name"] = file_name
    vectorstore.add_documents(chunks)

def retrieve_context(question: str, k: int = 4):
    return vectorstore.similarity_search(question, k=k)

def delete_document(document_id: str):
    vectorstore._collection.delete(where={"document_id": document_id})