from fastapi.testclient import TestClient

from apps.api.main import app

client = TestClient(app)

def test_websocket_stream_immediate_handshake_and_tools():
    """Verify that connecting to the agent WebSocket immediately yields connected handshake with tools and IDLE state."""
    with client.websocket_connect("/api/v1/agents/agent_sales_analyst/stream") as websocket:
        # Client receives handshake immediately upon connecting WITHOUT sending anything first!
        data = websocket.receive_json()
        assert data["event"] == "connected"
        assert data["data"]["status"] == "READY"
        assert data["data"]["agentId"] == "agent_sales_analyst"
        assert data["data"]["state"] in ["IDLE", "READY"]
        assert "tools" in data["data"]
        tool_names = [t["name"] if isinstance(t, dict) else t for t in data["data"]["tools"]]
        assert any("calculator" in t.lower() for t in tool_names)

def test_websocket_ping_and_status_checks():
    """Verify that WebSocket responds to ping and status checks while connection stays open."""
    with client.websocket_connect("/api/v1/agents/agent_sales_analyst/stream") as websocket:
        # Handshake
        handshake = websocket.receive_json()
        assert handshake["event"] == "connected"

        # Ping
        websocket.send_json({"action": "ping"})
        pong = websocket.receive_json()
        assert pong["event"] == "pong"
        assert pong["data"]["status"] == "READY"

        # Status
        websocket.send_json({"action": "status"})
        st = websocket.receive_json()
        assert st["event"] == "status"
        assert "status" in st["data"]

def test_websocket_stream_live_tool_calling_and_processing_flow():
    """
    Verify that when agent is called, the stream delivers:
    1. status: PROCESSING
    2. tool_calling (BEFORE execution)
    3. tool_completed (AFTER execution)
    4. final_output
    5. status: IDLE
    """
    with client.websocket_connect("/api/v1/agents/agent_sales_analyst/stream") as websocket:
        # Handshake
        init = websocket.receive_json()
        assert init["event"] == "connected"

        # Trigger execution
        websocket.send_json({"inputs": {"query": "Calculate 50 * 20"}})

        events_received = []
        # Receive events until IDLE
        for _ in range(15):
            ev = websocket.receive_json()
            events_received.append(ev)
            if ev.get("event") == "status" and ev.get("data", {}).get("status") == "IDLE":
                break

        event_names = [e["event"] for e in events_received]
        assert "status" in event_names

        # Verify status started as PROCESSING
        processing_events = [e for e in events_received if e["event"] == "status" and e["data"].get("status") == "PROCESSING"]
        assert len(processing_events) >= 1

        # Verify tool calling was broadcasted
        tool_calling_events = [e for e in events_received if e["event"] == "tool_calling"]
        assert len(tool_calling_events) >= 1
        assert "calculator" in tool_calling_events[0]["data"]["tool"].lower()
        assert tool_calling_events[0]["data"]["status"] == "CALLING"

        # Verify tool completed was broadcasted
        tool_completed_events = [e for e in events_received if e["event"] == "tool_completed"]
        assert len(tool_completed_events) >= 1
        assert tool_completed_events[0]["data"]["status"] == "SUCCESS"

        # Verify final IDLE status
        idle_events = [e for e in events_received if e["event"] == "status" and e["data"].get("status") == "IDLE"]
        assert len(idle_events) >= 1

def test_global_stream_observes_http_executions():
    """Verify that WebSocket clients observe executions triggered via HTTP POST /execute."""
    with client.websocket_connect("/api/v1/agents/agent_sales_analyst/stream") as websocket:
        init = websocket.receive_json()
        assert init["event"] == "connected"

        # Trigger execution via HTTP endpoint
        res = client.post("/api/v1/agents/agent_sales_analyst/execute", json={
            "version": "latest",
            "inputs": {"query": "Calculate 120 + 80"}
        })
        assert res.status_code == 200

        # The open WebSocket MUST observe the live execution!
        events_received = []
        for _ in range(15):
            ev = websocket.receive_json()
            events_received.append(ev)
            if ev.get("event") == "status" and ev.get("data", {}).get("status") == "IDLE":
                break

        event_names = [e["event"] for e in events_received]
        assert "status" in event_names
        assert any(e["event"] == "tool_calling" for e in events_received)
        assert any(e["event"] == "tool_completed" for e in events_received)
