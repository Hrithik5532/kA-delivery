"""Authentication routes for every role.

Customers sign in by phone + OTP (email/password retained for tooling/tests).
Riders and mess owners use email + password. Admins log in with email + password
and have **no public signup**. Role switching is limited to roles already granted.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import (
    CustomerRegister,
    LoginRequest,
    MessRegister,
    OtpRequest,
    OtpRequestResponse,
    OtpVerify,
    RiderRegister,
    RoleSwitchRequest,
    Token,
    UserOut,
)
from app.services import auth_service
from app.services.auth_service import AuthError

router = APIRouter(prefix="/auth", tags=["auth"])


def _bad_request(exc: AuthError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def _unauthorized(exc: AuthError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))


# --- Rider ---------------------------------------------------------------

@router.post("/rider/register", response_model=Token, status_code=201)
def rider_register(data: RiderRegister, db: Session = Depends(get_db)) -> Token:
    try:
        user = auth_service.register_rider(db, data)
    except AuthError as exc:
        raise _bad_request(exc)
    return auth_service.issue_token(user, UserRole.rider)


@router.post("/rider/otp/request", response_model=OtpRequestResponse)
def rider_otp_request(data: OtpRequest, db: Session = Depends(get_db)) -> OtpRequestResponse:
    try:
        code = auth_service.request_rider_otp(db, data.phone)
    except AuthError as exc:
        raise _bad_request(exc)
    return OtpRequestResponse(sent=True, dev_code=code)


@router.post("/rider/otp/verify", response_model=Token)
def rider_otp_verify(data: OtpVerify, db: Session = Depends(get_db)) -> Token:
    try:
        _, token = auth_service.verify_rider_otp(db, data.phone, data.code)
    except AuthError as exc:
        raise _unauthorized(exc)
    return token


@router.post("/rider/login", response_model=Token)
def rider_login(data: LoginRequest, db: Session = Depends(get_db)) -> Token:
    try:
        _, token = auth_service.login_as(db, data.email, data.password, UserRole.rider)
    except AuthError as exc:
        raise _unauthorized(exc)
    return token


# --- Customer (phone + OTP; password login kept for tooling/tests) -------

@router.post("/customer/register", response_model=Token, status_code=201)
def customer_register(data: CustomerRegister, db: Session = Depends(get_db)) -> Token:
    try:
        user = auth_service.register_customer(db, data)
    except AuthError as exc:
        raise _bad_request(exc)
    return auth_service.issue_token(user, UserRole.customer)


@router.post("/customer/login", response_model=Token)
def customer_login(data: LoginRequest, db: Session = Depends(get_db)) -> Token:
    try:
        _, token = auth_service.login_as(
            db, data.email, data.password, UserRole.customer
        )
    except AuthError as exc:
        raise _unauthorized(exc)
    return token


@router.post("/customer/otp/request", response_model=OtpRequestResponse)
def customer_otp_request(data: OtpRequest, db: Session = Depends(get_db)) -> OtpRequestResponse:
    try:
        code = auth_service.request_customer_otp(db, data.phone)
    except AuthError as exc:
        raise _bad_request(exc)
    # In dev we surface the code so the flow is testable without an SMS gateway.
    return OtpRequestResponse(sent=True, dev_code=code)


@router.post("/customer/otp/verify", response_model=Token)
def customer_otp_verify(data: OtpVerify, db: Session = Depends(get_db)) -> Token:
    try:
        _, token = auth_service.verify_customer_otp(
            db, data.phone, data.code, data.full_name
        )
    except AuthError as exc:
        raise _bad_request(exc)
    return token


# --- Mess ----------------------------------------------------------------

@router.post("/mess/register", response_model=Token, status_code=201)
def mess_register(data: MessRegister, db: Session = Depends(get_db)) -> Token:
    try:
        user = auth_service.register_mess(db, data)
    except AuthError as exc:
        raise _bad_request(exc)
    return auth_service.issue_token(user, UserRole.mess)


@router.post("/mess/login", response_model=Token)
def mess_login(data: LoginRequest, db: Session = Depends(get_db)) -> Token:
    try:
        _, token = auth_service.login_as(db, data.email, data.password, UserRole.mess)
    except AuthError as exc:
        raise _unauthorized(exc)
    return token


# --- Admin (no public signup) --------------------------------------------

@router.post("/admin/login", response_model=Token)
def admin_login(data: LoginRequest, db: Session = Depends(get_db)) -> Token:
    try:
        _, token = auth_service.login_as(db, data.email, data.password, UserRole.admin)
    except AuthError as exc:
        raise _unauthorized(exc)
    return token


# --- Shared --------------------------------------------------------------

@router.post("/role/switch", response_model=Token)
def role_switch(
    data: RoleSwitchRequest, user: User = Depends(get_current_user)
) -> Token:
    try:
        return auth_service.switch_role(user, data.role)
    except AuthError as exc:
        raise _bad_request(exc)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.from_user(user)
