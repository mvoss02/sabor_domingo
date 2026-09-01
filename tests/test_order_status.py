from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

import api.index as index
from api.index import app


def db_with(rows):
    client = MagicMock()
    q = MagicMock()
    q.select.return_value = q
    q.eq.return_value = q
    q.execute.return_value = MagicMock(data=rows)
    client.table.return_value = q
    return client


def test_found():
    rows = [{"status": "paid", "ref_num": 241, "delivery_day": "Monday", "total": 89}]
    with patch.object(index, "get_client", return_value=db_with(rows)):
        resp = TestClient(app).get("/api/py/order-status?session_id=cs_1")
    assert resp.status_code == 200
    assert resp.json() == {"status": "paid", "ref": "#SD-241",
                           "delivery_day": "Monday", "total": 89}


def test_unknown_404():
    with patch.object(index, "get_client", return_value=db_with([])):
        resp = TestClient(app).get("/api/py/order-status?session_id=cs_nope")
    assert resp.status_code == 404
