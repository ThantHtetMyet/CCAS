import os
import json
import re
import shutil
import time
import zipfile
import uuid
import xml.etree.ElementTree as ET
import requests
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # Allow cross-origin requests from React dev server (port 5173)

MODEL_ID = "ornith-1.0-35b"
MAX_UNSTRUCTURED_RESPONSE_RETRIES = 3
AVAILABLE_MODELS = {
    "ornith-1.0-35b",
    "qwen-3-14b-instruct"
}

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
STORAGE_CONFIG_PATH = os.path.join(SCRIPT_DIR, "storage_config.json")
DEFAULT_DATABASE_DIR = os.path.abspath(os.path.join(PROJECT_ROOT, "Database"))


def default_storage_config():
    database_dir = DEFAULT_DATABASE_DIR
    template_dir = os.path.join(database_dir, "Report", "Template")
    ai_server_base_url = "http://192.3.71.67:1234"
    return {
        "database_dir": database_dir,
        "reports_dir": os.path.join(database_dir, "Report"),
        "workspace_db_path": os.path.join(database_dir, "workspaces.txt"),
        "template_dir": template_dir,
        "ccop_template_pdf_path": os.path.join(template_dir, "CCoP_template.pdf"),
        "ai_server_base_url": ai_server_base_url,
        "ai_chat_completions_url": f"{ai_server_base_url}/v1/chat/completions"
    }


def save_storage_config(config):
    with open(STORAGE_CONFIG_PATH, "w", encoding="utf-8") as config_file:
        json.dump(config, config_file, ensure_ascii=False, indent=2)


def load_storage_config():
    config = default_storage_config()
    if os.path.exists(STORAGE_CONFIG_PATH):
        try:
            with open(STORAGE_CONFIG_PATH, "r", encoding="utf-8") as config_file:
                loaded_config = json.load(config_file)
            configured_database_dir = os.path.abspath(
                loaded_config.get("database_dir") or config["database_dir"]
            )
            config["database_dir"] = configured_database_dir
            config["reports_dir"] = os.path.abspath(
                loaded_config.get("reports_dir") or os.path.join(configured_database_dir, "Report")
            )
            config["workspace_db_path"] = os.path.abspath(
                loaded_config.get("workspace_db_path") or os.path.join(configured_database_dir, "workspaces.txt")
            )
            configured_template_dir = os.path.abspath(
                loaded_config.get("template_dir") or os.path.join(configured_database_dir, "Report", "Template")
            )
            config["template_dir"] = configured_template_dir
            config["ccop_template_pdf_path"] = os.path.abspath(
                loaded_config.get("ccop_template_pdf_path") or os.path.join(configured_template_dir, "CCoP_template.pdf")
            )
            configured_ai_server_base_url = (loaded_config.get("ai_server_base_url") or "http://192.3.71.67:1234").rstrip("/")
            config["ai_server_base_url"] = configured_ai_server_base_url
            config["ai_chat_completions_url"] = (
                loaded_config.get("ai_chat_completions_url") or f"{configured_ai_server_base_url}/v1/chat/completions"
            )
        except (json.JSONDecodeError, OSError):
            pass

    save_storage_config(config)
    return config


STORAGE_CONFIG = load_storage_config()
DATABASE_DIR = STORAGE_CONFIG["database_dir"]
REPORTS_DIR = STORAGE_CONFIG["reports_dir"]
WORKSPACE_DB_PATH = STORAGE_CONFIG["workspace_db_path"]
TEMPLATE_DIR = STORAGE_CONFIG["template_dir"]
CCOP_TEMPLATE_PDF_PATH = STORAGE_CONFIG["ccop_template_pdf_path"]
AI_SERVER_BASE_URL = STORAGE_CONFIG["ai_server_base_url"]
LM_STUDIO_URL = STORAGE_CONFIG["ai_chat_completions_url"]


def refresh_no_proxy_for_ai_server():
    ai_entries = ["127.0.0.1", "localhost"]
    try:
        ai_host = re.sub(r"^https?://", "", AI_SERVER_BASE_URL).split("/")[0].split(":")[0].strip()
        if ai_host:
            ai_entries.append(ai_host)
    except Exception:
        pass

    no_proxy_value = ",".join(dict.fromkeys(ai_entries))
    os.environ["NO_PROXY"] = no_proxy_value
    os.environ["no_proxy"] = no_proxy_value


refresh_no_proxy_for_ai_server()


def ensure_workspace_storage():
    os.makedirs(DATABASE_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)
    os.makedirs(TEMPLATE_DIR, exist_ok=True)
    if not os.path.exists(WORKSPACE_DB_PATH):
        with open(WORKSPACE_DB_PATH, "a", encoding="utf-8"):
            pass


