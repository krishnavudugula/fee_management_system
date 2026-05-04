from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base # Import Base from database

# --- ENUMS (For restricted choices) ---
class RoleType(enum.Enum):
    STUDENT = "STUDENT"
    ADMIN = "ADMIN"

class StatusType(enum.Enum):
    PENDING = "PENDING"
    CLEARED = "CLEARED"

class TransactionStatus(enum.Enum):
    PENDING_APPROVAL = "PENDING_APPROVAL"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"

class TicketStatus(enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"

# --- DATABASE TABLES ---

class User(Base):

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(RoleType), default=RoleType.STUDENT)
    
    # Specific to students
    roll_number = Column(String, unique=True, index=True, nullable=True) 
    branch = Column(String, nullable=True)

    # Relationships (Links to other tables)
    dues = relationship("StudentDue", back_populates="student")
    transactions = relationship("Transaction", back_populates="student")


class FeeCategory(Base):
    __tablename__ = "fee_categories"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    default_amount = Column(Float, nullable=False)
    target_audience = Column(String, nullable=False) # e.g., "ALL", "CSE"
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    student_dues = relationship("StudentDue", back_populates="fee_category")


class StudentDue(Base):
    __tablename__ = "student_dues"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    fee_category_id = Column(Integer, ForeignKey("fee_categories.id"))
    
    total_amount = Column(Float, nullable=False)
    paid_amount = Column(Float, default=0.0)
    status = Column(Enum(StatusType), default=StatusType.PENDING)
    is_proposed = Column(Integer, default=0)  # 1 if it's a newly proposed fee, 0 otherwise

    # Relationships
    student = relationship("User", back_populates="dues")
    fee_category = relationship("FeeCategory", back_populates="student_dues")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    fee_category_id = Column(Integer, ForeignKey("fee_categories.id"))
    
    amount_paid = Column(Float, nullable=False)
    utr_number = Column(String, unique=True, nullable=False)
    receipt_proof_url = Column(String, nullable=False) # Path to uploaded screenshot
    status = Column(Enum(TransactionStatus), default=TransactionStatus.PENDING_APPROVAL)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    student = relationship("User", back_populates="transactions")


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"))
    ticket_number = Column(String, unique=True, nullable=False)
    subject = Column(String, nullable=False)
    description = Column(String, nullable=False)
    category = Column(String, nullable=False)  # e.g., "Payment Issue", "Technical Support"
    status = Column(Enum(TicketStatus), default=TicketStatus.OPEN)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    admin_response = Column(String, nullable=True)


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id"), nullable=False)
    sender_type = Column(String, nullable=False)  # "STUDENT" or "ADMIN"
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message_text = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)