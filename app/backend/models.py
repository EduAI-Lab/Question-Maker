from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class Class(Base):
    __tablename__ = "classes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    course_code = Column(String)
    semester = Column(String)
    year = Column(Integer)
    description = Column(Text)
    department = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class Draft(Base):
    __tablename__ = "drafts"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    class_id = Column(Integer, ForeignKey("classes.id"))
    content = Column(Text)
    last_saved = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow) 