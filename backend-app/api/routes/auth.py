from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from core.database import get_db
from models.domain import User
from models.schemas import LoginRequest, LoginResponse

router = APIRouter()

@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user or user.password != request.password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    
    return LoginResponse(
        message="Login successful",
        employee_id=str(user.employee_id),
        employee_name=str(user.employee_name),
        email=user.email,
        designation=user.designation,
        permissions=user.permissions
    )
