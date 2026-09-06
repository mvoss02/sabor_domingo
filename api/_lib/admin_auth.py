from fastapi import Header, HTTPException

from api._lib.db import get_client


def require_admin(authorization: str = Header(default="")) -> str:
    """FastAPI dependency: the caller must present a valid Supabase session.

    The admin panel signs in with Supabase Auth (email + password, signup
    disabled), so "any valid Supabase user" == admin, same rule the RLS
    policies use. We verify by asking Supabase's auth server about the
    token (one round trip) rather than checking the JWT signature locally:
    no extra secret to manage, and it keeps working when Supabase rotates
    signing keys. Returns the admin's email for logging.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not signed in")
    token = authorization[len("Bearer "):].strip()
    try:
        res = get_client().auth.get_user(token)
    except Exception:
        res = None
    user = getattr(res, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Session expired — log in again")
    return user.email or user.id
