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
MODEL_ID = "ornith-1.0-35b"



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
        f"{extracted_text[:9000]}\n\n"
        "Audit every subsection by finding related content anywhere in the uploaded plan text. "
        "Do NOT require matching section titles. Return raw JSON only."
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
