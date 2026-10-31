import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "college_event_manager")

client = AsyncIOMotorClient(MONGODB_URI)
db = client[DATABASE_NAME]

users_collection = db["users"]
events_collection = db["events"]
registrations_collection = db["registrations"]
faqs_collection = db["faqs"]
announcements_collection = db["announcements"]
feedbacks_collection = db["feedbacks"]


async def init_indexes():
    await users_collection.create_index("username", unique=True)
    await registrations_collection.create_index(
        [("event_id", 1), ("student_id", 1)], unique=True
    )
    await events_collection.create_index([("participants_count", -1)])
    await faqs_collection.create_index([("event_id", 1), ("created_at", -1)])
    await announcements_collection.create_index([("event_id", 1), ("created_at", -1)])
    await feedbacks_collection.create_index([("organizer_id", 1), ("created_at", -1)])
