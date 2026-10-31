import io
import os
import secrets
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from typing import Optional
from bson import ObjectId
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pymongo.errors import DuplicateKeyError
import openpyxl

from database import (
    init_indexes,
    users_collection,
    events_collection,
    registrations_collection,
    faqs_collection,
)
from models import (
    UserRegisterRequest,
    UserLoginRequest,
    EventCreateRequest,
    EventUpdateRequest,
    EventRegistrationRequest,
    FAQCreateRequest,
    FAQAnswerRequest,
)
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_indexes()
    yield


app = FastAPI(
    title="EVENT MANAGER API",
    description="College Event Management Platform Backend (FastAPI + MongoDB Atlas)",
    version="1.0.0",
    lifespan=lifespan,
)

origins = os.getenv("FRONTEND_ORIGIN", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def serialize_event(doc: dict, today_str: Optional[str] = None) -> dict:
    if today_str is None:
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    is_completed = (
        bool(doc.get("is_completed"))
        or doc.get("event_date", "") < today_str
        or doc.get("registration_deadline", "") < today_str
    )
    return {
        "id": str(doc["_id"]),
        "title": doc["title"],
        "category": doc["category"],
        "description": doc["description"],
        "venue": doc["venue"],
        "event_date": doc["event_date"],
        "event_time": doc["event_time"],
        "registration_deadline": doc["registration_deadline"],
        "cost": doc.get("cost", 0.0),
        "max_capacity": doc.get("max_capacity"),
        "min_team_size": doc.get("min_team_size", 1),
        "max_team_size": doc.get("max_team_size", 4),
        "organizer_id": doc["organizer_id"],
        "organizer_name": doc["organizer_name"],
        "organizer_phone": doc["organizer_phone"],
        "image_url": doc.get("image_url", ""),
        "participants_count": doc.get("participants_count", 0),
        "is_completed": is_completed,
        "created_at": doc.get("created_at", ""),
    }


def serialize_faq(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "event_id": doc["event_id"],
        "question": doc["question"],
        "asked_by_name": doc.get("asked_by_name", "Organizer"),
        "answer": doc.get("answer"),
        "answered_at": doc.get("answered_at"),
        "created_at": doc.get("created_at", ""),
    }


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


@app.get("/api/auth/check-username")
async def check_username(username: str = Query(..., min_length=1)):
    normalized = username.strip().lower()
    existing = await users_collection.find_one({"username": normalized})
    if existing:
        return {
            "exists": True,
            "role": existing["role"],
            "message": "Account already exists. Switch to Sign In to access your account.",
        }
    return {"exists": False}


@app.post("/api/auth/register")
async def register_user(payload: UserRegisterRequest):
    normalized_username = payload.username.strip().lower()
    existing = await users_collection.find_one({"username": normalized_username})
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "ACCOUNT_EXISTS",
                "role": existing["role"],
                "message": "An account with this username already exists. Please switch to existing account Sign In.",
            },
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "username": normalized_username,
        "password_hash": hash_password(payload.password),
        "full_name": payload.full_name.strip(),
        "email": payload.email.strip().lower(),
        "phone": payload.phone.strip(),
        "department": payload.department.strip(),
        "role": payload.role,
        "created_at": now_iso,
    }
    try:
        result = await users_collection.insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "ACCOUNT_EXISTS",
                "message": "An account with this username already exists. Please switch to existing account Sign In.",
            },
        )

    user_id = str(result.inserted_id)
    token = create_access_token(user_id, normalized_username, payload.role)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "username": normalized_username,
            "full_name": user_doc["full_name"],
            "email": user_doc["email"],
            "phone": user_doc["phone"],
            "department": user_doc["department"],
            "role": user_doc["role"],
            "created_at": now_iso,
        },
    }


@app.post("/api/auth/login")
async def login_user(payload: UserLoginRequest):
    normalized_username = payload.username.strip().lower()
    user = await users_collection.find_one({"username": normalized_username})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=401, detail="Invalid username or password."
        )
    if user["role"] != payload.role:
        raise HTTPException(
            status_code=403,
            detail=f"This account is registered as {user['role']}. Please select {user['role']} to sign in.",
        )

    user_id = str(user["_id"])
    token = create_access_token(user_id, user["username"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user_id,
            "username": user["username"],
            "full_name": user["full_name"],
            "email": user["email"],
            "phone": user.get("phone", ""),
            "department": user.get("department", ""),
            "role": user["role"],
            "created_at": user.get("created_at", ""),
        },
    }


@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}


