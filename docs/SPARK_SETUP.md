# PySpark Setup Notes

## Required environment variables

These must be set before running `pytest tests/test_spark_embed.py` or any
PySpark-based code in this project.

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PYSPARK_PYTHON=$(pwd)/.venv/bin/python
```

`JAVA_HOME` is needed because `/usr/libexec/java_home` resolves the correct
Temurin 17 path on macOS. Without it, `pyspark` may pick up a different JVM.

`PYSPARK_PYTHON` ensures the Spark executor workers use the same virtualenv
Python as the driver; without it, workers may use the system Python and fail
to import project modules (`src.config`, `sentence_transformers`, etc.).

## macOS Apple Silicon (MPS) note

Spark's Python worker processes are launched via `fork()`. The Metal/MPS GPU
stack on Apple Silicon (M1/M2/M3) cannot be used from forked subprocesses — the
XPC connection to the GPU compositor is severed at fork time. This causes the
worker to crash with:

```
MPSLibrary::MPSKey_Create internal error: Unable to get MPS kernel ...
Error: Compiler encountered XPC_ERROR_CONNECTION_INVALID
Fatal Python error: Aborted
```

`src/spark_embed.py` fixes this by passing `device="cpu"` when constructing
`SentenceTransformer` inside the executor. On Linux/GPU clusters, remove the
`device="cpu"` kwarg (or replace with `"cuda"`) to enable GPU acceleration.

## One-liner for tests

```bash
cd /path/to/legal-rag
source .venv/bin/activate
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PYSPARK_PYTHON=$(pwd)/.venv/bin/python
pytest tests/test_spark_embed.py -v
```

Expected: `1 passed` in ~15–60 seconds depending on hardware.
