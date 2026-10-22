import os
import shutil
import tempfile

import pytest

from services.control_plane.registry import registry


@pytest.fixture(scope="session", autouse=True)
def isolate_registry_data_for_tests():
    """
    Isolates registry state to a temporary directory for the duration of tests
    to prevent dirtying the tracked data/registry/registry_state.json file.
    """
    repo_data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "registry"))
    base_state_file = os.path.join(repo_data_dir, "registry_state.json")

    with tempfile.TemporaryDirectory() as tmp_dir:
        if os.path.exists(base_state_file):
            shutil.copy2(base_state_file, os.path.join(tmp_dir, "registry_state.json"))

        orig_env = os.environ.get("REGISTRY_DATA_DIR")
        os.environ["REGISTRY_DATA_DIR"] = tmp_dir
        registry.data_dir = tmp_dir
        registry._load_from_disk()

        yield

        if orig_env is not None:
            os.environ["REGISTRY_DATA_DIR"] = orig_env
        else:
            os.environ.pop("REGISTRY_DATA_DIR", None)

        registry.data_dir = repo_data_dir
        registry._load_from_disk()
