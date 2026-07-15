import os
import json
import re
import zipfile
import xml.etree.ElementTree as ET
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS

# Prevent proxy interception for local network and LM Studio endpoints
os.environ['NO_PROXY'] = '192.3.71.67,127.0.0.1,localhost'
os.environ['no_proxy'] = '192.3.71.67,127.0.0.1,localhost'

app = Flask(__name__)
CORS(app) # Allow cross-origin requests from React dev server (port 5173)

LM_STUDIO_URL = "http://192.3.71.67:1234/v1/chat/completions"
MODEL_ID = "qwen-3-14b-instruct:2"

# Fallback CCoP controls if prepared JSON is missing
DEFAULT_CONTROLS = [
  {"id": "A.1", "title": "Cybersecurity Governance and Leadership", "reqs": "Define clear cybersecurity roles, assign responsibilities to Project Managers/Security Officers, and set up a governance steering committee."},
  {"id": "A.2", "title": "Asset Management", "reqs": "Establish a centralized, up-to-date registry of hardware/software assets with designated owners and security classifications."},
  {"id": "A.4", "title": "Access Control", "reqs": "Enforce strong authentication mechanisms, mandatory Multi-Factor Authentication (MFA) for administrative gateways, and privilege escalation logging."},
  {"id": "A.5", "title": "Communications and Operations Security", "reqs": "Implement network firewalls, encrypted communication tunnels (TLS 1.3/SSH v2), security logging, and monitoring checks."},
  {"id": "A.7", "title": "Cybersecurity Incident Management", "reqs": "Formulate a formal incident response plan (IRP) with clear escalation hierarchies, contact details, and response procedures."},
  {"id": "A.10", "title": "Business Continuity and Disaster Recovery", "reqs": "Document data backup frequency, retention intervals, and define schedule plans for disaster recovery (DR) simulations."},
  {"id": "A.12", "title": "Cryptographic Controls", "reqs": "Establish rules for data encryption (AES-256 for resting data) and robust key management policies."}
]

