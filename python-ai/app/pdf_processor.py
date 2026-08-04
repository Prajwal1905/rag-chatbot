import base64
import os
import uuid
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

TEMP_DIR = "./temp_uploads"
os.makedirs(TEMP_DIR, exist_ok=True)


def save_base64_pdf(file_base64: str, file_name: str) -> str:
    file_bytes = base64.b64decode(file_base64)
    temp_path = os.path.join(TEMP_DIR, f"{uuid.uuid4()}_{file_name}")
    with open(temp_path, "wb") as f:
        f.write(file_bytes)
    return temp_path


def load_and_split_pdf(file_path: str, chunk_size: int = 1000, chunk_overlap: int = 150):
    loader = PyPDFLoader(file_path)
    pages = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    chunks = splitter.split_documents(pages)
    return chunks