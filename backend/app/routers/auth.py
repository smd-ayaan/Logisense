from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.auth import create_access_token, get_current_user, verify_password
from app.db import get_connection
from app.schemas.common import LoginRequest, Token, UserResponse

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(payload: LoginRequest):
    with get_connection() as con:
        user = con.execute(
            "SELECT USER_ID, EMAIL, HASHED_PASSWORD, FULL_NAME, ROLE, IS_ACTIVE FROM LOGISENSE.USERS WHERE EMAIL = {email!s}",
            {"email": payload.email.strip().lower()},
        ).fetchone()

    print(f"[LOGIN ATTEMPT] email={payload.email}, found_user={bool(user)}")
    if user:
        matches = verify_password(payload.password, user["HASHED_PASSWORD"])
        print(f"[LOGIN ATTEMPT] password_match={matches}, is_active={user.get('IS_ACTIVE')}")
        if not matches or not user.get("IS_ACTIVE"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    token = create_access_token(
        data={"sub": user["EMAIL"], "role": user["ROLE"], "uid": user["USER_ID"]}
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user["ROLE"],
        "full_name": user["FULL_NAME"],
        "email": user["EMAIL"],
    }


@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "user_id": current_user["USER_ID"],
        "email": current_user["EMAIL"],
        "full_name": current_user["FULL_NAME"],
        "role": current_user["ROLE"],
        "is_active": current_user["IS_ACTIVE"],
    }