def load_ccop_standards():
    """
    Loads CCoP controls from JSON database. Falls back to default list if missing.
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

@app.route("/api/analyze", methods=["POST"])
def analyze_compliance():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    uploaded_file = request.files["file"]
    if uploaded_file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    ext = uploaded_file.filename.split(".").pop().lower()
    if ext not in ["pdf", "docx"]:
        return jsonify({"error": "Unsupported file format. Please upload a PDF or DOCX file."}), 400

    # Save file temporarily
    script_dir = os.path.dirname(os.path.abspath(__file__))
    temp_dir = os.path.join(script_dir, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    temp_file_path = os.path.join(temp_dir, uploaded_file.filename)
    uploaded_file.save(temp_file_path)

    # Extract text content
    print(f"[*] Extracting text from uploaded file: {uploaded_file.filename}...")
    extracted_text = None
    if ext == "pdf":
        extracted_text = extract_pdf_text(temp_file_path)
        # Fallback if pypdf is missing or failed
        if not extracted_text:
            os.remove(temp_file_path)
            return jsonify({
                "error": "Failed to parse PDF. Please ensure the 'pypdf' package is installed on the host: 'pip install pypdf'"
            }), 500
    else:
        extracted_text = extract_docx_text(temp_file_path)

    # Clean up temp file
    if os.path.exists(temp_file_path):
        os.remove(temp_file_path)

    if not extracted_text or len(extracted_text.strip()) == 0:
        return jsonify({"error": "The uploaded document contains no readable text."}), 400

    # Load CCoP controls
    controls = load_ccop_standards()

    # Build explicit numbered control checklist to force AI to audit ALL of them
    control_ids_list = "\n".join([
        f"  - {c.get('id', 'A.x')}: {c.get('title', '')}"
        for c in controls
    ])
    controls_detail = "\n".join([
        f"Control {c.get('id', 'A.x')} - {c.get('title', '')}:\n  Requirements: {c.get('requirements', c.get('reqs', ''))[:300]}"
        for c in controls
    ])

    # Construct Qwen system prompt & audit prompt
    system_prompt = (
        "You are an expert Cybersecurity Auditor. Your task is to audit an uploaded Cybersecurity Plan "
        "against the CCoP (Cybersecurity Code of Practice) standard template.\n\n"
        "IMPORTANT RULES:\n"
        "1. You MUST audit and return EVERY SINGLE control listed in the reference checklist, without skipping any.\n"
        "2. For each control, assess one of exactly three statuses:\n"
        "   - 'compliant': The uploaded plan fully covers this control's requirements.\n"
        "   - 'partial': The uploaded plan mentions or addresses this section but is missing some points or details.\n"
        "   - 'non-compliant': The uploaded plan does not mention or address this section at all, or fails to meet it entirely.\n"
        "3. If status is 'partial' or 'non-compliant', you MUST provide a 'proposed_solution' field explaining exactly what is missing and how to fix it.\n"
        "4. compliance_percentage = (number of 'compliant' controls / total controls) * 100, rounded to nearest integer.\n\n"
        "Return ONLY raw JSON in this exact format, no markdown, no intro text:\n"
        "{\n"
        '  "compliance_percentage": 78,\n'
        '  "all_sections": [\n'
        '    {\n'
        '      "id": "A.1",\n'
        '      "title": "Cybersecurity Governance and Leadership",\n'
        '      "status": "compliant",\n'
        '      "description": "The plan defines clear roles and governance structure meeting CCoP requirements."\n'
        '    },\n'
        '    {\n'
        '      "id": "A.2",\n'
        '      "title": "Asset Management",\n'
        '      "status": "partial",\n'
        '      "description": "The plan mentions asset inventory but lacks security classification and designated owners.",\n'
        '      "proposed_solution": "Add asset classification levels (Critical/High/Medium/Low) and assign named owners for each asset category to fully comply."\n'
        '    },\n'
        '    {\n'
        '      "id": "A.4",\n'
        '      "title": "Access Control",\n'
        '      "status": "non-compliant",\n'
        '      "description": "The uploaded plan does not contain any section addressing access control or authentication policies.",\n'
        '      "proposed_solution": "Create a dedicated Access Control section. Define MFA requirements for all administrative access, password policy standards, and privilege escalation review schedules."\n'
        '    }\n'
        '  ]\n'
        "}\n"
    )

    user_content = (
        f"REFERENCE CONTROL CHECKLIST - You MUST output a result for EACH of these {len(controls)} controls:\n"
        f"{control_ids_list}\n\n"
        f"DETAILED CONTROL REQUIREMENTS:\n{controls_detail}\n\n"
        f"UPLOADED PLAN TEXT:\n{extracted_text[:10000]}\n\n"
        f"Audit every single control listed above. Return raw JSON only."
    )

    print("[*] Contacting LM Studio API...")
    try:
        response = requests.post(
            LM_STUDIO_URL,
            json={
                "model": MODEL_ID,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_content}
                ],
                "temperature": 0.2
            },
            timeout=180,
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

        # Parse output as JSON
        audit_results = json.loads(cleaned_json)
        return jsonify(audit_results)

    except requests.exceptions.Timeout as e:
        print(f"[!] Request timed out: {e}")
        return jsonify({"error": "LM Studio took too long to respond (timeout). Your document is being analyzed, but the local model is running slowly. Try allocating more GPU layers in LM Studio."}), 504
    except requests.exceptions.RequestException as e:
        print(f"[!] Connection failed: {e}")
        return jsonify({"error": "Failed to connect to LM Studio API at 192.3.71.67:1234. Please verify it is running and accessible."}), 502
    except json.JSONDecodeError as e:
        print(f"[!] JSON parsing failed: {e}\nRaw output: {raw_completion}")
        return jsonify({
            "error": "The AI model returned an unstructured response. Please re-run the assessment.",
            "raw_output": raw_completion[:200]
        }), 502

if __name__ == "__main__":
    print("[*] Starting CCAS Auditor Server on http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
