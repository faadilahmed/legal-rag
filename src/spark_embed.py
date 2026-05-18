"""Stage 4 (distributed): Embedding generation with PySpark + Pandas UDFs.

Design choices, in priority order:

1. Pandas UDFs over regular UDFs. Pandas UDFs batch rows through Apache Arrow,
   giving the model 32-doc batches per call instead of one-doc-per-call. On CPU
   this is roughly a 50x throughput improvement.

2. Singleton model loading per executor. The 80MB sentence-transformer is loaded
   once and reused across batches in the same Python worker; without this, each
   partition reloads the model.

3. Lineage columns. embedding_model and embedded_at travel with each row so
   downstream consumers can reproduce or invalidate stale embeddings.

4. Repartition before embedding. Forces balanced work across executors when the
   input partitioning is skewed (e.g., one big section + many tiny ones).

macOS note: Apple Silicon MPS (Metal GPU) is unavailable inside Spark's forked
Python worker processes — the XPC connection to the GPU compositor is severed on
fork. SentenceTransformer is therefore loaded with device='cpu' explicitly. On
Linux/GPU clusters, swap 'cpu' for 'cuda' or remove the device kwarg.
"""
import pandas as pd
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import ArrayType, FloatType

from src.config import EMBEDDING_MODEL

_model = None  # SentenceTransformer | None — typed at runtime inside executor


def get_model():
    """Lazy singleton — loaded once per executor process.

    SentenceTransformer is imported inside this function rather than at module
    level so that cloudpickle can serialize the UDF without pulling in the full
    torch/transformers dependency graph into the serialised closure.

    device='cpu' is required on macOS Apple Silicon: the Metal/MPS stack is
    unavailable inside Spark's forked subprocess workers.
    """
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        _model = SentenceTransformer(EMBEDDING_MODEL, device="cpu")
    return _model


@F.pandas_udf(ArrayType(FloatType()))
def embed_batch(text_series: pd.Series) -> pd.Series:
    """Vectorized embedding — batches rows through Arrow for the model.encode call."""
    model = get_model()
    embeddings = model.encode(
        text_series.tolist(),
        batch_size=32,
        show_progress_bar=False,
        normalize_embeddings=True,
    )
    return pd.Series([emb.tolist() for emb in embeddings])


def embed_chunks_distributed(spark: SparkSession, input_path: str, output_path: str) -> None:
    """Read chunks JSONL, embed in parallel, write Parquet with lineage columns."""
    df = spark.read.json(input_path)
    embedded = (
        df
        .repartition(8)
        .withColumn("embedding", embed_batch(F.col("text")))
        .withColumn("embedding_model", F.lit(EMBEDDING_MODEL))
        .withColumn("embedded_at", F.current_timestamp())
    )
    embedded.write.mode("overwrite").parquet(output_path)


def build_local_spark() -> SparkSession:
    return (
        SparkSession.builder
        .appName("legal-rag-embed")
        .config("spark.sql.shuffle.partitions", "16")
        .config("spark.sql.adaptive.enabled", "true")
        .getOrCreate()
    )


if __name__ == "__main__":
    from src.config import CHUNKS_PATH, PROCESSED_DIR
    spark = build_local_spark()
    embed_chunks_distributed(
        spark,
        str(CHUNKS_PATH),
        str(PROCESSED_DIR / "embeddings_spark.parquet"),
    )
    print(f"Wrote {PROCESSED_DIR / 'embeddings_spark.parquet'}")
