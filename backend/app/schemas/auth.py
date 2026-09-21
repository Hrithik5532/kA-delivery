"""Auth and user schemas."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.enums import ApprovalStatus


class CustomerRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=32)


class RiderRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    vehicle_type: str = Field(default="bike", max_length=32)
    vehicle_number: str = Field(default="PENDING", max_length=32)
    license_number: str = Field(default="PENDING", max_length=64)
    emergency_contact: str | None = Field(default=None, max_length=32)


class MessRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=1, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    mess_name: str = Field(min_length=1, max_length=255)
    description: str = Field(default="", max_length=2000)
    address_text: str = Field(min_length=1, max_length=255)
    lat: float
    lng: float


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OtpRequest(BaseModel):
    phone: str = Field(min_length=6, max_length=20)


class OtpRequestResponse(BaseModel):
    sent: bool
    # Present only in dev (no real SMS): lets the app prefill the code.
    dev_code: str | None = None


class OtpVerify(BaseModel):
    phone: str = Field(min_length=6, max_length=20)
    code: str = Field(min_length=3, max_length=8)
    full_name: str | None = Field(default=None, max_length=255)


class RoleSwitchRequest(BaseModel):
    role: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    roles: list[str]


class RiderProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    vehicle_type: str
    vehicle_number: str
    license_number: str
    approval_status: ApprovalStatus
    correction_reason: str | None = None
    is_online: bool


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr | None = None
    full_name: str
    phone: str | None = None
    roles: list[str]
    admin_role: str | None = None
    rider_profile: RiderProfileOut | None = None

    @classmethod
    def from_user(cls, user) -> "UserOut":
        return cls(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            phone=user.phone,
            roles=user.role_list,
            admin_role=(user.admin_role.value if user.admin_role else None),
            rider_profile=(
                RiderProfileOut.model_validate(user.rider_profile)
                if user.rider_profile
                else None
            ),
        )
