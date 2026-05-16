from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379"
    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    ALGORITHM: str = "HS256"

    AZURE_CLIENT_ID: str = ""
    AZURE_TENANT_ID: str = ""
    AZURE_CLIENT_SECRET: str = ""

    SENDGRID_API_KEY: str = ""
    FROM_EMAIL: str = "noreply@atomquest.com"

    FRONTEND_URL: str = "http://localhost:5173"
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
