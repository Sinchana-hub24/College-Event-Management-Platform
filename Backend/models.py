from typing import Optional, Literal, List
from pydantic import BaseModel, Field


class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=40)
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2, max_length=80)
    email: str = Field(..., min_length=5, max_length=120)
    phone: str = Field(default="", max_length=25)
    department: str = Field(default="", max_length=80)
    role: Literal["STUDENT", "ORGANIZER"]


class UserLoginRequest(BaseModel):
    username: str
    password: str
    role: Literal["STUDENT", "ORGANIZER"]


class InitialFAQItem(BaseModel):
    question: str
    answer: str


class EventCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=120)
    category: str = Field(..., min_length=2, max_length=50)
    description: str = Field(..., min_length=10)
    venue: str = Field(..., min_length=2, max_length=120)
    event_date: str = Field(..., description="YYYY-MM-DD")
    event_time: str = Field(..., description="HH:MM")
    registration_deadline: str = Field(..., description="YYYY-MM-DD final date for registration")
    cost: float = Field(default=0.0, ge=0)
    prizes: Optional[str] = Field(default=None, description="Prize pool and awards")
    max_capacity: Optional[int] = Field(default=None, ge=1)
    show_remaining_seats: Optional[bool] = Field(default=False)
    min_team_size: int = Field(default=1, ge=1)
    max_team_size: int = Field(default=4, ge=1)
    organizer_phone: str = Field(..., min_length=7, max_length=25)
    image_url: str = Field(default="")
    initial_faqs: Optional[List[InitialFAQItem]] = Field(default_factory=list)


class EventUpdateRequest(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    venue: Optional[str] = None
    event_date: Optional[str] = None
    event_time: Optional[str] = None
    registration_deadline: Optional[str] = None
    cost: Optional[float] = None
    prizes: Optional[str] = None
    max_capacity: Optional[int] = None
    show_remaining_seats: Optional[bool] = None
    min_team_size: Optional[int] = None
    max_team_size: Optional[int] = None
    organizer_phone: Optional[str] = None
    image_url: Optional[str] = None
    is_completed: Optional[bool] = None


class ParticipantMemberModel(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=5)
    phone: str = Field(..., min_length=7)
    roll_no: Optional[str] = ""
    department: Optional[str] = ""


class EventRegistrationRequest(BaseModel):
    team_name: Optional[str] = None
    participants: List[ParticipantMemberModel] = Field(..., min_length=1)
    notes: Optional[str] = Field(default="", max_length=240)


class FAQCreateRequest(BaseModel):
    question: str = Field(..., min_length=4, max_length=300)
    answer: Optional[str] = Field(default=None, max_length=800)


class FAQAnswerRequest(BaseModel):
    answer: str = Field(..., min_length=1, max_length=800)


class AnnouncementCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=120)
    message: str = Field(..., min_length=4)
    is_urgent: bool = False


class FeedbackCreateRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: str = Field(..., min_length=2)
    event_id: Optional[str] = None
    event_title: Optional[str] = None


class CheckinRequest(BaseModel):
    pass_code: Optional[str] = None
    registration_id: Optional[str] = None
    toggle: bool = True
