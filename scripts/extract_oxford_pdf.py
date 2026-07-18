"""Extract the official Oxford 3000 PDF to UTF-8 text for the catalog generator."""

from pathlib import Path
import sys

try:
    from pypdf import PdfReader
except ImportError as exc:
    raise SystemExit("Thiếu pypdf. Chạy: python -m pip install pypdf") from exc


def main() -> None:
    if len(sys.argv) not in (2, 3):
        raise SystemExit("Cách dùng: python scripts/extract_oxford_pdf.py <pdf> [output.txt]")
    source = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else source.with_suffix(".txt")
    if not source.is_file():
        raise SystemExit(f"Không tìm thấy PDF: {source}")
    text = "\n".join(page.extract_text() or "" for page in PdfReader(source).pages)
    output.write_text(text, encoding="utf-8")
    print(f"Đã trích xuất {len(text.splitlines())} dòng vào {output}")


if __name__ == "__main__":
    main()
