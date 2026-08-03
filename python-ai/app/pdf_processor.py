from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter

def load_and_split_pdf(file_path: str, chunk_size: int = 1000, chunk_overlap: int = 150):
    loader = PyPDFLoader(file_path)
    pages = loader.load()  

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    chunks = splitter.split_documents(pages)
    return chunks