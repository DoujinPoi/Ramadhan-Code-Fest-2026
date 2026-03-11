from fastmcp import FastMCP
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv
import chromadb
from sentence_transformers import SentenceTransformer
from datetime import datetime
from sys_prompt import system_prompt

load_dotenv()

sql = create_engine(
    f"mysql+pymysql://{os.getenv('DB_USER')}:@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
)

mcp = FastMCP("sql-mcp")
db = chromadb.PersistentClient(path="./faq_db")
collection = db.get_or_create_collection(name="faq_docs")


@mcp.prompt()
def sys_prompt():
    return system_prompt()


@mcp.tool()
def chat_cat(message: str) -> str:
    """
    Categorize the user message, is it complaint, chitchat, or question.
    """
    chat_category = {"complaint", "chitchat", "question"}
    if message != next(iter(chat_category.values())):
        return f"Message {message} is not complaint, forbidden to run tool create_ticket"
    else:
        return f"Message {message} is complaint, allowed to run tool create_ticket"
    

@mcp.tool()
def create_ticket(
    user_id: int,
    title: str,
    description: str,
    category: str,
    priority: str,
) -> str:
    """
    Create a new support ticket in the database.
    IMPORTANT: user_id MUST come from find_user() or create_user() — never invented.
    category must be one of: technical support, billing, account management, retention & experience.
    priority must be one of: low, medium, high.
    status is automatically set to 'open'.
    """

    valid_categories = {"technical support", "billing", "account management", "retention & experience"}
    valid_priorities = {"low", "medium", "high"}

    if category not in valid_categories:
        return f"Invalid category '{category}'. Must be one of: {', '.join(valid_categories)}"
    if priority not in valid_priorities:
        return f"Invalid priority '{priority}'. Must be one of: {', '.join(valid_priorities)}"

    try:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with sql.connect() as conn:
            search_user = conn.execute(
                text("SELECT id FROM users WHERE id = :user_id"), {"user_id": user_id}
            )
            result = search_user.fetchone()
            if result is None:
                return (
                    f"ERROR: user_id {user_id} does not exist. "
                    "Call find_user() first, then create_user() if user is new, "
                    "and use the ID returned from those tools."
                )
            else:
                add_ticket = text("""
                INSERT INTO tickets (user_id, title, description, category, status, priority, created_at, updated_at)
                VALUES (:user_id, :title, :description, :category, 'open', :priority, :now, :now)
                """)
                result = conn.execute(
                    add_ticket,
                    {
                        "user_id": user_id,
                        "title": title,
                        "description": description,
                        "category": category,
                        "priority": priority,
                        "now": now,
                    },
                )
                conn.commit()
                return f"Ticket created successfully! Ticket ID: {result.lastrowid}, Status: open, Priority: {priority}"
    except Exception as e:
        return f"Failed to create ticket: {str(e)}"


@mcp.tool()
def find_user(email: str, phone_number: str) -> str:
    """
    Find user by email or phone number.
    """
    query = text("""
        SELECT id, name, email, phone_number, address FROM users WHERE email = :email OR phone_number = :phone_number
    """)

    try:
        with sql.connect() as conn:
            result = conn.execute(query, {"email": email, "phone_number": phone_number})
            user = result.fetchall()
            if user:
                # Akses pakai index integer, bukan string key
                return f"User found: ID={user[0][0]}, name={user[0][1]}, email={user[0][2]}"
            else:
                return (
                    f"User with email {email} or phone number {phone_number} not found"
                )
    except Exception as e:
        return f"Failed to find user: {str(e)}"


@mcp.tool()
def create_user(name: str, email: str, phone_number: str, address: str) -> str:
    """
    Create a new user with the provided information.
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        with sql.connect() as conn:
            add_user = text("""
            INSERT INTO users (name, email, phone_number, address, created_at, updated_at)
            VALUES (:name, :email, :phone_number, :address, :now, :now)
            """)
            result = conn.execute(
                add_user,
                {
                    "name": name,
                    "email": email,
                    "phone_number": phone_number,
                    "address": address,
                    "now": now,
                },
            )
            conn.commit()
            return f"User created successfully! User ID: {result.lastrowid}"
    except Exception as e:
        return f"Failed to find or create user: {str(e)}"


@mcp.tool()
def execute_query(query: str) -> str:
    """
    Execute a raw SQL query (SELECT, INSERT, UPDATE only). DELETE is forbidden.
    Use this only for complex or admin-level queries.
    """
    query_upper = query.strip().upper()

    if query_upper.startswith("DELETE"):
        return "Delete is not allowed"

    try:
        with sql.connect() as conn:
            result = conn.execute(text(query))

            if query_upper.startswith("SELECT"):
                rows = result.fetchall()
                if rows:
                    return str(rows)
                else:
                    return "No results"
            else:
                conn.commit()
                return f"Query executed successfully. Rows affected: {result.rowcount}"

    except Exception as e:
        return str(e)


@mcp.tool()
def save_faq_docs() -> str:
    """
    Query from database to get faq docs and save to local vector database
    """
    data = []

    try:
        with sql.connect() as conn:
            result = conn.execute(text("SELECT question, answer FROM faq_docs"))
            rows = result.fetchall()
    except Exception as e:
        return f"Failed to fetch FAQ data: {str(e)}"

    if not rows:
        return "No FAQ data found in the database."

    for row in rows:
        data.append({"question": row[0], "answer": row[1]})

    vector = SentenceTransformer("all-MiniLM-L6-v2")
    questions = [doc["question"] for doc in data]
    embed_data = vector.encode(questions)

    collection.upsert(
        documents=questions,
        metadatas=[{"answer": doc["answer"]} for doc in data],
        ids=[str(i) for i in range(len(data))],
        embeddings=embed_data.tolist(),
    )

    return f"FAQ docs saved to vector database. Total documents: {len(data)}"


if __name__ == "__main__":
    mcp.run(transport="streamable-http", port=5000)