def sanitize_filename(filename):
    base_name = os.path.basename(filename or "uploaded_document")
    return re.sub(r"[^A-Za-z0-9._-]", "_", base_name)


def now_iso():
    return datetime.now().isoformat(timespec="seconds")


def workspace_folder_path(workspace_id):
    return os.path.join(REPORTS_DIR, workspace_id)


def workspace_file_path(workspace_id):
    return os.path.join(workspace_folder_path(workspace_id), "workspace.json")


def report_folder_path(workspace_id, report_id):
    return os.path.join(workspace_folder_path(workspace_id), report_id)


def build_default_report_name(source_name=""):
    source_base = os.path.splitext(os.path.basename(source_name or ""))[0].strip()
    if source_base:
        return source_base
    return f"CCAS Report {datetime.now().strftime('%d%m%Y_%H%M%S')}"


def sort_reports(reports):
    return sorted(
        reports,
        key=lambda item: item.get("updated_at") or item.get("created_at") or "",
        reverse=True
    )


def normalize_report_record(report, workspace_id, default_model, default_created_at):
    if not isinstance(report, dict):
        return None

    report_id = report.get("report_id") or str(uuid.uuid4())
    created_at = report.get("created_at") or default_created_at or now_iso()
    updated_at = report.get("updated_at") or created_at
    document_name = report.get("document_name") or ""
    upload_file_name = report.get("upload_file_name") or sanitize_filename(document_name) if document_name else ""
    report_name = (report.get("report_name") or "").strip() or build_default_report_name(
        report.get("report_file_name") or upload_file_name or document_name
    )
    report_model = report.get("model") or default_model or MODEL_ID
    compliance_percentage = report.get("compliance_percentage")
    audit_result = report.get("audit_result")
    if compliance_percentage is None:
        compliance_percentage = (audit_result or {}).get("compliance_percentage", 0)

    status = report.get("status")
    if not status:
        status = "completed" if audit_result else "draft"

    return {
        "report_id": report_id,
        "report_name": report_name,
        "created_at": created_at,
        "updated_at": updated_at,
        "status": status,
        "document_name": document_name,
        "upload_file_name": upload_file_name,
        "upload_file_path": report.get("upload_file_path") or "",
        "report_file_name": report.get("report_file_name"),
        "report_file_path": report.get("report_file_path"),
        "report_folder_path": report.get("report_folder_path") or report_folder_path(workspace_id, report_id),
        "model": report_model,
        "model_label": report.get("model_label") or report_model,
        "compliance_percentage": compliance_percentage or 0,
        "audit_result": audit_result
    }


def build_report_summary(report):
    normalized_report = dict(report or {})
    normalized_report.pop("audit_result", None)
    return normalized_report


def build_workspace_summary_from_payload(payload):
    reports = sort_reports(payload.get("reports") or [])
    return {
        "workspace_id": payload.get("workspace_id"),
        "workspace_name": payload.get("workspace_name"),
        "created_at": payload.get("created_at"),
        "updated_at": payload.get("updated_at") or payload.get("created_at"),
        "workspace_folder_path": payload.get("workspace_folder_path"),
        "report_count": len(reports),
    }


