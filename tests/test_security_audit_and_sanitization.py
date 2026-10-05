from packages.agent_spec.models import MCPServerDefinition
from services.runtime.mcp_router import mcp_router


def test_token_masking_in_mcp_router():
    """Verify that sensitive API tokens are properly masked in tool outputs."""
    token = "sk-live-secret-test-token-1234567890abcdef"
    masked = mcp_router.mask_token(token)
    assert "secret" not in masked
    assert masked.endswith("cdef")
    assert masked.startswith("sk-l")
    assert "••••••••" in masked

def test_token_masking_short_tokens():
    """Verify short tokens are completely redacted."""
    short = "secret12"
    masked = mcp_router.mask_token(short)
    assert "secret" not in masked
    assert masked == "••••••••"

def test_sanitize_response_data_removes_sensitive_keys():
    """Verify recursive sanitization strips credentials, passwords, and private keys."""
    raw_payload = {
        "user_id": "usr_991",
        "api_key": "secret-super-sensitive-api-key",
        "password": "my_db_password",
        "aws_secret_access_key": "AKIAIOSFODNN7EXAMPLEKEY",
        "token": "bearer-token-payload",
        "nested": {
            "auth_header": "Bearer topsecret",
            "safe_metric": 42.5
        },
        "safe_list": [
            {"private_key": "MIIEvgIBADANBgk...", "public_metric": "ok"}
        ]
    }

    clean = mcp_router.sanitize_response_data(raw_payload)

    # Sensitive fields must be redacted
    assert clean["api_key"] == "••••••••"
    assert clean["password"] == "••••••••"
    assert clean["aws_secret_access_key"] == "••••••••"
    assert clean["token"] == "••••••••"
    assert clean["nested"]["auth_header"] == "••••••••"
    assert clean["safe_list"][0]["private_key"] == "••••••••"

    # Safe fields must be retained
    assert clean["user_id"] == "usr_991"
    assert clean["nested"]["safe_metric"] == 42.5
    assert clean["safe_list"][0]["public_metric"] == "ok"

def test_mcp_server_definition_validation():
    """Verify model attributes and protocol types on MCPServerDefinition."""
    server = MCPServerDefinition(
        serverId="srv_sec_test",
        name="Security Test Server",
        transportType="http",
        url="http://localhost:8000"
    )
    assert server.serverId == "srv_sec_test"
    assert server.transportType == "http"
