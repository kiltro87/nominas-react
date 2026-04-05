from extractor import (
    classify_entry,
    get_normalized_subcategory_rules,
    money_to_float,
    parse_period_from_text,
    split_irpf_embedded_pct_rows,
)


def test_parse_period_from_period_token() -> None:
    text = "PERIODO MENS 01 DIC 25 a 31 DIC 25"
    year, month, meta = parse_period_from_text(text)
    assert year == 2025
    assert month == 12
    assert meta["period_token"] == "MENS 01 DIC 25"


def test_parse_period_from_date_token() -> None:
    text = "FECHA 31 DICIEMBRE 2025"
    year, month, meta = parse_period_from_text(text)
    assert year == 2025
    assert month == 12
    assert meta["date_token"] == "31 DICIEMBRE 2025"


def test_money_to_float_spanish_format() -> None:
    assert money_to_float("1.234,56") == 1234.56
    assert money_to_float("-10,00") == -10.0
    assert money_to_float("texto") is None


def test_classify_deduction_sign_and_subcategory() -> None:
    rules = get_normalized_subcategory_rules()
    categoria, subcategoria, importe = classify_entry("TRIBUTACION I.R.P.F.", None, 100.0, rules)
    assert categoria == "Deducción"
    assert subcategoria == "Impuestos (IRPF)"
    assert importe == -100.0


def test_classify_negative_deduction_as_refund_positive() -> None:
    rules = get_normalized_subcategory_rules()
    categoria, subcategoria, importe = classify_entry("TAX REFUND", None, -100.0, rules)
    assert categoria == "Deducción"
    assert subcategoria == "Impuestos (Ajustes)"
    assert importe == 100.0


def test_classify_negative_devengo_as_deduccion() -> None:
    rules = get_normalized_subcategory_rules()
    categoria, subcategoria, importe = classify_entry("RETRIB. FLEXIBLE", -10.0, None, rules)
    assert categoria == "Ingreso"
    assert subcategoria == "Beneficio en Especie"
    assert importe == -10.0


def test_split_irpf_embedded_pct_creates_two_rows() -> None:
    rows = [
        {
            "year": 2025, "month": 12,
            "item": "TRIBUTACION I.R.P.F.33,17",
            "amount": -1779.24,
            "category": "Deducción",
            "subcategory": "Impuestos (IRPF)",
        }
    ]
    result = split_irpf_embedded_pct_rows(rows)
    assert len(result) == 2

    deduction = next(r for r in result if r["item"] == "Tributación I.R.P.F.")
    pct_row = next(r for r in result if r["item"] == "% IRPF")

    assert deduction["amount"] == -1779.24
    assert deduction["category"] == "Deducción"

    assert pct_row["amount"] == 33.17
    assert pct_row["category"] == "No computable"
    assert pct_row["subcategory"] == "Porcentaje"
    assert pct_row["year"] == 2025
    assert pct_row["month"] == 12


def test_split_irpf_plain_concept_unchanged() -> None:
    rows = [
        {
            "year": 2025, "month": 12,
            "item": "TRIBUTACION I.R.P.F.",
            "amount": -1779.24,
            "category": "Deducción",
            "subcategory": "Impuestos (IRPF)",
        }
    ]
    result = split_irpf_embedded_pct_rows(rows)
    assert len(result) == 1
    assert result[0]["item"] == "TRIBUTACION I.R.P.F."
