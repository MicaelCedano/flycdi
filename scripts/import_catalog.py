"""Importa el catálogo mayorista FLYCDI desde el PDF original a JSON."""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PDF = Path(r"C:\Users\xmica\Downloads\Catalogo_pantallas_camaras_flex_pin.pdf")
OUTPUT = ROOT / "data" / "catalog.json"
EXPECTED = {"Pantallas": 266, "Cámaras traseras": 19, "Flex pin de carga": 126}


def repair(value: str | None) -> str:
    text = (value or "").strip()
    replacements = {
        "C�mara": "Cámara",
        "c�mara": "cámara",
        "C�maras": "Cámaras",
        "c�maras": "cámaras",
    }
    for broken, fixed in replacements.items():
        text = text.replace(broken, fixed)
    return text


def price(value: str | None) -> int:
    digits = re.sub(r"\D", "", value or "")
    if not digits:
        raise ValueError(f"Precio inválido: {value!r}")
    return int(digits)


def slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")


def main() -> None:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PDF
    if not source.exists():
        raise FileNotFoundError(f"No se encontró el catálogo: {source}")

    products: list[dict[str, object]] = []
    counts: dict[str, int] = {}
    with pdfplumber.open(source) as pdf:
        tables = pdf.pages[0].extract_tables()
        catalog_tables = tables[3:6]
        if len(catalog_tables) != 3:
            raise RuntimeError("La estructura del PDF cambió: no se encontraron las tres tablas.")

        for table in catalog_tables:
            heading = repair(table[0][0])
            if heading.startswith("Pantallas"):
                category = "Pantallas"
            elif heading.startswith("Cámaras"):
                category = "Cámaras traseras"
            elif heading.startswith("Flex"):
                category = "Flex pin de carga"
            else:
                raise RuntimeError(f"Categoría desconocida: {heading}")

            rows = table[2:]
            counts[category] = len(rows)
            for position, row in enumerate(rows, start=1):
                brand, model, product_type, variant, reference, p1, p2, p3 = [repair(v) for v in row]
                reference = "" if reference == "-" else reference
                variant = "" if variant == "-" else variant
                stable_key = reference or f"{category}-{brand}-{model}-{position}"
                products.append(
                    {
                        "id": slug(stable_key),
                        "category": category,
                        "brand": brand,
                        "model": model,
                        "productType": product_type,
                        "variant": variant,
                        "reference": reference,
                        "price1": price(p1),
                        "price2": price(p2),
                        "price3": price(p3),
                    }
                )

    if counts != EXPECTED:
        raise RuntimeError(f"Conteos inesperados: {counts}; se esperaba {EXPECTED}")
    if len({product["id"] for product in products}) != len(products):
        raise RuntimeError("Se generaron identificadores duplicados.")
    if any(not (p["price1"] >= p["price2"] >= p["price3"] > 0) for p in products):
        raise RuntimeError("Hay precios fuera del orden mayorista esperado.")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Catálogo importado: {len(products)} productos -> {OUTPUT}")
    print(" | ".join(f"{name}: {count}" for name, count in counts.items()))


if __name__ == "__main__":
    main()
