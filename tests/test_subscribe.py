from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from api._lib import emails
from api.index import app


def test_subscribe_adds_contact_to_list(monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test")
    monkeypatch.setenv("BREVO_LIST_ID", "4")
    with patch.object(emails.httpx, "post") as post:
        post.return_value = MagicMock(status_code=201)
        resp = TestClient(app).post("/api/py/subscribe", json={"email": "a@b.c"})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    args, kwargs = post.call_args
    assert args[0] == "https://api.brevo.com/v3/contacts"
    assert kwargs["headers"]["api-key"] == "xkeysib-test"
    assert kwargs["json"] == {"email": "a@b.c", "listIds": [4], "updateEnabled": True}


def test_subscribe_brevo_failure_502(monkeypatch):
    monkeypatch.setenv("BREVO_API_KEY", "xkeysib-test")
    monkeypatch.setenv("BREVO_LIST_ID", "4")
    with patch.object(emails.httpx, "post", side_effect=RuntimeError("boom")):
        resp = TestClient(app).post("/api/py/subscribe", json={"email": "a@b.c"})
    assert resp.status_code == 502


def test_subscribe_invalid_email_422():
    resp = TestClient(app).post("/api/py/subscribe", json={"email": "not-an-email"})
    assert resp.status_code == 422
