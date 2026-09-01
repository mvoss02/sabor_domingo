from functools import lru_cache

from supabase import Client, create_client

from api._lib.config import env


@lru_cache(maxsize=1)
def get_client() -> Client:
    return create_client(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"))