def normalize_workspace_payload(payload, workspace_id=None):
    if not payload:
        return None, False

    changed = False
    normalized_payload = dict(payload)
    normalized_workspace_id = normalized_payload.get("workspace_id") or workspace_id or str(uuid.uuid4())
    normalized_payload["workspace_id"] = normalized_workspace_id
    normalized_payload["workspace_folder_path"] = normalized_payload.get("workspace_folder_path") or workspace_folder_path(normalized_workspace_id)
    normalized_payload["created_at"] = normalized_payload.get("created_at") or now_iso()
    normalized_payload["updated_at"] = normalized_payload.get("updated_at") or normalized_payload["created_at"]
    normalized_payload["model"] = normalized_payload.get("model") or MODEL_ID
    normalized_payload["model_label"] = normalized_payload.get("model_label") or normalized_payload["model"]

    reports = normalized_payload.get("reports")
    if not isinstance(reports, list):
        reports = []
        legacy_has_report_data = any([
            normalized_payload.get("document_name"),
            normalized_payload.get("upload_file_name"),
            normalized_payload.get("upload_file_path"),
            normalized_payload.get("report_file_name"),
            normalized_payload.get("report_file_path"),
            normalized_payload.get("audit_result")
        ])
        if legacy_has_report_data:
            reports.append({
                "report_id": normalized_payload.get("report_id") or str(uuid.uuid4()),
                "report_name": normalized_payload.get("report_name") or build_default_report_name(
                    normalized_payload.get("report_file_name") or normalized_payload.get("upload_file_name") or normalized_payload.get("document_name")
                ),
                "created_at": normalized_payload.get("created_at"),
                "updated_at": normalized_payload.get("updated_at"),
                "status": normalized_payload.get("status"),
                "document_name": normalized_payload.get("document_name"),
                "upload_file_name": normalized_payload.get("upload_file_name"),
                "upload_file_path": normalized_payload.get("upload_file_path"),
                "report_file_name": normalized_payload.get("report_file_name"),
                "report_file_path": normalized_payload.get("report_file_path"),
                "model": normalized_payload.get("model"),
                "model_label": normalized_payload.get("model_label"),
                "compliance_percentage": normalized_payload.get("summary", {}).get("compliance_percentage")
                if isinstance(normalized_payload.get("summary"), dict) else normalized_payload.get("compliance_percentage", 0),
                "audit_result": normalized_payload.get("audit_result")
            })
        changed = True

    normalized_reports = []
    for report in reports:
        normalized_report = normalize_report_record(
            report,
            normalized_workspace_id,
            normalized_payload["model"],
            normalized_payload["created_at"]
        )
        if normalized_report:
            normalized_reports.append(normalized_report)
            if normalized_report != report:
                changed = True

    normalized_reports = sort_reports(normalized_reports)
    normalized_payload["reports"] = normalized_reports
    normalized_payload["summary"] = build_workspace_summary_from_payload(normalized_payload)
    normalized_payload["status"] = normalized_payload["summary"].get("status", "draft")
    normalized_payload["updated_at"] = normalized_payload["summary"].get("updated_at") or normalized_payload["updated_at"]

    latest_report = normalized_reports[0] if normalized_reports else {}
    normalized_payload["report_id"] = latest_report.get("report_id")
    normalized_payload["report_name"] = latest_report.get("report_name") or ""
    normalized_payload["document_name"] = latest_report.get("document_name") or ""
    normalized_payload["upload_file_name"] = latest_report.get("upload_file_name") or ""
    normalized_payload["upload_file_path"] = latest_report.get("upload_file_path") or ""
    normalized_payload["report_file_name"] = latest_report.get("report_file_name")
    normalized_payload["report_file_path"] = latest_report.get("report_file_path")
    normalized_payload["audit_result"] = latest_report.get("audit_result") if latest_report else None

    return normalized_payload, changed


def find_workspace_report(payload, report_id):
    for index, report in enumerate(payload.get("reports") or []):
        if report.get("report_id") == report_id:
            return report, index
    return None, -1


def load_workspace_index():
    ensure_workspace_storage()
    records = []
    should_rewrite = False
    with open(WORKSPACE_DB_PATH, "r", encoding="utf-8") as db_file:
        for line in db_file:
            entry = line.strip()
            if not entry:
                continue
            try:
                raw_record = json.loads(entry)
                sanitized_record = build_workspace_summary(raw_record)
                records.append(sanitized_record)
                if sanitized_record != raw_record:
                    should_rewrite = True
            except json.JSONDecodeError:
                print(f"[!] Skipping malformed workspace record: {entry[:80]}")
    if should_rewrite:
        write_workspace_index(records)
    return records


def write_workspace_index(records):
    ensure_workspace_storage()
    with open(WORKSPACE_DB_PATH, "w", encoding="utf-8") as db_file:
        for record in records:
            db_file.write(json.dumps(record, ensure_ascii=True) + "\n")


def upsert_workspace_record(record):
    records = load_workspace_index()
    updated = False
    for index, item in enumerate(records):
        if item.get("workspace_id") == record.get("workspace_id"):
            records[index] = record
            updated = True
            break
    if not updated:
        records.append(record)
    records.sort(key=lambda item: item.get("updated_at", ""), reverse=True)
    write_workspace_index(records)


def delete_workspace_record(workspace_id):
    records = load_workspace_index()
    filtered_records = [item for item in records if item.get("workspace_id") != workspace_id]
    removed = len(filtered_records) != len(records)
    if removed:
        write_workspace_index(filtered_records)
    return removed


def build_workspace_summary(record):
    return {
        "workspace_id": record.get("workspace_id"),
        "workspace_name": record.get("workspace_name"),
        "created_at": record.get("created_at"),
        "updated_at": record.get("updated_at"),
        "workspace_folder_path": record.get("workspace_folder_path"),
        "report_count": record.get("report_count", 0),
    }


