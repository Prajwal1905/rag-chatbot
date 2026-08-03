from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from langchain_core.documents import Document
from app.rag import retrieve_context, llm


class ChatState(TypedDict):
    question: str
    chat_history: List[dict]
    context: List[Document]
    answer: str
    sources: List[dict]
    suggested_questions: List[str]


def retrieve_node(state: ChatState) -> ChatState:
    docs = retrieve_context(state["question"])
    state["context"] = docs
    state["sources"] = [
        {
            "file_name": d.metadata.get("file_name", "unknown"),
            "page": d.metadata.get("page", None),
        }
        for d in docs
    ]
    return state


def generate_answer_node(state: ChatState) -> ChatState:
    context_text = "\n\n".join([d.page_content for d in state["context"]])
    history_text = "\n".join(
        [f"User: {h['question']}\nAI: {h['answer']}" for h in state.get("chat_history", [])[-3:]]
    )

    prompt = f"""You are a helpful assistant answering questions using ONLY the provided context from uploaded documents.
If the answer isn't in the context, say you don't have enough information.

Conversation so far:
{history_text}

Context:
{context_text}

Question: {state['question']}

Answer clearly and concisely:"""

    response = llm.invoke(prompt)
    state["answer"] = response.content
    return state


def generate_suggestions_node(state: ChatState) -> ChatState:
    context_text = "\n\n".join([d.page_content for d in state["context"]])

    prompt = f"""Based on this Q&A and context, suggest 3 to 5 relevant follow-up questions
the user might ask next. Return ONLY the questions, one per line, no numbering, no extra text.

Question: {state['question']}
Answer: {state['answer']}
Context: {context_text}
"""

    response = llm.invoke(prompt)
    questions = [q.strip("-• ").strip() for q in response.content.split("\n") if q.strip()]
    state["suggested_questions"] = questions[:5]
    return state


def build_graph():
    graph = StateGraph(ChatState)

    graph.add_node("retrieve", retrieve_node)
    graph.add_node("generate_answer", generate_answer_node)
    graph.add_node("generate_suggestions", generate_suggestions_node)

    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "generate_answer")
    graph.add_edge("generate_answer", "generate_suggestions")
    graph.add_edge("generate_suggestions", END)

    return graph.compile()


rag_graph = build_graph()