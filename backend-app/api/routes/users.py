from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from core.database import get_db
from models.domain import User
from models.schemas import CreateUserRequest, UpdateUserRequest, UserResponse
from typing import List

router = APIRouter()

@router.post("/", response_model=UserResponse)
def create_user(request: CreateUserRequest, requester_id: str, db: Session = Depends(get_db)):
    # Check if requester is Project Manager
    requester = db.query(User).filter(User.employee_id == requester_id).first()
    if not requester or requester.designation != "Project Manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Project Managers can create users")
    
    # Check if user exists
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        
    new_user = User(
        employee_id=request.employee_id,
        employee_name=request.employee_name,
        designation=request.designation,
        permissions=request.permissions,
        email=request.email,
        password=request.password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return UserResponse(
        employee_id=new_user.employee_id,
        employee_name=new_user.employee_name,
        designation=new_user.designation,
        permissions=new_user.permissions,
        email=new_user.email
    )

@router.get("/", response_model=List[UserResponse])
def get_all_users(requester_id: str, db: Session = Depends(get_db)):
    requester = db.query(User).filter(User.employee_id == requester_id).first()
    if not requester or requester.designation != "Project Manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Project Managers can list users")
    
    users = db.query(User).all()
    return [
        UserResponse(
            employee_id=u.employee_id,
            employee_name=u.employee_name,
            designation=u.designation,
            permissions=u.permissions,
            email=u.email
        ) for u in users
    ]

@router.get("/{employee_id}", response_model=UserResponse)
def get_user(employee_id: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.employee_id == employee_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    return UserResponse(
        employee_id=user.employee_id,
        employee_name=user.employee_name,
        designation=user.designation,
        permissions=user.permissions,
        email=user.email
    )

@router.put("/{employee_id}", response_model=UserResponse)
def update_user(employee_id: str, request: UpdateUserRequest, requester_id: str, db: Session = Depends(get_db)):
    requester = db.query(User).filter(User.employee_id == requester_id).first()
    if not requester or requester.designation != "Project Manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Project Managers can update users")
    
    user = db.query(User).filter(User.employee_id == employee_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    if request.employee_name is not None:
        user.employee_name = request.employee_name
    if request.designation is not None:
        user.designation = request.designation
    if request.permissions is not None:
        user.permissions = request.permissions
    if request.email is not None:
        user.email = request.email
    if request.password is not None:
        user.password = request.password
        
    db.commit()
    db.refresh(user)
    
    return UserResponse(
        employee_id=user.employee_id,
        employee_name=user.employee_name,
        designation=user.designation,
        permissions=user.permissions,
        email=user.email
    )

@router.delete("/{employee_id}")
def delete_user(employee_id: str, requester_id: str, db: Session = Depends(get_db)):
    requester = db.query(User).filter(User.employee_id == requester_id).first()
    if not requester or requester.designation != "Project Manager":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Project Managers can delete users")
        
    user = db.query(User).filter(User.employee_id == employee_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        
    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}