def save_workspace_payload(workspace_id, payload):
    folder_path = workspace_folder_path(workspace_id)
    os.makedirs(folder_path, exist_ok=True)
    with open(workspace_file_path(workspace_id), "w", encoding="utf-8") as workspace_file:
        json.dump(payload, workspace_file, ensure_ascii=False, indent=2)


def load_workspace_payload(workspace_id):
    payload_path = workspace_file_path(workspace_id)
    if not os.path.exists(payload_path):
        return None
    with open(payload_path, "r", encoding="utf-8") as workspace_file:
        payload = json.load(workspace_file)
    normalized_payload, changed = normalize_workspace_payload(payload, workspace_id)
    if changed:
        save_workspace_payload(workspace_id, normalized_payload)
        upsert_workspace_record(normalized_payload.get("summary", {}))
    return normalized_payload



# Fallback CCoP controls (hierarchical) if JSON file is missing
DEFAULT_CONTROLS = [
  {"section_num": 3, "section_title": "Governance Requirements", "subsections": [
    {"id": "3.1", "title": "Leadership and Oversight", "requirements": "Cybersecurity governance structure with defined leadership roles must be established."},
    {"id": "3.2", "title": "Risk Management", "requirements": "Risk management framework with regular assessments and treatment plans must exist."},
  ]},
  {"section_num": 4, "section_title": "Identification Requirements", "subsections": [
    {"id": "4.1", "title": "Asset Management", "requirements": "Maintain a comprehensive inventory of all CII assets with ownership and classifications."},
  ]},
  {"section_num": 5, "section_title": "Protection Requirements", "subsections": [
    {"id": "5.1", "title": "Access Control", "requirements": "MFA and access control commensurate with risk profile must be implemented."},
    {"id": "5.3", "title": "Privileged Access Management", "requirements": "Privileged accounts must use MFA and be controlled."},
  ]},
]

