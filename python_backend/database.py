import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGODB_URI", "mongodb://localhost:27017/bodyfitai")
client = AsyncIOMotorClient(MONGO_URL)
db = client.get_database()

async def get_db():
    return db
