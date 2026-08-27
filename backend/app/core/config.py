"""Application settings loaded from environment / .env file."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Local dev uses SQLite; swap to mysql+asyncmy://... for production (see design §11.5)
    database_url: str = "sqlite:///./gokulam.db"

    jwt_secret: str = "dev-secret-change-me"
    jwt_alg: str = "HS256"
    jwt_access_ttl: int = 900          # 15 min access token (design §10)
    jwt_refresh_ttl: int = 1209600     # 14 day refresh token

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Printed in the header of donation receipts. Keep in step with the public
    # site's FARM block in frontend/src/public/content.ts.
    farm_name: str = "Gokulam Dairy Farm"
    farm_address: str = "Gokulam Village, Tamil Nadu, India"
    farm_phone: str = "+91 98765 43210"
    farm_email: str = "hello@gokulamdairy.in"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