def load_ccop_standards():
    """
    Loads CCoP controls from hierarchical JSON. Falls back to default list if missing.
    Returns list of sections, each with section_num, section_title, and subsections[].
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_path = os.path.join(script_dir, "data", "ccop_controls.json")
    if os.path.exists(json_path):
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading {json_path}: {e}")
    return DEFAULT_CONTROLS

def extract_pdf_text(file_path):
    """
    Extracts text from PDF using pypdf.
    """
    try:
        from pypdf import PdfReader
    except ImportError:
        print("[!] 'pypdf' missing. Install using: pip install pypdf")
        return None

    try:
        reader = PdfReader(file_path)
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text
    except Exception as e:
        print(f"Error parsing PDF: {e}")
        return None

def extract_docx_text(file_path):
    """
    Extracts text from DOCX files without python-docx using built-in zipfile/xml parser.
    """
    try:
        with zipfile.ZipFile(file_path) as docx:
            xml_content = docx.read('word/document.xml')
        root = ET.fromstring(xml_content)
        namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
        texts = []
        for elem in root.findall('.//w:t', namespaces):
            if elem.text:
                texts.append(elem.text)
        return ' '.join(texts)
    except Exception as e:
        print(f"Error parsing DOCX internally: {e}")
        return None


ensure_workspace_storage()

@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"status": "online", "service": "CCAS Auditor Backend", "api": "/api/analyze"})


@app.route("/api/templates/ccop/download", methods=["GET"])
def download_ccop_template():
    if not os.path.exists(CCOP_TEMPLATE_PDF_PATH):
        return jsonify({"error": "CCoP template file not found"}), 404

    return send_file(
        CCOP_TEMPLATE_PDF_PATH,
        as_attachment=True,
        download_name="CCoP_template.pdf",
        mimetype="application/pdf"
    )


@app.route("/api/runtime/health", methods=["GET"])
def runtime_health():
    models_url = f"{AI_SERVER_BASE_URL.rstrip('/')}/v1/models"
    try:
        response = requests.get(
            models_url,
            timeout=3,
            proxies={"http": None, "https": None}
        )
        reachable = response.status_code == 200
        return jsonify({
            "reachable": reachable,
            "label": "LM Studio reachable" if reachable else "LM Studio offline",
            "ai_server_base_url": AI_SERVER_BASE_URL
        }), (200 if reachable else 503)
    except requests.RequestException:
        return jsonify({
            "reachable": False,
            "label": "LM Studio offline",
            "ai_server_base_url": AI_SERVER_BASE_URL
        }), 503
    except Exception as error:
        return jsonify({
            "reachable": False,
            "label": "LM Studio offline",
            "ai_server_base_url": AI_SERVER_BASE_URL,
            "error": str(error)
        }), 503


@app.route("/api/workspaces", methods=["GET"])
def list_workspaces():
    records = load_workspace_index()
    return jsonify({"workspaces": [build_workspace_summary(record) for record in records]})


@app.route("/api/workspaces/<workspace_id>", methods=["GET"])
def get_workspace(workspace_id):
    payload = load_workspace_payload(workspace_id)
    if not payload:
        return jsonify({"error": "Workspace not found"}), 404
    return jsonify(payload)


@app.route("/api/workspaces/create", methods=["POST"])
def create_workspace():
    ensure_workspace_storage()
    data = request.get_json(silent=True) or {}
    requested_model = data.get("model", MODEL_ID)
    model_to_use = requested_model if requested_model in AVAILABLE_MODELS else MODEL_ID
    timestamp = now_iso()
    workspace_id = str(uuid.uuid4())
    requested_workspace_name = (data.get("workspace_name") or "").strip()
    workspace_name = requested_workspace_name or f"CCAS Workspace {datetime.now().strftime('%d%m%Y_%H%M%S')}"
    folder_path = workspace_folder_path(workspace_id)
    os.makedirs(folder_path, exist_ok=True)

    workspace_payload = {
        "workspace_id": workspace_id,
        "workspace_name": workspace_name,
        "created_at": timestamp,
        "updated_at": timestamp,
        "status": "draft",
        "workspace_folder_path": folder_path,
        "model": model_to_use,
        "model_label": model_to_use,
        "reports": []
    }
    workspace_payload, _ = normalize_workspace_payload(workspace_payload, workspace_id)
    save_workspace_payload(workspace_id, workspace_payload)
    upsert_workspace_record(workspace_payload["summary"])
    return jsonify(workspace_payload), 201


@app.route("/api/workspaces/<workspace_id>/reports", methods=["POST"])
def create_workspace_report(workspace_id):
    payload = load_workspace_payload(workspace_id)
    if not payload:
        return jsonify({"error": "Workspace not found"}), 404

    data = request.get_json(silent=True) or {}
    report_name = (data.get("report_name") or "").strip()
    if not report_name:
        return jsonify({"error": "Report name is required"}), 400

    requested_model = data.get("model") or payload.get("model") or MODEL_ID
    model_to_use = requested_model if requested_model in AVAILABLE_MODELS else MODEL_ID
    timestamp = now_iso()
    report_id = str(uuid.uuid4())
    report_record = normalize_report_record({
        "report_id": report_id,
        "report_name": report_name,
        "created_at": timestamp,
        "updated_at": timestamp,
        "status": "draft",
        "model": model_to_use,
        "model_label": model_to_use,
        "compliance_percentage": 0
    }, workspace_id, model_to_use, timestamp)

    os.makedirs(report_record["report_folder_path"], exist_ok=True)
    payload["reports"] = [report_record, *(payload.get("reports") or [])]
    payload["updated_at"] = timestamp
    payload["model"] = model_to_use
    payload["model_label"] = model_to_use
    payload, _ = normalize_workspace_payload(payload, workspace_id)
    save_workspace_payload(workspace_id, payload)
    upsert_workspace_record(payload["summary"])

    return jsonify({
        "workspace": payload,
        "report": build_report_summary(report_record)
    }), 201


@app.route("/api/workspaces/<workspace_id>", methods=["DELETE"])
def delete_workspace(workspace_id):
    payload = load_workspace_payload(workspace_id)
    if not payload:
        return jsonify({"error": "Workspace not found"}), 404

    delete_workspace_record(workspace_id)
    folder_path = workspace_folder_path(workspace_id)
    if os.path.exists(folder_path):
        shutil.rmtree(folder_path, ignore_errors=True)

    return jsonify({"status": "deleted", "workspace_id": workspace_id})


@app.route("/api/workspaces/<workspace_id>/report", methods=["POST"])
def save_workspace_report(workspace_id):
    report_file = request.files.get("report")
    if report_file is None or report_file.filename == "":
        return jsonify({"error": "No PDF report uploaded"}), 400

    payload = load_workspace_payload(workspace_id)
    if not payload:
        return jsonify({"error": "Workspace not found"}), 404

    report_id = (request.form.get("report_id") or "").strip()
    report_record, report_index = find_workspace_report(payload, report_id)
    if not report_record:
        return jsonify({"error": "Report not found in workspace"}), 404

    folder_path = report_record.get("report_folder_path") or report_folder_path(workspace_id, report_record["report_id"])
    os.makedirs(folder_path, exist_ok=True)
    report_filename = sanitize_filename(report_file.filename or f"{report_record['report_id']}.pdf")
    report_path = os.path.join(folder_path, report_filename)
    report_file.save(report_path)

    timestamp = now_iso()
    report_record["report_file_name"] = report_filename
    report_record["report_file_path"] = report_path
    report_record["updated_at"] = timestamp
    payload["reports"][report_index] = normalize_report_record(
        report_record,
        workspace_id,
        report_record.get("model") or payload.get("model"),
        report_record.get("created_at") or payload.get("created_at")
    )
    payload["updated_at"] = timestamp
    payload, _ = normalize_workspace_payload(payload, workspace_id)
    save_workspace_payload(workspace_id, payload)
    upsert_workspace_record(payload["summary"])

    return jsonify({
        "workspace_id": workspace_id,
        "report_id": report_record["report_id"],
        "report_file_path": report_path,
        "message": "PDF report stored successfully"
    })


@app.route("/api/workspaces/<workspace_id>/reports/<report_id>/download", methods=["GET"])
def download_workspace_report(workspace_id, report_id):
    payload = load_workspace_payload(workspace_id)
    if not payload:
        return jsonify({"error": "Workspace not found"}), 404

    report_record, _ = find_workspace_report(payload, report_id)
    if not report_record:
        return jsonify({"error": "Report not found in workspace"}), 404

    report_path = report_record.get("report_file_path")
    report_name = report_record.get("report_file_name") or f"{report_id}.pdf"
    if not report_path or not os.path.exists(report_path):
        return jsonify({"error": "Generated PDF report not found"}), 404

    return send_file(
        report_path,
        as_attachment=True,
        download_name=report_name,
        mimetype="application/pdf"
    )

@app.route("/api/analyze", methods=["POST"])
def analyze_compliance():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    uploaded_file = request.files["file"]
    requested_model = request.form.get("model", MODEL_ID)
    model_to_use = requested_model if requested_model in AVAILABLE_MODELS else MODEL_ID
    if uploaded_file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    ext = uploaded_file.filename.split(".").pop().lower()
    if ext not in ["pdf", "docx"]:
        return jsonify({"error": "Unsupported file format. Please upload a PDF or DOCX file."}), 400

    ensure_workspace_storage()
    requested_workspace_id = request.form.get("workspace_id", "").strip()
    requested_report_id = request.form.get("report_id", "").strip()
    existing_workspace = load_workspace_payload(requested_workspace_id) if requested_workspace_id else None
    workspace_id = requested_workspace_id if existing_workspace else str(uuid.uuid4())
    workspace_name = (
        existing_workspace.get("workspace_name")
        if existing_workspace and existing_workspace.get("workspace_name")
        else f"CCAS Workspace {datetime.now().strftime('%d%m%Y_%H%M%S')}"
    )
    if not existing_workspace:
        existing_workspace = {
            "workspace_id": workspace_id,
            "workspace_name": workspace_name,
            "created_at": now_iso(),
            "updated_at": now_iso(),
            "status": "draft",
            "workspace_folder_path": workspace_folder_path(workspace_id),
            "model": model_to_use,
            "model_label": model_to_use,
            "reports": []
        }
        existing_workspace, _ = normalize_workspace_payload(existing_workspace, workspace_id)

    report_record, report_index = find_workspace_report(existing_workspace, requested_report_id)
    if not report_record:
        timestamp = now_iso()
        report_record = normalize_report_record({
            "report_id": requested_report_id or str(uuid.uuid4()),
            "report_name": (request.form.get("report_name") or "").strip() or build_default_report_name(uploaded_file.filename),
            "created_at": timestamp,
            "updated_at": timestamp,
            "status": "draft",
            "model": model_to_use,
            "model_label": model_to_use
        }, workspace_id, model_to_use, timestamp)
        existing_workspace["reports"] = [report_record, *(existing_workspace.get("reports") or [])]
        report_index = 0

    folder_path = report_record.get("report_folder_path") or report_folder_path(workspace_id, report_record["report_id"])
    os.makedirs(folder_path, exist_ok=True)
    safe_upload_name = sanitize_filename(uploaded_file.filename)
    temp_file_path = os.path.join(folder_path, safe_upload_name)
    uploaded_file.save(temp_file_path)

    # Extract text content
    print(f"[*] Extracting text from uploaded file: {uploaded_file.filename}...")
    extracted_text = None
    if ext == "pdf":
        extracted_text = extract_pdf_text(temp_file_path)
        if not extracted_text:
            return jsonify({
                "error": "Failed to parse PDF. Please ensure the 'pypdf' package is installed on the host: 'pip install pypdf'"
            }), 500
    else:
        extracted_text = extract_docx_text(temp_file_path)

    if not extracted_text or len(extracted_text.strip()) == 0:
        return jsonify({"error": "The uploaded document contains no readable text."}), 400

    # Load CCoP hierarchical controls
    sections = load_ccop_standards()

    # Build flat subsection list and checklist string for the prompt
    all_subsections = []
    for section in sections:
        for sub in section.get("subsections", []):
            all_subsections.append({
                "section_num": section["section_num"],
                "section_title": section["section_title"],
                "id": sub["id"],
                "title": sub["title"],
                "requirements": sub.get("requirements", "")
            })

    total_subsections = len(all_subsections)

    # Build checklist string — include requirements and topic keyword hints for semantic matching
    checklist_str = "\n".join([
        (
            f"  [{sub['id']}] {sub['title']} "
            f"(Topics/keywords to search for: {', '.join(sub.get('topics', [])) if sub.get('topics') else 'see requirements'}) "
            f"— Requirement: {sub['requirements'][:200]}"
        )
        for sub in all_subsections
    ])


    # Construct system prompt with explicit semantic matching instructions
    system_prompt = (
        "You are an expert Cybersecurity Auditor assessing compliance against the CCoP "
        "(Cybersecurity Code of Practice) v2.1 for Critical Information Infrastructure Owners (CIIOs).\n\n"

        "=== CRITICAL INSTRUCTION: SEMANTIC TOPIC MATCHING ===\n"
        "The uploaded plan document will NOT use the same section titles or numbering as the CCoP standard.\n"
        "You MUST search the entire document text for CONTENT and CONCEPTS that correspond to each CCoP control,\n"
        "regardless of how the document is organised or what its sections are called.\n\n"
        "For example:\n"
        "  - A document section titled 'User Authentication' covers CCoP 5.1 (Access Control)\n"
        "  - A section titled 'IT Risk Review' covers CCoP 3.2 (Risk Management)\n"
        "  - A section titled 'Backup Procedures' covers CCoP 8.1 (Backup and Restoration Plan)\n"
        "  - A section titled 'Staff Security Training' covers CCoP 9.1 (Cybersecurity Awareness Programme)\n"
        "Do NOT require the document to have the same section title as the CCoP. Look for the TOPIC and SUBSTANCE.\n\n"

        "=== AUDIT RULES ===\n"
        f"1. Audit ALL {total_subsections} CCoP subsections below. Do NOT skip any.\n"
        "2. For each subsection, read the FULL uploaded plan text and look for any content that addresses\n"
        "   the topic, concept, or requirement described — even if it uses different words or appears\n"
        "   in a different section of the plan.\n"
        "3. Assign one of exactly three statuses:\n"
        "   - 'compliant': The plan adequately addresses the topic and satisfies the requirement.\n"
        "   - 'partial': The plan mentions or partially addresses the topic but is missing key details or elements.\n"
        "   - 'non-compliant': The plan has NO content at all related to this topic, or the content present\n"
        "     is so inadequate it cannot be considered addressed.\n"
        "4. For 'partial' or 'non-compliant', provide a 'proposed_solution' with specific steps to fix the gap.\n"
        "5. In the 'description' field, cite what you found (or didn't find) in the uploaded plan text.\n"
        "6. Group all subsection results under their parent section.\n"
        "7. Set each section's overall_status:\n"
        "   - 'compliant' if ALL subsections in that section are compliant.\n"
        "   - 'partial' if any subsection is partial but none are non-compliant.\n"
        "   - 'non-compliant' if any subsection is non-compliant.\n"
        "8. compliance_percentage = (count of 'compliant' subsections / total subsections) * 100, rounded.\n\n"

        "Return ONLY raw JSON, no markdown, no commentary, in this EXACT format:\n"
        "{\n"
        '  "compliance_percentage": 72,\n'
        '  "sections": [\n'
        '    {\n'
        '      "section_num": 3,\n'
        '      "section_title": "Governance Requirements",\n'
        '      "overall_status": "partial",\n'
        '      "subsections": [\n'
        '        {\n'
        '          "id": "3.1",\n'
        '          "title": "Leadership and Oversight",\n'
        '          "status": "compliant",\n'
        '          "description": "Found in plan under \'Project Organisation\': defines Cybersecurity Manager, IT Security Officer and steering roles."\n'
        '        },\n'
        '        {\n'
        '          "id": "3.2",\n'
        '          "title": "Risk Management",\n'
        '          "status": "partial",\n'
        '          "description": "Plan mentions annual risk reviews in Section 4 but lacks a formal risk treatment plan with owners and timelines.",\n'
        '          "proposed_solution": "Add a Risk Treatment Plan appendix defining each identified risk, its owner, mitigation action, target date, and residual risk acceptance."\n'
        '        }\n'
        '      ]\n'
        '    }\n'
        '  ]\n'
        "}\n"
    )

    user_content = (
        f"CCoP SUBSECTION CHECKLIST — audit ALL {total_subsections} items using semantic topic matching:\n"
        f"{checklist_str}\n\n"
        f"UPLOADED CYBERSECURITY PLAN TEXT (search the entire text below for relevant content):\n"
        f"{extracted_text[:400000]}\n\n"
        "Audit every subsection by finding related content anywhere in the uploaded plan text. "
        "Do NOT require matching section titles. Return raw JSON only."
    )




    print("[*] Contacting LM Studio API...")
    print(f"[*] Using LM Studio model: {model_to_use}")
    raw_completion = ""
    try:
        for attempt in range(1, MAX_UNSTRUCTURED_RESPONSE_RETRIES + 1):
            response = requests.post(
                LM_STUDIO_URL,
                json={
                    "model": model_to_use,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    "temperature": 0.2
                },
                timeout=600,
                proxies={"http": None, "https": None}

            )

            if response.status_code != 200:
                return jsonify({"error": f"LM Studio API responded with error status: {response.status_code}"}), 502

            response_data = response.json()
            raw_completion = response_data["choices"][0]["message"]["content"]

            # Clean up code blocks if model output it inside ```json ... ```
            cleaned_json = raw_completion.strip()
            if cleaned_json.startswith("```"):
                cleaned_json = re.sub(r"^```(?:json)?\n", "", cleaned_json)
                cleaned_json = re.sub(r"\n```$", "", cleaned_json)
                cleaned_json = cleaned_json.strip()

            try:
                audit_results = json.loads(cleaned_json)
                timestamp = now_iso()
                report_record["status"] = "completed"
                report_record["document_name"] = uploaded_file.filename
                report_record["upload_file_name"] = safe_upload_name
                report_record["upload_file_path"] = temp_file_path
                report_record["report_folder_path"] = folder_path
                report_record["model"] = model_to_use
                report_record["model_label"] = model_to_use
                report_record["compliance_percentage"] = audit_results.get("compliance_percentage", 0)
                report_record["audit_result"] = audit_results
                report_record["updated_at"] = timestamp

                existing_workspace["workspace_id"] = workspace_id
                existing_workspace["workspace_name"] = workspace_name
                existing_workspace["workspace_folder_path"] = workspace_folder_path(workspace_id)
                existing_workspace["updated_at"] = timestamp
                existing_workspace["model"] = model_to_use
                existing_workspace["model_label"] = model_to_use
                existing_workspace["reports"][report_index] = report_record
                workspace_payload, _ = normalize_workspace_payload(existing_workspace, workspace_id)
                save_workspace_payload(workspace_id, workspace_payload)
                upsert_workspace_record(workspace_payload["summary"])
                response_payload = dict(audit_results)
                response_payload["workspace_id"] = workspace_id
                response_payload["workspace_name"] = workspace_name
                response_payload["workspace_folder_path"] = workspace_folder_path(workspace_id)
                response_payload["report_id"] = report_record["report_id"]
                response_payload["report_name"] = report_record["report_name"]
                response_payload["upload_file_path"] = temp_file_path
                response_payload["report_file_path"] = report_record.get("report_file_path")
                return jsonify(response_payload)
            except json.JSONDecodeError as e:
                print(f"[!] JSON parsing failed on attempt {attempt}/{MAX_UNSTRUCTURED_RESPONSE_RETRIES}: {e}\nRaw output: {raw_completion}")
                if attempt < MAX_UNSTRUCTURED_RESPONSE_RETRIES:
                    print("[*] Retrying LM Studio request due to unstructured response...")
                    time.sleep(1)
                    continue

                return jsonify({
                    "error": "The AI model returned an unstructured response after automatic retries. Please re-run the assessment.",
                    "raw_output": raw_completion[:200]
                }), 502

    except requests.exceptions.Timeout as e:
        print(f"[!] Request timed out: {e}")
        return jsonify({"error": "LM Studio took too long to respond (timeout). Your document is being analyzed, but the local model is running slowly. Try allocating more GPU layers in LM Studio."}), 504
    except requests.exceptions.RequestException as e:
        print(f"[!] Connection failed: {e}")
        return jsonify({"error": f"Failed to connect to LM Studio API at {AI_SERVER_BASE_URL}. Please verify it is running and accessible."}), 502

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    print(f"[*] Starting CCAS Auditor Server on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