# List Active Events (COMPLETED EVENTS ARE REMOVED FROM WEBSITE)
@app.get("/api/events")
async def list_events(
    search: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
):
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    query: dict = {
        "event_date": {"$gte": today_str},
        "registration_deadline": {"$gte": today_str},
        "is_completed": {"$ne": True},
    }
    if category and category.lower() != "all":
        query["category"] = {"$regex": f"^{category.strip()}$", "$options": "i"}
    if search and search.strip():
        q = search.strip()
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
            {"venue": {"$regex": q, "$options": "i"}},
            {"organizer_name": {"$regex": q, "$options": "i"}},
        ]

    cursor = events_collection.find(query).sort("event_date", 1)
    events = [serialize_event(doc, today_str) async for doc in cursor]
    return {"events": events}


# Top 5 Active Events
@app.get("/api/events/top")
async def top_events():
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    query: dict = {
        "event_date": {"$gte": today_str},
        "registration_deadline": {"$gte": today_str},
        "is_completed": {"$ne": True},
    }
    cursor = (
        events_collection.find(query)
        .sort([("participants_count", -1), ("created_at", -1)])
        .limit(5)
    )
    events = [serialize_event(doc, today_str) async for doc in cursor]
    return {"events": events}


@app.get("/api/events/{event_id}")
async def get_event_details(event_id: str):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=404, detail="Event not found.")
    doc = await events_collection.find_one({"_id": ObjectId(event_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Event not found.")
    faq_cursor = faqs_collection.find({"event_id": event_id}).sort("created_at", 1)
    faqs = [serialize_faq(f) async for f in faq_cursor]
    return {"event": serialize_event(doc), "faqs": faqs}


@app.post("/api/events")
async def create_event(
    payload: EventCreateRequest, current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "ORGANIZER":
        raise HTTPException(status_code=403, detail="Only organizers can create events.")

    now_iso = datetime.now(timezone.utc).isoformat()
    doc = {
        "title": payload.title.strip(),
        "category": payload.category.strip(),
        "description": payload.description.strip(),
        "venue": payload.venue.strip(),
        "event_date": payload.event_date,
        "event_time": payload.event_time,
        "registration_deadline": payload.registration_deadline,
        "cost": payload.cost,
        "max_capacity": payload.max_capacity,
        "min_team_size": payload.min_team_size,
        "max_team_size": payload.max_team_size,
        "organizer_id": current_user["id"],
        "organizer_name": current_user["full_name"],
        "organizer_phone": payload.organizer_phone.strip(),
        "image_url": payload.image_url.strip(),
        "participants_count": 0,
        "is_completed": False,
        "created_at": now_iso,
    }
    result = await events_collection.insert_one(doc)
    doc["_id"] = result.inserted_id
    event_id = str(result.inserted_id)

    if payload.initial_faqs:
        faq_docs = [
            {
                "event_id": event_id,
                "question": item.question.strip(),
                "asked_by_name": current_user["full_name"],
                "answer": item.answer.strip(),
                "answered_at": now_iso,
                "created_at": now_iso,
            }
            for item in payload.initial_faqs
            if item.question.strip() and item.answer.strip()
        ]
        if faq_docs:
            await faqs_collection.insert_many(faq_docs)

    return {"event": serialize_event(doc)}


@app.put("/api/events/{event_id}")
async def update_event(
    event_id: str,
    payload: EventUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "ORGANIZER":
        raise HTTPException(status_code=403, detail="Only organizers can edit events.")
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=404, detail="Event not found.")

    existing = await events_collection.find_one({"_id": ObjectId(event_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Event not found.")
    if existing["organizer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only update events you created.")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates:
        await events_collection.update_one({"_id": ObjectId(event_id)}, {"$set": updates})
    updated = await events_collection.find_one({"_id": ObjectId(event_id)})
    return {"event": serialize_event(updated)}


@app.delete("/api/events/{event_id}")
async def delete_event(
    event_id: str, current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "ORGANIZER":
        raise HTTPException(status_code=403, detail="Only organizers can delete events.")
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=404, detail="Event not found.")

    existing = await events_collection.find_one({"_id": ObjectId(event_id)})
    if not existing:
        raise HTTPException(status_code=404, detail="Event not found.")
    if existing["organizer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only delete events you created.")

    await events_collection.delete_one({"_id": ObjectId(event_id)})
    await registrations_collection.delete_many({"event_id": event_id})
    await faqs_collection.delete_many({"event_id": event_id})
    return {"deleted": True}


# Multi-Participant Registration
@app.post("/api/events/{event_id}/register")
async def register_for_event(
    event_id: str,
    payload: EventRegistrationRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "STUDENT":
        raise HTTPException(status_code=403, detail="Only student accounts can register for events.")
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=404, detail="Event not found.")

    event = await events_collection.find_one({"_id": ObjectId(event_id)})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found.")

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if (
        bool(event.get("is_completed"))
        or event["registration_deadline"] < today_str
        or event["event_date"] < today_str
    ):
        raise HTTPException(
            status_code=400,
            detail="Registration is closed or this event has completed.",
        )

    count_to_add = len(payload.participants)
    if (
        event.get("max_capacity")
        and event.get("participants_count", 0) + count_to_add > event["max_capacity"]
    ):
        raise HTTPException(status_code=400, detail="Event capacity exceeded.")

    ref_code = f"EM-{secrets.token_hex(2).upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()
    reg_doc = {
        "event_id": event_id,
        "reference_code": ref_code,
        "student_id": current_user["id"],
        "student_name": current_user["full_name"],
        "student_username": current_user["username"],
        "team_name": (payload.team_name or "").strip(),
        "participants": [p.model_dump() for p in payload.participants],
        "participant_count": count_to_add,
        "notes": (payload.notes or "").strip(),
        "registered_at": now_iso,
    }
    try:
        result = await registrations_collection.insert_one(reg_doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=409, detail="You are already registered for this event."
        )

    await events_collection.update_one(
        {"_id": ObjectId(event_id)}, {"$inc": {"participants_count": count_to_add}}
    )
    updated_event = await events_collection.find_one({"_id": ObjectId(event_id)})
    return {
        "registration": {
            "id": str(result.inserted_id),
            **{k: v for k, v in reg_doc.items() if k != "_id"},
        },
        "event": serialize_event(updated_event),
    }


# Student Registrations (Current vs History)
@app.get("/api/student/registrations")
async def get_student_registrations(current_user: dict = Depends(get_current_user)):
    cursor = registrations_collection.find({"student_id": current_user["id"]}).sort(
        "registered_at", -1
    )
    regs = [doc async for doc in cursor]
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    current_events = []
    history_events = []

    for r in regs:
        if not ObjectId.is_valid(r["event_id"]):
            continue
        ev = await events_collection.find_one({"_id": ObjectId(r["event_id"])})
        if not ev:
            continue
        serialized_ev = serialize_event(ev, today_str)
        item = {
            "registration": {
                "id": str(r["_id"]),
                "reference_code": r.get("reference_code", "EM-001"),
                "team_name": r.get("team_name"),
                "participants": r.get("participants", []),
                "participant_count": r.get("participant_count", 1),
                "notes": r.get("notes", ""),
                "registered_at": r["registered_at"],
            },
            "event": serialized_ev,
            "is_completed": serialized_ev["is_completed"],
        }
        if serialized_ev["is_completed"]:
            history_events.append(item)
        else:
            current_events.append(item)

    return {"current": current_events, "history": history_events, "today": today_str}


# FAQs
@app.post("/api/events/{event_id}/faqs")
async def create_faq(
    event_id: str,
    payload: FAQCreateRequest,
    current_user: dict = Depends(get_current_user),
):
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=404, detail="Event not found.")
    ev = await events_collection.find_one({"_id": ObjectId(event_id)})
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found.")

    now_iso = datetime.now(timezone.utc).isoformat()
    is_host = (
        current_user["role"] == "ORGANIZER"
        and ev["organizer_id"] == current_user["id"]
    )
    faq_doc = {
        "event_id": event_id,
        "question": payload.question.strip(),
        "asked_by_name": current_user["full_name"],
        "answer": payload.answer.strip() if (is_host and payload.answer) else None,
        "answered_at": now_iso if (is_host and payload.answer) else None,
        "created_at": now_iso,
    }
    res = await faqs_collection.insert_one(faq_doc)
    faq_doc["_id"] = res.inserted_id
    return {"faq": serialize_faq(faq_doc)}


@app.put("/api/events/{event_id}/faqs/{faq_id}")
async def answer_faq(
    event_id: str,
    faq_id: str,
    payload: FAQAnswerRequest,
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] != "ORGANIZER":
        raise HTTPException(status_code=403, detail="Only organizers can answer FAQs.")
    if not ObjectId.is_valid(event_id) or not ObjectId.is_valid(faq_id):
        raise HTTPException(status_code=404, detail="FAQ or event not found.")

    ev = await events_collection.find_one({"_id": ObjectId(event_id)})
    if not ev or ev["organizer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="You can only answer FAQs for your own events.")

    now_iso = datetime.now(timezone.utc).isoformat()
    await faqs_collection.update_one(
        {"_id": ObjectId(faq_id), "event_id": event_id},
        {"$set": {"answer": payload.answer.strip(), "answered_at": now_iso}},
    )
    updated = await faqs_collection.find_one({"_id": ObjectId(faq_id)})
    if not updated:
        raise HTTPException(status_code=404, detail="FAQ not found.")
    return {"faq": serialize_faq(updated)}


@app.get("/api/organizer/events")
async def get_organizer_events(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "ORGANIZER":
        raise HTTPException(status_code=403, detail="Organizer access required.")

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cursor = events_collection.find({"organizer_id": current_user["id"]}).sort(
        "created_at", -1
    )
    hosted_events = [serialize_event(doc, today_str) async for doc in cursor]
    return {"events": hosted_events}


@app.get("/api/organizer/events/{event_id}/participants")
async def get_event_participants(
    event_id: str, current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "ORGANIZER":
        raise HTTPException(status_code=403, detail="Organizer access required.")
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=404, detail="Event not found.")

    ev = await events_collection.find_one({"_id": ObjectId(event_id)})
    if not ev or ev["organizer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied for this event.")

    reg_cursor = registrations_collection.find({"event_id": event_id}).sort(
        "registered_at", -1
    )
    registrations = [
        {
            "id": str(r["_id"]),
            "reference_code": r.get("reference_code", "EM-001"),
            "team_name": r.get("team_name"),
            "student_name": r["student_name"],
            "student_username": r["student_username"],
            "participants": r.get("participants", []),
            "participant_count": r.get("participant_count", 1),
            "notes": r.get("notes", ""),
            "registered_at": r["registered_at"],
        }
        async for r in reg_cursor
    ]
    faq_cursor = faqs_collection.find({"event_id": event_id}).sort("created_at", -1)
    faqs = [serialize_faq(f) async for f in faq_cursor]
    return {
        "event": serialize_event(ev),
        "registrations": registrations,
        "faqs": faqs,
    }


# Excel Export Endpoint
@app.get("/api/organizer/events/{event_id}/export-excel")
async def export_event_excel(
    event_id: str, current_user: dict = Depends(get_current_user)
):
    if current_user["role"] != "ORGANIZER":
        raise HTTPException(status_code=403, detail="Organizer access required.")
    if not ObjectId.is_valid(event_id):
        raise HTTPException(status_code=404, detail="Event not found.")

    ev = await events_collection.find_one({"_id": ObjectId(event_id)})
    if not ev or ev["organizer_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied for this event.")

    reg_cursor = registrations_collection.find({"event_id": event_id}).sort(
        "registered_at", 1
    )

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Participants"

    headers = [
        "Pass Code",
        "Team / Group Name",
        "Member Role",
        "Participant Name",
        "Email ID",
        "Phone Number",
        "Roll No / Dept",
        "Registered By (Student)",
        "Registered At",
        "Event Name",
        "Category",
        "Venue",
        "Event Date",
        "Notes",
    ]
    ws.append(headers)

    async for reg in reg_cursor:
        members = reg.get("participants", [])
        for idx, m in enumerate(members):
            ws.append([
                reg.get("reference_code", ""),
                reg.get("team_name") or "Individual",
                "Team Lead / Primary" if idx == 0 else f"Member #{idx + 1}",
                m.get("name", ""),
                m.get("email", ""),
                m.get("phone", ""),
                m.get("roll_no") or m.get("department") or "",
                f"{reg.get('student_name', '')} (@{reg.get('student_username', '')})",
                reg.get("registered_at", ""),
                ev.get("title", ""),
                ev.get("category", ""),
                ev.get("venue", ""),
                ev.get("event_date", ""),
                reg.get("notes", ""),
            ])

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"{ev['title'].replace(' ', '_')}_participants.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.get("/api/organizer/profile")
async def get_organizer_profile(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "ORGANIZER":
        raise HTTPException(status_code=403, detail="Organizer access required.")

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    cursor = events_collection.find({"organizer_id": current_user["id"]})
    events = [serialize_event(doc, today_str) async for doc in cursor]
    total_events = len(events)
    total_participants = sum(e.get("participants_count", 0) for e in events)
    event_ids = [str(e["id"]) for e in events]
    pending_faqs = (
        await faqs_collection.count_documents(
            {"event_id": {"$in": event_ids}, "answer": None}
        )
        if event_ids
        else 0
    )

    return {
        "organizer": current_user,
        "stats": {
            "events_hosted": total_events,
            "total_participants": total_participants,
            "pending_faqs": pending_faqs,
            "answered_faqs": 0,
        },
        "hosted_events": events,
    }
