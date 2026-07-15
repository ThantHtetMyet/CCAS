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
    controls_summary = "\n".join([
        f"- Control {c.get('id', 'A.x')}: {c.get('title', '')} (Requirements: {c.get('requirements', c.get('reqs', ''))[:200]}...)"
        for c in controls
    ])

    # Construct Qwen system prompt & audit prompt
    system_prompt = (
        "You are an expert Cybersecurity Auditor. Your job is to check if an uploaded "
        "Cybersecurity Plan document complies with our CCoP (Cybersecurity Code of Practice) template.\n"
        "Analyze the document text and cross-reference it against the provided controls.\n"
        "Calculate a compliance score based on how many controls are fully met (roughly percentage score).\n"
        "Return a JSON format exactly as follows, with no additional formatting, introduction, markdown blocks, or wraps:\n"
        "{\n"
        '  "compliance_percentage": 78,\n'
        '  "all_sections": [\n'
        '    {\n'
        '      "id": "A.1",\n'
        '      "title": "Cybersecurity Governance and Leadership",\n'
        '      "compliant": true,\n'
        '      "description": "Proof from the plan showing they defined steering roles."\n'
        '    },\n'
        '    {\n'
        '      "id": "A.2",\n'
        '      "title": "Asset Management",\n'
        '      "compliant": false,\n'
        '      "description": "Detailed explanation of what section is missing or wrong in the plan.",\n'
        '      "proposed_solution": "Remediation step or solution description to fix this gap and comply."\n'
        '    }\n'
        '  ]\n'
        "}\n"
        "Be sure to audit and list EVERY SINGLE reference control provided in the prompt. "
        "Do not include any extra chat dialogue. Output ONLY raw JSON."
    )

    user_content = (
        f"CCoP Standard Reference Controls:\n{controls_summary}\n\n"
        f"Uploaded Cybersecurity Plan Text (Excerpt):\n{extracted_text[:12000]}\n\n" # Limit text input to stay safe on context lengths
        "Perform audit and output raw JSON compliance metrics."
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
