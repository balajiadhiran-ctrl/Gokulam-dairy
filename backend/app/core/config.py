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

    # ---- Cattle rent billing ----
    # Charged per animal per day; invoices are issued on the 25th for the month
    # just gone. Both are frozen onto each invoice when it is generated.
    rent_per_cattle_per_day: float = 10.0
    rent_due_days: int = 10          # payment window from the issue date
    rent_auto_run: bool = True       # generate on startup once the 25th passes
    rent_auto_send: bool = True      # email new invoices as they are generated

    # ---- Outgoing mail ----
    # Unset by default: invoices still generate and appear in the owner's login,
    # they just aren't emailed until these are configured.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""              # falls back to smtp_user
    smtp_starttls: bool = True
    smtp_timeout: int = 20

    # Absolute base for links in emails, e.g. https://gokulam-dairy.onrender.com
    public_base_url: str = ""

    @property
    def mail_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_from or self.smtp_host and self.smtp_user)

    @property
    def mail_from(self) -> str:
        return self.smtp_from or self.smtp_user

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
