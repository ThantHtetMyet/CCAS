# Debug Session: nssm-service-failure
- **Status**: [OPEN]
- **Issue**: `python app.py` starts successfully in an interactive shell, but the backend fails when started through NSSM as a Windows service.
- **Debug Server**: Pending
- **Log File**: `.dbg/trae-debug-log-nssm-service-failure.ndjson`

## Reproduction Steps
1. Start the backend manually with `python app.py` from `CCAS-Agent`.
2. Confirm the Flask app starts and serves requests.
3. Start the backend through NSSM.
4. Observe that the NSSM-hosted service fails or does not behave like the manual run.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | NSSM uses a different startup directory, so relative paths like `storage_config.json` or data folders resolve incorrectly. | High | Low | Pending |
| B | NSSM runs a different Python interpreter or virtual environment than the one used by the successful manual command. | High | Low | Pending |
| C | NSSM runs under a Windows account that lacks permission to read project files or bind the port. | Medium | Medium | Pending |
| D | NSSM does not pass required environment variables or `PATH`, causing dependency/import/runtime differences. | Medium | Medium | Pending |
| E | NSSM launches successfully, but stdout/stderr is hidden, so the actual startup exception has not been captured yet. | High | Low | Pending |

## Log Evidence
- `py -3.14 app.py` starts successfully from `CCAS-Agent` and binds to `http://127.0.0.1:5000`.
- In the shell environment used for inspection, `python` resolves to `C:\Users\thanthtet.myet\AppData\Local\Microsoft\WindowsApps\python.exe`, which is only the Microsoft Store alias and does not start the real interpreter.
- The real interpreter exists at `C:\Users\thanthtet.myet\AppData\Local\Programs\Python\Python314\python.exe`.

## Verification Conclusion
- Hypothesis B is strongly supported: using plain `python` is unsafe because it may resolve differently between user and service sessions.
- Hypothesis A remains highly likely until the NSSM `AppDirectory` is confirmed to be `CCAS-Agent`.
- Hypothesis E remains open because NSSM stdout/stderr has not been captured yet.
