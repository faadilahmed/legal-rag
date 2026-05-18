"""Smoke test for the PySpark embedding module — runs against a tiny synthetic JSONL."""
import json

import pytest


@pytest.fixture(scope="module")
def spark():
    from src.spark_embed import build_local_spark
    spark = build_local_spark()
    yield spark
    spark.stop()


def test_spark_embed_writes_parquet_with_lineage(spark, tmp_path):
    from src.config import EMBEDDING_DIM, EMBEDDING_MODEL
    from src.spark_embed import embed_chunks_distributed

    input_path = tmp_path / "chunks.jsonl"
    output_path = tmp_path / "out.parquet"
    rows = [
        {"chunk_id": "A_1_0", "text": "Apple supply chain risk in Asia."},
        {"chunk_id": "B_1_0", "text": "Microsoft Azure cloud growth."},
        {"chunk_id": "C_1_0", "text": "JP Morgan regulatory capital."},
    ]
    with open(input_path, "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")

    embed_chunks_distributed(spark, str(input_path), str(output_path))

    result = spark.read.parquet(str(output_path)).collect()
    assert len(result) == 3
    for row in result:
        assert len(row.embedding) == EMBEDDING_DIM
        assert row.embedding_model == EMBEDDING_MODEL
        assert row.embedded_at is not None
