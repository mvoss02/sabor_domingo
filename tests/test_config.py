import pytest

from api._lib.config import env


def test_env_returns_value(monkeypatch):
    monkeypatch.setenv("FOO_VAR", "bar")
    assert env("FOO_VAR") == "bar"


def test_env_missing_raises():
    with pytest.raises(RuntimeError):
        env("DEFINITELY_NOT_SET_12345")
